// src/modules/security/securityAlert.controller.ts
import { Request, Response } from 'express';
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createConflictResponse,
    ErrorCode
} from '@repo/api-utils';
import { 
    validateRequest, 
    validateRequestParams, 
    validateRequestQuery 
} from '../../../../../middlewares/request-validation';

import { logger } from '@repo/logger';
import { transformValidationErrors } from '../../../../../utils/transform-validation-errors';
import { SecurityAlertService, SecurityAlertType, SecurityAlertSeverity } from '../../../../../services/user/security/securityAlert.service';

export class SecurityAlertController {
    // Send a security alert
    static sendSecurityAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            type: `required|string|in:ACCOUNT_LOCKED,SUSPICIOUS_LOGIN,PASSWORD_CHANGED,MFA_DISABLED,FAILED_LOGIN_ATTEMPTS,NEW_DEVICE_LOGIN,ACCOUNT_RECOVERY,UNAUTHORIZED_ACCESS`,
            message: 'required|string|min:5|max:500',
            severity: 'required|string|in:LOW,MEDIUM,HIGH,CRITICAL',
            metadata: 'optional|object'
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
            const { userId, type, message, severity, metadata } = validation.data;
            
            await SecurityAlertService.sendSecurityAlert({
                userId,
                type: type as SecurityAlertType,
                message,
                severity: severity as SecurityAlertSeverity,
                metadata
            });

            const response = createSuccessResponse(
                null,
                "Security alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendSecurityAlert:", error);

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

    // Send account locked alert
    static sendAccountLockedAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            ipAddress: 'optional|ip',
            attempts: 'optional|integer|min:1'
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
            const { userId, ipAddress, attempts } = validation.data;
            
            await SecurityAlertService.sendAccountLockedAlert(userId, ipAddress, attempts);

            const response = createSuccessResponse(
                null,
                "Account locked alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendAccountLockedAlert:", error);

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

    // Send failed login alert
    static sendFailedLoginAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            attempts: 'required|integer|min:1',
            ipAddress: 'optional|ip'
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
            const { userId, attempts, ipAddress } = validation.data;
            
            await SecurityAlertService.sendFailedLoginAlert(userId, attempts, ipAddress);

            const response = createSuccessResponse(
                null,
                "Failed login alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendFailedLoginAlert:", error);

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

    // Send password changed alert
    static sendPasswordChangedAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            ipAddress: 'optional|ip'
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
            const { userId, ipAddress } = validation.data;
            
            await SecurityAlertService.sendPasswordChangedAlert(userId, ipAddress);

            const response = createSuccessResponse(
                null,
                "Password changed alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendPasswordChangedAlert:", error);

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

    // Send MFA disabled alert
    static sendMFADisabledAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            ipAddress: 'optional|ip'
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
            const { userId, ipAddress } = validation.data;
            
            await SecurityAlertService.sendMFADisabledAlert(userId, ipAddress);

            const response = createSuccessResponse(
                null,
                "MFA disabled alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendMFADisabledAlert:", error);

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

    // Send new device login alert
    static sendNewDeviceLoginAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            device: 'optional|string|max:100',
            location: 'optional|string|max:100',
            ipAddress: 'optional|ip'
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
            const { userId, device, location, ipAddress } = validation.data;
            
            await SecurityAlertService.sendNewDeviceLoginAlert(userId, device, location, ipAddress);

            const response = createSuccessResponse(
                null,
                "New device login alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendNewDeviceLoginAlert:", error);

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

    // Send suspicious login alert
    static sendSuspiciousLoginAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            message: 'required|string|min:5|max:500',
            device: 'optional|string|max:100',
            location: 'optional|string|max:100',
            ipAddress: 'optional|ip'
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
            const { userId, message, device, location, ipAddress } = validation.data;
            
            await SecurityAlertService.sendSecurityAlert({
                userId,
                type: 'SUSPICIOUS_LOGIN',
                message,
                severity: 'HIGH',
                metadata: { device, location, ipAddress }
            });

            const response = createSuccessResponse(
                null,
                "Suspicious login alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendSuspiciousLoginAlert:", error);

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

    // Send account recovery alert
    static sendAccountRecoveryAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            message: 'optional|string|min:5|max:500',
            ipAddress: 'optional|ip'
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
            const { userId, message, ipAddress } = validation.data;
            
            await SecurityAlertService.sendSecurityAlert({
                userId,
                type: 'ACCOUNT_RECOVERY',
                message: message || 'Account recovery process has been initiated.',
                severity: 'HIGH',
                metadata: { ipAddress }
            });

            const response = createSuccessResponse(
                null,
                "Account recovery alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendAccountRecoveryAlert:", error);

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

    // Send unauthorized access attempt alert
    static sendUnauthorizedAccessAlert = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            message: 'required|string|min:5|max:500',
            ipAddress: 'optional|ip',
            userAgent: 'optional|string',
            attemptedAction: 'optional|string'
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
            const { userId, message, ipAddress, userAgent, attemptedAction } = validation.data;
            
            await SecurityAlertService.sendSecurityAlert({
                userId,
                type: 'UNAUTHORIZED_ACCESS',
                message,
                severity: 'CRITICAL',
                metadata: { ipAddress, userAgent, attemptedAction }
            });

            const response = createSuccessResponse(
                null,
                "Unauthorized access alert sent successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendUnauthorizedAccessAlert:", error);

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

    // Bulk send security alerts (admin only)
    static sendBulkSecurityAlerts = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            alerts: 'required|array|min:1',
            'alerts.*.userId': 'required|string|cuid',
            'alerts.*.type': `required|string|in:ACCOUNT_LOCKED,SUSPICIOUS_LOGIN,PASSWORD_CHANGED,MFA_DISABLED,FAILED_LOGIN_ATTEMPTS,NEW_DEVICE_LOGIN,ACCOUNT_RECOVERY,UNAUTHORIZED_ACCESS`,
            'alerts.*.message': 'required|string|min:5|max:500',
            'alerts.*.severity': 'required|string|in:LOW,MEDIUM,HIGH,CRITICAL',
            'alerts.*.metadata': 'optional|object'
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
            const { alerts } = validation.data;
            const results = [];
            const errors = [];

            // Process alerts sequentially to handle errors properly
            for (const alert of alerts) {
                try {
                    await SecurityAlertService.sendSecurityAlert({
                        userId: alert.userId,
                        type: alert.type as SecurityAlertType,
                        message: alert.message,
                        severity: alert.severity as SecurityAlertSeverity,
                        metadata: alert.metadata
                    });
                    results.push({
                        userId: alert.userId,
                        type: alert.type,
                        success: true
                    });
                } catch (error: any) {
                    errors.push({
                        userId: alert.userId,
                        type: alert.type,
                        error: error.message
                    });
                    logger.error(`Failed to send security alert for user ${alert.userId}:`, error);
                }
            }

            const response = createSuccessResponse(
                {
                    total: alerts.length,
                    successful: results.length,
                    failed: errors.length,
                    results,
                    errors: errors.length > 0 ? errors : undefined
                },
                `${results.length} of ${alerts.length} security alerts sent successfully`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in sendBulkSecurityAlerts:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}