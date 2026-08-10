// config/cors.ts

import { CorsOptions } from 'cors';
import { ENV } from './config';
import {logger} from '@repo/logger';

/**
 * Parse allowed origins from environment variable
 */
function getAllowedOrigins(): string[] {
  const origins = ENV.ALLOWED_ORIGINS;

  if (!origins) {
    console.warn('  ALLOWED_ORIGINS not set, using default');
    return ['http://localhost:3000', 'http://localhost:3001'];
  }

  // Split by comma and trim whitespace
  const parsed = origins.split(',').map(origin => origin.trim());
  logger.info('Allowed Origins:', { origins: parsed });

  return parsed;
}

const allowedOrigins = getAllowedOrigins();

/**
 * CORS Options for Express
 */
export const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, Postman, curl)
    if (!origin) {
      return callback(null, true);
    }

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.warn(`   Blocked CORS request from: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    "x-client-id",
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 86400, // 24 hours
};

/**
 * CORS Options for Socket.IO
 * Note: Socket.IO has slightly different CORS requirements
 */
export const socketCorsOptions = {
  origin: allowedOrigins,
  credentials: true,
  methods: ['GET', 'POST']
};

/**
 * Helper function to check if origin is allowed
 */
export function isOriginAllowed(origin: string | undefined): boolean {
  if (!origin) return true; // Allow requests with no origin
  return allowedOrigins.includes(origin);
}

/**
 * Get allowed origins (useful for debugging)
 */
export function getConfiguredOrigins(): string[] {
  return [...allowedOrigins]; // Return copy to prevent mutation
}