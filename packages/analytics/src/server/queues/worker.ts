import { Worker, Job } from 'bullmq';
import { db } from '@repo/database'; // Import from your existing database package
import { queueConnection } from './redis-connection';

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

function isPermanentDbError(err: unknown): boolean {
    if (!(err instanceof Error)) return false;
    return (
        err.message.includes('Unique constraint') ||
        err.message.includes('foreign key constraint') ||
        err.message.includes('Foreign key constraint')
    );
}

async function handleSession(data: any): Promise<void> {
    const { sessionId, duration, ...rest } = data;
    const isSessionEnd = typeof duration === 'number' && duration > 0;

    if (isSessionEnd) {
        const existing = await db.analyticsSession.findUnique({
            where: { sessionId },
            select: { id: true, duration: true },
        });

        if (!existing) {
            throw new RetryableNotFoundError(`Session ${sessionId} not found for end event`);
        }

        if (existing.duration > 0) {
            console.log('[Analytics Worker] Session already ended, skipping', { sessionId });
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
        }).filter(([, v]) => v !== undefined && v !== null)
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
        update: {},
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
    const { id, endTime, duration } = data;

    const existing = await db.pageVisit.findUnique({
        where: { id },
        select: { id: true, startTime: true, endTime: true, duration: true },
    });

    if (!existing) {
        throw new RetryableNotFoundError(`Page visit ${id} not found yet`);
    }

    if (existing.endTime && existing.duration !== null) {
        console.log('[Analytics Worker] Page visit already ended, skipping', { id });
        return;
    }

    const parsedEnd = endTime ? new Date(endTime) : new Date();

    await db.pageVisit.update({
        where: { id },
        data: {
            endTime: parsedEnd,
            ...(typeof duration === 'number' ? { duration } : {}),
        },
    });
}

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
                console.warn('[Analytics Worker] Unknown job name, skipping', { name: job.name });
        }
    },
    { connection: queueConnection, concurrency: 10 }
);

worker.on('completed', (job) => {
    console.debug('[Analytics Worker] Job completed', { id: job.id, name: job.name });
});

worker.on('failed', (job, err) => {
    if (isPermanentDbError(err)) {
        console.error('[Analytics Worker] Permanent DB error', {
            id: job?.id,
            name: job?.name,
            error: err.message,
        });
        return;
    }

    if (err instanceof RetryableNotFoundError) {
        console.warn('[Analytics Worker] Dependent record not found', {
            id: job?.id,
            name: job?.name,
            attemptsMade: job?.attemptsMade,
            error: err.message,
        });
        return;
    }

    console.error('[Analytics Worker] Job failed', {
        id: job?.id,
        name: job?.name,
        attemptsMade: job?.attemptsMade,
        error: err.message,
    });
});

worker.on('error', (err) => {
    console.error('[Analytics Worker] Worker error', { error: err.message });
});

export default worker;