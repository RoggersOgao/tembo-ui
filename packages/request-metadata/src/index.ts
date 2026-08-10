// Main exports
export { getAdvancedRequestMetadata, createMetadataExtractor } from './extractor';
export { createExpressMiddleware, attachMetadata, getMetadata } from './middleware';

// Type exports
export type {
  RequestMetadata,
  IPInfo,
  ExtractionOptions,
  MiddlewareOptions,
  RequestWithSocket,
} from './types';

// Utility exports
export { extractIPInfo } from './extractors/ip-extractor';
export { extractUserAgentInfo } from './extractors/user-agent-extractor';

// Default configuration
export { DEFAULT_CONFIG } from './config';

// Cache utilities
export { MemoryCache, requestCache, getCached, createCacheKey } from './cache';