import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import {
  ApiResponse,
  createSuccessResponse,
  createErrorResponse,
  ErrorCode,
  isApiResponse,
} from '../core/api.types.js';
import { ValidationRules, ValidationOptions } from '../core/validation.types.js';
import { validateRequest as validateData } from '../validation/engine.js';

const REQUEST_ID_HEADER = 'x-request-id';
const CORRELATION_ID_HEADER = 'x-correlation-id';

export interface MiddlewareOptions {
  enableCorrelationId?: boolean;
  enableRequestLogging?: boolean;
  exposeStackTraces?: boolean;
  trustedProxy?: boolean;
}

/**
 * NOTE: this is a middleware *factory* — call it (`apiResponseMiddleware()`),
 * don't pass the factory itself to `app.use()`. Passing the un-called
 * factory means Express invokes it as `(req, res, next)`, which just
 * returns another function and never calls `next()` — every request hangs.
 */
export function apiResponseMiddleware(options: MiddlewareOptions = {}) {
  return (req: Request, res: Response, next: NextFunction) => {
    // Always recorded, independent of `enableRequestLogging` — this is
    // also what `duration` below is computed from. Previously `duration`
    // was computed unconditionally but `startTime` was only ever set when
    // `enableRequestLogging` was true, so every response got
    // `duration: NaN` unless that unrelated option happened to be on.
    (req as any).startTime = Date.now();

    const originalJson = res.json.bind(res);

    res.json = function (data: any) {
      if (res.headersSent) {
        return originalJson(data);
      }

      if (res.statusCode === 204 || res.statusCode === 304) {
        return res.send();
      }

      if (isApiResponse(data)) {
        return originalJson(data);
      }

      const correlationId = options.enableCorrelationId
        ? (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID()
        : undefined;

      const apiResponse = createSuccessResponse(data, 'Success', undefined, undefined, {
        correlationId,
        duration: Date.now() - (req as any).startTime,
      });

      return originalJson(apiResponse);
    };

    if (options.enableCorrelationId) {
      const correlationId = (req.headers[CORRELATION_ID_HEADER] as string) || randomUUID();
      req.headers[CORRELATION_ID_HEADER] = correlationId;
      res.setHeader(CORRELATION_ID_HEADER, correlationId);
    }

    next();
  };
}

/**
 * Same factory-function note as `apiResponseMiddleware`: call this
 * (`app.use(apiErrorMiddleware())`), registered last, after all routes.
 */
export function apiErrorMiddleware(options: MiddlewareOptions = {}) {
  return (error: any, req: Request, res: Response, _next: NextFunction) => {
    console.error('API error:', {
      message: error.message,
      stack: error.stack,
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    let statusCode = 500;
    let errorCode = ErrorCode.INTERNAL_ERROR;
    // Default to the error's own message, not a hardcoded string — the
    // named branches below only override this for their nicer specific
    // defaults when `error.message` is falsy. Previously this stayed
    // 'Internal server error' for any error that didn't match one of the
    // named types below (i.e. almost every real error), which meant the
    // isDev/shouldExposeStack logic further down never actually surfaced
    // a real message for ordinary errors even in development.
    let message = error.message || 'Internal server error';

    if (error.statusCode) {
      statusCode = error.statusCode;
    }

    if (error.code) {
      errorCode = error.code;
    }

    // Validation failures consistently use UNPROCESSABLE_ENTITY/422
    // everywhere in this package (see `validateRequestRules`,
    // `validateRequestSchema`, `createValidationErrorResponse`) — this
    // branch used to return BAD_REQUEST/400 instead, so the same kind of
    // failure could come back as either 400 or 422 depending on which
    // code path threw it.
    if (error.name === 'ValidationError') {
      statusCode = 422;
      errorCode = ErrorCode.UNPROCESSABLE_ENTITY;
      message = error.message || 'Validation failed';
    } else if (error.name === 'UnauthorizedError') {
      statusCode = 401;
      errorCode = ErrorCode.UNAUTHORIZED;
      message = error.message || 'Unauthorized';
    } else if (error.name === 'ForbiddenError') {
      statusCode = 403;
      errorCode = ErrorCode.FORBIDDEN;
      message = error.message || 'Forbidden';
    } else if (error.name === 'NotFoundError') {
      statusCode = 404;
      errorCode = ErrorCode.NOT_FOUND;
      message = error.message || 'Not found';
    } else if (error.name === 'ConflictError') {
      statusCode = 409;
      errorCode = ErrorCode.CONFLICT;
      message = error.message || 'Conflict';
    } else if (error.name === 'PrismaClientKnownRequestError') {
      handlePrismaError(error, req, res);
      return;
    }

    const isKnownClientError = statusCode < 500;
    const isDev = process.env.NODE_ENV === 'development';
    const shouldExposeStack = options.exposeStackTraces && isDev;

    // Never leak an arbitrary internal error message to the client for an
    // unrecognized 500 outside development — only known 4xx errors (or
    // dev mode) surface their real message.
    const safeMessage = isKnownClientError || isDev
      ? message
      : 'Internal server error';

    const apiResponse = createErrorResponse(errorCode, { message: safeMessage });

    if (shouldExposeStack) {
      apiResponse.errors![0]!.stack = error.stack;
    }

    const correlationId = req.headers[CORRELATION_ID_HEADER] as string;
    if (correlationId) {
      apiResponse.correlationId = correlationId;
    }

    res.status(statusCode).json(apiResponse);
  };
}

function handlePrismaError(error: any, req: Request, res: Response) {
  const correlationId = req.headers[CORRELATION_ID_HEADER] as string | undefined;
  const attachCorrelationId = (response: ApiResponse) => {
    if (correlationId) response.correlationId = correlationId;
    return response;
  };

  if (error.code === 'P2002') {
    const field = error.meta?.target?.[0] || 'unknown';
    return res.status(409).json(
      attachCorrelationId(createErrorResponse(ErrorCode.DUPLICATE_ENTRY, {
        message: `${field} already exists`,
        field,
      }))
    );
  } else if (error.code === 'P2025') {
    return res.status(404).json(
      attachCorrelationId(createErrorResponse(ErrorCode.NOT_FOUND, {
        message: 'Record not found',
      }))
    );
  } else if (error.code === 'P2003') {
    return res.status(400).json(
      attachCorrelationId(createErrorResponse(ErrorCode.BAD_REQUEST, {
        message: 'Referenced resource does not exist',
      }))
    );
  } else {
    console.error('Unhandled Prisma error:', error);
    return res.status(500).json(
      attachCorrelationId(createErrorResponse(ErrorCode.DATABASE_ERROR, {
        message: 'Database error',
      }))
    );
  }
}

export function asyncController(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}

export function healthCheck(req: Request, res: Response) {
  const response: ApiResponse<{ status: string; timestamp: string; uptime: number }> = {
    success: true,
    message: 'Service is healthy',
    data: {
      status: 'OK',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    },
    timestamp: new Date().toISOString(),
    correlationId: req.headers[CORRELATION_ID_HEADER] as string,
  };

  res.json(response);
}

/**
 * Middleware factory for a pre-built schema with a `.parseAsync` method
 * (e.g. a raw Zod schema you built yourself). If you want to describe
 * fields with the `ValidationRules` shorthand instead, use
 * `validateRequestRules` below.
 */
export function validateRequestSchema(schema: any) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      await schema.parseAsync({
        body: req.body,
        query: req.query,
        params: req.params,
      });
      next();
    } catch (error: any) {
      const apiResponse = createErrorResponse(
        ErrorCode.UNPROCESSABLE_ENTITY,
        { message: error.message || 'Validation failed' }
      );
      res.status(422).json(apiResponse);
    }
  };
}

/**
 * Middleware factory for a `ValidationRules` map (the same shape used by
 * `createValidationSchema`/`validateRequest` in `@your-org/api-utils/validation`).
 * Merges `req.body`, `req.query`, and `req.params` (later sources win on
 * key collisions) and validates the combined object; on success the
 * validated/coerced data replaces `req.body` so downstream handlers see
 * clean values (e.g. `page` as a `number`, not the raw query string).
 */
export function validateRequestRules(rules: ValidationRules, options?: ValidationOptions) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const data = { ...req.body, ...req.query, ...req.params };
    const result = await validateData(data, rules, options);

    if (!result.isValid) {
      const apiResponse = createErrorResponse(
        result.errors.map(e => ({ code: e.code || ErrorCode.UNPROCESSABLE_ENTITY, message: e.message, field: e.field })),
        { message: 'Validation failed' }
      );
      res.status(422).json(apiResponse);
      return;
    }

    req.body = result.data;
    next();
  };
}

export function rateLimitExceeded(_req: Request, res: Response) {
  const apiResponse = createErrorResponse(
    ErrorCode.TOO_MANY_REQUESTS,
    { message: 'Too many requests, please try again later' }
  );
  res.status(429).json(apiResponse);
}

/**
 * A wildcard origin ("*") combined with Access-Control-Allow-Credentials:
 * true is invalid per the Fetch/CORS spec and rejected by browsers, so
 * this never emits both together. Set ALLOWED_ORIGINS (comma-separated)
 * to allow credentialed cross-origin requests from those exact origins;
 * without it, any origin is allowed but credentials are not.
 */
export function corsMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(origin => origin.trim())
    .filter(Boolean);

  const requestOrigin = req.header('Origin');

  if (allowedOrigins.length > 0) {
    if (requestOrigin && allowedOrigins.includes(requestOrigin)) {
      res.header('Access-Control-Allow-Origin', requestOrigin);
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Vary', 'Origin');
    }
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }

  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-Id, X-Correlation-Id');
  res.header('Access-Control-Expose-Headers', 'X-Request-Id, X-Correlation-Id');

  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
}

export function requestIdMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = (req.headers[REQUEST_ID_HEADER] as string) || randomUUID();
  req.headers[REQUEST_ID_HEADER] = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);
  next();
}

export function loggingMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
) {
  const startTime = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const logEntry = {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      duration: `${duration}ms`,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      requestId: req.headers[REQUEST_ID_HEADER],
      correlationId: req.headers[CORRELATION_ID_HEADER],
    };

    if (res.statusCode >= 500) {
      console.error('Request error:', logEntry);
    } else if (res.statusCode >= 400) {
      console.warn('Request warning:', logEntry);
    } else {
      console.log('Request:', logEntry);
    }
  });

  next();
}
