import { Worker, Job } from 'bullmq';
import { db } from '@repo/database';
import { logger } from '@repo/logger';
import { queueConnection } from '../queues/redis-connection';

/**
 * Errors that mean "retrying won't help" — resolve the job instead of
 * throwing, so BullMQ doesn't burn through attempts/backoff on something
 * that will never succeed.
 */
function isPermanentDbError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return (
        err.message.includes('Unique constraint') ||
        err.message.includes('unique constraint') ||
        err.message.includes('Foreign key constraint') ||
        err.message.includes('foreign key')
    );
}

/**
 * Errors where the dependent row (e.g. the session) simply hasn't been
 * written yet because its own job is still ahead in the queue or still
 * retrying. Throwing here lets BullMQ's backoff retry the job later,
 * instead of the request-time 404 the old synchronous controllers used.
 */
class RetryableNotFoundError extends Error { }

async function requireSessionInternalId(sessionId: string): Promise<string> {
    const session = await db.analyticsSession.findUnique({
        where: { sessionId },
        select: { id: true },
    });

    if (!session) {
        throw new RetryableNotFoundError(`Session ${sessionId} not found yet`);
    }

    return session.id;
}

// ─── Job Handlers ──────────────────────────────────────────────────────────────

async function handleSession(data: any): Promise<void> {
    const { sessionId, duration, ...rest } = data;
    const isSessionEnd = typeof duration === 'number' && duration > 0;

    if (isSessionEnd) {
        const existing = await db.analyticsSession.findUnique({
            where: { sessionId },
            select: { id: true, duration: true },
        });

        if (!existing) {
            // Session-end arrived before session-create was processed — retry later.
            throw new RetryableNotFoundError(`Session ${sessionId} not found for end event`);
        }

        if (existing.duration > 0) {
            logger.info('[analytics-worker] Session already ended, skipping', { sessionId });
            return;
        }

        await db.analyticsSession.update({
            where: { sessionId },
            data: { duration },
        });
        return;
    }

    const metaFields = Object.fromEntries(
        Object.entries({
            ip: rest.ip,
            country: rest.country,
            region: rest.region,
            city: rest.city,
            deviceType: rest.deviceType,
            browser: rest.browser,
            os: rest.os,
            referrer: rest.referrer,
        }).filter(([, v]) => v !== undefined && v !== null),
    );

    await db.analyticsSession.upsert({
        where: { sessionId },
        update: metaFields,
        create: { sessionId, duration: 0, ...metaFields },
    });
}

async function handleClick(data: any): Promise<void> {
    const { sessionId, path, element, timestamp } = data;

    await requireSessionInternalId(sessionId);

    await db.clickEvent.create({
        data: {
            sessionId,
            path,
            element,
            createdAt: timestamp ? new Date(timestamp) : new Date(),
        },
    });
}

async function handleEvent(data: any): Promise<void> {
    const { sessionId, type, url, element, data: eventData, timestamp } = data;

    await requireSessionInternalId(sessionId);

    await db.analyticsEvent.create({
        data: {
            sessionId,
            type,
            url,
            element: element ?? null,
            data: eventData ?? {},
            createdAt: timestamp ? new Date(timestamp) : new Date(),
        },
    });
}

async function handleEventBatch(data: any): Promise<void> {
    const { sessionId, events } = data;

    await requireSessionInternalId(sessionId);

    await db.analyticsEvent.createMany({
        data: events.map((e: any) => ({
            sessionId,
            type: e.type,
            url: e.url,
            element: e.element ?? null,
            data: e.data ?? {},
            createdAt: e.timestamp ? new Date(e.timestamp) : new Date(),
        })),
        skipDuplicates: true,
    });
}

async function handlePageVisit(data: any): Promise<void> {
    const { id, sessionId, path, query, startTime, endTime, duration } = data;

    await requireSessionInternalId(sessionId);

    const parsedStart = startTime ? new Date(startTime) : new Date();

    await db.pageVisit.upsert({
        where: { id },
        update: {}, // no-op if a retry redelivers the same job after a partial success
        create: {
            id,
            sessionId,
            path,
            query: query ?? null,
            startTime: parsedStart,
            endTime: endTime ? new Date(endTime) : null,
            duration: duration ?? null,
        },
    });
}

async function handlePageVisitEnd(data: any): Promise<void> {
    const { id, endTime, duration, scrollDepth } = data;

    const existing = await db.pageVisit.findUnique({
        where: { id },
        select: { id: true, startTime: true, endTime: true, duration: true },
    });

    if (!existing) {
        // The create job for this page visit may not have landed yet — retry.
        throw new RetryableNotFoundError(`Page visit ${id} not found yet`);
    }

    // Idempotent — already closed, nothing to do.
    if (existing.endTime && existing.duration !== null) {
        logger.info('[analytics-worker] Page visit already ended, skipping', { id });
        return;
    }

    const parsedEnd = endTime ? new Date(endTime) : new Date();

    if (existing.startTime && parsedEnd < existing.startTime) {
        logger.warn('[analytics-worker] End time before start time, clamping to start', { id });
    }

    await db.pageVisit.update({
        where: { id },
        data: {
            endTime: parsedEnd,
            ...(typeof duration === 'number' ? { duration } : {}),
            // Uncomment when scrollDepth is added to the Prisma schema:
            // ...(typeof scrollDepth === 'number' ? { scrollDepth } : {}),
        },
    });
}

// ─── Worker ────────────────────────────────────────────────────────────────────

const worker = new Worker(
    'analytics',
    async (job: Job) => {
        switch (job.name) {
            case 'session':
                return handleSession(job.data);
            case 'click':
                return handleClick(job.data);
            case 'event':
                return handleEvent(job.data);
            case 'event-batch':
                return handleEventBatch(job.data);
            case 'page-visit':
                return handlePageVisit(job.data);
            case 'page-visit-end':
                return handlePageVisitEnd(job.data);
            default:
                logger.warn('[analytics-worker] Unknown job name, skipping', { name: job.name });
        }
    },
    { connection: queueConnection, concurrency: 10 },
);

worker.on('completed', (job) => {
    logger.debug('[analytics-worker] Job completed', { id: job.id, name: job.name });
});

worker.on('failed', (job, err) => {
    if (isPermanentDbError(err)) {
        logger.error('[analytics-worker] Permanent DB error, will not be retried further', {
            id: job?.id,
            name: job?.name,
            error: err.message,
        });
        return;
    }

    if (err instanceof RetryableNotFoundError) {
        logger.warn('[analytics-worker] Dependent record not found yet, will retry', {
            id: job?.id,
            name: job?.name,
            attemptsMade: job?.attemptsMade,
            error: err.message,
        });
        return;
    }

    logger.error('[analytics-worker] Job failed', {
        id: job?.id,
        name: job?.name,
        attemptsMade: job?.attemptsMade,
        error: err.message,
    });
});

worker.on('error', (err) => {
    logger.error('[analytics-worker] Worker error', { error: err.message });
});

export default worker;