import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiClient } from './client.js';
import { ErrorCode } from '../core/api.types.js';

describe('ApiClient.request', () => {
  let originalFetch: typeof fetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('returns the server ApiResponse on success', async () => {
    const serverResponse = { success: true, message: 'ok', data: { id: 1 }, timestamp: new Date().toISOString() };
    global.fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => serverResponse }) as any;

    const client = new ApiClient({ baseUrl: '' });
    expect(await client.get('/things/1')).toEqual(serverResponse);
  });

  it('does not throw a ReferenceError on a network failure (regression: timeoutId was out of scope in the catch block)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as any;

    const client = new ApiClient({ baseUrl: '', retryCount: 0 });
    const result = await client.get('/unreachable');

    expect(result.success).toBe(false);
    expect(result.message).toBe('ECONNREFUSED');
    expect(result.errors?.[0].code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('returns a "Request timed out" response on abort', async () => {
    const abortError = new Error('aborted');
    abortError.name = 'AbortError';
    global.fetch = vi.fn().mockRejectedValue(abortError) as any;

    const client = new ApiClient({ baseUrl: '', timeout: 5, retryCount: 0 });
    const result = await client.get('/slow');

    expect(result.message).toBe('Request timed out');
    expect(result.errors?.[0].code).toBe(ErrorCode.SERVICE_UNAVAILABLE);
  });

  it('retries on failure up to retryCount, then returns an error response (not a thrown exception)', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls++;
      return Promise.reject(new Error('flaky'));
    }) as any;

    const client = new ApiClient({ baseUrl: '', retryCount: 2, retryDelay: 1 });
    const result = await client.get('/flaky');

    expect(calls).toBe(3); // initial attempt + 2 retries
    expect(result.success).toBe(false);
  });

  it('succeeds after a retry if a later attempt works', async () => {
    let calls = 0;
    global.fetch = vi.fn().mockImplementation(() => {
      calls++;
      if (calls < 2) return Promise.reject(new Error('flaky'));
      return Promise.resolve({
        ok: true,
        json: async () => ({ success: true, message: 'ok', data: {}, timestamp: new Date().toISOString() }),
      });
    }) as any;

    const client = new ApiClient({ baseUrl: '', retryCount: 2, retryDelay: 1 });
    const result = await client.get('/eventually-ok');

    expect(result.success).toBe(true);
    expect(calls).toBe(2);
  });
});
