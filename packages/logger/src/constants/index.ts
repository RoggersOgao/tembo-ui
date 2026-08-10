// packages/logger/src/constants/index.ts
export {
  LOG_LEVELS,
  LOG_COLORS,
  DEFAULT_CONFIG,
  DEFAULT_REDACT_KEYS
} from '../types/index.js';

export const ENVIRONMENTS = ['development', 'production', 'test'] as const;
export const DEFAULT_LOG_DIR = 'logs';
export const DEFAULT_MAX_SIZE = '20m';
export const DEFAULT_MAX_FILES = '14d';
export const DEFAULT_LEVEL = 'info';