// src/modules/device/device.routes.ts
import { Router } from 'express';
import { DeviceController } from '../../../controllers/user/new/account/mfa-device.controller';
import { authMiddleware, requireRole } from '../../../middlewares/auth.middleware';

const router = Router();

// ── POST (static routes first, cleanup last since it's protected) ─────────────

// Public
router.post('/register', DeviceController.registerDevice);
router.post('/verify', DeviceController.verifyDevice);
router.post('/validate', DeviceController.validateDeviceToken);
router.post('/resend-code', DeviceController.resendVerificationCode);

// Admin — static, so safe here but explicitly after public
router.post('/cleanup',
    authMiddleware,
    requireRole('ADMIN', 'SUPER_ADMIN'),
    DeviceController.cleanupExpired
);

// ── GET (static before dynamic) ───────────────────────────────────────────────

// Protected
router.get('/me', authMiddleware, DeviceController.getMyDevices);

// Admin — /list/:userId must come before any bare /:id GET if added later
router.get('/list/:userId',
    authMiddleware,
    requireRole('ADMIN', 'SUPER_ADMIN'),
    DeviceController.listUserDevices
);

// ── DELETE (static before dynamic) ───────────────────────────────────────────

// Protected — /:deviceId is the only DELETE, no conflict but kept last by convention
router.delete('/:deviceId', authMiddleware, DeviceController.revokeDevice);

export default router;