# @your-scope/logger — Complete Documentation

A Winston-based logger with structured JSON output in production, a colorized human-friendly format in development, automatic secret redaction, and ambient request context (via `AsyncLocalStorage`) so `requestId`/`correlationId`/`userId` show up on every log line downstream — without threading a logger reference through every function call.

```
src/
  types/       LogLevel, LogContext, LoggerOptions, constants — no external deps
  core/        The Logger class + the default singleton instance
  transports/  Console, file, daily-rotate-file, CloudWatch, Logtail
  formatters/  jsonFormatter (prod) / prettyFormatter (dev) + context/redact steps
  redact/      Recursive secret-redaction utility, used by the formatters
  context/     AsyncLocalStorage-based ambient log context
  helpers/     Express middleware + purpose-built logging helpers (audit, perf, DB, cache, ...)
  constants/   Re-exported + logger-specific constants
  index.ts     Everything re-exported from one place
```

---

## 1. Installation & Import Style

```ts
import logger from '@your-scope/logger';               // default export — the ready-to-use singleton
// or, named:
import { logger, Logger } from '@your-scope/logger';

logger.info('Server started', { port: 3000 });
logger.error('Failed to connect to DB', { error: err.message });
```

Everything else (types, transports, formatters, redaction, context helpers, Express middleware, constants) is available from the same root import:

```ts
import {
  logger,
  Logger,
  createRequestLogger,
  runWithLogContext,
  redact,
  LOG_LEVELS,
  DEFAULT_REDACT_KEYS,
  type LoggerOptions,
  type LogContext,
} from '@your-scope/logger';
```

---

## 2. Quick Start

```ts
import logger from '@your-scope/logger';

logger.info('User signed up', { userId: '123', plan: 'pro' });
logger.warn('Rate limit approaching', { userId: '123', remaining: 5 });
logger.error('Payment failed', { userId: '123', error: 'card_declined' });
logger.debug('Cache miss', { key: 'user:123' });
```

The default export is a ready-to-use singleton, already configured from environment variables (`NODE_ENV`, `LOG_LEVEL`, `SERVICE_NAME`) — see §6.1. You don't need to construct anything to start logging; reach for `new Logger(options)` (§6) only when you need a **separately configured** instance (different level, different transports, a different service name) from the shared default.

---

## 3. Log Levels

```ts
type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'verbose' | 'debug' | 'silly';
```

This is Winston's standard `npm` level set (`winston.config.npm.levels`), from most to least severe: `error` (0) → `warn` (1) → `info` (2) → `http` (3) → `verbose` (4) → `debug` (5) → `silly` (6). Setting `level: 'info'` logs everything at `info` and more severe (`info`, `warn`, `error`) but suppresses `http`/`verbose`/`debug`/`silly`.

```ts
export const LOG_LEVELS = {
  ERROR: 'error', WARN: 'warn', INFO: 'info', HTTP: 'http',
  DEBUG: 'debug', VERBOSE: 'verbose', SILLY: 'silly',
} as const;

export const LOG_COLORS = {
  error: 'red', warn: 'yellow', info: 'green', http: 'magenta',
  verbose: 'cyan', debug: 'blue', silly: 'gray',
} as const;
```

`isValidLogLevel(value: unknown): value is LogLevel` — a runtime type guard for values coming from `process.env`/config files, backed by a `Set` of the valid levels. Use this rather than a manual string comparison when validating user- or env-supplied level strings:

```ts
import { isValidLogLevel } from '@your-scope/logger';

if (!isValidLogLevel(process.env.LOG_LEVEL)) {
  console.warn('Invalid LOG_LEVEL, defaulting to info');
}
```

(The logger itself already does exactly this internally when it boots — see §6.1 — so you don't need to pre-validate `LOG_LEVEL` yourself unless you're validating some *other* source of a level string.)

---

## 4. `LogContext` — the shape of your metadata

```ts
interface LogContext {
  [key: string]: unknown;   // free-form — anything you want to attach to a log line
  timestamp?: string;
  correlationId?: string;
  requestId?: string;
  userId?: string;
  sessionId?: string;
  ip?: string;
  userAgent?: string;
}
```

Every `logger.info/warn/error/...` call takes `(message: string, meta?: LogContext)`. `LogContext` is intentionally `[key: string]: unknown` rather than `any` — this means TypeScript will still let you attach arbitrary structured fields (`{ orderId: '...', itemCount: 3 }`), but forces you to narrow the type before *using* a value pulled back out of metadata elsewhere, rather than letting `any` silently propagate.

```ts
logger.info('Order placed', {
  userId: 'u_123',
  orderId: 'o_456',
  itemCount: 3,
  total: 49.99,
});
```

---

## 5. `LoggerOptions` — every configuration knob

```ts
interface LoggerOptions {
  environment?: 'development' | 'production' | 'test';  // controls dev-pretty vs. prod-JSON formatting
  level?: LogLevel;                                       // minimum level that gets logged
  defaultMeta?: LogContext;                                // merged into every single log line
  transports?: TransportType[];                            // informational list; actual wiring is enableX below
  exceptionHandlers?: boolean;                              // catch uncaught exceptions, log them, don't crash by default
  rejectionHandlers?: boolean;                              // catch unhandled promise rejections
  exitOnError?: boolean;                                    // whether Winston exits the process on a handled exception
  logDir?: string;                                          // default 'logs'
  maxSize?: string;                                         // rotate size, e.g. '20m'
  maxFiles?: string;                                        // retention, e.g. '14d'
  filename?: string;                                        // override the default log filename
  enableConsole?: boolean;
  enableFile?: boolean;
  enableCloudWatch?: boolean;
  enableLogtail?: boolean;
  redactKeys?: string[];       // ADDITIONAL keys to redact, merged with DEFAULT_REDACT_KEYS — not a replacement
  enableAsyncContext?: boolean; // pick up ambient context from runWithLogContext() automatically; default true
}
```

Defaults (`DEFAULT_CONFIG`, merged under whatever you pass to `new Logger(options)`):

```ts
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
```

---

## 6. The `Logger` Class

### 6.1 The default singleton

`import logger from '@your-scope/logger'` gives you an already-constructed `Logger`, configured from environment variables at import time:

```ts
const defaultOptions: LoggerOptions = {
  environment: process.env.NODE_ENV || 'development',
  level: resolveInitialLevel(),   // reads process.env.LOG_LEVEL, validated (see below)
  defaultMeta: {
    service: process.env.SERVICE_NAME || 'app',
    version: process.env.npm_package_version || '0.0.0',
  },
};
```

`resolveInitialLevel()` reads `LOG_LEVEL` from the environment and validates it with `isValidLogLevel`. **An invalid value doesn't crash startup** — it logs a loud `console.warn` (not `logger.warn`, since the logger isn't constructed yet at that point) and falls back to `'info'`:

```
[logger] Invalid LOG_LEVEL "verbose-ish" — falling back to "info". Valid levels: error, warn, info, http, verbose, debug, silly.
```

`service` and `version` from `defaultMeta` are automatically merged onto **every** log line via Winston's `defaultMeta`, so every log entry is traceable to the emitting service/version without you passing those fields manually each time.

### 6.2 Constructing your own instance

```ts
import { Logger } from '@your-scope/logger';

const paymentsLogger = new Logger({
  environment: 'production',
  level: 'debug',
  defaultMeta: { service: 'payments-worker', version: '2.4.1' },
  enableFile: true,
  logDir: 'logs/payments',
  redactKeys: ['cardNumber', 'iban'],   // merged with DEFAULT_REDACT_KEYS, not a replacement
});
```

Construction has two phases:
1. **Synchronous** (`initializeSync`) — builds the Winston formatter chain and the sync transports (console, file/daily-rotate-file), and wires exception/rejection handlers. This all happens inside the constructor, so `paymentsLogger.info(...)` works immediately, on the same tick you construct it.
2. **Asynchronous** (`initializeAsync`, kicked off automatically at the end of the constructor) — dynamically `import()`s and attaches the optional cloud transports (CloudWatch, Logtail) if enabled. This runs in the background; logging already works via the sync transports while this is in flight.

```ts
await paymentsLogger.whenReady(); // resolves once cloud transports have attempted to attach (or failed and logged a warning)
```

Reach for `whenReady()` specifically in short-lived environments (e.g. a serverless function) where you need a guarantee that CloudWatch/Logtail delivery was attempted before the process/function is frozen or torn down.

### 6.3 Logging methods

```ts
logger.error(message: string, meta?: LogContext): void;
logger.warn(message: string, meta?: LogContext): void;
logger.info(message: string, meta?: LogContext): void;
logger.http(message: string, meta?: LogContext): void;
logger.debug(message: string, meta?: LogContext): void;
logger.verbose(message: string, meta?: LogContext): void;
logger.log(level: LogLevel, message: string, meta?: LogContext): void; // dynamic-level variant
```

```ts
logger.error('Failed to process refund', { orderId: 'o_1', error: err.message });
logger.log('debug', 'Cache warm-up complete', { keys: 512 });
```

Two purpose-built convenience methods, in addition to the generic ones above:

```ts
logger.performance(action: string, duration: number, meta?: LogContext): void;
// → logger.info(`Performance: ${action}`, { ...meta, action, duration, unit: 'ms' })

logger.audit(action: string, userId: string, details: LogContext): void;
// → logger.info(`Audit: ${action}`, { ...details, action, userId, timestamp: <ISO now> })
```

### 6.4 Child loggers vs. ambient context — which to use

```ts
child(context: LogContext): winston.Logger;
```

`logger.child({ requestId, userId })` returns a real Winston logger with that context pre-bound to every call — cheap, no new transports spun up. But it's **opt-in per call site**: only code that actually holds a reference to that child logger gets the bound fields.

For anything request-scoped, prefer `runWithLogContext()` (§9) instead: it propagates context through the entire async call chain automatically — including service/repository code many layers down that never receives `req` or a logger reference at all. `createRequestLogger` (§10.1) uses both: a child logger attached to `req.logger` for callers who want an explicit reference, **and** `runWithLogContext` so every other `logger.*()` call anywhere in that request's async chain picks the context up automatically too.

### 6.5 Runtime reconfiguration & transport management

```ts
updateOptions(options: Partial<LoggerOptions>): void;  // merges into current options, then rebuilds sync+async transports
addTransport(transport: winston.transport): void;
removeTransport(transport: winston.transport): void;
getWinstonLogger(): winston.Logger;                      // escape hatch for anything this class doesn't wrap
```

```ts
logger.updateOptions({ level: 'debug' }); // e.g. temporarily raise verbosity without restarting the process
```

### 6.6 Shutdown — flushing buffered writes

```ts
async close(): Promise<void>;
```

Waits for every attached transport to finish flushing/closing (file writes, in-flight network deliveries to CloudWatch/Logtail) before resolving. Call this before process exit so you don't lose buffered log lines.

```ts
registerShutdownHandlers(options: { exit?: boolean } = {}): void;
```

Opt-in: wires `SIGTERM`/`SIGINT` to call `close()` and then `process.exit(0)` (unless you pass `{ exit: false }`). **Not called automatically** — a logging library shouldn't install global process listeners as a side effect of merely being imported, since that could clash with a host application's own shutdown sequencing. Call it once, explicitly, from your app's entrypoint:

```ts
import logger from '@your-scope/logger';
logger.registerShutdownHandlers();
```

Idempotent — calling it more than once after the first is a no-op, so it's safe even if multiple modules call it defensively.

---

## 7. Transports

### 7.1 Sync transports — console & file (safe in a constructor)

```ts
createSyncTransports(options: LoggerOptions): winston.transport[];
```

Called synchronously from the `Logger` constructor. In production, file logging is split into two daily-rotating files: an `error`-level-only file (`error-%DATE%.log`) and a full `combined-%DATE%.log`. In development, it's a single flat `development.log` (no rotation) — rotation/retention only matters once you're actually running for a long time in production.

```ts
consoleTransport(options: LoggerOptions): winston.transport;
// Deliberately has NO format of its own — see the note in §8: the
// logger-level format (from createFormatter) already runs
// context+redact+colorize+printf/json exactly once. Giving the
// transport its own colorize()+simple() on top double-processes the
// line and produces garbled, doubly-colorized output.

fileTransport(options: LoggerOptions): winston.transport;
// Flat file, 5MB max size, keeps 5 old files.

dailyRotateFileTransport(options: LoggerOptions): winston.transport;
// Rotates daily, gzips old files (zippedArchive: true), maxSize/maxFiles
// from options (defaults '20m' / '14d').
```

### 7.2 Async transports — CloudWatch & Logtail (optional peer dependencies)

```ts
createAsyncTransports(options: LoggerOptions): Promise<winston.transport[]>;
```

Only attempted when the relevant `enableX` flag **and** its required environment variable are both present:
- CloudWatch: `enableCloudWatch: true` **and** `AWS_CLOUDWATCH_GROUP_NAME` set.
- Logtail: `enableLogtail: true` **and** `LOGTAIL_SOURCE_TOKEN` set.

```ts
logtailTransport(options: LoggerOptions): Promise<winston.transport | null>;
cloudWatchTransport(options: LoggerOptions): Promise<winston.transport | null>;
```

Both use `@logtail/node`/`@logtail/winston` and `winston-cloudwatch` respectively as **optional peer dependencies** — they're dynamically `import()`ed rather than statically imported, specifically so:
1. You don't have to install them at all if you don't use CloudWatch/Logtail.
2. A missing/uninstalled package doesn't crash your app on startup — the `import()` is wrapped in try/catch, and a failure just logs a `console.error` warning (`[logger] Logtail transport unavailable — is @logtail/node / @logtail/winston installed?`) and returns `null`, which the caller filters out rather than pushing into the transport list.

```ts
cloudWatchTransport(options).catch(...); // not actually needed — errors are already swallowed internally and logged
```

CloudWatch config, read from the environment when the transport is constructed: `AWS_CLOUDWATCH_GROUP_NAME` (required to even attempt), `AWS_CLOUDWATCH_STREAM_NAME` (default `'app-logs'`), `AWS_REGION` (default `'us-east-1'`).

### 7.3 `createTransports` (deprecated)

```ts
/** @deprecated */
createTransports(options: LoggerOptions): Promise<winston.transport[]>;
// = [...createSyncTransports(options), ...(await createAsyncTransports(options))]
```

Kept only for backwards compatibility with code calling it directly. Because it awaits network/module loading, it **can't be used synchronously** — which is exactly why the `Logger` class itself doesn't use it, and instead calls `createSyncTransports` from its (sync) constructor and `createAsyncTransports` separately from its async init step. Prefer the two split functions directly in new code.

### 7.4 Why exception/rejection handlers never use the cloud transports

```ts
exceptionHandlers: this.options.exceptionHandlers
  ? createSyncTransports({ ...this.options, level: 'error', enableConsole: false })
  : undefined,
```

Uncaught-exception/unhandled-rejection logging is deliberately restricted to **sync** transports only (file, not console in this case, and never CloudWatch/Logtail). The reasoning: you don't want your crash-reporting path itself blocked on — or silently dropped by — a network call to a third-party log shipper succeeding, especially while the process may already be in a compromised state during a crash.

---

## 8. Formatters — how a log line actually gets rendered

```ts
createFormatter(environment?: string, redactKeys?: readonly string[], useContext?: boolean);
// → jsonFormatter(...) if environment === 'production', else prettyFormatter(...)
```

Both formatters share the same **ordered** pipeline, and the order is load-bearing (see the inline comments in the source):

```ts
winston.format.errors({ stack: true }),   // must run first — extracts .stack from Error objects
winston.format.splat(),                    // must run second — re-merges the ORIGINAL meta object
                                            //   from logger.info(msg, meta)'s internal Symbol(splat)
                                            //   args; anything written to `info` before this runs
                                            //   gets silently clobbered by that re-merge
...(useContext ? [contextFormat()] : []),  // merge in ambient context from runWithLogContext (§9)
redactFormat(redactKeys),                  // strip secrets (§11) — after context, so injected
                                            //   context fields get a chance to be redacted too
winston.format.timestamp({ ... }),
/* then, format-specific: */ winston.format.json()  // prod
                          /* or */ winston.format.colorize() + printf(...)  // dev
```

**Why `contextFormat`/`redactFormat` mutate `info` in place instead of returning a new object:** Winston/logform attach internal `Symbol(level)`/`Symbol(message)` properties onto the `info` object that later steps (`colorize`, `printf`) depend on. Returning a fresh plain object from a custom format step silently drops those symbols and breaks `colorize` with an opaque `"colors[...] is not a function"` error. Both custom formats in this package are written to avoid that trap — worth knowing if you ever add your own format step to the chain.

### 8.1 `jsonFormatter` — production

Structured, one-line JSON per entry — the shape a log aggregator (Datadog, CloudWatch Insights, Logtail, etc.) expects:

```json
{"level":"error","message":"Failed to process refund","service":"payments-worker","version":"2.4.1","requestId":"a1b2c3","orderId":"o_1","error":"card_declined","timestamp":"2026-08-11 09:30:00.512"}
```

### 8.2 `prettyFormatter` — development

Aligned, colorized, icon-per-level console output, with a few special-cased shapes for readability:

```
09:30:00.512  ● info    Order placed
    { userId: 'u_123', orderId: 'o_456', itemCount: 3, total: 49.99 }

09:30:01.004  🌐 http    200 GET /health [::1]

09:30:02.117  🌐 http    404 GET /favicon.ico [::1] - ignored

09:30:03.400  ❌ error   Failed to process refund       412ms
    { orderId: 'o_1', error: 'card_declined' }
    at processRefund (src/payments.ts:88:13)
    at ...
```

Notable dev-format behaviors:
- **404 requests** (`meta.statusCode === 404`, from `createRequestLogger`/`logApiRequest` — note this is `statusCode`, not `status`, which is a different field used for service lifecycle strings) collapse to a single compact line, and common noise paths (`/favicon.ico`, `/robots.txt`, `/apple-touch-icon.png`) get an explicit `- ignored` suffix so they don't look like real problems while you're scanning a busy dev console.
- **Service lifecycle logs** (`meta.service` present and `meta.status === 'started'`, from `logServiceLifecycle`) collapse to `[service] Started <details>`.
- **Duration values** are recognized whether they arrive as a raw number (e.g. from `logger.performance()`/`createPerformanceLogger`, which pass a numeric `duration` plus a separate `unit: 'ms'`) or as a pre-formatted string like `"45ms"` (e.g. from `createRequestLogger`, `logDatabaseQuery`, `logCacheOperation`, which bake the unit into the string already). Either way it's rendered right after the message, colored red if it exceeds 1000ms, dim gray otherwise — and a genuine `0ms` duration still renders (the check is `!== undefined`, not truthiness, so a falsy-but-real `0` isn't dropped).
- **`service`/`version`** (from `defaultMeta`, present on every line) are hidden on non-error lines to reduce noise, and shown again for `error`-level lines where you want full context.
- Remaining metadata is pretty-printed with `util.inspect` (`depth: 4`, colorized, indented) under the message line; stack traces are boxed in red, one indented line per frame.

### 8.3 `colorizedFormatter`

A minimal `colorize() + simple()` combo, exported standalone for cases where you want to hand a bare formatter to some other Winston setup outside this package's own `Logger` class — not used internally by `createFormatter`.

---

## 9. Ambient Context Propagation (`context/`)

Built on Node's `AsyncLocalStorage`, so context set once at the start of an async operation (e.g. an incoming HTTP request) is automatically visible to every `logger.*()` call anywhere in that operation's async call chain — including deeply nested service/repository/database code that never receives `req` or any logger reference at all.

```ts
runWithLogContext<T>(context: LogContext, fn: () => T): T;
getLogContext(): LogContext | undefined;
updateLogContext(patch: LogContext): void;
```

```ts
import { runWithLogContext, getLogContext, updateLogContext } from '@your-scope/logger';
import logger from '@your-scope/logger';

runWithLogContext({ requestId: 'req_1', userId: 'u_1' }, async () => {
  logger.info('Starting checkout');        // includes requestId + userId automatically

  await processOrder();                    // any logger call inside here ALSO includes them,
                                            // even though processOrder() never sees requestId/userId

  updateLogContext({ orderStatus: 'paid' }); // add a field mid-flow
  logger.info('Checkout complete');          // now includes requestId, userId, AND orderStatus
});

async function processOrder() {
  logger.debug('Charging card');   // requestId + userId show up here too, automatically
  const ctx = getLogContext();     // read the ambient context directly, if you need to branch on it
}
```

**Nesting:** calling `runWithLogContext` again inside an already-active context **merges** on top of the existing context rather than replacing it — so a nested "worker" or "sub-task" scope can add its own fields without losing the outer request's `requestId`.

**How it reaches the formatter:** `contextFormat()` (§8) calls `getLogContext()` on every single log line and merges any ambient fields in — but only for keys not already explicitly present in that call's own `meta` object, so an explicit field you pass to `logger.info(msg, { requestId: 'override' })` always wins over the ambient one. This whole mechanism is gated by `enableAsyncContext` in `LoggerOptions` (default `true`) — set it to `false` if you want a `Logger` instance that ignores ambient context entirely and only logs whatever's explicitly passed per call.

---

## 10. Express Helpers (`helpers/`)

> **Import note:** helpers import the default logger from `../core/logger.js` directly, not via the package's own barrel (`index.ts`) — importing the barrel from inside the package would create a circular dependency (`index.ts → helpers/index.ts → index.ts`), since `index.ts` itself re-exports everything from `helpers/index.ts`. This only matters if you're editing the package itself; consumers just `import { createRequestLogger } from '@your-scope/logger'` as usual.

### 10.1 `createRequestLogger` — request/response logging middleware

```ts
createRequestLogger(options?: {
  excludePaths?: string[];      // default ['/health', '/metrics', '/favicon.ico']
  logRequestBody?: boolean;      // default false
  logResponseBody?: boolean;     // default false
}): (req, res, next) => void;
```

```ts
import express from 'express';
import { createRequestLogger } from '@your-scope/logger';

const app = express();
app.use(createRequestLogger({ logRequestBody: true }));
```

What it does, per request:
1. Skips entirely (calls `next()` immediately) for any path starting with one of `excludePaths` — keeps health-check/metrics polling out of your logs.
2. Resolves a `requestId` (reuses an incoming `x-request-id` header if present, otherwise generates a UUID via `uuid`), sets it back on both the request header and the `x-request-id` response header.
3. Builds a `LogContext` (`requestId`, `method`, `path`, `ip`, `userAgent`) and:
   - attaches a Winston **child logger** with that context to `req.logger`, for handlers that want an explicit reference;
   - wraps the rest of request handling in `runWithLogContext(context, ...)` (§9), so **every** `logger.*()` call anywhere downstream — including deep in service code that never sees `req` — automatically includes `requestId`/`method`/`path`/`ip`/`userAgent` too, with zero extra plumbing.
4. Logs an `http`-level "Request started" line immediately, and patches `res.send` so a matching "Request completed" line (with `statusCode`, `duration`, `contentLength`, and optionally a truncated response body) is logged right before the response actually goes out.

```ts
app.get('/orders/:id', async (req, res) => {
  // req.logger is available explicitly if you want it:
  req.logger.info('Fetching order', { orderId: req.params.id });

  // but you don't need it — this works identically, picked up via ambient context:
  const order = await orderService.find(req.params.id); // logs inside here also get requestId etc.
  res.json(order);
});
```

### 10.2 The rest of the purpose-built helpers

Each of these is a thin, opinionated wrapper around `logger.info`/`logger.debug`/`logger.error` that standardizes the shape of a common kind of log line — use them instead of hand-building the metadata object yourself so every call site produces consistent, greppable fields.

```ts
createErrorLogger(error: Error, context?: LogContext): void;
// logger.error(error.message, { error: { name, message, stack }, ...context, timestamp })

createPerformanceLogger(operation: string, duration: number, meta?: LogContext): void;
// logger.info(`Performance: ${operation}`, { ...meta, operation, duration, unit: 'ms', timestamp })

createAuditLogger(action: string, userId: string, details?: LogContext): void;
// logger.info(`Audit: ${action}`, { ...details, action, userId, ip: details.ip ?? 'unknown', userAgent: ..., timestamp })

logDatabaseQuery(query: string, params?: any[], duration: number, context?: LogContext): void;
// logger.debug('Database Query', { ...context, query: query.slice(0, 500), params: params.slice(0, 10), duration: `${duration}ms`, timestamp })
// query text is truncated to 500 chars and params to the first 10 entries so a runaway query/param list can't blow up a log line

logCacheOperation(operation: string, key: string, success: boolean, duration?: number, context?: LogContext): void;
// logger.debug('Cache Operation', { ...context, operation, key, success, duration: duration ? `${duration}ms` : undefined, timestamp })

logBusinessAction(action: string, data: Record<string, any>, userId?: string): void;
// logger.info(`Business Action: ${action}`, { ...data, action, userId, timestamp })

logServiceLifecycle(service: string, status: 'starting'|'started'|'stopping'|'stopped'|'failed', details?: any): void;
// logger.info(`Service ${status}: ${service}`, { service, status, details, timestamp })
// this is the exact shape prettyFormatter special-cases (§8.2) into "[service] Started ..."

logApiRequest(req: any, res: any, responseTime: number): void;
// logger.http('API Request', { method, url: originalUrl, statusCode, responseTime: `${responseTime}ms`, ip, userId, userAgent, timestamp })
// ported from a retired config/logger.config.ts — an alternative to createRequestLogger for
// codebases that already compute their own timing and just want the log line

morganStream: { write(message: string): void };
// an object shaped for Morgan's `stream` option — routes Morgan's HTTP access lines through
// logger.http() instead of straight to stdout, so they get JSON/pretty formatting + redaction too
```

**Usage examples:**

```ts
// Global error handler
app.use((err, req, res, next) => {
  createErrorLogger(err, { requestId: req.headers['x-request-id'] as string });
  res.status(500).json({ error: 'Internal server error' });
});

// Timing an operation by hand
const start = Date.now();
await sendEmail(user);
createPerformanceLogger('send_welcome_email', Date.now() - start, { userId: user.id });

// Security-relevant action
createAuditLogger('password_changed', user.id, { ip: req.ip, userAgent: req.get('user-agent') });

// Service startup
logServiceLifecycle('payments-worker', 'started', { port: 4000, workers: 4 });

// Morgan integration
import morgan from 'morgan';
import { morganStream } from '@your-scope/logger';
app.use(morgan('combined', { stream: morganStream }));
```

---

## 11. Redaction (`redact/`)

```ts
redact(value: unknown, extraKeys?: readonly string[], depth?: number): unknown;
```

Recursively walks an object/array and replaces the **value** of any key that matches — case-insensitively, as a **substring** — one of `DEFAULT_REDACT_KEYS` combined with any `extraKeys` you supply, with the literal string `'[REDACTED]'`.

```ts
export const DEFAULT_REDACT_KEYS = [
  'password', 'passwd', 'secret', 'token', 'apikey', 'api_key',
  'authorization', 'auth', 'creditcard', 'credit_card', 'cvv',
  'ssn', 'privatekey', 'private_key',
] as const;
```

Because matching is substring-based, `authToken`, `AUTHORIZATION`, `user_password`, and `stripeApiKey` **all** match without you needing to enumerate every possible field name — a real safety margin against a slightly-differently-named secret slipping through.

```ts
redact({ email: 'a@b.com', password: 'hunter2', profile: { authToken: 'abc123' } });
// → { email: 'a@b.com', password: '[REDACTED]', profile: { authToken: '[REDACTED]' } }
```

Behavior worth knowing:
- **Recursion depth-limited to 6** (`MAX_DEPTH`) — beyond that, values are returned as-is rather than descended into further, as a guard against pathological/circular-ish structures.
- **Arrays** are mapped over, redacting each element.
- **Only plain objects are descended into.** `Error` instances, `Date`s, `Buffer`s, and any other class instance (checked via `Object.getPrototypeOf(value) === Object.prototype || null`) are passed through untouched rather than having their internal structure/prototype mangled — so logging an `Error` object still gives you a usable `Error`, not a stripped-down plain object.
- This runs as part of every formatter (`redactFormat`, §8) automatically, on every log line, before it reaches any transport — so a secret never reaches disk, stdout, or a third-party shipper even if a call site accidentally logs a full request body, user object, or headers object.

**Per-instance additional keys** — merged with, not replacing, the defaults:

```ts
const paymentsLogger = new Logger({ redactKeys: ['cardNumber', 'iban', 'routingNumber'] });
paymentsLogger.info('Processing payment', { cardNumber: '4111111111111111', amount: 49.99 });
// logged metadata: { cardNumber: '[REDACTED]', amount: 49.99 }
```

You can also call `redact()` directly yourself outside the logging pipeline — e.g. before writing an object to a non-Winston destination (an audit table, an error-tracking SDK payload) where you want the same redaction guarantees:

```ts
import { redact } from '@your-scope/logger';
const safeBody = redact(req.body, ['ssn']);
await auditTable.insert({ requestId, body: safeBody });
```

---

## 12. Constants (`constants/`, plus a few from `types/`)

```ts
// Re-exported from types/index.ts:
LOG_LEVELS, LOG_COLORS, DEFAULT_CONFIG, DEFAULT_REDACT_KEYS

// Defined directly in constants/index.ts:
ENVIRONMENTS: readonly ['development', 'production', 'test'];
DEFAULT_LOG_DIR: 'logs';
DEFAULT_MAX_SIZE: '20m';
DEFAULT_MAX_FILES: '14d';
DEFAULT_LEVEL: 'info';
```

Useful for validating config (e.g. `ENVIRONMENTS.includes(someEnvString)`) or building your own tooling around the same defaults the logger itself uses.

---

## 13. End-to-End Example

```ts
// logger.ts — a dedicated instance for this service, registered once at startup
import { Logger } from '@your-scope/logger';

export const logger = new Logger({
  environment: (process.env.NODE_ENV as any) || 'development',
  level: (process.env.LOG_LEVEL as any) || 'info',
  defaultMeta: { service: 'orders-api', version: process.env.npm_package_version },
  enableFile: true,
  logDir: 'logs/orders-api',
  enableCloudWatch: process.env.NODE_ENV === 'production',
  redactKeys: ['cardNumber'],
});

logger.registerShutdownHandlers(); // flush on SIGTERM/SIGINT — call this once, at the entrypoint
```

```ts
// app.ts
import express from 'express';
import { createRequestLogger, createErrorLogger, logServiceLifecycle } from '@your-scope/logger';
import { logger } from './logger.js';

const app = express();
app.use(express.json());
app.use(createRequestLogger({ excludePaths: ['/health'] }));

app.post('/orders', async (req, res) => {
  // No logger reference needed here — ambient context (requestId, method, path, ip)
  // from createRequestLogger is already attached to every call in this async chain.
  logger.info('Creating order', { itemCount: req.body.items?.length });

  try {
    const order = await orderService.create(req.body); // logs inside orderService ALSO get requestId etc.
    logger.audit('order_created', req.body.userId, { orderId: order.id });
    res.status(201).json(order);
  } catch (err) {
    createErrorLogger(err as Error, { userId: req.body.userId });
    res.status(500).json({ error: 'Failed to create order' });
  }
});

app.listen(3000, () => {
  logServiceLifecycle('orders-api', 'started', { port: 3000 });
});
```

```ts
// order.service.ts — nowhere near req/res, still gets full request context automatically
import logger from '@your-scope/logger';

export const orderService = {
  async create(input: CreateOrderInput) {
    logger.debug('Validating order input');            // includes requestId, method, path, ip automatically
    const start = Date.now();
    const order = await db.orders.insert(input);
    logger.performance('db.orders.insert', Date.now() - start, { orderId: order.id });
    return order;
  },
};
```

Sample output — development (`prettyFormatter`):

```
09:41:02.010  🌐 http    Request started: POST /orders
09:41:02.014  ● info     Creating order
    { requestId: 'a1b2c3d4', method: 'POST', path: '/orders', ip: '::1', userAgent: 'curl/8.4.0', itemCount: 2 }
09:41:02.016  🐞 debug    Validating order input
    { requestId: 'a1b2c3d4', method: 'POST', path: '/orders', ip: '::1', userAgent: 'curl/8.4.0' }
09:41:02.061  ● info     Performance: db.orders.insert       45ms
    { requestId: 'a1b2c3d4', orderId: 'o_789', action: 'db.orders.insert' }
09:41:02.063  ● info     Audit: order_created
    { requestId: 'a1b2c3d4', action: 'order_created', userId: 'u_1', orderId: 'o_789' }
09:41:02.065  🌐 http    Request completed: POST /orders
    { requestId: 'a1b2c3d4', statusCode: 201, duration: '55ms', contentLength: '142' }
```

Same request, production (`jsonFormatter`) — one line per entry, secrets redacted, ready for a log aggregator:

```json
{"level":"info","message":"Creating order","service":"orders-api","version":"2.4.1","requestId":"a1b2c3d4","method":"POST","path":"/orders","ip":"::1","userAgent":"curl/8.4.0","itemCount":2,"timestamp":"2026-08-11 09:41:02.014"}
{"level":"info","message":"Audit: order_created","service":"orders-api","version":"2.4.1","requestId":"a1b2c3d4","action":"order_created","userId":"u_1","orderId":"o_789","timestamp":"2026-08-11 09:41:02.063"}
```

---

## 14. Gotchas Checklist

- Don't give `consoleTransport` its own `colorize()`/`simple()` format — the logger-level formatter chain (`createFormatter`) already colorizes and formats the line once; adding a second format step doubles it into garbled, doubly-escaped output.
- `contextFormat`/`redactFormat` **mutate** the `info` object in place rather than returning a new one — if you write your own custom Winston format step for this logger, do the same, or you'll silently break `colorize` by dropping Winston's internal `Symbol(level)`/`Symbol(message)` properties.
- `errors({ stack: true })` and `splat()` must run **before** `contextFormat`/`redactFormat` in the pipeline — `splat()` re-merges the original, unmodified meta object, which would otherwise clobber anything written earlier by context/redaction.
- `redactKeys` in `LoggerOptions` is **additive** — it's merged with `DEFAULT_REDACT_KEYS`, not a replacement for it. You never need to re-list `password`/`token`/etc. yourself.
- Exception/rejection handlers only ever use sync transports (file), never console or CloudWatch/Logtail — crash reporting shouldn't depend on a network call succeeding while the process is already in a bad state.
- `registerShutdownHandlers()` is opt-in and must be called explicitly once from your app's entrypoint — importing the package never installs `SIGTERM`/`SIGINT` listeners as a side effect.
- Prefer `runWithLogContext()` over manually threading a child logger through every function call for anything request-scoped — it reaches code that never sees `req` at all, with zero extra plumbing.
- CloudWatch/Logtail transports require **both** the corresponding `enableX: true` flag **and** the relevant environment variable (`AWS_CLOUDWATCH_GROUP_NAME` / `LOGTAIL_SOURCE_TOKEN`) to be set — missing either one means that transport is silently skipped (not an error), so double-check both if logs aren't showing up where you expect.
- `createTransports` (the combined sync+async helper) is deprecated specifically because it's `async` and therefore unusable from a synchronous constructor — use `createSyncTransports` + `createAsyncTransports` separately, the way the `Logger` class itself does.