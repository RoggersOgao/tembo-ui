import { Response } from 'express';
import {
  ApiResponse,
  ApiMetadata,
  ErrorCode,
  createErrorResponse,
  createValidationErrorResponse,
  createNotFoundResponse,
  createUnauthorizedResponse,
  createForbiddenResponse,
  createConflictResponse,
  createPaginatedResponse,
  ResponseBuilder,
  getStatusCodeFromResponse
} from '../core/api.types.js';
import { ValidationResult } from '../core/validation.types.js';

export class ResponseHandler {
  static success<T>(
    res: Response,
    data: T,
    message: string = 'Success',
    statusCode: number = 200,
    metadata?: ApiMetadata
  ): void {
    const response = ResponseBuilder.success(data, message);
    if (metadata) {
      response.metadata = metadata;
    }
    res.status(statusCode).json(response);
  }

  static error(
    res: Response,
    error: string | ApiResponse<null>,
    message?: string,
    statusCode?: number
  ): void {
    let apiResponse: ApiResponse<null>;

    if (typeof error === 'string') {
      apiResponse = createErrorResponse(
        [{ code: ErrorCode.INTERNAL_ERROR, message: error }],
        { message: message || error }
      );
    } else {
      apiResponse = error;
    }

    const status = statusCode || getStatusCodeFromResponse(apiResponse);
    res.status(status).json(apiResponse);
  }

  static validationError(
    res: Response,
    errors: ValidationResult['errors'] | Array<{ field: string; message: string }>,
    message: string = 'Validation failed'
  ): void {
    const apiResponse = createValidationErrorResponse(errors, message);
    res.status(422).json(apiResponse);
  }

  static notFound(
    res: Response,
    resource: string,
    id?: string
  ): void {
    const apiResponse = createNotFoundResponse(resource, id);
    res.status(404).json(apiResponse);
  }

  static unauthorized(
    res: Response,
    message: string = 'Unauthorized'
  ): void {
    const apiResponse = createUnauthorizedResponse(message);
    res.status(401).json(apiResponse);
  }

  static forbidden(
    res: Response,
    message: string = 'Insufficient permissions'
  ): void {
    const apiResponse = createForbiddenResponse(message);
    res.status(403).json(apiResponse);
  }

  static conflict(
    res: Response,
    message: string = 'Resource conflict',
    details?: string
  ): void {
    const apiResponse = createConflictResponse(message, details);
    res.status(409).json(apiResponse);
  }

  static paginated<T>(
    res: Response,
    data: T[],
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
      hasMore: boolean;
    },
    message: string = 'Success',
    metadata?: ApiMetadata
  ): void {
    const apiResponse = createPaginatedResponse(data, pagination, message);
    if (metadata) {
      apiResponse.metadata = metadata;
    }
    res.status(200).json(apiResponse);
  }

  static created<T>(
    res: Response,
    data: T,
    message: string = 'Resource created successfully',
    metadata?: ApiMetadata
  ): void {
    const response = ResponseBuilder.success(data, message);
    if (metadata) {
      response.metadata = metadata;
    }
    res.status(201).json(response);
  }

  static noContent(res: Response): void {
    res.status(204).send();
  }

  static badRequest(
    res: Response,
    message: string = 'Bad request',
    details?: string
  ): void {
    const apiResponse = createErrorResponse(
      [{ code: ErrorCode.BAD_REQUEST, message, details }],
      { message }
    );
    res.status(400).json(apiResponse);
  }

  static internalError(
    res: Response,
    error?: Error,
    message: string = 'Internal server error'
  ): void {
    const errors = error ? [{
      code: ErrorCode.INTERNAL_ERROR,
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    }] : undefined;

    const apiResponse = createErrorResponse(
      errors || [{ code: ErrorCode.INTERNAL_ERROR, message }],
      { message }
    );

    res.status(500).json(apiResponse);
  }

  static handlePrismaError(
    res: Response,
    error: any
  ): void {
    console.error('Prisma error:', error);

    if (error.code === 'P2002') {
      const field = error.meta?.target?.[0] || 'unknown';
      const message = `${field} already exists`;
      ResponseHandler.conflict(res, message);
    } else if (error.code === 'P2025') {
      ResponseHandler.notFound(res, 'Resource');
    } else if (error.code === 'P2003') {
      ResponseHandler.badRequest(res, 'Referenced resource does not exist');
    } else {
      ResponseHandler.internalError(res, error);
    }
  }
}

export function asyncHandler(
  handler: (req: any, res: Response, next?: any) => Promise<any>
) {
  return async (req: any, res: Response, next: any) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      console.error('Async handler error:', error);
      ResponseHandler.internalError(res, error as Error);
    }
  };
}
