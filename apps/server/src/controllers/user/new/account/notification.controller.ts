// src/modules/notification/notification.controller.ts
import { Request, Response } from 'express';
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createPaginatedResponse,
    ErrorCode,
    PaginationInfo
} from '@repo/api-utils';
import { 
    validateRequest, 
    validateRequestParams, 
    validateRequestQuery 
} from '../../../../middlewares/request-validation';

import { logger } from '@repo/logger';
import { transformValidationErrors } from '../../../../utils/transform-validation-errors';
import { NotificationService } from '../../../../services/user/notification.service';

export class NotificationController {
    // Get notification by ID
    static getNotificationById = async (req: Request, res: Response): Promise<void> => {
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
            const notification = await NotificationService.getNotificationById(id);

            const response = createSuccessResponse(
                { notification },
                "Notification retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getNotificationById:", error);

            if (error.message === "Notification not found") {
                const response = createNotFoundResponse('notification');
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

    // Get user notifications
    static getUserNotifications = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            sortBy: 'optional|string|in:createdAt,updatedAt,type',
            sortOrder: 'optional|string|in:asc,desc',
            isRead: 'optional|boolean',
            type: 'optional|string',
            startDate: 'optional|date',
            endDate: 'optional|date',
            search: 'optional|string'
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
                sortBy = 'createdAt',
                sortOrder = 'desc',
                isRead,
                type,
                startDate,
                endDate,
                search
            } = queryValidation.data;

            // Parse dates if provided
            const filters: any = {};
            if (isRead !== undefined) filters.isRead = isRead;
            if (type) filters.type = type;
            if (startDate) filters.startDate = new Date(startDate);
            if (endDate) filters.endDate = new Date(endDate);
            if (search) filters.search = search;

            const { notifications, total, totalPages, page: currentPage, limit: currentLimit, hasMore } = 
                await NotificationService.getUserNotifications(userId, {
                    page,
                    limit,
                    sortBy: sortBy === 'createdAt' ? 'createdAt' : undefined,
                    sortOrder: sortOrder as 'asc' | 'desc',
                    filters
                });

            const paginationInfo: PaginationInfo = {
                page: currentPage,
                limit: currentLimit,
                total,
                totalPages,
                hasMore
            };

            const response = createPaginatedResponse(
                notifications,
                paginationInfo,
                'Notifications retrieved successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserNotifications:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Create notification
    static createNotification = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            type: 'optional|string|max:50',
            notification: 'required|string|min:1|max:500',
            data: 'optional|object'
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
            const notificationData = validation.data;
            const notification = await NotificationService.createNotification(notificationData);

            const response = createSuccessResponse(
                { notification },
                "Notification created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in createNotification:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Create batch notifications
    static createBatchNotifications = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            notifications: 'required|array|min:1',
            'notifications.*.userId': 'required|string|cuid',
            'notifications.*.type': 'optional|string|max:50',
            'notifications.*.notification': 'required|string|min:1|max:500',
            'notifications.*.data': 'optional|object'
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
            const { notifications } = validation.data;
            const createdNotifications = await NotificationService.createBatchNotifications(notifications);

            const response = createSuccessResponse(
                { notifications: createdNotifications },
                `${createdNotifications.length} notifications created successfully`
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in createBatchNotifications:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Mark notification as read
    static markAsRead = async (req: Request, res: Response): Promise<void> => {
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
            const notification = await NotificationService.markAsRead(id);

            const response = createSuccessResponse(
                { notification },
                "Notification marked as read"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in markAsRead:", error);

            if (error.message === "Notification not found") {
                const response = createNotFoundResponse('notification');
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

    // Mark all notifications as read
    static markAllAsRead = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
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
            const { userId } = paramsValidation.data;
            const result = await NotificationService.markAllAsRead(userId);

            const response = createSuccessResponse(
                { count: result.count },
                `${result.count} notifications marked as read`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in markAllAsRead:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Get unread count
    static getUnreadCount = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
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
            const { userId } = paramsValidation.data;
            const count = await NotificationService.getUnreadCount(userId);

            const response = createSuccessResponse(
                { count },
                "Unread count retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUnreadCount:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Delete notification
    static deleteNotification = async (req: Request, res: Response): Promise<void> => {
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
            const result = await NotificationService.deleteNotification(id);

            const response = createSuccessResponse(
                { notification: result },
                "Notification deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deleteNotification:", error);

            if (error.message === "Notification not found") {
                const response = createNotFoundResponse('notification');
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

    // Get notification statistics
    static getNotificationStats = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
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
            const { userId } = paramsValidation.data;
            const stats = await NotificationService.getNotificationStats(userId);

            const response = createSuccessResponse(
                { stats },
                "Notification statistics retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getNotificationStats:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Get notification types
    static getNotificationTypes = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
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
            const { userId } = paramsValidation.data;
            const types = await NotificationService.getNotificationTypes(userId);

            const response = createSuccessResponse(
                { types },
                "Notification types retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getNotificationTypes:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Update notification
    static updateNotification = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        const bodyValidation = await validateRequest(req, {
            isRead: 'optional|boolean',
            notification: 'optional|string|min:1|max:500',
            data: 'optional|object'
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
            const updateData = bodyValidation.data;

            const notification = await NotificationService.updateNotification(id, updateData);

            const response = createSuccessResponse(
                { notification },
                "Notification updated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updateNotification:", error);

            if (error.message === "Notification not found") {
                const response = createNotFoundResponse('notification');
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

    // Clean up old notifications (Admin endpoint)
    static cleanupOldNotifications = async (req: Request, res: Response): Promise<void> => {
        const queryValidation = await validateRequestQuery(req, {
            days: 'optional|integer|min:1|max:365'
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
            const { days = 30 } = queryValidation.data;
            const result = await NotificationService.cleanupOldNotifications(days);

            const response = createSuccessResponse(
                { count: result.count },
                `${result.count} old notifications cleaned up`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in cleanupOldNotifications:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Check notification ownership
    static checkNotificationOwnership = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            notificationId: 'required|string|cuid',
            userId: 'required|string|cuid'
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
            const { notificationId, userId } = paramsValidation.data;
            const isOwner = await NotificationService.isNotificationOwner(notificationId, userId);

            const response = createSuccessResponse(
                { isOwner },
                "Notification ownership checked successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in checkNotificationOwnership:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}