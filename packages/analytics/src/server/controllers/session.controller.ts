import { Request, Response } from 'express';
import { sessionSchema } from '../schemas/analytics.schemas';
import { analyticsQueue } from '../queues/analytics.queue';

export async function logSession(req: Request, res: Response): Promise<void> {
    const parsed = sessionSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({
            message: 'Invalid request data',
            errors: parsed.error.flatten(),
        });
        return;
    }

    const { sessionId } = parsed.data;

    if (!sessionId?.trim()) {
        res.status(400).json({
            message: 'Session ID is required and cannot be empty.',
        });
        return;
    }

    await analyticsQueue.add('session', parsed.data);
    res.status(202).json({ message: 'Session queued.' });
}