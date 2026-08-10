// lib/resilience.ts
//
// Small, dependency-free resilience primitives for outbound calls that can
// be slow or flaky on a bad network: DB queries, internal API clients, and
// (via @auth/core's `customFetch`) the OAuth token-exchange request itself.
//
// Usage pattern: wrap any external call in `guarded(circuit, fn, opts)`.
// It will: skip the call early if the circuit is open, time it out, retry
// it (if safe to retry), and track success/failure on the breaker.

export class TimeoutError extends Error { }

/**
 * Rejects with TimeoutError if `promise` doesn't settle within `ms`.
 * Always clears the timer, win or lose, so it doesn't keep the event loop
 * alive after the race is decided.
 */
export async function withTimeout<T>(
    promise: Promise<T>,
    ms: number,
    label = "operation"
): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new TimeoutError(`${label} timed out after ${ms}ms`)), ms);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

/**
 * Retries `fn` with exponential backoff + jitter.
 *
 * IMPORTANT: only use retries > 0 for calls that are safe to repeat —
 * idempotent reads, or writes your backend already de-dupes. Never wrap a
 * mutating call (increment a counter, lock an account, exchange an
 * auth code) with retries > 0 unless you've confirmed double-execution
 * is harmless, since the *first* attempt may have actually succeeded
 * server-side even though the client-side promise threw (e.g. response
 * arrived after your timeout fired).
 */
export async function withRetry<T>(
    fn: () => Promise<T>,
    opts: { retries?: number; baseDelayMs?: number; maxDelayMs?: number; label?: string } = {}
): Promise<T> {
    const { retries = 1, baseDelayMs = 200, maxDelayMs = 1500, label = "operation" } = opts;
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            return await fn();
        } catch (err) {
            lastError = err;
            if (attempt === retries) break;
            const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt) * (0.5 + Math.random() * 0.5);
            console.warn(`[!] ${label} failed (attempt ${attempt + 1}/${retries + 1}), retrying in ${Math.round(delay)}ms`);
            await new Promise((r) => setTimeout(r, delay));
        }
    }

    throw lastError;
}

/**
 * Minimal circuit breaker: after `threshold` consecutive failures, the
 * circuit "opens" and short-circuits further calls for `cooldownMs` —
 * so a dead downstream service doesn't get hammered (and doesn't make
 * every concurrent login attempt pay the full timeout) during an outage.
 */
export class CircuitBreaker {
    private failures = 0;
    private openedAt: number | null = null;

    constructor(private threshold = 5, private cooldownMs = 30_000) { }

    get isOpen(): boolean {
        if (this.openedAt && Date.now() - this.openedAt > this.cooldownMs) {
            // Cooldown elapsed — allow a fresh attempt through ("half-open").
            this.openedAt = null;
            this.failures = 0;
        }
        return this.openedAt !== null;
    }

    recordSuccess() {
        this.failures = 0;
        this.openedAt = null;
    }

    recordFailure() {
        this.failures++;
        if (this.failures >= this.threshold && !this.openedAt) {
            this.openedAt = Date.now();
            console.error(`🔴 Circuit breaker opened after ${this.failures} consecutive failures`);
        }
    }
}

// Shared breakers — one per downstream dependency. Import the same instance
// everywhere you call that dependency so failures accumulate correctly.
export const userServiceCircuit = new CircuitBreaker(5, 30_000);
export const dbCircuit = new CircuitBreaker(5, 30_000);

/**
 * Convenience wrapper combining circuit-breaker + timeout + retry + outcome
 * tracking in one call. This is what auth.ts uses for almost every external
 * call.
 *
 * @param breaker   Which circuit to check/update (userServiceCircuit, dbCircuit, ...)
 * @param fn        The call to make, e.g. () => userClient.getUserById(id)
 * @param opts.timeoutMs  Hard timeout for this call (default 5000)
 * @param opts.retries    Retry count — see withRetry's warning above (default 1)
 * @param opts.label      Used in logs to identify which call failed
 */
export async function guarded<T>(
    breaker: CircuitBreaker,
    fn: () => Promise<T>,
    opts: { timeoutMs?: number; retries?: number; label?: string } = {}
): Promise<T> {
    const { timeoutMs = 5000, retries = 1, label = "operation" } = opts;

    if (breaker.isOpen) {
        throw new Error(`${label}: circuit open — skipping call to failing dependency`);
    }

    try {
        const result = await withTimeout(
            withRetry(fn, { retries, label }),
            timeoutMs,
            label
        );
        breaker.recordSuccess();
        return result;
    } catch (err) {
        breaker.recordFailure();
        throw err;
    }
}