// packages/logger/src/types/index.ts
export type LogLevel =
  | 'error'
  | 'warn'
  | 'info'
  | 'http'
  | 'verbose'
  | 'debug'
  | 'silly';

export interface LogContext {
  // `unknown` instead of `any` — forces callers/consumers to narrow before
  // using arbitrary meta fields, while still allowing free-form structured
  // logging data.
  [key: string]: unknown;
  timestamp?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
}

export interface LoggerOptions {
  environment?: 'development' | 'production' | 'test';
  level?: LogLevel;
  defaultMeta?: LogContext;
  transports?: TransportType[];
  exceptionHandlers?: boolean;
  rejectionHandlers?: boolean;
  exitOnError?: boolean;
  logDir?: string;
  maxSize?: string;
  maxFiles?: string;
  filename?: string;
  enableConsole?: boolean;
  enableFile?: boolean;
  enableCloudWatch?: boolean;
  enableLogtail?: boolean;
  /**
   * Field names (case-insensitive, matched anywhere in the key) whose
   * values get replaced with '[REDACTED]' before a log line is formatted.
   * Merged with DEFAULT_REDACT_KEYS, not a replacement for it.
   */
  redactKeys?: string[];
  /**
   * When true, logger.info/warn/error/etc. calls automatically pick up
   * ambient context (requestId, correlationId, userId, ...) set via
   * runWithLogContext(), without needing an explicit child logger.
   * Defaults to true.
   */
  enableAsyncContext?: boolean;
}

export type TransportType =
  | 'console'
  | 'file'
  | 'daily-rotate-file'
  | 'logtail'
  | 'cloudwatch';

export interface TransportConfig {
  type: TransportType;
  enabled: boolean;
  options?: Record<string, unknown>;
}

export interface LogtailConfig {
  sourceToken: string;
  endpoint?: string;
}

export interface CloudWatchConfig {
  logGroupName: string;
  logStreamName: string;
  awsRegion: string;
  awsAccessKeyId?: string;
  awsSecretAccessKey?: string;
}

export interface PerformanceMetrics {
  duration: number;
  operation: string;
  success: boolean;
  [key: string]: unknown;
}

// Constants
export const LOG_LEVELS = {
  ERROR: 'error' as LogLevel,
  WARN: 'warn' as LogLevel,
  INFO: 'info' as LogLevel,
  HTTP: 'http' as LogLevel,
  DEBUG: 'debug' as LogLevel,
  VERBOSE: 'verbose' as LogLevel,
  SILLY: 'silly' as LogLevel,
} as const;

const VALID_LOG_LEVELS: ReadonlySet<string> = new Set(Object.values(LOG_LEVELS));

/** Type guard + runtime check for values coming from process.env / config files. */
export const isValidLogLevel = (level: unknown): level is LogLevel =>
  typeof level === 'string' && VALID_LOG_LEVELS.has(level);

export const LOG_COLORS = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  verbose: 'cyan',
  debug: 'blue',
  silly: 'gray'
} as const;

/**
 * Field-name fragments that get redacted from log metadata by default.
 * Matching is case-insensitive and substring-based (e.g. "authToken",
 * "AUTHORIZATION", "user_password" all match).
 */
export const DEFAULT_REDACT_KEYS = [
  'password',
  'passwd',
  'secret',
  'token',
  'apikey',
  'api_key',
  'authorization',
  'auth',
  'creditcard',
  'credit_card',
  'cvv',
  'ssn',
  'privatekey',
  'private_key',
] as const;

export const DEFAULT_CONFIG: LoggerOptions = {
  environment: 'development',
  level: 'info',
  transports: ['console', 'file'],
  exceptionHandlers: true,
  rejectionHandlers: true,
  exitOnError: false,
  logDir: 'logs',
  maxSize: '20m',
  maxFiles: '14d',
  enableConsole: true,
  enableFile: true,
  enableCloudWatch: false,
  enableLogtail: false,
  redactKeys: [],
  enableAsyncContext: true,
};