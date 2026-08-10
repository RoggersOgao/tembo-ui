import { Router } from 'express';
import { logSession } from '../controllers/session.controller';
import { logEvent, logEventBatch } from '../controllers/event.controller';
import { logPageVisit, updatePageVisitDuration } from '../controllers/page-visit.controller';
import { consentMiddleware } from '../middleware/consent.middleware';
import { authMiddleware } from '../middleware/auth.middleware';

export function createAnalyticsRouter(): Router {
    const router = Router();

    // Apply middleware
    router.use(authMiddleware);
    router.use(consentMiddleware);

    // Session routes
    router.post('/session', logSession);

    // Event routes
    router.post('/event', logEvent);
    router.post('/event/batch', logEventBatch);

    // Page visit routes
    router.post('/page-visit', logPageVisit);
    router.post('/page-visit/end', updatePageVisitDuration);

    return router;
}