import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  apiResponseMiddleware,
  apiErrorMiddleware,
  corsMiddleware,
  rateLimitExceeded,
  validateRequestRules,
} from './middleware.js';
import { ErrorCode } from '../core/api.types.js';

function mockResponse() {
  const res: any = { headers: {} as Record<string, string>, headersSent: false, statusCode: 200 };
  res.header = vi.fn((name: string, value: string) => { res.headers[name] = value; return res; });
  res.status = vi.fn((code: number) => { res.statusCode = code; return res; });
  res.json = vi.fn((_body: any) => res);
  res.send = vi.fn((_body?: any) => res);
  res.sendStatus = vi.fn((_code: number) => res);
  res.setHeader = vi.fn();
  return res;
}

function mockRequest(overrides: Partial<{ headers: Record<string, string>; method: string; body: any; query: any; params: any }> = {}) {
  const headers = overrides.headers || {};
  return {
    method: overrides.method || 'GET',
    header: (name: string) => headers[name],
    headers,
    body: overrides.body || {},
    query: overrides.query || {},
    params: overrides.params || {},
  } as any;
}

describe('apiResponseMiddleware (duration correctness)', () => {
  it('produces a finite, non-NaN duration even with no options set (regression: duration was NaN unless enableRequestLogging was also true)', () => {
    const req = mockRequest();
    const res: any = { headersSent: false, statusCode: 200, setHeader: vi.fn(), send: vi.fn() };
    let captured: any;
    res.json = (body: any) => { captured = body; };

    const middleware = apiResponseMiddleware(); // no options at all
    middleware(req, res, vi.fn());
    res.json({ hello: 'world' });

    expect(captured.success).toBe(true);
    expect(typeof captured.duration).toBe('number');
    expect(Number.isNaN(captured.duration)).toBe(false);
  });

  it('passes an already-formed ApiResponse through unchanged', () => {
    const req = mockRequest();
    const res: any = { headersSent: false, statusCode: 200, setHeader: vi.fn(), send: vi.fn() };
    let captured: any;
    res.json = (body: any) => { captured = body; };

    const middleware = apiResponseMiddleware();
    middleware(req, res, vi.fn());
    const alreadyFormed = { success: true, message: 'x', data: null, timestamp: 't' };
    res.json(alreadyFormed);

    expect(captured).toBe(alreadyFormed);
  });
});

describe('apiErrorMiddleware', () => {
  const originalEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = originalEnv; });

  it('uses UNPROCESSABLE_ENTITY/422 for a ValidationError (regression: used to be BAD_REQUEST/400, inconsistent with validateRequestRules/validateRequestSchema)', () => {
    const res = mockResponse();
    const middleware = apiErrorMiddleware();
    middleware({ name: 'ValidationError', message: 'name is required' }, mockRequest(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(422);
    const body = res.json.mock.calls[0][0];
    expect(body.errors[0].code).toBe(ErrorCode.UNPROCESSABLE_ENTITY);
    expect(body.message).toBe('name is required');
  });

  it('does not leak an internal error message in production for an unrecognized error', () => {
    process.env.NODE_ENV = 'production';
    const res = mockResponse();
    const middleware = apiErrorMiddleware();
    middleware(new Error('db password wrong'), mockRequest(), res, vi.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('Internal server error');
  });

  it('surfaces the real message in development', () => {
    process.env.NODE_ENV = 'development';
    const res = mockResponse();
    const middleware = apiErrorMiddleware();
    middleware(new Error('helpful detail'), mockRequest(), res, vi.fn());

    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('helpful detail');
  });
});

describe('rateLimitExceeded', () => {
  it('returns 429 with the correct code', () => {
    const res = mockResponse();
    rateLimitExceeded(mockRequest(), res);
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].errors[0].code).toBe(ErrorCode.TOO_MANY_REQUESTS);
  });
});

describe('corsMiddleware', () => {
  const originalEnv = process.env.ALLOWED_ORIGINS;
  afterEach(() => { process.env.ALLOWED_ORIGINS = originalEnv; });

  it('never combines wildcard origin with credentials', () => {
    delete process.env.ALLOWED_ORIGINS;
    const res = mockResponse();
    corsMiddleware(mockRequest({ headers: { Origin: 'https://anywhere.example' } }), res, vi.fn());
    expect(res.headers['Access-Control-Allow-Origin']).toBe('*');
    expect(res.headers['Access-Control-Allow-Credentials']).toBeUndefined();
  });

  it('reflects an allow-listed origin with credentials enabled', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    const res = mockResponse();
    corsMiddleware(mockRequest({ headers: { Origin: 'https://app.example.com' } }), res, vi.fn());
    expect(res.headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(res.headers['Access-Control-Allow-Credentials']).toBe('true');
  });
});

describe('validateRequestRules (Express integration for ValidationRules)', () => {
  it('responds 422 on invalid input and never calls next()', async () => {
    const res = mockResponse();
    const next = vi.fn();
    const middleware = validateRequestRules({ email: { string: true, email: true, required: true } });

    await middleware(mockRequest({ body: { email: 'not-an-email' } }), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(422);
  });

  it('calls next() and replaces req.body with validated/coerced data on success', async () => {
    const res = mockResponse();
    const next = vi.fn();
    const middleware = validateRequestRules({ page: { number: true, required: false } });
    const req = mockRequest({ query: { page: '3' } });

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.body.page).toBe(3);
  });
});
