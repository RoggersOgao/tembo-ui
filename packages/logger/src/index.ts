export { default as logger } from './core/logger.js';
export { Logger } from './core/logger.js';

// Export types
export type {
  LogLevel,
  LogContext,
  LoggerOptions,
  TransportConfig,
  LogtailConfig,
  CloudWatchConfig,
  PerformanceMetrics,
  TransportType
} from './types/index.js';

// Export transports
export {
  createSyncTransports,
  createAsyncTransports,
  createTransports,
  consoleTransport,
  fileTransport,
  dailyRotateFileTransport,
  logtailTransport,
  cloudWatchTransport
} from './transports/index.js';

// Export formatters
export {
  createFormatter,
  jsonFormatter,
  prettyFormatter,
  colorizedFormatter,
  contextFormat,
  redactFormat
} from './formatters/index.js';

// Export helpers
export {
  createRequestLogger,
  createErrorLogger,
  createPerformanceLogger,
  createAuditLogger,
  logDatabaseQuery,
  logCacheOperation,
  logBusinessAction,
  logServiceLifecycle,
  logApiRequest,
  morganStream
} from './helpers/index.js';

// Export context propagation (correlation IDs across async call chains)
export {
  runWithLogContext,
  getLogContext,
  updateLogContext
} from './context/index.js';

// Export redaction utility
export { redact } from './redact/index.js';

// Export constants
export {
  LOG_LEVELS,
  LOG_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_REDACT_KEYS,
  ENVIRONMENTS,
  DEFAULT_LOG_DIR,
  DEFAULT_MAX_SIZE,
  DEFAULT_MAX_FILES,
  DEFAULT_LEVEL
} from './constants/index.js';

export { isValidLogLevel } from './types/index.js';

// Re-export winston for advanced usage
export { default as winston } from 'winston';