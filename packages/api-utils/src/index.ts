// Core exports
export * from './core/api.types.js';
export * from './core/validation.types.js';

// Validation exports
export * from './validation/index.js';

// Client exports
export * from './client/index.js';

// Server exports (express)
export * from './server/index.js';

// Utils exports
export * from './utils/index.js';

// Convenience re-exports
export {
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createConflictResponse,
  createPaginatedResponse,
  ResponseBuilder,
  isApiResponse,
  isErrorResponse,
  getStatusCodeFromResponse,
} from './core/api.types.js';

export type {
  ApiResponse,
  ApiError,
  ApiMetadata,
  PaginationInfo,
} from './core/api.types.js';

export type {
  ValidationError,
  ValidationResult,
  ValidationRule,
  ValidationRules,
  ValidationOptions,
} from './core/validation.types.js';

export {
  customValidators,
  validationSchemas,
} from './core/validation.types.js';

export {
  ApiClient,
  createServerApiClient,
} from './client/index.js';

export type {
  ApiClientOptions,
  RequestOptions,
} from './client/index.js';

export {
  ResponseHandler,
  asyncHandler,
} from './utils/index.js';

export {
  apiResponseMiddleware,
  apiErrorMiddleware,
  asyncController,
  healthCheck,
  validateRequestSchema,
  validateRequestRules,
  rateLimitExceeded,
  corsMiddleware,
  requestIdMiddleware,
  loggingMiddleware,
} from './server/index.js';

export type {
  MiddlewareOptions,
} from './server/index.js';
