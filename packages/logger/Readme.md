# @intellisirn/logger

Winston-based structured logger with async cloud transports, PII/secret
redaction, correlation-ID propagation, and graceful shutdown.

## Quick start

```ts
import { logger } from '@intellisirn/logger';

logger.info('server started', { port: 3000 });
logger.error('payment failed', { orderId: 'o-123', password: 'never-logged' });
// -> password automatically redacted before it reaches any transport
```

## Graceful shutdown

Not enabled by default (library code shouldn't install global process
listeners as a side effect of being imported). Call once from your app's
entrypoint:

```ts
import { logger } from '@intellisirn/logger';

logger.registerShutdownHandlers();
// on SIGTERM/SIGINT: flushes all transports, then process.exit(0)
```

## Correlation IDs without manual threading

```ts
import { runWithLogContext, createRequestLogger } from '@intellisirn/logger';

app.use(createRequestLogger());
// every logger.info()/warn()/error() call anywhere downstream in this
// request's async call chain now automatically includes requestId,
// method, path, ip, userAgent — even in code with no reference to `req`.
```

Manually, for background jobs / queue consumers:

```ts
await runWithLogContext({ correlationId: job.id }, async () => {
  await processJob(job); // any logging inside here is tagged automatically
});
```

## Redaction

`password`, `token`, `secret`, `apiKey`, `authorization`, `ssn`, and a
handful of other common sensitive-field names are redacted by default,
recursively, in both dev and prod formatters. Add your own:

```ts
import { Logger } from '@intellisirn/logger';

const logger = new Logger({ redactKeys: ['internalCustomerRef'] });
```

## Async cloud transports

CloudWatch/Logtail are loaded via dynamic `import()` in the background —
logging works immediately via console/file transports, cloud transports
attach once their (optional) packages resolve. If you need to guarantee
they're attached before continuing (e.g. a short-lived serverless
function):

```ts
await logger.whenReady();
```

If `@logtail/node`, `@logtail/winston`, or `winston-cloudwatch` aren't
installed, the corresponding transport is skipped with a console warning
— app startup is never blocked by a missing optional dependency.

## Options

See `LoggerOptions` in `src/types/index.ts` for the full list
(`environment`, `level`, `redactKeys`, `enableAsyncContext`,
`enableConsole` / `enableFile` / `enableCloudWatch` / `enableLogtail`,
`logDir`, `maxSize`, `maxFiles`, etc.).

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```