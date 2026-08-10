import { Request, Response } from 'express';
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createPaginatedResponse,
    ErrorCode,
    PaginationInfo
} from '@repo/api-utils';
import { validateRequest, validateRequestParams, validateRequestQuery } from '../../../../middlewares/request-validation';

import { logger } from '@repo/logger';
import { transformValidationErrors } from '../../../../utils/transform-validation-errors';
import { AuditLogService } from '../../../../services/user/audit-log.service';


export class AuditLogController {
    // Get audit log by ID
    static getAuditLogById = async (req: Request, res: Response): Promise<void> => {
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
            const auditLog = await AuditLogService.getAuditLogById(id);

            const response = createSuccessResponse(
                { auditLog },
                "Audit log retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getAuditLogById:", {error});

            if (error.message === "Audit log not found") {
                const response = createNotFoundResponse('audit_log');
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

    // Get audit logs with filters and pagination
    static getAuditLogs = async (req: Request, res: Response): Promise<void> => {
        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            userId: 'optional|string|cuid',
            action: 'optional|string',
            entityType: 'optional|string',
            entityId: 'optional|string',
            startDate: 'optional|date',
            endDate: 'optional|date',
            sortBy: 'optional|string',
            sortOrder: 'optional|string|in:asc,desc'
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
            const { 
                page = 1, 
                limit = 20,
                userId,
                action,
                entityType,
                entityId,
                startDate,
                endDate,
                sortBy = 'createdAt',
                sortOrder = 'desc'
            } = queryValidation.data;

            const { auditLogs, total, totalPages } = await AuditLogService.getAuditLogs({
                page,
                limit,
                filters: {
                    userId,
                    action,
                    entityType,
                    entityId,
                    startDate,
                    endDate
                },
                sortBy,
                sortOrder: sortOrder as 'asc' | 'desc'
            });

            const pagination: PaginationInfo = {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
               
            };

            const response = createPaginatedResponse(
                 auditLogs ,
                 pagination,
                 "Audit logs retrieved successfully",
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getAuditLogs:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Create audit log (typically called internally)
    static createAuditLog = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'optional|string|cuid',
            action: 'required|string|max:100',
            entityType: 'required|string|max:50',
            entityId: 'optional|string|max:100',
            changes: 'optional|object',
            ipAddress: 'optional|string|ip',
            userAgent: 'optional|string|max:500',
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
            const auditLogData = validation.data;
            const auditLog = await AuditLogService.createAuditLog(auditLogData);

            const response = createSuccessResponse(
                { auditLog },
                "Audit log created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in createAuditLog:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Get user's audit logs
    static getUserAuditLogs = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            action: 'optional|string',
            startDate: 'optional|date',
            endDate: 'optional|date'
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
                action,
                startDate,
                endDate
            } = queryValidation.data;

            const { auditLogs, total, totalPages } = await AuditLogService.getUserAuditLogs(userId, {
                page,
                limit,
                filters: { action, startDate, endDate }
            });

            const pagination: PaginationInfo = {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            };

            const response = createPaginatedResponse(
                auditLogs ,
                pagination,
                "User audit logs retrieved successfully",
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserAuditLogs:", error);
            
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

    // Search audit logs by entity
    static searchAuditLogsByEntity = async (req: Request, res: Response): Promise<void> => {
        const queryValidation = await validateRequestQuery(req, {
            entityType: 'required|string',
            entityId: 'required|string',
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
            const { entityType, entityId, page = 1, limit = 20 } = queryValidation.data;
            
            const { auditLogs, total, totalPages } = await AuditLogService.getEntityAuditLogs(
                entityType,
                entityId,
                page,
                limit
            );

            const pagination: PaginationInfo = {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            };

            const response = createPaginatedResponse(
                auditLogs ,
                pagination,
                "Entity audit logs retrieved successfully",
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in searchAuditLogsByEntity:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}