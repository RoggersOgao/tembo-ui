import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import http from 'http';
import { fileURLToPath } from 'url';
import path from 'path';

import { corsOptions } from './config/cors';
import { validateEmailConfig } from './config/email.config';
import {
  logger,
  createRequestLogger,
  createErrorLogger,
  logServiceLifecycle,
} from '@repo/logger';
import { createExpressMiddleware } from '@repo/request-metadata';
import cacheService from './cache/cache.service';
import { emailTransporter } from './services/email-transporter';
import { closeSocket, getConnectedCount, initializeSocket } from './sockets/ws-server';
import analyticsWorker from './workers/analytics.worker';

// ── Route imports ────────────────────────────────────────────────────────────

import adminUserRoutes from './routes/user/new/admn-user.routes';
import analyticsRoute from './routes/analytics/analytics-route';
import consentRoute from './routes/analytics/consent-route';
import emailRoutes from './routes/emails/email.route';
import uploadsRouter from './routes/s3-upload/upload';
import userAuthTokens from './routes/user/new/auth-tokens.routes';
import auditLogRoutes from './routes/user/new/audit-log.routes';
import sessionRoutes from './routes/user/new/session.routes';
import securityAlertRoutes from './routes/user/new/securityAlert.routes';
import trustedDevicesRoutes from './routes/user/new/trusted-device.routes';
import profileRoutes from './routes/user/new/profile.routes';
import mfaDeviceRoutes from './routes/user/new/mfa-device.routes';
import userRoutes from './routes/user/new/user.routes';

// ── ESM-safe __dirname ───────────────────────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ── Typed app error ──────────────────────────────────────────────────────────
// NOTE: Consider moving AppError to a shared @repo/types package for monorepo reuse
export interface AppError extends Error {
  statusCode?: number;
  status?: number;
  errors?: unknown;
}

// ── Shutdown state ───────────────────────────────────────────────────────────
let isShuttingDown = false;

// ── Connection tracking for graceful drain ───────────────────────────────────
const connections = new Set<import('net').Socket>();

// ── App + server ─────────────────────────────────────────────────────────────
const app = express();
const server = http.createServer(app);

server.on('connection', (socket) => {
  connections.add(socket);
  socket.once('close', () => connections.delete(socket));
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  Trust proxy — must be set before any req.ip usage so Express resolves
 *  the real client IP rather than the proxy's address.
 * ───────────────────────────────────────────────────────────────────────────── */
app.set('trust proxy', 1);

/** ─────────────────────────────────────────────────────────────────────────────
 *  Security
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(helmet());
app.use(helmet.crossOriginResourcePolicy({ policy: 'cross-origin' }));

/** ─────────────────────────────────────────────────────────────────────────────
 *  CORS
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

/** ─────────────────────────────────────────────────────────────────────────────
 *  Body parsers — keep limits sane; large uploads go through the S3 route
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

/** ─────────────────────────────────────────────────────────────────────────────
 *  Request logging + correlation ID
 *
 *  This ONE middleware replaces what used to be three separate things:
 *   1. a hand-rolled "assign x-request-id" middleware
 *   2. a hand-rolled →/← logger.info request/response middleware
 *   3. this createRequestLogger() call
 *  All three were running back-to-back, which meant every request was
 *  logged twice and the request ID was generated/assigned twice.
 *
 *  createRequestLogger() already: generates/reuses x-request-id, sets it
 *  on both req and the response header, logs "Request started"/"Request
 *  completed" at `http` level, and — via runWithLogContext under the
 *  hood — makes requestId/method/path/ip/userAgent available to every
 *  logger.*() call for the rest of this request's async chain, including
 *  deep in route handlers/services that never see `req` directly.
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(createRequestLogger({
  excludePaths: ['/health', '/metrics'],
  logRequestBody: false, // careful: enabling this logs full request bodies (redaction still applies, but prefer opt-in per-route instead)
  logResponseBody: false,
}));

/** ─────────────────────────────────────────────────────────────────────────────
 *  Rate limiting
 * ───────────────────────────────────────────────────────────────────────────── */
const isHealthPath = (req: express.Request) =>
  req.path === '/health' || req.path === '/health/socket';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { status: 'error', message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: isHealthPath,
});

app.use('/api/', limiter);
app.use('/ormify-uploads/', limiter);

/** ─────────────────────────────────────────────────────────────────────────────
 *  Health checks (no auth, no rate-limit)
 * ───────────────────────────────────────────────────────────────────────────── */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV ?? 'development',
    memory: process.memoryUsage(),
  });
});

app.get('/health/socket', async (_req, res) => {
  try {
    const count = await getConnectedCount();
    res.json({
      status: 'ok',
      socketIO: 'initialized',
      connectedClients: count,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      socketIO: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
  }
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  Request metadata enrichment
 * ───────────────────────────────────────────────────────────────────────────── */
app.use(createExpressMiddleware({
  features: {
    ipDetection: true,
    userAgent: true,
    geolocation: true,
  },
  ipDetection: {
    trustedProxies: ['127.0.0.1', '::1'],
  },
}));

/** ─────────────────────────────────────────────────────────────────────────────
 *  API routes
 *  NOTE: more-specific analytics paths are registered before generic ones so
 *  Express matches them correctly (batch before event).
 * ───────────────────────────────────────────────────────────────────────────── */

app.use('/api/usr/admin', adminUserRoutes);
app.use('/api/analytics', analyticsRoute);
app.use('/api/consent', consentRoute);
app.use('/api/emails', emailRoutes);
app.use('/api', userRoutes);
app.use('/api/users/v1', auditLogRoutes);
app.use('/api/tokens', userAuthTokens);
app.use('/api/security', securityAlertRoutes);
app.use('/api/users/v1', sessionRoutes);
app.use('/api/device', trustedDevicesRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/mfa-device', mfaDeviceRoutes);

/** ─────────────────────────────────────────────────────────────────────────────
 *  Static files — use __dirname so the path is stable regardless of cwd
 * ───────────────────────────────────────────────────────────────────────────── */
app.use('/temp', express.static(path.join(__dirname, '../../temp')));
app.use('/uploads', express.static(path.join(__dirname, '../../temp/uploads')));

/** ─────────────────────────────────────────────────────────────────────────────
 *  Root
 * ───────────────────────────────────────────────────────────────────────────── */
app.get('/', (_req, res) => {
  res.json({
    message: 'Welcome to TEMBO API',
    version: '2.0.0',
    socketIO: 'enabled',
    documentation: {
      health: '/health',
      socketHealth: '/health/socket',
      api: '/api/*',
    },
  });
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  404
 * ───────────────────────────────────────────────────────────────────────────── */
app.use((req: express.Request, res: express.Response) => {
  logger.warn(`404 Not Found: ${req.method} ${req.path}`);
  res.status(404).json({
    status: 'error',
    message: 'Route not found',
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  Global error handler — MUST be last and MUST have 4 parameters.
 *
 *  This is now the ONLY error handler in the app. There used to be a
 *  second app.use((err, req, res, next) => {...}) further down, after
 *  gracefulShutdown() was defined — it was dead code (Express only
 *  reaches it if this one calls next(err) instead of ending the response,
 *  which it never did) and it referenced createErrorLogger without
 *  importing it, so it would have thrown at runtime the one time it
 *  *was* somehow reached. Consolidated into this single handler using
 *  the (now imported) createErrorLogger helper, which logs the error at
 *  `error` level with stack + requestId, redacting anything in `err`
 *  that matches a sensitive field pattern automatically.
 * ───────────────────────────────────────────────────────────────────────────── */
app.use((
  err: AppError,
  req: express.Request,
  res: express.Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: express.NextFunction,
) => {
  createErrorLogger(err, {
    requestId: req.headers['x-request-id'] as string,
    path: req.path,
    method: req.method,
    ip: req.ip,
  });

  const statusCode = err.statusCode ?? err.status ?? 500;
  const isProd = process.env.NODE_ENV === 'production';

  const body: Record<string, unknown> = {
    status: 'error',
    message: isProd ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString(),
  };

  if (!isProd && err.stack) body.stack = err.stack;
  if (err.errors) body.errors = err.errors;

  res.status(statusCode).json(body);
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  Startup banner
 * ───────────────────────────────────────────────────────────────────────────── */
const INTELLISIRN_BANNER = [
  '███ █   █ █████ █████ █     █     ███  ████ ███ ████  █   █',
  ' █  ██  █   █   █     █     █      █  █      █  █   █ ██  █',
  ' █  █ █ █   █   ████  █     █      █   ███   █  ████  █ █ █',
  ' █  █  ██   █   █     █     █      █      █  █  █  █  █  ██',
  '███ █   █   █   █████ █████ █████ ███ ████  ███ █   █ █   █',
];

function printStartupBanner(): void {
  // Structured log aggregators expect one JSON object per line — dumping
  // ASCII art through the production JSON formatter still "works" (each
  // row becomes its own {"message": "███ ..."} line) but it's noise in a
  // log search UI, so it's dev-only. Production still gets a clean single
  // startup line below, from logServiceLifecycle.
  if (process.env.NODE_ENV === 'production') return;
  for (const line of INTELLISIRN_BANNER) {
    logger.info(line);
  }
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Startup
 * ───────────────────────────────────────────────────────────────────────────── */
async function startServer(): Promise<void> {
  logServiceLifecycle('tembo-api', 'starting');

  // Confirm the logger itself is fully wired up (including any
  // CloudWatch/Logtail transports, which attach asynchronously in the
  // background) before we start logging things we care about not losing.
  await logger.whenReady();
  logServiceLifecycle('logger', 'started', {
    environment: process.env.NODE_ENV ?? 'development',
    level: process.env.LOG_LEVEL ?? 'info',
  });

  // Email config
  try {
    validateEmailConfig();
    logServiceLifecycle('email-config', 'started');
  } catch (error) {
    logServiceLifecycle('email-config', 'failed', {
      error: error instanceof Error ? error.message : error,
    });
    logger.warn('Email config invalid — server will start without email service');
  }

  // Email transporter
  try {
    await emailTransporter.initialize();
    logServiceLifecycle('email-transporter', 'started');
  } catch (error) {
    logServiceLifecycle('email-transporter', 'failed', {
      error: error instanceof Error ? error.message : error,
    });
    logger.error('Email service init failed — continuing without email');
  }

  // Cache
  try {
    if (cacheService.connect) {
      await cacheService.connect();
      logServiceLifecycle('cache', 'started');
    }
  } catch (error) {
    logServiceLifecycle('cache', 'failed', {
      error: error instanceof Error ? error.message : error,
    });
    logger.warn('Cache init failed — continuing without cache');
  }

  const PORT = process.env.PORT ?? 5001;

  // Start listening first, then initialize Socket.IO so it attaches to a live server
  await new Promise<void>((resolve) => {
    server.listen(PORT, () => {
      const env = process.env.NODE_ENV ?? 'development';
      const status = emailTransporter.isInitialized() ? 'ready' : 'disabled';

      printStartupBanner();

      const lines: [string, string][] = [
        ['ENV', env],
        ['PORT', String(PORT)],
        ['SOCKET.IO', 'enabled'],
        ['EMAIL', status],
        ['API', `http://localhost:${PORT}/api`],
        ['HEALTH', `http://localhost:${PORT}/health`],
      ];

      const width = Math.max(...lines.map(([k]) => k.length));

      logger.info('─'.repeat(48));
      logger.info('SERVER STARTED');
      logger.info('─'.repeat(48));
      for (const [key, value] of lines) {
        logger.info(`[${key.padEnd(width)}] ${value}`);
      }
      logger.info('─'.repeat(48));

      // Single structured line for log aggregators / production dashboards —
      // this is the one that actually matters for alerting/searching, the
      // banner and box above are for humans watching a terminal.
      logServiceLifecycle('tembo-api', 'started', { port: PORT, environment: env });

      resolve();
    });
  });

  initializeSocket(server);
  logServiceLifecycle('socket.io', 'started');
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Graceful shutdown — drains in-flight connections before exiting.
 *
 *  logger.close() is called as the LAST step here, right before
 *  process.exit(). Deliberately NOT using logger.registerShutdownHandlers()
 *  anywhere in this file — that installs its own separate SIGTERM/SIGINT
 *  listener that calls logger.close() then process.exit(0) on its own
 *  timeline. With both registered, a SIGTERM would race two independent
 *  shutdown sequences: the logger's own handler could call process.exit(0)
 *  while THIS function is still mid-way through draining connections,
 *  closing sockets, disconnecting the cache, or closing the analytics
 *  worker — killing the process before that cleanup finishes. Since this
 *  app already has its own full shutdown sequence, logger.close() is
 *  folded into it instead, once, at the very end.
 * ───────────────────────────────────────────────────────────────────────────── */
async function gracefulShutdown(signal: string): Promise<void> {
  if (isShuttingDown) {
    logger.info('[*] Shutdown already in progress');
    return;
  }
  isShuttingDown = true;

  logger.info(`${signal} received — starting graceful shutdown`);

  const forceExit = setTimeout(() => {
    logger.error('Shutdown timed out — forcing exit');
    process.exit(1);
  }, 10_000);

  try {
    await new Promise<void>((resolve, reject) =>
      server.close((err) => (err ? reject(err) : resolve())),
    );
    logger.info('HTTP server closed');

    for (const socket of connections) {
      socket.destroy();
    }
    connections.clear();
    logger.info('Open connections drained');

    await closeSocket().catch((err) =>
      logger.warn('Error closing Socket.IO', { error: err instanceof Error ? err.message : err }),
    );
    logger.info('Socket.IO closed');

    if (cacheService.disconnect) {
      await cacheService.disconnect().catch((err) =>
        logger.warn('Error disconnecting cache', { error: err instanceof Error ? err.message : err }),
      );
      logger.info('Cache disconnected');
    }

    await analyticsWorker.close().catch((err) =>
      logger.warn('Error closing analytics worker', { error: err instanceof Error ? err.message : err }),
    );
    logger.info('Analytics worker closed');

    if (emailTransporter.isInitialized() && emailTransporter.close) {
      await emailTransporter.close().catch((err) =>
        logger.warn('Error closing email service', { error: err instanceof Error ? err.message : err }),
      );
      logger.info('Email service closed');
    }

    clearTimeout(forceExit);
    logger.info('Graceful shutdown complete');
    await logger.close(); // flush all transports — last thing before exit
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', {
      error: error instanceof Error ? error.message : error,
    });
    clearTimeout(forceExit);
    await logger.close().catch(() => { });
    process.exit(1);
  }
}

/** ─────────────────────────────────────────────────────────────────────────────
 *  Process-level handlers
 * ───────────────────────────────────────────────────────────────────────────── */
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', {
    reason,
    stack: (reason as Error)?.stack,
  });
  gracefulShutdown('UNHANDLED_REJECTION');
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { message: error.message, stack: error.stack });
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

/** ─────────────────────────────────────────────────────────────────────────────
 *  Boot
 * ───────────────────────────────────────────────────────────────────────────── */
startServer().catch((error) => {
  logger.error('Fatal error during startup', {
    error: error instanceof Error ? error.message : error,
    stack: error instanceof Error ? error.stack : undefined,
  });
  process.exit(1);
});

export default app;