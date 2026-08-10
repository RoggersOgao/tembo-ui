// packages/logger/src/transports/index.ts
import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';
import { LoggerOptions } from '../types/index.js';

/**
 * Transports that can be constructed synchronously with no external
 * network/module-loading concerns: console + local file transports.
 * Safe to call from a synchronous constructor.
 */
export const createSyncTransports = (options: LoggerOptions): winston.transport[] => {
  const transports: winston.transport[] = [];
  const isProduction = options.environment === 'production';

  if (options.enableConsole) {
    transports.push(consoleTransport(options));
  }

  if (options.enableFile) {
    if (isProduction) {
      transports.push(
        dailyRotateFileTransport({
          ...options,
          level: 'error',
          filename: 'error-%DATE%.log',
        })
      );
      transports.push(
        dailyRotateFileTransport({
          ...options,
          filename: 'combined-%DATE%.log',
        })
      );
    } else {
      transports.push(
        fileTransport({
          ...options,
          filename: 'development.log',
        })
      );
    }
  }

  return transports;
};

/**
 * Transports that require loading optional third-party packages
 * (@logtail/*, winston-cloudwatch). These use dynamic `import()` rather
 * than `require()` so they work under `"type": "module"` / strict ESM,
 * and so a missing/uninstalled optional dependency doesn't crash app
 * startup — it just logs a warning and skips that transport.
 *
 * Call this from an async context (e.g. Logger's async init step) rather
 * than a constructor.
 */
export const createAsyncTransports = async (
  options: LoggerOptions
): Promise<winston.transport[]> => {
  const transports: winston.transport[] = [];

  if (options.enableCloudWatch && process.env.AWS_CLOUDWATCH_GROUP_NAME) {
    const transport = await cloudWatchTransport(options);
    if (transport) transports.push(transport);
  }

  if (options.enableLogtail && process.env.LOGTAIL_SOURCE_TOKEN) {
    const transport = await logtailTransport(options);
    if (transport) transports.push(transport);
  }

  return transports;
};

/**
 * @deprecated Kept for backwards compatibility with anything calling
 * createTransports() directly and expecting the full sync+async set.
 * Prefer createSyncTransports() in constructors and createAsyncTransports()
 * for the optional cloud transports, since this awaits network/module
 * loading and therefore can't be used synchronously.
 */
export const createTransports = async (options: LoggerOptions): Promise<winston.transport[]> => {
  return [...createSyncTransports(options), ...(await createAsyncTransports(options))];
};

export const consoleTransport = (options: LoggerOptions): winston.transport => {
  // No `format` here deliberately — the logger-level format set in
  // core/logger.ts (createFormatter -> prettyFormatter/jsonFormatter)
  // already runs contextFormat + redactFormat + colorize + printf/json
  // once. Giving this transport its own colorize()+simple() format made
  // that run a SECOND time on top, producing double-colorized, garbled
  // output (visible as doubled ANSI escape codes around the level name).
  return new winston.transports.Console({
    level: options.level,
  });
};

export const fileTransport = (options: LoggerOptions): winston.transport => {
  const logDir = options.logDir || 'logs';
  return new winston.transports.File({
    filename: path.join(logDir, options.filename || 'app.log'),
    level: options.level,
    maxsize: 5242880, // 5MB
    maxFiles: 5,
  });
};

export const dailyRotateFileTransport = (options: LoggerOptions): winston.transport => {
  const logDir = options.logDir || 'logs';
  return new DailyRotateFile({
    filename: path.join(logDir, options.filename || 'app-%DATE%.log'),
    datePattern: 'YYYY-MM-DD',
    zippedArchive: true,
    maxSize: options.maxSize || '20m',
    maxFiles: options.maxFiles || '14d',
    level: options.level,
  });
};

// These are optional peer dependencies — consumers who don't need
// CloudWatch/Logtail shouldn't be forced to install them just to
// typecheck or build this package. Routing the specifier through a
// non-literal `string` variable (rather than a string literal directly
// in `import(...)`) stops TypeScript from statically resolving/requiring
// type declarations for the module at compile time; it's still a normal
// dynamic import at runtime.
const LOGTAIL_NODE_SPECIFIER: string = '@logtail/node';
const LOGTAIL_WINSTON_SPECIFIER: string = '@logtail/winston';
const CLOUDWATCH_SPECIFIER: string = 'winston-cloudwatch';

export const logtailTransport = async (
  options: LoggerOptions
): Promise<winston.transport | null> => {
  try {
    const [{ Logtail }, { LogtailTransport }] = await Promise.all([
      import(LOGTAIL_NODE_SPECIFIER),
      import(LOGTAIL_WINSTON_SPECIFIER),
    ]);

    const logtail = new Logtail(process.env.LOGTAIL_SOURCE_TOKEN!);
    return new LogtailTransport(logtail, {
      level: options.level,
    });
  } catch (error) {
    console.error(
      '[logger] Logtail transport unavailable — is @logtail/node / @logtail/winston installed?',
      error
    );
    return null;
  }
};

export const cloudWatchTransport = async (
  options: LoggerOptions
): Promise<winston.transport | null> => {
  try {
    const mod: any = await import(CLOUDWATCH_SPECIFIER);
    const CloudWatchTransport = mod.default ?? mod.CloudWatchTransport ?? mod;

    return new CloudWatchTransport({
      logGroupName: process.env.AWS_CLOUDWATCH_GROUP_NAME!,
      logStreamName: process.env.AWS_CLOUDWATCH_STREAM_NAME || 'app-logs',
      awsRegion: process.env.AWS_REGION || 'us-east-1',
      level: options.level,
      messageFormatter: (log: any) =>
        `${log.level}: ${log.message} ${JSON.stringify(log.meta || {})}`,
    });
  } catch (error) {
    console.error(
      '[logger] CloudWatch transport unavailable — is winston-cloudwatch installed?',
      error
    );
    return null;
  }
};