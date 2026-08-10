// src/modules/device/device.controller.ts
import { Response } from 'express';
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createConflictResponse,
    createPaginatedResponse,
    ErrorCode,
    PaginationInfo
} from '@repo/api-utils';
import {
    validateRequest,
    validateRequestBody,
    validateRequestParams,
    validateRequestQuery
} from '../../../../middlewares/request-validation';
import { logger } from '@repo/logger';
import { transformValidationErrors } from '../../../../utils/transform-validation-errors';
import { DeviceService } from '../../../../services/user/mfa-device.service';
import { AuthRequest } from '../../../../middlewares/auth.middleware';

export class DeviceController {
    /**
     * Register a new device for a user
     * POST /api/devices/register
     */
    static registerDevice = async (req: AuthRequest, res: Response): Promise<void> => {
       
        const validation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            metadata: {
                deviceName: 'required|string|max:255',
                browser: 'required|string|max:100',
                os: 'required|string|max:100',
                deviceType: 'optional|string|max:20',
                timezone: 'required|string|max:100',
                language: 'required|string|max:10'
            },
            ipAddress: 'optional|string|ip'
        });
        if (!validation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }


        try {
            const { userId, metadata, ipAddress } = validation.data;

            // Register device and generate verification challenge
            const result = await DeviceService.registerDevice(
                userId,
                metadata,
                ipAddress || req.ip || 'unknown'
            );

            const response = createSuccessResponse(
                {
                    deviceId: result.deviceId,
                    challenge: {
                        challengeId: result.challenge.challengeId,
                        method: result.challenge.method,
                        expiresAt: result.challenge.expiresAt,
                    }
                },
                "Device registration initiated. Verification code sent."
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in registerDevice:", error);

            if (error.message.includes('User not found')) {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes('already exists')) {
                const response = createConflictResponse('Device already registered');
                res.status(409).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "Failed to register device",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
     * Verify device with code
     * POST /api/devices/verify
     */
    static verifyDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        logger.warn(req.body)
        const validation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            challengeId: 'required|string',
            code: 'required|string|size:6'
        });

        if (!validation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            logger.error("errors",{response})
            res.status(400).json(response);
            return;
        }

        try {
            const { userId, challengeId, code } = validation.data;

            const result = await DeviceService.verifyDevice(userId, challengeId, code);

            const response = createSuccessResponse(
                {
                   result
                },
                "Device verified successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in verifyDevice:", error);

            if (error.message.includes('Challenge not found') ||
                error.message.includes('expired')) {
                const response = createErrorResponse(
                    "Invalid or expired verification code",
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else if (error.message.includes('Invalid code')) {
                const response = createErrorResponse(
                    "Incorrect verification code",
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(400).json(response);
            } else if (error.message.includes('Maximum attempts')) {
                const response = createErrorResponse(
                    "Too many failed attempts. Please request a new code.",
                    ErrorCode.VALIDATION_ERROR
                );
                res.status(429).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "Failed to verify device",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
     * Validate device token (used on login)
     * POST /api/devices/validate
     */
    static validateDeviceToken = async (req: AuthRequest, res: Response): Promise<void> => {
        const validation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            deviceId: 'required|string',
            deviceToken: 'required|string'
        });

        if (!validation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId, deviceId, deviceToken } = validation.data;

            const isValid = await DeviceService.validateDeviceToken(
                userId,
                deviceId,
                deviceToken
            );

            const response = createSuccessResponse(
                { valid: isValid },
                isValid ? "Device is trusted" : "Device is not trusted"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in validateDeviceToken:", error);

            // Always return valid: false on error (fail closed)
            const response = createSuccessResponse(
                { valid: false },
                "Device validation failed"
            );
            res.status(200).json(response);
        }
    }

    /**
     * List user's trusted devices
     * GET /api/devices/list/:userId
     */
    static listUserDevices = async (req: AuthRequest, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            verified: 'optional|boolean',
            sortBy: 'optional|string|in:lastSeen,firstSeen,trustScore',
            sortOrder: 'optional|string|in:asc,desc'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        if (!queryValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(queryValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId } = paramsValidation.data;
            const {
                page = 1,
                limit = 20,
                verified,
                sortBy = 'lastSeen',
                sortOrder = 'desc'
            } = queryValidation.data;

            const result = await DeviceService.listUserDevices(userId, {
                page,
                limit,
                verified,
                sortBy,
                sortOrder: sortOrder as 'asc' | 'desc'
            });

            const pagination: PaginationInfo = {
                page,
                limit,
                total: result.total,
                totalPages: result.totalPages,
                hasMore: page < result.totalPages
            };

            // Don't expose tokens in list
            const safeDevices = result.devices.map(d => ({
                deviceId: d.deviceId,
                deviceName: d.deviceName,
                browser: d.browser,
                os: d.os,
                deviceType: d.deviceType,
                location: d.location,
                lastSeen: d.lastSeen,
                firstSeen: d.firstSeen,
                trustScore: d.trustScore,
                verified: d.verified,
            }));

            const response = createPaginatedResponse(
                safeDevices,
                pagination,
                "User devices retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in listUserDevices:", error);

            if (error.message.includes('User not found')) {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "Failed to list devices",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
     * Get my devices (authenticated user)
     * GET /api/devices/me
     */
    static getMyDevices = async (req: AuthRequest, res: Response): Promise<void> => {
        const userId = (req as any).user?.id;

        if (!userId) {
            const response = createErrorResponse(
                "Unauthorized",
                ErrorCode.UNAUTHORIZED
            );
            res.status(401).json(response);
            return;
        }

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100'
        });

        if (!queryValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(queryValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { page = 1, limit = 20 } = queryValidation.data;

            const result = await DeviceService.listUserDevices(userId, {
                page,
                limit,
                verified: true, // Only show verified devices
                sortBy: 'lastSeen',
                sortOrder: 'desc'
            });

            const pagination: PaginationInfo = {
                page,
                limit,
                total: result.total,
                totalPages: result.totalPages,
                hasMore: page < result.totalPages
            };

            const safeDevices = result.devices.map(d => ({
                deviceId: d.deviceId,
                deviceName: d.deviceName,
                browser: d.browser,
                os: d.os,
                deviceType: d.deviceType,
                location: d.location,
                lastSeen: d.lastSeen,
                firstSeen: d.firstSeen,
                trustScore: d.trustScore,
                current: false, // TODO: Detect current device from deviceId
            }));

            const response = createPaginatedResponse(
                safeDevices,
                pagination,
                "Your devices retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getMyDevices:", error);
            const response = createErrorResponse(
                error.message || "Failed to retrieve devices",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    /**
     * Revoke a device
     * DELETE /api/devices/:deviceId
     */
    static revokeDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        const userId = (req as any).user?.id;

        if (!userId) {
            const response = createErrorResponse(
                "Unauthorized",
                ErrorCode.UNAUTHORIZED
            );
            res.status(401).json(response);
            return;
        }

        const paramsValidation = await validateRequestParams(req, {
            deviceId: 'required|string'
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { deviceId } = paramsValidation.data;

            await DeviceService.revokeDevice(userId, deviceId);

            const response = createSuccessResponse(
                null,
                "Device revoked successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in revokeDevice:", error);

            if (error.message.includes('not found')) {
                const response = createNotFoundResponse('device');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "Failed to revoke device",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
     * Resend verification code
     * POST /api/devices/resend-code
     */
    static resendVerificationCode = async (req: AuthRequest, res: Response): Promise<void> => {
        const validation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            challengeId: 'required|string'
        });

        if (!validation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId, challengeId } = validation.data;

            await DeviceService.resendVerificationCode(userId, challengeId);

            const response = createSuccessResponse(
                null,
                "Verification code resent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in resendVerificationCode:", error);

            if (error.message.includes('Challenge not found')) {
                const response = createNotFoundResponse('challenge');
                res.status(404).json(response);
            } else if (error.message.includes('Rate limit')) {
                const response = createErrorResponse(
                    "Too many requests. Please wait before requesting another code.",
                    ErrorCode.RATE_LIMIT_EXCEEDED
                );
                res.status(429).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "Failed to resend code",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    /**
     * Clean expired devices and challenges
     * POST /api/devices/cleanup (Admin only)
     */
    static cleanupExpired = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const result = await DeviceService.cleanupExpired();

            const response = createSuccessResponse(
                {
                    devicesDeleted: result.devicesDeleted,
                    challengesDeleted: result.challengesDeleted
                },
                "Cleanup completed successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in cleanupExpired:", error);
            const response = createErrorResponse(
                error.message || "Cleanup failed",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}