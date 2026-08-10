import { Router } from "express";
import {
    presignImageUpload,
    registerImage,
    uploadNewImages,
    deleteBatch,
} from "../../controllers/s3-upload/upload-controller";
import { authMiddleware, requireRole } from "../../middlewares/auth.middleware";
import { generalRateLimit, uploadRateLimit } from "../../middlewares/rate-limit.middleware";

const router = Router();

router.use(authMiddleware);
router.use(generalRateLimit);

router.post("/presign-image",
    requireRole("MANAGER", "ADMIN", 'SUPER_ADMIN'),
    uploadRateLimit,
    presignImageUpload
);

router.post("/register-image",
    requireRole("MANAGER", "ADMIN", 'SUPER_ADMIN'),
    uploadRateLimit,
    registerImage
);

router.post("/images/complete",
    requireRole("MANAGER", "ADMIN", 'SUPER_ADMIN'),
    uploadNewImages
);

router.post("/assets/batch-delete",
    requireRole("MANAGER", "ADMIN", 'SUPER_ADMIN'),
    uploadRateLimit,
    deleteBatch
);

export default router;