import { Router } from "express";
import { authMiddleware } from "../../middlewares/auth.middleware";
import { EmailController } from "../../controllers/emails/email.controller";


const router = Router();
const controller = new EmailController();

/* ----------------------------------
   Routes
---------------------------------- */

// Send single email
router.post(
    "/send",
    authMiddleware,
    controller.sendSingle
);

// Send bulk campaign emails
router.post(
    "/campaign",
    authMiddleware,
    controller.sendCampaign
);

// Send verification email
router.post(
    "/verification",
    controller.sendVerification
);
// Send verification email
router.post(
    "/twoFactor",
    controller.sendTwoFactor
);

// Send password reset email
router.post(
    "/password-reset",
    controller.sendPasswordReset
);

export default router;
