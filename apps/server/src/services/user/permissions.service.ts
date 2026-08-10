// src/modules/permission/permission.service.ts

import { db } from "@repo/database";

export interface PermissionFilters {
    category?: string;
    search?: string;
}

export interface GetPermissionsOptions {
    page: number;
    limit: number;
    filters?: PermissionFilters;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface PermissionWithCounts {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: {
        users: number;
        roles: number;
    };
}

export class PermissionService {
    // Get permission by ID with counts
    static async getPermissionById(id: string): Promise<PermissionWithCounts> {
        const permission = await db.permission.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        roles: true
                    }
                }
            }
        });

        if (!permission) {
            throw new Error('Permission not found');
        }

        return permission as PermissionWithCounts;
    }

    // Get permissions with pagination and filters
    static async getPermissions(options: GetPermissionsOptions): Promise<{
        permissions: PermissionWithCounts[];
        total: number;
        totalPages: number;
    }> {
        const { page, limit, filters = {}, sortBy = 'name', sortOrder = 'asc' } = options;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (filters.category) {
            where.category = filters.category;
        }

        if (filters.search) {
            where.OR = [
                { name: { contains: filters.search, mode: 'insensitive' } },
                { description: { contains: filters.search, mode: 'insensitive' } }
            ];
        }

        // Map sortBy fields to database column names
        const sortByFieldMap: Record<string, string> = {
            'createdAt': 'createdAt',
            'updatedAt': 'updatedAt',
            'name': 'name',
            'description': 'description',
            'category': 'category'
        };

        const mappedSortBy = sortByFieldMap[sortBy] || 'name';

        const [permissions, total] = await Promise.all([
            db.permission.findMany({
                where,
                include: {
                    _count: {
                        select: {
                            users: true,
                            roles: true
                        }
                    }
                },
                orderBy: {
                    [mappedSortBy]: sortOrder
                },
                skip,
                take: limit
            }),
            db.permission.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            permissions: permissions as PermissionWithCounts[],
            total,
            totalPages
        };
    }

    // Create permission
    static async createPermission(data: {
        name: string;
        description?: string;
        category?: string;
    }): Promise<PermissionWithCounts> {
        // Check if permission already exists
        const existingPermission = await db.permission.findUnique({
            where: { name: data.name }
        });

        if (existingPermission) {
            throw new Error(`Permission with name "${data.name}" already exists`);
        }

        const permission = await db.permission.create({
            data: {
                name: data.name,
                description: data.description,
                category: data.category
            },
            include: {
                _count: {
                    select: {
                        users: true,
                        roles: true
                    }
                }
            }
        });

        return permission as PermissionWithCounts;
    }

    // Update permission
    static async updatePermission(id: string, data: {
        description?: string;
        category?: string;
    }): Promise<PermissionWithCounts> {
        try {
            const permission = await db.permission.update({
                where: { id },
                data: {
                    description: data.description,
                    category: data.category
                },
                include: {
                    _count: {
                        select: {
                            users: true,
                            roles: true
                        }
                    }
                }
            });

            return permission as PermissionWithCounts;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Permission not found');
            }
            throw error;
        }
    }

    // Delete permission
    static async deletePermission(id: string): Promise<void> {
        // Check if permission is in use
        const permission = await db.permission.findUnique({
            where: { id },
            include: {
                _count: {
                    select: {
                        users: true,
                        roles: true
                    }
                }
            }
        });

        if (!permission) {
            throw new Error('Permission not found');
        }

        const userCount = permission._count.users;
        const roleCount = permission._count.roles;

        if (userCount > 0 || roleCount > 0) {
            throw new Error('Permission is in use and cannot be deleted');
        }

        await db.permission.delete({
            where: { id }
        });
    }

    // Get all unique permission categories
    static async getPermissionCategories(): Promise<string[]> {
        const categories = await db.permission.findMany({
            select: {
                category: true
            },
            distinct: ['category'],
            where: {
                category: { not: null }
            }
        });

        return categories
            .map(c => c.category)
            .filter((c): c is string => c !== null)
            .sort();
    }

    // Assign permission to user
    static async assignPermissionToUser(userId: string, permissionId: string): Promise<void> {
        // Check if user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check if permission exists
        const permission = await db.permission.findUnique({
            where: { id: permissionId }
        });

        if (!permission) {
            throw new Error('Permission not found');
        }

        // Check if permission is already assigned
        const existingAssignment = await db.user.findFirst({
            where: {
                id: userId,
                permissions: {
                    some: {
                        id: permissionId
                    }
                }
            }
        });

        if (existingAssignment) {
            throw new Error('Permission already assigned to user');
        }

        // Assign permission
        await db.user.update({
            where: { id: userId },
            data: {
                permissions: {
                    connect: { id: permissionId }
                }
            }
        });
    }

    // Remove permission from user
    static async removePermissionFromUser(userId: string, permissionId: string): Promise<void> {
        // Check if user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check if permission exists
        const permission = await db.permission.findUnique({
            where: { id: permissionId }
        });

        if (!permission) {
            throw new Error('Permission not found');
        }

        // Remove permission
        await db.user.update({
            where: { id: userId },
            data: {
                permissions: {
                    disconnect: { id: permissionId }
                }
            }
        });
    }

    // Get user permissions
    static async getUserPermissions(userId: string): Promise<PermissionWithCounts[]> {
        const user = await db.user.findUnique({
            where: { id: userId },
            include: {
                permissions: {
                    include: {
                        _count: {
                            select: {
                                users: true,
                                roles: true
                            }
                        }
                    }
                }
            }
        });

        if (!user) {
            throw new Error('User not found');
        }

        return user.permissions as PermissionWithCounts[];
    }
}