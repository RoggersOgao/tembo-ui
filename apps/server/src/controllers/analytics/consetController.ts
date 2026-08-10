// controllers/analytics/consentController.ts
import { Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { db } from '@repo/database';

const consentPreferencesSchema = z.object({
    essential: z.boolean().optional(),
    analytics: z.boolean().optional(),
    marketing: z.boolean().optional(),
    personalization: z.boolean().optional(),
});

const getConsentQuerySchema = z.object({
    sessionId: z.string().min(1),
});

const upsertConsentSchema = z.object({
    sessionId: z.string().min(1),
    userId: z.string().optional(),
    preferences: consentPreferencesSchema,
});

export const getConsent: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const parsed = getConsentQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        res.status(400).json({ message: 'sessionId is required', errors: parsed.error.flatten() });
        return;
    }

    try {
        const consent = await db.userConsent.findUnique({
            where: { sessionId: parsed.data.sessionId },
        });
        res.status(200).json(consent?.preferences ?? {});
    } catch (error) {
        res.status(500).json({ message: 'Failed to load consent' });
    }
};

export const upsertConsent: RequestHandler = async (req: Request, res: Response): Promise<void> => {
    const parsed = upsertConsentSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ message: 'Invalid request data', errors: parsed.error.flatten() });
        return;
    }

    const { sessionId, userId, preferences } = parsed.data;

    try {
        const consent = await db.userConsent.upsert({
            where: { sessionId },
            update: { preferences, userId, updatedAt: new Date() },
            create: { sessionId, userId, preferences },
        });
        res.status(200).json(consent.preferences);
    } catch (error) {
        res.status(500).json({ message: 'Failed to save consent' });
    }
};