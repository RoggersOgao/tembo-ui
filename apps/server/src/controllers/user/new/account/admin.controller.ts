import { Response } from "express";
import {
    createSuccessResponse,
    createValidationErrorResponse,
    createConflictResponse,
    createErrorResponse,
    ErrorCode,
} from "@repo/api-utils";
import { AdminUserService } from "../../../../services/user/admin-user.service";
import { logger } from "@repo/logger";
import { AuthRequest } from "../../../../middlewares/auth.middleware";


export class AdminUserController {

    /**
     * POST /api/admin/users
     * Dashboard-only manual user creation — no IP tracking, no risk scoring.
     */
    static createUser = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            logger.info("=== ADMIN USER CREATION START ===");

            const user = await AdminUserService.createUser(req.body);

            logger.info(" Admin user creation completed:", {
                userId: user.id,
                role: user.role,
                email: user.email,
            });

            const response = createSuccessResponse(
                {
                    user: {
                        id: user.id,
                        uuid: user.uuid,
                        name: user.name,
                        email: user.email,
                        phone: user.phone,
                        role: user.role,
                        isActive: user.isActive,
                        isVerified: user.isVerified,
                        isTwoFactorEnabled: user.isTwoFactorEnabled,
                        verificationLevel: user.verificationLevel,
                        language: user.language,
                        timezone: user.timezone,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                    },
                },
                "User created successfully"
            );

            res.status(201).json(response);
        } catch (error: any) {
            logger.error("[*] Admin user creation failed:", {
                message: error.message,
                stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
                code: error.code,
            });

            // Duplicate email / phone
            if (error.code === "P2002" || error.message?.includes("already exists")) {
                const field = error.meta?.target?.[0] || "field";
                res.status(409).json(
                    createConflictResponse(`A user with this ${field} already exists.`)
                );
                return;
            }

            // Duplicate ID document
            if (error.message?.includes("ID document")) {
                res.status(409).json(
                    createConflictResponse(error.message)
                );
                return;
            }

            // Zod / manual validation
            if (error.message?.toLowerCase().includes("validation")) {
                try {
                    const parsed = JSON.parse(error.message.split(": ").slice(1).join(": "));
                    res.status(400).json(createValidationErrorResponse(parsed));
                } catch {
                    res.status(400).json(
                        createValidationErrorResponse([{ field: "body", message: error.message }])
                    );
                }
                return;
            }

            res.status(500).json(
                createErrorResponse(
                    error instanceof Error ? error.message : "Unknown error",
                    ErrorCode.INTERNAL_ERROR
                )
            );
        }
    };
}