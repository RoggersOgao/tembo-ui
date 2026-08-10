/**
 * Core API types - no external dependencies
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  timestamp: string;
  errors?: ApiError[];
  metadata?: ApiMetadata;
  pagination?: PaginationInfo;
  correlationId?: string;
  version?: string;
  duration?: number;
}

export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: string;
  stack?: string;
  path?: string[];
}

export interface ApiMetadata {
  userId?: string;
  duration?: number;
  resourceIds?: string[];
  source?: string;
  requestId?: string;
  [key: string]: any;
}

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasMore: boolean;
  next?: string;
  previous?: string;
}

export enum ErrorCode {
  // Client Errors (4xx)
  BAD_REQUEST = 'BAD_REQUEST',
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  NOT_FOUND = 'NOT_FOUND',
  CONFLICT = 'CONFLICT',
  UNPROCESSABLE_ENTITY = 'UNPROCESSABLE_ENTITY',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server Errors (5xx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',

  // Business Logic Errors
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  RESOURCE_LOCKED = 'RESOURCE_LOCKED',
  INVALID_STATE = 'INVALID_STATE',
  DUPLICATE_ENTRY = 'DUPLICATE_ENTRY',

  // Third-party Integration Errors
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  PAYMENT_FAILED = 'PAYMENT_FAILED',

  // File/Upload Errors
  FILE_TOO_LARGE = 'FILE_TOO_LARGE',
  INVALID_FILE_TYPE = 'INVALID_FILE_TYPE',
  UPLOAD_FAILED = 'UPLOAD_FAILED',
}

export const HttpStatusMap: Record<ErrorCode, number> = {
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.FORBIDDEN]: 403,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.CONFLICT]: 409,
  [ErrorCode.UNPROCESSABLE_ENTITY]: 422,
  [ErrorCode.TOO_MANY_REQUESTS]: 429,

  [ErrorCode.INTERNAL_ERROR]: 500,
  [ErrorCode.SERVICE_UNAVAILABLE]: 503,
  [ErrorCode.DATABASE_ERROR]: 500,
  [ErrorCode.CACHE_ERROR]: 500,

  [ErrorCode.INSUFFICIENT_PERMISSIONS]: 403,
  [ErrorCode.RESOURCE_LOCKED]: 423,
  [ErrorCode.INVALID_STATE]: 400,
  [ErrorCode.DUPLICATE_ENTRY]: 409,

  [ErrorCode.EXTERNAL_SERVICE_ERROR]: 502,
  [ErrorCode.PAYMENT_FAILED]: 402,

  [ErrorCode.FILE_TOO_LARGE]: 413,
  [ErrorCode.INVALID_FILE_TYPE]: 415,
  [ErrorCode.UPLOAD_FAILED]: 500,
};

export interface CreateErrorOptions {
  message?: string;
  metadata?: ApiMetadata;
  field?: string;
  details?: string;
  path?: string[];
}

// Type-safe overloads
export function createErrorResponse(
  code: ErrorCode,
  options?: CreateErrorOptions
): ApiResponse;
export function createErrorResponse(
  errors: ApiError[],
  options?: Omit<CreateErrorOptions, 'field' | 'details'>
): ApiResponse;
export function createErrorResponse(
  errorsOrCode: ApiError[] | ErrorCode,
  options?: CreateErrorOptions | string
): ApiResponse {
  const opts = typeof options === 'string' ? { message: options } : options || {};
  const { message, metadata, field, details, path } = opts;

  let errorArray: ApiError[];

  if (Array.isArray(errorsOrCode)) {
    errorArray = errorsOrCode;
  } else {
    errorArray = [{
      code: errorsOrCode,
      message: message || getDefaultErrorMessage(errorsOrCode),
      ...(field && { field }),
      ...(details && { details }),
      ...(path && { path }),
    }];
  }

  const finalMessage = message || errorArray[0]?.message || 'An error occurred';

  return {
    success: false,
    message: finalMessage,
    data: null,
    timestamp: new Date().toISOString(),
    errors: errorArray,
    metadata,
  };
}

function getDefaultErrorMessage(code: ErrorCode): string {
  const messages: Record<ErrorCode, string> = {
    [ErrorCode.BAD_REQUEST]: 'Bad request',
    [ErrorCode.UNAUTHORIZED]: 'Unauthorized',
    [ErrorCode.FORBIDDEN]: 'Forbidden',
    [ErrorCode.NOT_FOUND]: 'Resource not found',
    [ErrorCode.CONFLICT]: 'Resource conflict',
    [ErrorCode.UNPROCESSABLE_ENTITY]: 'Unprocessable entity',
    [ErrorCode.TOO_MANY_REQUESTS]: 'Too many requests',
    [ErrorCode.INTERNAL_ERROR]: 'Internal server error',
    [ErrorCode.SERVICE_UNAVAILABLE]: 'Service unavailable',
    [ErrorCode.DATABASE_ERROR]: 'Database error',
    [ErrorCode.CACHE_ERROR]: 'Cache error',
    [ErrorCode.INSUFFICIENT_PERMISSIONS]: 'Insufficient permissions',
    [ErrorCode.RESOURCE_LOCKED]: 'Resource locked',
    [ErrorCode.INVALID_STATE]: 'Invalid state',
    [ErrorCode.DUPLICATE_ENTRY]: 'Duplicate entry',
    [ErrorCode.EXTERNAL_SERVICE_ERROR]: 'External service error',
    [ErrorCode.PAYMENT_FAILED]: 'Payment failed',
    [ErrorCode.FILE_TOO_LARGE]: 'File too large',
    [ErrorCode.INVALID_FILE_TYPE]: 'Invalid file type',
    [ErrorCode.UPLOAD_FAILED]: 'Upload failed',
  };
  return messages[code] || 'An error occurred';
}

export function createSuccessResponse<T>(
  data: T,
  message: string = 'Success',
  metadata?: ApiMetadata,
  pagination?: PaginationInfo,
  options?: { duration?: number; correlationId?: string; version?: string }
): ApiResponse<T> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    metadata,
    pagination,
    correlationId: options?.correlationId,
    version: options?.version,
    duration: options?.duration,
  };
}

export function createValidationErrorResponse<T = any>(
  fieldErrors: Array<{ field: string; message: string; code?: string }>,
  message: string = 'Validation failed'
): ApiResponse<T> {
  const errors: ApiError[] = fieldErrors.map(error => ({
    code: error.code || ErrorCode.UNPROCESSABLE_ENTITY,
    message: error.message,
    field: error.field,
  }));

  return createErrorResponse(errors, { message });
}

export function createNotFoundResponse<T = any>(
  resource: string,
  id?: string
): ApiResponse<T> {
  const message = id
    ? `${resource} with ID ${id} not found`
    : `${resource} not found`;

  return createErrorResponse(
    [{ code: ErrorCode.NOT_FOUND, message }],
    { message }
  );
}

export function createUnauthorizedResponse<T = any>(
  message: string = 'Unauthorized'
): ApiResponse<T> {
  return createErrorResponse(
    [{ code: ErrorCode.UNAUTHORIZED, message }],
    { message }
  );
}

export function createForbiddenResponse<T = any>(
  message: string = 'Insufficient permissions'
): ApiResponse<T> {
  return createErrorResponse(
    [{ code: ErrorCode.FORBIDDEN, message }],
    { message }
  );
}

export function createConflictResponse<T = any>(
  message: string = 'Resource conflict',
  details?: string
): ApiResponse<T> {
  return createErrorResponse(
    [{ code: ErrorCode.CONFLICT, message, details }],
    { message }
  );
}

export function createPaginatedResponse<T>(
  data: T[],
  pagination: PaginationInfo,
  message: string = 'Success',
  metadata?: ApiMetadata,
  options?: { duration?: number; correlationId?: string; version?: string }
): ApiResponse<T[]> {
  return {
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
    pagination,
    metadata,
    correlationId: options?.correlationId,
    version: options?.version,
    duration: options?.duration,
  };
}

export function isApiResponse(obj: any): obj is ApiResponse {
  return (
    obj &&
    typeof obj === 'object' &&
    'success' in obj &&
    'message' in obj &&
    'data' in obj &&
    'timestamp' in obj
  );
}

export function isErrorResponse<T = any>(
  response: ApiResponse<T>
): response is ApiResponse<T> & { errors: ApiError[] } {
  return !response.success && !!response.errors && response.errors.length > 0;
}

export function getStatusCodeFromResponse(response: ApiResponse): number {
  if (response.success) {
    return 200;
  }

  if (response.errors && response.errors.length > 0) {
    const errorCode = response.errors[0]?.code as ErrorCode;
    return HttpStatusMap[errorCode] || 500;
  }

  return 500;
}

export class ResponseBuilder {
  private response: Partial<ApiResponse> = {
    timestamp: new Date().toISOString(),
  };

  static success<T>(data: T, message?: string): ApiResponse<T> {
    return createSuccessResponse(data, message);
  }

  static error<T = any>(
    errors: ApiError[] | string,
    message?: string
  ): ApiResponse<T> {
    return createErrorResponse(
      typeof errors === 'string' ? [{ code: ErrorCode.INTERNAL_ERROR, message: errors }] : errors,
      { message }
    );
  }

  static paginated<T>(
    data: T[],
    pagination: PaginationInfo,
    message?: string
  ): ApiResponse<T[]> {
    return createPaginatedResponse(data, pagination, message);
  }

  withSuccess(success: boolean): this {
    this.response.success = success;
    return this;
  }

  withMessage(message: string): this {
    this.response.message = message;
    return this;
  }

  withData<T>(data: T): this {
    this.response.data = data;
    return this;
  }

  withErrors(errors: ApiError[]): this {
    this.response.errors = errors;
    return this;
  }

  withMetadata(metadata: ApiMetadata): this {
    this.response.metadata = metadata;
    return this;
  }

  withPagination(pagination: PaginationInfo): this {
    this.response.pagination = pagination;
    return this;
  }

  withCorrelationId(correlationId: string): this {
    this.response.correlationId = correlationId;
    return this;
  }

  withVersion(version: string): this {
    this.response.version = version;
    return this;
  }

  withDuration(duration: number): this {
    this.response.duration = duration;
    return this;
  }

  build<T>(): ApiResponse<T> {
    if (this.response.success === undefined) {
      throw new Error('Success status is required');
    }

    if (!this.response.message) {
      throw new Error('Message is required');
    }

    // Only require data for success responses
    if (this.response.success && this.response.data === undefined) {
      throw new Error('Data is required for success responses');
    }

    return {
      success: this.response.success,
      message: this.response.message,
      data: (this.response.success ? this.response.data : null) as T,
      timestamp: this.response.timestamp!,
      errors: this.response.errors,
      metadata: this.response.metadata,
      pagination: this.response.pagination,
      correlationId: this.response.correlationId,
      version: this.response.version,
      duration: this.response.duration,
    };
  }
}

export type CreateResponse<T> = ApiResponse<T>;
export type ReadResponse<T> = ApiResponse<T>;
export type UpdateResponse<T> = ApiResponse<T>;
export type DeleteResponse<T = { deleted: boolean }> = ApiResponse<T>;
export type ListResponse<T> = ApiResponse<T[]> & { pagination: PaginationInfo };
export type SearchResponse<T> = ListResponse<T> & {
  metadata: { query: string; filters: Record<string, any> };
};
