// packages/logger/src/context/index.ts
import { AsyncLocalStorage } from 'node:async_hooks';
import { LogContext } from '../types/index.js';

const storage = new AsyncLocalStorage<LogContext>();

/**
 * Run `fn` with `context` merged into the ambient log context for the
 * duration of the call (and anything awaited/scheduled from within it —
 * AsyncLocalStorage follows the async call chain automatically). Nested
 * calls merge on top of any existing context rather than replacing it.
 *
 * Typical usage: wrap an Express request in this once in middleware, then
 * every logger.info()/warn()/error() call anywhere downstream — including
 * in code that has no reference to `req` — automatically includes
 * requestId/correlationId/userId without manually building a child logger.
 */
export const runWithLogContext = <T>(context: LogContext, fn: () => T): T => {
    const parent = storage.getStore();
    return storage.run({ ...parent, ...context }, fn);
};

/** Read the current ambient log context, if any (e.g. inside a request). */
export const getLogContext = (): LogContext | undefined => storage.getStore();

/** Merge additional fields into the current ambient context, if one exists. */
export const updateLogContext = (patch: LogContext): void => {
    const current = storage.getStore();
    if (current) {
        Object.assign(current, patch);
    }
};