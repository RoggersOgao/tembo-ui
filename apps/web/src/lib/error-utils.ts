import z from "zod"

// lib/error-utils.ts
export interface DatabaseError extends Error {
  code: string;
  meta?: Record<string, any>;
}

export interface NetworkError extends Error {
  statusCode?: number;
  url?: string;
}

export interface RateLimitError extends Error {
  retryAfter?: number;
  limit?: number;
  reset?: number;
}

export const isDatabaseError = (error: any): error is DatabaseError => {
  return error && 
    (error.code?.startsWith('P') || // Prisma error codes
     error.code === '23505' || // PostgreSQL unique violation
     error.name?.includes('Database') ||
     error.name?.includes('Prisma'));
};

export const isNetworkError = (error: any): error is NetworkError => {
  return error &&
    (error.name === 'FetchError' ||
     error.name === 'AxiosError' ||
     error.name === 'NetworkError' ||
     error.message?.includes('network') ||
     error.message?.includes('fetch') ||
     error.message?.includes('ECONNREFUSED') ||
     error.message?.includes('ETIMEDOUT'));
};

export const isRateLimitError = (error: any): error is RateLimitError => {
  return error &&
    (error.name === 'RateLimitError' ||
     error.message?.includes('rate limit') ||
     error.message?.includes('too many requests') ||
     error.message?.includes('429') ||
     error.retryAfter !== undefined);
};

export const isValidationError = (error: any): error is z.ZodError => {
  return error instanceof z.ZodError;
};

// Error wrapper for consistent error handling
export class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 500,
    public meta?: Record<string, any>
  ) {
    super(message);
    this.name = 'AppError';
  }
}