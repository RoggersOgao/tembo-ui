import { Router } from 'express';

import {
  logSession,
  logClick,
  logEvent,
  logEventBatch,
  logPageVisit,
  updatePageVisitDuration,
} from '../../controllers/analytics/newControllerAnalytics';

const router = Router();

// ── Session ───────────────────────────────────────────────────────────────────
router.post('/session', logSession);

// ── Clicks ────────────────────────────────────────────────────────────────────
router.post('/click', logClick);

// ── Events — batch MUST come before the generic /event route ─────────────────
router.post('/event/batch', logEventBatch);
router.post('/event',       logEvent);

// ── Page visits ───────────────────────────────────────────────────────────────
router.post('/page-visit', logPageVisit);
router.post('/page-visit/end', updatePageVisitDuration);

export default router;