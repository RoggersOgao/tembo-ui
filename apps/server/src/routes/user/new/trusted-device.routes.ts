// src/modules/trusted-device/trusted-device.routes.ts
import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { TrustedDeviceController } from '../../../controllers/user/new/account/trusted-devices.controller';

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Specific/static routes MUST come before dynamic /:id routes.
// Express matches top-to-bottom — "revoke", "check", "verify", "refresh",
// "cleanup/old", "cleanup/expired", "me" would all be swallowed by /:id
// if /:id is defined first.
// ─────────────────────────────────────────────────────────────────────────────

// ── POST (static first, no dynamic segments) ─────────────────────────────────

router.post('/trusted-devices/verify', TrustedDeviceController.verifyDeviceToken);
router.post('/trusted-devices/check', TrustedDeviceController.checkTrustedDevice);
router.post('/trusted-devices/revoke', authMiddleware, TrustedDeviceController.revokeDevice);
router.post('/trusted-devices/refresh', authMiddleware, TrustedDeviceController.refreshDeviceToken);
router.post('/trusted-devices', TrustedDeviceController.createTrustedDevice);

// ── GET (static first, then dynamic) ─────────────────────────────────────────

router.get('/trusted-devices/me', authMiddleware, TrustedDeviceController.getMyTrustedDevices);
router.get('/trusted-devices/users/:userId', authMiddleware, TrustedDeviceController.getUserTrustedDevices);
// /:id must be last — would swallow /me and /users/:userId otherwise
router.get('/trusted-devices/:id', authMiddleware, TrustedDeviceController.getTrustedDeviceById);

// ── PUT (only dynamic, no conflicts) ─────────────────────────────────────────

router.put('/trusted-devices/:id', TrustedDeviceController.updateDevice);

// ── DELETE (static cleanup routes before dynamic /:id) ───────────────────────

router.delete('/trusted-devices/cleanup/expired', authMiddleware, TrustedDeviceController.cleanupExpiredDevices);
router.delete('/trusted-devices/cleanup/old', authMiddleware, TrustedDeviceController.cleanOldTrustedDevices);
// /:id must be last — would swallow /cleanup/expired and /cleanup/old otherwise
router.delete('/trusted-devices/:id', authMiddleware, TrustedDeviceController.deleteTrustedDevice);

export default router;
