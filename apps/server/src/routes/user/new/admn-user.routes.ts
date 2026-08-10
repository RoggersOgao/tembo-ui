import { Router } from "express";
import { authMiddleware, requireRole } from "../../../middlewares/auth.middleware";
import { AdminUserController } from "../../../controllers/user/new/account/admin.controller";
import { createUserRateLimiter } from "../../../middlewares/rate-limit.middleware";


const router = Router();

// All admin-user routes require authentication + at least MANAGER role
router.use(authMiddleware);

/**
 * POST /api/admin/users
 * Manually create a user from the dashboard.
 * Rate-limited to 30 creations / 15 min to prevent bulk abuse.
 */
router.post(
    "/create",
    createUserRateLimiter,
    requireRole("ADMIN","SUPER_ADMIN", "MANAGER"),
    AdminUserController.createUser
);

export default router;