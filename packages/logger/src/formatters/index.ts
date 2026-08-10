// packages/logger/src/formatters/index.ts
import winston from 'winston';
import util from 'util';
import { LOG_COLORS } from '../types/index.js';
import { redact } from '../redact/index.js';
import { getLogContext } from '../context/index.js';

winston.addColors(LOG_COLORS);

// --- terminal styling helpers -------------------------------------------

const DIM = '\x1b[90m';
const RED = '\x1b[31m';
const RESET = '\x1b[0m';
const ANSI_RE = /\x1b\[[0-9;]*m/g;

const LEVEL_ICONS: Record<string, string> = {
  error: '❌',
  warn: '⚠️',
  info: '●',
  http: '🌐',
  verbose: '📝',
  debug: '🐞',
  silly: '✦',
};

// widest level name so columns line up ("verbose" = 7 chars)
const LABEL_WIDTH = 7;

// keys that are noisy on every line in dev; still shown for errors
const QUIET_KEYS = new Set(['service', 'version']);

// --- context / redaction formats (shared by dev + prod) -------------------

/**
 * Merges ambient context (set via runWithLogContext, e.g. per-request
 * requestId/correlationId/userId) into every log line's metadata.
 * Explicit fields passed to logger.info(msg, meta) win over ambient ones
 * on key collision.
 */
export const contextFormat = () =>
  winston.format((info) => {
    const ctx = getLogContext();
    if (ctx) {
      // Mutate the existing `info` object rather than spreading into a new
      // one — winston/logform attach internal Symbol(level)/Symbol(message)
      // properties to `info` that later formats (colorize, printf) depend
      // on. A new plain object silently drops those symbols and breaks
      // colorize with an opaque "colors[...] is not a function" error.
      const infoAny = info as Record<string, unknown>;
      for (const [key, value] of Object.entries(ctx)) {
        // explicit fields passed to logger.info(msg, meta) win over ambient context
        if (!(key in infoAny)) {
          infoAny[key] = value;
        }
      }
    }
    return info;
  })();

/**
 * Redacts sensitive fields (passwords, tokens, secrets, etc.) from
 * metadata before it's serialized to any transport. `extraKeys` lets a
 * given Logger instance add app-specific field names on top of the
 * built-in defaults.
 */
export const redactFormat = (extraKeys: readonly string[] = []) =>
  winston.format((info) => {
    // Same rule as contextFormat: mutate `info` in place, don't return a
    // fresh object, or winston's internal level/message symbols disappear.
    const infoAny = info as Record<string, unknown>;
    const { level, message, ...meta } = infoAny;
    const redactedMeta = redact(meta, extraKeys) as Record<string, unknown>;

    for (const key of Object.keys(meta)) {
      delete infoAny[key];
    }
    Object.assign(infoAny, redactedMeta);

    return info;
  })();

// --- formatters -----------------------------------------------------------

export const createFormatter = (
  environment: string = 'development',
  redactKeys: readonly string[] = [],
  useContext: boolean = true
) => {
  return environment === 'production'
    ? jsonFormatter(redactKeys, useContext)
    : prettyFormatter(redactKeys, useContext);
};

export const jsonFormatter = (
  redactKeys: readonly string[] = [],
  useContext: boolean = true
) => {
  return winston.format.combine(
    // errors() and splat() MUST run before contextFormat()/redactFormat().
    // splat() re-merges the ORIGINAL (unredacted, un-context-enriched) meta
    // object passed to logger.info(msg, meta) from its internal Symbol(splat)
    // args array — anything written to `info` before splat() runs gets
    // silently clobbered by that re-merge. Redaction and context injection
    // only stick if they happen after the merge is done.
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    ...(useContext ? [contextFormat()] : []),
    redactFormat(redactKeys),
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.json()
  );
};

/**
 * Dev-mode formatter: icon per level, aligned columns, dim timestamp,
 * pretty-printed (colorized) metadata block, and boxed stack traces.
 *
 * error   14:32:07.812  ✖ error   Failed to fetch user
 *     { userId: '123', code: 'ETIMEDOUT' }
 *     at fetchUser (src/users.ts:42:11)
 *     ...
 */
// Parses a `duration` meta value that may arrive as either a raw number
// (e.g. from logger.performance()/createPerformanceLogger, which pass
// duration as a number with a separate unit: 'ms' field) or a
// pre-formatted string like "45ms" (e.g. from createRequestLogger,
// logDatabaseQuery, logCacheOperation, which bake the unit into the
// string). Returns null if the value can't be interpreted as a duration,
// so callers can fall back to showing the raw value instead of a bogus
// "NaNms".
const formatDurationMs = (value: unknown): { text: string; ms: number } | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { text: `${value}ms`, ms: value };
  }
  if (typeof value === 'string') {
    const withUnit = value.match(/^(\d+(?:\.\d+)?)\s*ms$/i);
    if (withUnit) {
      return { text: value, ms: Number(withUnit[1]) };
    }
    const bare = Number(value);
    if (Number.isFinite(bare)) {
      return { text: `${bare}ms`, ms: bare };
    }
  }
  return null;
};

export const prettyFormatter = (
  redactKeys: readonly string[] = [],
  useContext: boolean = true
) => {
  return winston.format.combine(
    // See jsonFormatter for why errors()/splat() must run first.
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    ...(useContext ? [contextFormat()] : []),
    redactFormat(redactKeys),
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.colorize({ level: true }),
    winston.format.printf((info) => {
      const { timestamp, level, message, stack, ...meta } = info;
      const rawLevel = String(level).replace(ANSI_RE, '');
      const icon = LEVEL_ICONS[rawLevel] ?? '•';
      const pad = ' '.repeat(Math.max(0, LABEL_WIDTH - rawLevel.length));
      const label = `${level}${pad}`;
      let line = `${DIM}${timestamp}${RESET}  ${icon} ${label} ${message}`;

      // Filter meta based on level and content
      let shownMeta = Object.fromEntries(
        Object.entries(meta).filter(
          ([k]) => rawLevel === 'error' || !QUIET_KEYS.has(k)
        )
      );

      // Compact 404 logs — createRequestLogger/logApiRequest both log the
      // response status under `statusCode`, not `status` ("status" is a
      // different field used by logServiceLifecycle for lifecycle strings
      // like 'started'/'failed' — see the branch below). Checking the
      // wrong field meant this branch never matched a real request log.
      if (meta.statusCode === 404) {
        const requestPath = typeof meta.path === 'string' ? meta.path : undefined;
        const commonPaths = ['/favicon.ico', '/robots.txt', '/apple-touch-icon.png'];
        const suffix = requestPath && commonPaths.includes(requestPath) ? ' - ignored' : '';
        line = `${DIM}${timestamp}${RESET}  ${icon} ${label} ${meta.statusCode} ${meta.method} ${meta.path} [${meta.ip}]${suffix}`;
        shownMeta = {};
      } else if (meta.service && meta.status === 'started') {
        // Service startup logs
        const details = meta.details ? ` ${util.inspect(meta.details, { colors: true, compact: true })}` : '';
        line = `${DIM}${timestamp}${RESET}  ${icon} ${label} [${meta.service}] Started${details}`;
        shownMeta = {};
      }

      // HTTP/perf logs with duration — handles both raw-number and
      // pre-formatted-string duration values (see formatDurationMs above).
      // Using `!== undefined` rather than truthiness so a genuine 0ms
      // duration (falsy as a number) still renders instead of being
      // silently dropped.
      if (meta.duration !== undefined) {
        const parsed = formatDurationMs(meta.duration);
        if (parsed) {
          const durationColor = parsed.ms > 1000 ? RED : DIM;
          line += ` ${durationColor}${parsed.text}${RESET}`;
          delete shownMeta.duration;
        }
        // If it couldn't be parsed, leave it in shownMeta so the raw
        // value is still visible for debugging rather than disappearing.
      }

      // Show remaining metadata
      if (Object.keys(shownMeta).length > 0) {
        const rendered = util
          .inspect(shownMeta, { colors: true, depth: 4, compact: false, breakLength: 100 })
          .split('\n')
          .map((l) => `    ${l}`)
          .join('\n');
        line += `\n${rendered}`;
      }

      // Stack trace with better formatting
      if (stack) {
        const boxed = String(stack)
          .split('\n')
          .map((l) => `${RED}    ${l}${RESET}`)
          .join('\n');
        line += `\n${boxed}`;
      }

      return line;
    })
  );
};

export const colorizedFormatter = () => {
  return winston.format.combine(
    winston.format.colorize(),
    winston.format.simple()
  );
};