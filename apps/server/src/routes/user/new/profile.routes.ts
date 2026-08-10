import { Router } from 'express';
import { authMiddleware } from '../../../middlewares/auth.middleware';
import { ProfileController } from '../../../controllers/user/new/account/profile.controller';

const router = Router();

// ─── Static routes (must come before /:id) ───────────────────────────────────

router.get('/me',           authMiddleware, ProfileController.getMyProfile);
router.put('/me',           authMiddleware, ProfileController.updateMyProfile);   // ← was missing
router.get('/stats',        authMiddleware, ProfileController.getProfileStats);
router.get('/admin/stats',  authMiddleware, ProfileController.getProfileStats);

// ─── Public routes (no auth) ──────────────────────────────────────────────────

router.get('/public/search',    ProfileController.getProfiles);
router.get('/public/:userId',   ProfileController.getProfileByUserId);

// ─── Collection ───────────────────────────────────────────────────────────────

router.get('/',  authMiddleware, ProfileController.getProfiles);
router.post('/', ProfileController.createProfile);

// ─── Param routes (must come last) ───────────────────────────────────────────

router.get('/:id',    authMiddleware, ProfileController.getProfileById);
router.put('/:id',    authMiddleware, ProfileController.updateProfileById);
router.delete('/:id', authMiddleware, ProfileController.deleteProfileById);

export default router;