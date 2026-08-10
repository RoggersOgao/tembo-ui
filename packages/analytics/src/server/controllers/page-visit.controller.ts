import { Request, Response } from 'express';
import { pageVisitCreateSchema, pageVisitUpdateSchema } from '../schemas/analytics.schemas';
import { analyticsQueue } from '../queues/analytics.queue';

export async function logPageVisit(req: Request, res: Response): Promise<void> {
    const parsed = pageVisitCreateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid request data',
            errors: parsed.error.flatten(),
        });
        return;
    }

    const { id, sessionId, path, startTime, endTime } = parsed.data;

    if (!id?.trim()) {
        res.status(400).json({ message: 'Page visit ID is required and cannot be empty.' });
        return;
    }

    if (!sessionId?.trim()) {
        res.status(400).json({ message: 'Session ID is required and cannot be empty.' });
        return;
    }

    if (!path?.trim()) {
        res.status(400).json({ message: 'Path is required and cannot be empty.' });
        return;
    }

    if (!path.startsWith('/')) {
        res.status(400).json({ message: "Path must start with '/'." });
        return;
    }

    const now = new Date();
    const parsedStart = startTime ? new Date(startTime) : now;
    const hoursDiff = (now.getTime() - parsedStart.getTime()) / 36e5;

    if (parsedStart > now) {
        res.status(400).json({ message: 'Start time cannot be in the future.' });
        return;
    }

    if (hoursDiff > 24) {
        res.status(400).json({ message: 'Start time must be within the last 24 hours.' });
        return;
    }

    if (endTime && new Date(endTime) < parsedStart) {
        res.status(400).json({ message: 'End time cannot be before start time.' });
        return;
    }

    await analyticsQueue.add('page-visit', parsed.data);
    res.status(202).json({ message: 'Page visit queued.', data: { id } });
}

export async function updatePageVisitDuration(req: Request, res: Response): Promise<void> {
    const parsed = pageVisitUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid request data',
            errors: parsed.error.flatten(),
        });
        return;
    }

    const { id } = parsed.data;

    if (!id?.trim()) {
        res.status(400).json({ message: 'Page visit ID is required and cannot be empty.' });
        return;
    }

    await analyticsQueue.add('page-visit-end', parsed.data);
    res.status(202).json({ message: 'Page visit end queued.' });
}