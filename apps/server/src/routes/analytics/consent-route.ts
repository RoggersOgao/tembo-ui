// routes/analytics/consentRoute.ts
import { Router } from 'express';
import { getConsent, upsertConsent } from '../../controllers/analytics/consetController';

const router = Router();

router.get('/', getConsent);
router.post('/', upsertConsent);

export default router;