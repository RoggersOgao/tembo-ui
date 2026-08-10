// packages/logger/src/core/logger.ts
import winston from 'winston';
import 'winston-daily-rotate-file';
import {
  LoggerOptions,
  LogLevel,
  LogContext,
  DEFAULT_CONFIG,
  isValidLogLevel
} from '../types/index.js';
import { createSyncTransports, createAsyncTransports } from '../transports/index.js';
import { createFormatter } from '../formatters/index.js';

class Logger {
  private instance!: winston.Logger;
  private options: LoggerOptions;
  private ready: Promise<void> = Promise.resolve();
  private shutdownHandlersRegistered = false;

  constructor(options: LoggerOptions = {}) {
    this.options = { ...DEFAULT_CONFIG, ...options };
    this.initializeSync();
    this.ready = this.initializeAsync();
  }

  private initializeSync(): void {
    const format = createFormatter(
      this.options.environment,
      this.options.redactKeys ?? [],
      this.options.enableAsyncContext ?? true
    );

    this.instance = winston.createLogger({
      level: this.options.level,
      levels: winston.config.npm.levels,
      format,
      transports: createSyncTransports(this.options),
      // Exception/rejection handlers deliberately only use sync (console +
      // file) transports — we never want crash reporting to depend on a
      // network call to CloudWatch/Logtail succeeding during a process
      // that may already be in a bad state.
      exceptionHandlers: this.options.exceptionHandlers
        ? createSyncTransports({ ...this.options, level: 'error', enableConsole: false })
        : undefined,
      rejectionHandlers: this.options.rejectionHandlers
        ? createSyncTransports({ ...this.options, level: 'error', enableConsole: false })
        : undefined,
      exitOnError: this.options.exitOnError ?? false,
    });

    if (this.options.defaultMeta) {
      this.instance.defaultMeta = {
        ...this.instance.defaultMeta,
        ...this.options.defaultMeta
      };
    }
  }

  /**
   * Loads optional cloud transports (CloudWatch, Logtail) via dynamic
   * import and attaches them once ready. Logging works immediately via
   * the sync transports (console/file) set up in the constructor — this
   * just adds the network-backed ones in the background. Await
   * `whenReady()` if you need a guarantee they're attached (e.g. before
   * a serverless function returns).
   */
  private async initializeAsync(): Promise<void> {
    try {
      const asyncTransports = await createAsyncTransports(this.options);
      for (const transport of asyncTransports) {
        this.instance.add(transport);
      }
    } catch (error) {
      this.instance.error('Failed to initialize async transports', {
        error: error instanceof Error ? error.message : error,
      });
    }
  }

  /** Resolves once any async transports (CloudWatch/Logtail) have attempted to attach. */
  whenReady(): Promise<void> {
    return this.ready;
  }

  /**
   * Create a child logger with additional bound context. Uses Winston's
   * built-in `.child()` — cheap, no new transports/logger spun up, safe to
   * call once per request.
   *
   * For most request-scoped logging, prefer wrapping the request in
   * runWithLogContext() (see context/index.ts) instead: it propagates
   * requestId/correlationId/userId automatically to every logger.*() call
   * in the async call chain, including code that never sees `req` or a
   * child logger reference at all.
   */
  child(context: LogContext): winston.Logger {
    return this.instance.child(context);
  }

  error(message: string, meta?: LogContext): void {
    this.instance.error(message, meta);
  }

  warn(message: string, meta?: LogContext): void {
    this.instance.warn(message, meta);
  }

  info(message: string, meta?: LogContext): void {
    this.instance.info(message, meta);
  }

  http(message: string, meta?: LogContext): void {
    this.instance.http(message, meta);
  }

  debug(message: string, meta?: LogContext): void {
    this.instance.debug(message, meta);
  }

  verbose(message: string, meta?: LogContext): void {
    this.instance.verbose(message, meta);
  }

  log(level: LogLevel, message: string, meta?: LogContext): void {
    this.instance.log(level, message, meta);
  }

  performance(action: string, duration: number, meta?: LogContext): void {
    this.instance.info(`Performance: ${action}`, {
      ...meta,
      action,
      duration,
      unit: 'ms'
    });
  }

  audit(action: string, userId: string, details: LogContext): void {
    this.instance.info(`Audit: ${action}`, {
      ...details,
      action,
      userId,
      timestamp: new Date().toISOString()
    });
  }

  getWinstonLogger(): winston.Logger {
    return this.instance;
  }

  updateOptions(options: Partial<LoggerOptions>): void {
    this.options = { ...this.options, ...options };
    this.initializeSync();
    this.ready = this.initializeAsync();
  }

  addTransport(transport: winston.transport): void {
    this.instance.add(transport);
  }

  removeTransport(transport: winston.transport): void {
    this.instance.remove(transport);
  }

  /**
   * Flush and close all transports. Call this before process exit so
   * buffered file/network writes aren't lost (e.g. from a SIGTERM
   * handler during a deploy). See registerShutdownHandlers() for an
   * opt-in helper that wires this to SIGTERM/SIGINT automatically.
   */
  async close(): Promise<void> {
    const closePromises = this.instance.transports.map((transport) => {
      return new Promise<void>((resolve) => {
        if (typeof (transport as any).close === 'function') {
          (transport as any).close(() => resolve());
        } else {
          resolve();
        }
      });
    });

    await Promise.all(closePromises);
  }

  /**
   * Opt-in: registers SIGTERM/SIGINT handlers that flush and close all
   * transports before letting the process exit. Not called automatically
   * on construction — library code shouldn't install global process
   * listeners as a side effect of being imported, since that can clash
   * with a host application's own shutdown sequencing. Call this once
   * from your app's entrypoint:
   *
   *   import { logger } from '@your-scope/logger';
   *   logger.registerShutdownHandlers();
   *
   * Idempotent — calling it more than once is a no-op after the first call.
   */
  registerShutdownHandlers(options: { exit?: boolean } = {}): void {
    if (this.shutdownHandlersRegistered) return;
    this.shutdownHandlersRegistered = true;

    const { exit = true } = options;

    const shutdown = (signal: string) => {
      this.instance.info(`Received ${signal}, flushing logs before exit`);
      this.close()
        .catch((err) => {
          // Use console here deliberately — the logger's own transports
          // may already be closing/closed at this point.
          console.error('[logger] Error while closing transports:', err);
        })
        .finally(() => {
          if (exit) process.exit(0);
        });
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
  }
}

const resolveInitialLevel = (): LogLevel => {
  const envLevel = process.env.LOG_LEVEL;
  if (envLevel && !isValidLogLevel(envLevel)) {
    // Fall back rather than throw — a bad env var shouldn't crash startup,
    // but silently ignoring it would be worse, so this is loud on purpose.
    console.warn(
      `[logger] Invalid LOG_LEVEL "${envLevel}" — falling back to "info". ` +
      `Valid levels: error, warn, info, http, verbose, debug, silly.`
    );
    return 'info';
  }
  return (envLevel as LogLevel) || 'info';
};

const defaultOptions: LoggerOptions = {
  environment: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
  level: resolveInitialLevel(),
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'app',
    version: process.env.npm_package_version || '0.0.0'
  }
};

const loggerInstance = new Logger(defaultOptions);

export { Logger };
export default loggerInstance;