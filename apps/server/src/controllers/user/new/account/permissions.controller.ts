// src/modules/permission/permission.controller.ts
import { Request, Response } from 'express';
import {
    createSuccessResponse,
    createErrorResponse,
    createNotFoundResponse,
    createConflictResponse,
    createPaginatedResponse,
    ErrorCode,
    PaginationInfo
} from '@repo/api-utils';
import { validateRequest, validateRequestParams, validateRequestQuery } from '../../../../middlewares/request-validation';

import { logger } from '@repo/logger';
import { transformValidationErrors } from '../../../../utils/transform-validation-errors';
import { PermissionService } from '../../../../services/user/permissions.service';



export class PermissionController {
    // Get permission by ID
    static getPermissionById = async (req: Request, res: Response): Promise<void> => {
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
            const permission = await PermissionService.getPermissionById(id);

            const response = createSuccessResponse(
                { permission },
                "Permission retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getPermissionById:", error);

            if (error.message === "Permission not found") {
                const response = createNotFoundResponse('permission');
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

    // Get all permissions
    static getPermissions = async (req: Request, res: Response): Promise<void> => {
        const queryValidation = await validateRequestQuery(req, {
            page: 'optional|integer|min:1',
            limit: 'optional|integer|min:1|max:100',
            category: 'optional|string',
            search: 'optional|string',
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
                category,
                search,
                sortBy = 'name',
                sortOrder = 'asc'
            } = queryValidation.data;

            const { permissions, total, totalPages } = await PermissionService.getPermissions({
                page,
                limit,
                filters: { category, search },
                sortBy,
                sortOrder: sortOrder as 'asc' | 'desc'
            });
            const paginationInfo: PaginationInfo = {
                page,
                limit,
                total,
                totalPages,
                hasMore: page < totalPages,
            };

            const response = createPaginatedResponse(
                permissions,
                paginationInfo,
                'Users retrieved successfully'
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getPermissions:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Create permission
    static createPermission = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            name: 'required|string|min:3|max:100',
            description: 'optional|string|max:500',
            category: 'optional|string|max:50'
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
            const permissionData = validation.data;
            const permission = await PermissionService.createPermission(permissionData);

            const response = createSuccessResponse(
                { permission },
                "Permission created successfully"
            );
            res.status(201).json(response);
        } catch (error: any) {
            logger.error("Error in createPermission:", error);

            if (error.message.includes('already exists')) {
                const response = createConflictResponse('Permission with this name already exists');
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

    // Update permission
    static updatePermission = async (req: Request, res: Response): Promise<void> => {
        const paramsValidation = await validateRequestParams(req, {
            id: 'required|string|cuid'
        });

        const bodyValidation = await validateRequest(req, {
            description: 'optional|string|max:500',
            category: 'optional|string|max:50'
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

            const permission = await PermissionService.updatePermission(id, updateData);

            const response = createSuccessResponse(
                { permission },
                "Permission updated successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in updatePermission:", error);

            if (error.message === "Permission not found") {
                const response = createNotFoundResponse('permission');
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

    // Delete permission
    static deletePermission = async (req: Request, res: Response): Promise<void> => {
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
            await PermissionService.deletePermission(id);

            const response = createSuccessResponse(
                null,
                "Permission deleted successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in deletePermission:", error);

            if (error.message === "Permission not found") {
                const response = createNotFoundResponse('permission');
                res.status(404).json(response);
            } else if (error.message.includes('in use')) {
                const response = createConflictResponse('Permission is in use and cannot be deleted');
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

    // Get permission categories
    static getPermissionCategories = async (req: Request, res: Response): Promise<void> => {
        try {
            const categories = await PermissionService.getPermissionCategories();

            const response = createSuccessResponse(
                { categories },
                "Permission categories retrieved successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in getPermissionCategories:", error);
            const response = createErrorResponse(
                error.message || "An unexpected error occurred",
                ErrorCode.INTERNAL_ERROR
            );
            res.status(500).json(response);
        }
    }

    // Assign permission to user
    static assignPermissionToUser = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            permissionId: 'required|string|cuid'
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
            const { userId, permissionId } = validation.data;
            await PermissionService.assignPermissionToUser(userId, permissionId);

            const response = createSuccessResponse(
                null,
                "Permission assigned to user successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in assignPermissionToUser:", error);

            if (error.message === "User not found" || error.message === "Permission not found") {
                const response = createNotFoundResponse(error.message.split(' ')[0].toLowerCase());
                res.status(404).json(response);
            } else if (error.message.includes('already assigned')) {
                const response = createConflictResponse('Permission already assigned to user');
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

    // Remove permission from user
    static removePermissionFromUser = async (req: Request, res: Response): Promise<void> => {
        const validation = await validateRequest(req, {
            userId: 'required|string|cuid',
            permissionId: 'required|string|cuid'
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
            const { userId, permissionId } = validation.data;
            await PermissionService.removePermissionFromUser(userId, permissionId);

            const response = createSuccessResponse(
                null,
                "Permission removed from user successfully"
            );
            res.status(200).json(response);
        } catch (error: any) {
            logger.error("Error in removePermissionFromUser:", error);

            if (error.message === "User not found" || error.message === "Permission not found") {
                const response = createNotFoundResponse(error.message.split(' ')[0].toLowerCase());
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
}