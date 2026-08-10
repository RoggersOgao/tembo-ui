import { Request, Response, NextFunction } from 'express';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
    const apiKey = req.headers['x-api-key'] as string;
    const expectedKey = process.env.ANALYTICS_API_KEY;

    if (!expectedKey) {
        console.warn('[Analytics] No API key configured, skipping auth');
        return next();
    }

    if (!apiKey || apiKey !== expectedKey) {
        return res.status(401).json({ error: 'Invalid API key' });
    }

    next();
}