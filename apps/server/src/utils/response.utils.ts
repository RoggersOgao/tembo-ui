// import { Response } from 'express';
// import {
//   ApiResponse,
//   ErrorCode,
//   createSuccessResponse,
//   createErrorResponse,
//   createValidationErrorResponse,
//   createNotFoundResponse,
//   createUnauthorizedResponse,
//   createForbiddenResponse,
//   createConflictResponse,
//   createPaginatedResponse,
//   ResponseBuilder,
//   getStatusCodeFromResponse
// } from '../types/api-response.types';
// import { ValidationResult } from '../middlewares/request-validation';

// /**
//  * Utility class for handling API responses consistently
//  */
// export class ResponseHandler {
//   /**
//    * Send a success response
//    */
//   static success<T>(
//     res: Response,
//     data: T,
//     message: string = 'Success',
//     statusCode: number = 200
//   ): void {
//     const response = ResponseBuilder.success(data, message);
//     res.status(statusCode).json(response);
//   }

//   /**
//    * Send an error response
//    */
//   static error(
//     res: Response,
//     error: string | ApiResponse<null>,
//     message?: string,
//     statusCode?: number
//   ): void {
//     let apiResponse: ApiResponse<null>;
    
//     if (typeof error === 'string') {
//       apiResponse = createErrorResponse(error, message);
//     } else {
//       apiResponse = error;
//     }

//     const status = statusCode || getStatusCodeFromResponse(apiResponse);
//     res.status(status).json(apiResponse);
//   }

//   /**
//    * Send a validation error response
//    */
//   static validationError(
//     res: Response,
//     errors: ValidationResult['errors'],
//     message: string = 'Validation failed'
//   ): void {
//     const apiResponse = createValidationErrorResponse(errors, message);
//     res.status(400).json(apiResponse);
//   }

//   /**
//    * Send a not found error response
//    */
//   static notFound(
//     res: Response,
//     resource: string,
//     id?: string
//   ): void {
//     const apiResponse = createNotFoundResponse(resource, id);
//     res.status(404).json(apiResponse);
//   }

//   /**
//    * Send an unauthorized error response
//    */
//   static unauthorized(
//     res: Response,
//     message: string = 'Unauthorized'
//   ): void {
//     const apiResponse = createUnauthorizedResponse(message);
//     res.status(401).json(apiResponse);
//   }

//   /**
//    * Send a forbidden error response
//    */
//   static forbidden(
//     res: Response,
//     message: string = 'Insufficient permissions'
//   ): void {
//     const apiResponse = createForbiddenResponse(message);
//     res.status(403).json(apiResponse);
//   }

//   /**
//    * Send a conflict error response
//    */
//   static conflict(
//     res: Response,
//     message: string = 'Resource conflict',
//     details?: string
//   ): void {
//     const apiResponse = createConflictResponse(message, details);
//     res.status(409).json(apiResponse);
//   }

//   /**
//    * Send a paginated response
//    */
//   static paginated<T>(
//     res: Response,
//     data: T[],
//     pagination: {
//       page: number;
//       limit: number;
//       total: number;
//       totalPages: number;
//       hasMore: boolean;
//     },
//     message: string = 'Success'
//   ): void {
//     const apiResponse = createPaginatedResponse(data, pagination, message);
//     res.status(200).json(apiResponse);
//   }

//   /**
//    * Send a created response
//    */
//   static created<T>(
//     res: Response,
//     data: T,
//     message: string = 'Resource created successfully'
//   ): void {
//     const response = ResponseBuilder.success(data, message);
//     res.status(201).json(response);
//   }

//   /**
//    * Send a no content response
//    */
//   static noContent(res: Response): void {
//     res.status(204).send();
//   }

//   /**
//    * Send a bad request response
//    */
//   static badRequest(
//     res: Response,
//     message: string = 'Bad request',
//     details?: string
//   ): void {
//     const apiResponse = createErrorResponse(
//       [{ code: ErrorCode.BAD_REQUEST, message, details }],
//       message
//     );
//     res.status(400).json(apiResponse);
//   }

//   /**
//    * Send an internal server error response
//    */
//   static internalError(
//     res: Response,
//     error?: Error,
//     message: string = 'Internal server error'
//   ): void {
//     const errors = error ? [{
//       code: ErrorCode.INTERNAL_ERROR,
//       message: error.message,
//       stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
//     }] : undefined;

//     const apiResponse = createErrorResponse(errors || message, message);
//     res.status(500).json(apiResponse);
//   }

//   /**
//    * Send a service unavailable response
//    */
//   static serviceUnavailable(
//     res: Response,
//     message: string = 'Service temporarily unavailable'
//   ): void {
//     const apiResponse = createErrorResponse(
//       [{ code: ErrorCode.SERVICE_UNAVAILABLE, message }],
//       message
//     );
//     res.status(503).json(apiResponse);
//   }

//   /**
//    * Handle Prisma errors
//    */
//   static handlePrismaError(
//     res: Response,
//     error: any
//   ): void {
//     console.error('Prisma error:', error);

//     if (error.code === 'P2002') {
//       // Unique constraint violation
//       const field = error.meta?.target?.[0] || 'unknown';
//       const message = `${field} already exists`;
//       ResponseHandler.conflict(res, message);
//     } else if (error.code === 'P2025') {
//       // Record not found
//       ResponseHandler.notFound(res, 'Resource');
//     } else if (error.code === 'P2003') {
//       // Foreign key constraint violation
//       ResponseHandler.badRequest(res, 'Referenced resource does not exist');
//     } else {
//       ResponseHandler.internalError(res, error);
//     }
//   }

//   /**
//    * Handle validation errors from Zod
//    */
//   static handleZodError(
//     res: Response,
//     error: any
//   ): void {
//     if (error.name === 'ZodError') {
//       const errors = error.errors.map((e: any) => ({
//         field: e.path.join('.'),
//         message: e.message
//       }));
//       ResponseHandler.validationError(res, errors);
//     } else {
//       ResponseHandler.internalError(res, error);
//     }
//   }
// }

// /**
//  * Async handler wrapper for consistent error handling
//  */
// export function asyncHandler(
//   handler: (req: any, res: Response, next?: any) => Promise<any>
// ) {
//   return async (req: any, res: Response, next: any) => {
//     try {
//       await handler(req, res, next);
//     } catch (error) {
//       console.error('Async handler error:', error);
//       ResponseHandler.internalError(res, error as Error);
//     }
//   };
// }

// /**
//  * Create a response interceptor for adding metadata
//  */
// export function withMetadata(
//   metadata: Record<string, any>
// ) {
//   return (req: any, res: Response, next: any) => {
//     const originalJson = res.json;
    
//     res.json = function(data: any) {
//       if (data && typeof data === 'object' && 'success' in data) {
//         // It's an ApiResponse
//         const response = data as ApiResponse;
//         response.metadata = { ...response.metadata, ...metadata };
//         return originalJson.call(this, response);
//       }
//       return originalJson.call(this, data);
//     };
    
//     next();
//   };
// }

// export default ResponseHandler;