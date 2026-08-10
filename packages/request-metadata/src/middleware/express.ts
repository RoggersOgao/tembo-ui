import { Request, Response, NextFunction } from 'express';
import { RequestMetadata, MiddlewareOptions } from '../types';
import { getAdvancedRequestMetadata } from '../extractor';
import { mergeConfig } from '../config';

export function createExpressMiddleware(options: Partial<MiddlewareOptions> = {}) {
  const config = mergeConfig(options);
  const middlewareOptions: MiddlewareOptions = {
    ...config,
    attachToRequest: options.attachToRequest ?? true,
    requestPropertyName: options.requestPropertyName ?? 'requestMetadata',
    skipPaths: options.skipPaths ?? [],
    skipPatterns: options.skipPatterns ?? [],
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const shouldSkip = shouldSkipRequest(req, middlewareOptions);
      if (shouldSkip) {
        return next();
      }

      const metadata = await getAdvancedRequestMetadata(req, config);

      if (middlewareOptions.attachToRequest) {
        (req as any)[middlewareOptions.requestPropertyName!] = metadata;
        
        if (metadata.network.ipAddress && metadata.network.ipAddress !== 'unknown') {
          (req as any).realIp = metadata.network.ipAddress;
        }
      }

      res.locals.requestMetadata = metadata;

      next();
    } catch (error) {
      if (config.logging?.enabled) {
        console.error('Request metadata extraction failed:', error);
      }
      next();
    }
  };
}

function shouldSkipRequest(req: Request, options: MiddlewareOptions): boolean {
  const path = req.path;

  if (options.skipPaths?.includes(path)) {
    return true;
  }

  if (options.skipPatterns?.some(pattern => pattern.test(path))) {
    return true;
  }

  return false;
}

export function attachMetadata(req: Request, metadata: RequestMetadata) {
  (req as any).requestMetadata = metadata;
}

export function getMetadata(req: Request): RequestMetadata | undefined {
  return (req as any).requestMetadata;
}