import { FastifyRequest, FastifyReply, FastifyInstance } from 'fastify';
import { RequestMetadata, MiddlewareOptions } from '../types';
import { getAdvancedRequestMetadata } from '../extractor';
import { mergeConfig } from '../config';

export function createFastifyPlugin(options: Partial<MiddlewareOptions> = {}) {
  const config = mergeConfig(options);
  
  return async function fastifyMetadataPlugin(fastify: FastifyInstance) {
    // Decorate the request object with custom properties
    // Use getter/setter functions instead of null
    fastify.decorateRequest('requestMetadata', {
      getter() {
        return undefined;
      }
    });
    
    fastify.decorateRequest('realIp', {
      getter() {
        return undefined;
      }
    });
    
    // Add a hook that runs before each request is processed
    fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
      try {
        // Check if this request should be skipped
        const shouldSkip = shouldSkipRequest(request, config);
        if (shouldSkip) {
          return;
        }
        
        // Extract metadata from the request
        const metadata = await getAdvancedRequestMetadata(request as any, config);
        
        // Attach metadata to the request object
        (request as any).requestMetadata = metadata;
        
        // Set realIp if available
        if (metadata.network.ipAddress && metadata.network.ipAddress !== 'unknown') {
          (request as any).realIp = metadata.network.ipAddress;
        }
      } catch (error) {
        // Log errors if logging is enabled
        if (config.logging?.enabled) {
          fastify.log.error({ err: error }, 'Request metadata extraction failed');
        }
        // Don't throw - allow request to continue even if metadata extraction fails
      }
    });
  };
}

function shouldSkipRequest(
  request: FastifyRequest, 
  config: MiddlewareOptions
): boolean {
  const path = request.url;
  
  // Skip if path matches exact skipPaths
  if (config.skipPaths?.some(skipPath => path === skipPath)) {
    return true;
  }
  
  // Skip if path matches skipPatterns regex
  if (config.skipPatterns?.some(pattern => pattern.test(path))) {
    return true;
  }
  
  return false;
}

// TypeScript module augmentation to add custom properties to Fastify types
declare module 'fastify' {
  interface FastifyRequest {
    requestMetadata?: RequestMetadata;
    realIp?: string;
  }
}