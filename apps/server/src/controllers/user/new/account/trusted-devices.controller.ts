// src/modules/trusted-device/trusted-device.controller.ts
import { Request, Response } from 'express';
import crypto from "crypto";

import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createConflictResponse,
    createPaginatedResponse,
    ErrorCode,
    PaginationInfo
} from '@repo/api-utils';
import { validateRequest, validateRequestBody, validateRequestParams, validateRequestQuery } from '../../../../middlewares/request-validation';

import { logger } from '@repo/logger';
import { transformValidationErrors } from '../../../../utils/transform-validation-errors';
import { TrustedDeviceService } from '../../../../services/user/trusted-device.service';
import { AuthRequest } from '../../../../middlewares/auth.middleware';

function hashDeviceToken(token: string): string {
    return crypto
        .createHash('sha256')
        .update(token)
        .digest('hex')
        .toLowerCase();
}

export class TrustedDeviceController {

    // ── Public routes (no auth required) ─────────────────────────────────────

    // Verify device with token hash
    static verifyDeviceToken = async (req: AuthRequest, res: Response): Promise<void> => {
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
            const deviceTokenHash = hashDeviceToken(deviceToken);

            const device = await TrustedDeviceService.verifyDeviceByToken(
                userId,
                deviceId
            );

            if (!device) {
                const response = createNotFoundResponse("Device not found or token invalid");
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse({ device }, "Device verified successfully");
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in verifyDeviceToken:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Check if device is trusted
    static checkTrustedDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        const bodyValidation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            deviceId: 'required|string'
        });

        if (!bodyValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(bodyValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { userId, deviceId } = bodyValidation.data;
            const isTrusted = await TrustedDeviceService.isDeviceTrusted(userId, deviceId);

            const response = createSuccessResponse(
                { isTrusted },
                isTrusted ? "Device is trusted" : "Device not found in trusted devices"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error checking trusted device:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Create trusted device
    static createTrustedDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            deviceId: 'required|string',
            deviceToken: 'required|string',
            deviceName: 'required|string|max:100',
            deviceType: 'optional|string|max:50',
            os: 'optional|string|max:50',
            osVersion: 'optional|string|max:50',
            browser: 'optional|string|max:50',
            browserVersion: 'optional|string|max:50',
            ipAddress: 'optional|string|ip',
            location: 'optional|string|max:200',
            verified: 'optional|boolean',
            trustScore: 'optional|integer|min:0|max:100'
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
            const { deviceToken, ...deviceData } = validation.data;

            const device = await TrustedDeviceService.createTrustedDevice({
               ...validation.data
            });

            const response = createSuccessResponse({ device }, "Trusted device created successfully");
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in createTrustedDevice:", error);
            if (error.message.includes('User not found')) {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes('already exists')) {
                const response = createConflictResponse('Device ID already exists for this user');
                res.status(409).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // ── Authenticated routes (authMiddleware applied in router) ───────────────

    // Get trusted device by ID
    static getTrustedDeviceById = async (req: AuthRequest, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
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
            const { id } = paramsValidation.data;
            const device = await TrustedDeviceService.getTrustedDeviceById(id);

            const response = createSuccessResponse({ device }, "Trusted device retrieved successfully");
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getTrustedDeviceById:", { error });
            if (error.message === "Trusted device not found") {
                const response = createNotFoundResponse('trusted_device');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Get user's trusted devices
    static getUserTrustedDevices = async (req: AuthRequest, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            verified: 'optional|boolean',
            deviceType: 'optional|string',
            sortBy: 'optional|string',
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
                deviceType,
                sortBy = 'lastSeen',
                sortOrder = 'desc'
            } = queryValidation.data;

            const { devices, total, totalPages } = await TrustedDeviceService.getUserTrustedDevices(userId, {
                page,
                limit,
                filters: { verified, deviceType },
                sortBy,
                sortOrder: sortOrder as 'asc' | 'desc'
            });

            const pagination: PaginationInfo = {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            };

            const response = createPaginatedResponse(
                devices,
                pagination,
                "User's trusted devices retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserTrustedDevices:", error);
            if (error.message === "User not found") {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Get my trusted devices (uses req.user from authMiddleware)
    static getMyTrustedDevices = async (req: AuthRequest, res: Response): Promise<void> => {
        const userId = req.user!.userId;

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            verified: 'optional|boolean'
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
            const { page = 1, limit = 20, verified } = queryValidation.data;

            const { devices, total, totalPages } = await TrustedDeviceService.getUserTrustedDevices(userId, {
                page,
                limit,
                filters: { verified },
                sortBy: 'lastSeen',
                sortOrder: 'desc'
            });

            const pagination: PaginationInfo = {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages
            };

            const response = createPaginatedResponse(
                devices,
                pagination,
                "Your trusted devices retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getMyTrustedDevices:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Update device properties
    static updateDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        const bodyValidation = await validateRequestBody(req, {
            deviceName: 'optional|string|max:100',
            deviceType: 'optional|string|max:50',
            os: 'optional|string|max:50',
            osVersion: 'optional|string|max:50',
            browser: 'optional|string|max:50',
            browserVersion: 'optional|string|max:50',
            verified: 'optional|boolean',
            trustScore: 'optional|integer|min:0|max:100',
            lastSeen: 'optional|boolean',
            incrementTrustScore: 'optional|integer',
        });

        if (!paramsValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(paramsValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        if (!bodyValidation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(bodyValidation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            res.status(400).json(response);
            return;
        }

        try {
            const { id } = paramsValidation.data;
            const { lastSeen, incrementTrustScore, ...updateData } = bodyValidation.data;

            const device = await TrustedDeviceService.updateDevice(id, {
                ...updateData,
                updateLastSeen: lastSeen,
                trustScoreIncrement: incrementTrustScore
            });

            const response = createSuccessResponse({ device }, "Trusted device updated successfully");
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updateDevice:", error);
            if (error.message === "Trusted device not found") {
                const response = createNotFoundResponse('trusted_device');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Revoke device
    static revokeDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        const validation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            deviceId: 'required|string',
            reason: 'optional|string|max:500'
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
            const { userId, deviceId, reason } = validation.data;
            const success = await TrustedDeviceService.revokeDevice(deviceId, userId, reason);

            if (!success) {
                const response = createNotFoundResponse('trusted_device');
                res.status(404).json(response);
                return;
            }

            const response = createSuccessResponse(null, "Device revoked successfully");
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in revokeDevice:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Delete trusted device
    static deleteTrustedDevice = async (req: AuthRequest, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
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
            const { id } = paramsValidation.data;
            await TrustedDeviceService.deleteTrustedDevice(id);

            const response = createSuccessResponse(null, "Trusted device deleted successfully");
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deleteTrustedDevice:", error);
            if (error.message === "Trusted device not found") {
                const response = createNotFoundResponse('trusted_device');
                res.status(404).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Cleanup expired devices
    static cleanupExpiredDevices = async (req: AuthRequest, res: Response): Promise<void> => {
        try {
            const count = await TrustedDeviceService.cleanupExpiredDevices();

            const response = createSuccessResponse(
                { deletedCount: count },
                `Successfully cleaned up ${count} expired devices`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in cleanupExpiredDevices:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Clean old unused trusted devices
    static cleanOldTrustedDevices = async (req: AuthRequest, res: Response): Promise<void> => {
        const queryValidation = await validateRequestQuery(req, {
            daysThreshold: 'optional|integer|min:1|max:365'
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
            const { daysThreshold = 90 } = queryValidation.data;
            const count = await TrustedDeviceService.cleanOldTrustedDevices(daysThreshold);

            const response = createSuccessResponse(
                { deletedCount: count },
                `Successfully cleaned ${count} old trusted devices`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in cleanOldTrustedDevices:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Refresh device token
    static refreshDeviceToken = async (req: AuthRequest, res: Response): Promise<void> => {
        const validation = await validateRequestBody(req, {
            userId: 'required|string|cuid',
            deviceId: 'required|string'
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
            const { userId, deviceId } = validation.data;
            await TrustedDeviceService.refreshDeviceToken(deviceId, userId);

            const response = createSuccessResponse(null, "Device token refreshed successfully");
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in refreshDeviceToken:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}