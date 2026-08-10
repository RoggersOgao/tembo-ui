// src/modules/session/session.controller.ts
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
import {logger} from '@repo/logger';
import { transformValidationErrors } from '../../../../utils/transform-validation-errors';
import { SessionService } from '../../../../services/user/session.service';

export class SessionController {
    // Get session by ID
    static getSessionById = async (req: Request, res: Response): Promise<void> => {
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
            const session = await SessionService.getSessionById(id);

            const response = createSuccessResponse(
                { session },
                "Session retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getSessionById:", error);

            if (error.message === "Session not found") {
                const response = createNotFoundResponse('session');
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

    // Get session by token
    static getSessionByToken = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            token: 'required|string'
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
            const { token } = paramsValidation.data;
            const session = await SessionService.getSessionByToken(token);

            const response = createSuccessResponse(
                { session },
                "Session retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getSessionByToken:", error);

            if (error.message === "Session not found") {
                const response = createNotFoundResponse('session');
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

    // Get user sessions
    static getUserSessions = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            userId: 'required|string|cuid'
        });

        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            isActive: 'optional|boolean',
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
                isActive,
                deviceType,
                sortBy = 'lastUsedAt',
                sortOrder = 'desc'
            } = queryValidation.data;

            const { sessions, total, totalPages } = await SessionService.getUserSessions(userId, {
                page,
                limit,
                filters: { isActive, deviceType },
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
                sessions ,
                pagination,
                "User sessions retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getUserSessions:", error);
            
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

    // Get current user sessions (for authenticated user)
    static getMySessions = async (req: Request, res: Response): Promise<void> => {
        const userId = (req as any).user.id;
        
        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            isActive: 'optional|boolean'
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
                isActive
            } = queryValidation.data;

            const { sessions, total, totalPages } = await SessionService.getUserSessions(userId, {
                page,
                limit,
                filters: { isActive },
                sortBy: 'lastUsedAt',
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
                sessions,
                pagination,
                "Your sessions retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getMySessions:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Create session
    static createSession = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            sessionToken: 'required|string',
            expires: 'required|date',
            ipAddress: 'optional|string|ip',
            userAgent: 'optional|string|max:500',
            deviceInfo: 'optional|object',
            isVerified: 'optional|boolean'
        });

        if (!validation.isValid) {
            const response = createErrorResponse(
                transformValidationErrors(validation.errors),
                ErrorCode.VALIDATION_ERROR
            );
            logger.warn("errors", validation.errors)
            res.status(400).json(response);
            return;
        }

        try {
            const sessionData = validation.data;
            const session = await SessionService.createSession(sessionData);

            const response = createSuccessResponse(
                { session },
                "Session created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in createSession:", error);
            
            if (error.message.includes('User not found')) {
                const response = createNotFoundResponse('user');
                res.status(404).json(response);
            } else if (error.message.includes('already exists')) {
                const response = createErrorResponse(
                    "Session token already exists",
                    ErrorCode.CONFLICT
                );
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

    // Update session
    static updateSession = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        const bodyValidation = await validateRequest(req, {
            isActive: 'optional|boolean',
            deviceInfo: 'optional|object',
            lastUsedAt: 'optional|date'
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
            
            const session = await SessionService.updateSession(id, updateData);

            const response = createSuccessResponse(
                { session },
                "Session updated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updateSession:", error);

            if (error.message === "Session not found") {
                const response = createNotFoundResponse('session');
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

    // Refresh session (update lastUsedAt)
    static refreshSession = async (req: Request, res: Response): Promise<void> => {
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
            const session = await SessionService.refreshSession(id);

            const response = createSuccessResponse(
                { session },
                "Session refreshed successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in refreshSession:", error);

            if (error.message === "Session not found") {
                const response = createNotFoundResponse('session');
                res.status(404).json(response);
            } else if (error.message === "Session is not active") {
                const response = createErrorResponse(
                    "Cannot refresh inactive session",
                    ErrorCode.FORBIDDEN
                );
                res.status(403).json(response);
            } else if (error.message === "Session has expired") {
                const response = createErrorResponse(
                    "Cannot refresh expired session",
                    ErrorCode.FORBIDDEN
                );
                res.status(403).json(response);
            } else {
                const response = createErrorResponse(
                    error.message || "An unexpected error occurred",
                    ErrorCode.INTERNAL_ERROR
                );
                res.status(500).json(response);
            }
        }
    }

    // Deactivate session
    static deactivateSession = async (req: Request, res: Response): Promise<void> => {
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
            const session = await SessionService.deactivateSession(id);

            const response = createSuccessResponse(
                { session },
                "Session deactivated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deactivateSession:", error);

            if (error.message === "Session not found") {
                const response = createNotFoundResponse('session');
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

    // Delete session
    static deleteSession = async (req: Request, res: Response): Promise<void> => {
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
            await SessionService.deleteSession(id);

            const response = createSuccessResponse(
                null,
                "Session deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deleteSession:", error);

            if (error.message === "Session not found") {
                const response = createNotFoundResponse('session');
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

    // Deactivate all user sessions
    static deactivateAllUserSessions = async (req: Request, res: Response): Promise<void> => {
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
            const count = await SessionService.deactivateAllUserSessions(userId);

            const response = createSuccessResponse(
                { deactivatedCount: count },
                `Successfully deactivated ${count} sessions`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deactivateAllUserSessions:", error);
            
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

    // Deactivate all my sessions except current
    static deactivateAllMySessions = async (req: Request, res: Response): Promise<void> => {
        const userId = (req as any).user.id;
        const currentSessionId = (req as any).sessionId;

        try {
            const count = await SessionService.deactivateAllOtherSessions(userId, currentSessionId);

            const response = createSuccessResponse(
                { deactivatedCount: count },
                `Successfully deactivated ${count} other sessions`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deactivateAllMySessions:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Clean expired sessions
    static cleanExpiredSessions = async (req: Request, res: Response): Promise<void> => {
        try {
            const count = await SessionService.cleanExpiredSessions();

            const response = createSuccessResponse(
                { deletedCount: count },
                `Successfully cleaned ${count} expired sessions`
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in cleanExpiredSessions:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }
}