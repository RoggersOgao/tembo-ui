// packages/logger/src/helpers/index.ts
import { Request, Response, NextFunction } from 'express';
// Import directly from core, not '../index.js' — importing the barrel file
// creates a circular dependency (index.ts -> helpers/index.ts -> index.ts)
// since index.ts itself re-exports everything in this file.
import logger from '../core/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { LogContext } from '../types/index.js';
import { runWithLogContext } from '../context/index.js';

/**
 * Request logging middleware for Express.
 *
 * Sets requestId/correlationId/method/path/ip/userAgent as ambient context
 * for the lifetime of the request (via AsyncLocalStorage), so any
 * logger.info()/warn()/error() call anywhere downstream — including deep
 * in service/repository code that never sees `req` — automatically
 * includes those fields. `req.logger` (a Winston child logger) is still
 * attached for callers who prefer an explicit reference.
 */
export const createRequestLogger = (options: {
  excludePaths?: string[];
  logRequestBody?: boolean;
  logResponseBody?: boolean;
} = {}) => {
  const {
    excludePaths = ['/health', '/metrics', '/favicon.ico'],
    logRequestBody = false,
    logResponseBody = false
  } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    if (excludePaths.some(path => req.path.startsWith(path))) {
      return next();
    }

    const requestId = (req.headers['x-request-id'] as string) || uuidv4();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);

    const context: LogContext = {
      requestId,
      method: req.method,
      path: req.path,
      ip: req.ip || req.socket.remoteAddress,
      userAgent: req.get('user-agent'),
    };

    const requestLogger = logger.child(context);
    (req as any).logger = requestLogger;

    runWithLogContext(context, () => {
      requestLogger.http(`Request started: ${req.method} ${req.path}`, {
        query: req.query,
        ...(logRequestBody && { body: req.body })
      });

      const originalSend = res.send;
      const startTime = Date.now();

      res.send = function (body: any) {
        const duration = Date.now() - startTime;

        requestLogger.http(`Request completed: ${req.method} ${req.path}`, {
          statusCode: res.statusCode,
          duration: `${duration}ms`,
          contentLength: res.get('content-length'),
          ...(logResponseBody && typeof body === 'string' && {
            responseBody: body.substring(0, 1000)
          })
        });

        return originalSend.call(this, body);
      };

      next();
    });
  };
};

/**
 * Error logging helper
 */
export const createErrorLogger = (error: Error, context: LogContext = {}) => {
  logger.error(error.message, {
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    ...context,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Performance logging helper
 */
export const createPerformanceLogger = (
  operation: string,
  duration: number,
  meta: LogContext = {}
) => {
  logger.info(`Performance: ${operation}`, {
    ...meta,
    operation,
    duration,
    unit: 'ms',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Audit logging helper for security/important actions
 */
export const createAuditLogger = (
  action: string,
  userId: string,
  details: LogContext = {}
) => {
  logger.info(`Audit: ${action}`, {
    ...details,
    action,
    userId,
    ip: details.ip || 'unknown',
    userAgent: details.userAgent || 'unknown',
    timestamp: new Date().toISOString(),
  });
};

/**
 * Database query logger
 */
export const logDatabaseQuery = (
  query: string,
  params: any[] = [],
  duration: number,
  context?: LogContext
) => {
  logger.debug('Database Query', {
    ...context,
    query: query.substring(0, 500),
    params: params.slice(0, 10),
    duration: `${duration}ms`,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Cache operation logger
 */
export const logCacheOperation = (
  operation: string,
  key: string,
  success: boolean,
  duration?: number,
  context?: LogContext
) => {
  logger.debug('Cache Operation', {
    ...context,
    operation,
    key,
    success,
    duration: duration ? `${duration}ms` : undefined,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Business logic logger
 */
export const logBusinessAction = (
  action: string,
  data: Record<string, any>,
  userId?: string
) => {
  logger.info(`Business Action: ${action}`, {
    ...data,
    action,
    userId,
    timestamp: new Date().toISOString(),
  });
};

/**
 * Startup/shutdown logger
 */
export const logServiceLifecycle = (
  service: string,
  status: 'starting' | 'started' | 'stopping' | 'stopped' | 'failed',
  details?: any
) => {
  logger.info(`Service ${status}: ${service}`, {
    service,
    status,
    details,
    timestamp: new Date().toISOString(),
  });
};

/**
 * API request logger — ported from the retired config/logger.config.ts.
 */
export const logApiRequest = (req: any, res: any, responseTime: number) => {
  const { method, originalUrl, ip, user } = req;
  const { statusCode } = res;

  logger.http('API Request', {
    method,
    url: originalUrl,
    statusCode,
    responseTime: `${responseTime}ms`,
    ip,
    userId: user?.id || 'anonymous',
    userAgent: req.get?.('user-agent'),
    timestamp: new Date().toISOString(),
  });
};

/**
 * Create a Morgan stream for HTTP logging
 */
export const morganStream = {
  write: (message: string) => {
    logger.http(message.trim());
  },
};