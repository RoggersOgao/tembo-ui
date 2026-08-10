import { Router } from "express";
import { UserController } from "../../../controllers/user/new/account/user.controller";
import { authMiddleware } from "../../../middlewares/auth.middleware";

const router = Router();

// ═══════════════════════════════════════════════════════════════════
// RULE: Static routes ALWAYS before /:id dynamic routes
// RULE: Public routes before protected routes
// ═══════════════════════════════════════════════════════════════════


// ============================================================
// PUBLIC STATIC ROUTES — no auth, no /:id conflict possible
// ============================================================

/** POST /api/users — Register */
router.post("/users", UserController.createUser);

/** GET /api/users — Get all users */
router.get("/users", UserController.getUsers);

/** POST /api/users/login-limits */
router.post("/users/login-limits", UserController.manageLoginLimits);

/** POST /api/users/password/history */
router.post("/users/password/history", UserController.updatePasswordHistory);

/** POST /api/users/suspicious-activity/check */
router.post("/users/suspicious-activity/check", UserController.checkSuspiciousActivity);

/** POST /api/users/suspicious-login/flag */
router.post("/users/suspicious-login/flag", UserController.flagSuspiciousLogin);

/** POST /api/users/login-activity */
router.post("/users/login-activity", UserController.recordLoginActivity);

/** GET|POST /api/users/location/detect */
router.get("/users/location/detect", UserController.detectLocation);
router.post("/users/location/detect", UserController.detectLocation);

/** GET|POST /api/location/detect */
router.get("/location/detect", UserController.detectCurrentLocation);
router.post("/location/detect", UserController.detectCurrentLocation);

/** GET /api/users/metadata */
router.get("/users/metadata", UserController.getRequestMetadata);


// ============================================================
// PROTECTED STATIC ROUTES — auth required, no /:id conflict
// ============================================================

/** GET /api/users/search */
router.get("/users/search", authMiddleware, UserController.searchUsers);

/** GET /api/users/statistics */
router.get("/users/statistics", authMiddleware, UserController.getUserStatistics);

/** PATCH /api/users/bulk-update */
router.patch("/users/bulk-update", authMiddleware, UserController.bulkUpdateUsers);


// ============================================================
// PUBLIC DYNAMIC ROUTES — /:id, no auth required
// (login flow calls — no session exists yet)
// ============================================================

/** GET /api/users/:id */
router.get("/users/:id", UserController.getUserById);

/** POST /api/users/:id/validate-password */
router.post("/users/:id/validate-password", UserController.validatePassword);

/** POST /api/users/:id/increment-failed-attempts */
router.post("/users/:id/increment-failed-attempts", UserController.incrementFailedAttempts);

/** GET /api/users/:id/check-lock */
router.get("/users/:id/check-lock", UserController.checkAccountLock);

/** PATCH /api/users/:id/verify-email */
router.patch("/users/:id/verify-email", UserController.verifyUserEmail);

/** PATCH /api/users/:id/verify-phone */
router.patch("/users/:id/verify-phone", UserController.verifyUserPhone);

/** GET /api/users/:id/security-status */
router.get("/users/:id/security-status", UserController.getAccountSecurityStatus);

/** GET /api/users/:id/activity */
router.get("/users/:id/activity", UserController.getUserActivity);

/** PATCH /api/users/:id/password */
router.patch("/users/:id/password", UserController.updateUserPassword);

/** PATCH /api/users/:id/unlock */
router.patch("/users/:id/unlock", UserController.unlockUserAccount);

/** PATCH /api/users/:id/reset-failed-logins */
router.patch("/users/:id/reset-failed-logins", UserController.resetFailedLoginAttempts);

/** PATCH /api/users/:id/verification-level */
router.patch("/users/:id/verification-level", UserController.updateVerificationLevel);

/** PATCH /api/users/:id/lock */
router.patch("/users/:id/lock", UserController.lockAccount);

/** PATCH /api/users/:id/suspend */
router.patch("/users/:id/suspend", UserController.toggleSuspension);

/** PATCH /api/users/:id/role */
router.patch("/users/:id/role", UserController.updateUserRole);


// ============================================================
// PROTECTED DYNAMIC ROUTES — /:id, auth required
// ============================================================

/** PUT /api/users/:id — Full update */
router.put("/users/:id", authMiddleware, UserController.updateUser);

/** DELETE /api/users/:id */
router.delete("/users/:id", authMiddleware, UserController.deleteUser);

/** GET /api/users/:id/export */
router.get("/users/:id/export", authMiddleware, UserController.exportUserData);


export default router;