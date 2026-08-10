import { Request, Response } from 'express';
import { eventSchema, eventBatchSchema } from '../schemas/analytics.schemas';
import { analyticsQueue } from '../queues/analytics.queue';

export async function logEvent(req: Request, res: Response): Promise<void> {
    const parsed = eventSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid request data',
            errors: parsed.error.flatten(),
        });
        return;
    }

    await analyticsQueue.add('event', parsed.data);
    res.status(202).json({ message: 'Event queued.' });
}

export async function logEventBatch(req: Request, res: Response): Promise<void> {
    const parsed = eventBatchSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid request data',
            errors: parsed.error.flatten(),
        });
        return;
    }

    await analyticsQueue.add('event-batch', parsed.data);
    res.status(202).json({ message: 'Event batch queued.' });
}