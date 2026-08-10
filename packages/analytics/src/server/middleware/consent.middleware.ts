import { Request, Response, NextFunction } from 'express';
import { ConsentManager } from '../../client/consent/ConsentManager';

export function consentMiddleware(req: Request, res: Response, next: NextFunction) {
    // Check if consent is required
    const consentRequired = process.env.ANALYTICS_CONSENT_REQUIRED === 'true';

    if (!consentRequired) {
        return next();
    }

    // Get consent from header or cookie
    const consentToken = req.headers['x-analytics-consent'] as string;

    if (!consentToken) {
        return res.status(403).json({
            error: 'Consent required for analytics tracking',
            consentRequired: true,
        });
    }

    try {
        // Verify consent token
        // This is a simple implementation - in production, you'd want to verify
        // the token signature and expiration
        const consent = JSON.parse(Buffer.from(consentToken, 'base64').toString());

        // Check if analytics consent is granted
        if (!consent.analytics) {
            return res.status(403).json({
                error: 'Analytics consent not granted',
                consentRequired: true,
            });
        }

        // Add consent to request for later use
        (req as any).analyticsConsent = consent;
        next();
    } catch (error) {
        return res.status(400).json({
            error: 'Invalid consent token',
            consentRequired: true,
        });
    }
}