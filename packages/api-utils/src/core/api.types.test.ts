import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  getStatusCodeFromResponse,
  isApiResponse,
  isErrorResponse,
  ResponseBuilder,
} from './api.types.js';

describe('createErrorResponse overloads', () => {
  it('accepts (code, options) and resolves message/code correctly', () => {
    const res = createErrorResponse(ErrorCode.NOT_FOUND, { message: 'User not found' });
    expect(res.success).toBe(false);
    expect(res.message).toBe('User not found');
    expect(res.errors).toEqual([{ code: ErrorCode.NOT_FOUND, message: 'User not found' }]);
  });

  it('falls back to a sensible default message when none is given', () => {
    const res = createErrorResponse(ErrorCode.UNAUTHORIZED);
    expect(res.message).toBe('Unauthorized');
    expect(res.errors?.[0].code).toBe(ErrorCode.UNAUTHORIZED);
  });

  it('accepts an ApiError[] directly', () => {
    const res = createErrorResponse(
      [{ code: ErrorCode.CONFLICT, message: 'dup', field: 'email' }],
      { message: 'Conflict' }
    );
    expect(res.errors).toHaveLength(1);
    expect(res.errors?.[0].field).toBe('email');
  });

  it('carries field/details/path through to the single-error case', () => {
    const res = createErrorResponse(ErrorCode.BAD_REQUEST, {
      field: 'age',
      details: 'must be positive',
      path: ['body', 'age'],
    });
    expect(res.errors?.[0]).toMatchObject({
      field: 'age',
      details: 'must be positive',
      path: ['body', 'age'],
    });
  });
});

describe('createSuccessResponse / createValidationErrorResponse / createNotFoundResponse', () => {
  it('builds a success envelope', () => {
    const res = createSuccessResponse({ id: 1 }, 'Loaded');
    expect(res).toMatchObject({ success: true, message: 'Loaded', data: { id: 1 } });
  });

  it('builds field-level validation errors with UNPROCESSABLE_ENTITY by default', () => {
    const res = createValidationErrorResponse([{ field: 'email', message: 'Invalid' }]);
    expect(res.errors?.[0].code).toBe(ErrorCode.UNPROCESSABLE_ENTITY);
  });

  it('includes the id in the not-found message when provided', () => {
    const res = createNotFoundResponse('User', 'abc-123');
    expect(res.message).toContain('abc-123');
  });
});

describe('getStatusCodeFromResponse', () => {
  it('maps 200 for success, the right code for known errors, 500 for unknown', () => {
    expect(getStatusCodeFromResponse(createSuccessResponse({}))).toBe(200);
    expect(getStatusCodeFromResponse(createErrorResponse(ErrorCode.NOT_FOUND))).toBe(404);
    expect(
      getStatusCodeFromResponse(createErrorResponse([{ code: 'MADE_UP', message: 'x' }]))
    ).toBe(500);
  });
});

describe('type guards', () => {
  it('isApiResponse / isErrorResponse', () => {
    expect(isApiResponse(createSuccessResponse({}))).toBe(true);
    expect(isApiResponse({ foo: 'bar' })).toBe(false);
    expect(isErrorResponse(createSuccessResponse({}))).toBe(false);
    expect(isErrorResponse(createErrorResponse(ErrorCode.BAD_REQUEST))).toBe(true);
  });
});

describe('ResponseBuilder', () => {
  it('requires data only for success responses', () => {
    const errRes = new ResponseBuilder().withSuccess(false).withMessage('nope').build();
    expect(errRes.data).toBeNull();

    expect(() =>
      new ResponseBuilder().withSuccess(true).withMessage('ok').build()
    ).toThrowError('Data is required for success responses');
  });

  it('static error() accepts a plain string', () => {
    const res = ResponseBuilder.error('boom');
    expect(res.errors?.[0].code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(res.errors?.[0].message).toBe('boom');
  });
});
