// src/modules/audit-log/audit-log.service.ts

import { db } from "@repo/database";
import { logger } from "@repo/logger";

export interface AuditLogFilters {
    userId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    startDate?: Date;
    endDate?: Date;
}

export interface GetAuditLogsOptions {
    page: number;
    limit: number;
    filters?: AuditLogFilters;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface AuditLogWithUser {
    id: string;
    userId: string | null;
    action: string;
    entityType: string;
    entityId: string | null;
    changes: any;
    ipAddress: string | null;
    userAgent: string | null;
    metadata: any;
    createdAt: Date;
    user: {
        id: string;
        email: string | null;
        name: string | null;
    } | null;
}

export class AuditLogService {
    // Get audit log by ID with user relation
    static async getAuditLogById(id: string): Promise<AuditLogWithUser> {
        const auditLog = await db.auditLog.findUnique({
            where: { id },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true,
                        name: true
                    }
                }
            }
        });

        if (!auditLog) {
            throw new Error('Audit log not found');
        }

        return auditLog;
    }

    // Get audit logs with pagination and filters
    static async getAuditLogs(options: GetAuditLogsOptions): Promise<{
        auditLogs: AuditLogWithUser[];
        total: number;
        totalPages: number;
    }> {
        const { page, limit, filters = {}, sortBy = 'createdAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;

        const where: any = {};

        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.action) {
            where.action = {
                contains: filters.action,
                mode: 'insensitive'
            };
        }

        if (filters.entityType) {
            where.entityType = {
                contains: filters.entityType,
                mode: 'insensitive'
            };
        }

        if (filters.entityId) {
            where.entityId = filters.entityId;
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }

        // Validate sortBy field
        const allowedSortFields = ['createdAt', 'action', 'entityType', 'userId'];
        const validSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt';

        const [auditLogs, total] = await Promise.all([
            db.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    [validSortBy]: sortOrder
                },
                skip,
                take: limit
            }),
            db.auditLog.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            auditLogs,
            total,
            totalPages
        };
    }

    // Create audit log
    static async createAuditLog(data: {
        userId?: string | null;
        action: string;
        entityType: string;
        entityId?: string | null;
        changes?: any;
        ipAddress?: string | null;
        userAgent?: string | null;
        metadata?: any;
    }): Promise<AuditLogWithUser> {
        try {
            const auditLog = await db.auditLog.create({
                data: {
                    userId: data.userId || null,
                    action: data.action,
                    entityType: data.entityType,
                    entityId: data.entityId || null,
                    changes: data.changes || null,
                    ipAddress: data.ipAddress || null,
                    userAgent: data.userAgent || null,
                    metadata: data.metadata || null
                },
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true
                        }
                    }
                }
            });

            logger.info(`Audit log created: ${auditLog.id} - ${auditLog.action}`, {
                userId: auditLog.userId as string,
                entityType: auditLog.entityType,
                entityId: auditLog.entityId
            });

            return auditLog;
        } catch (error) {
            logger.error('Failed to create audit log', { error, data });
            throw new Error('Failed to create audit log');
        }
    }

    // Batch create audit logs (for performance)
    static async createAuditLogsBatch(
        logs: Array<{
            userId?: string | null;
            action: string;
            entityType: string;
            entityId?: string | null;
            changes?: any;
            ipAddress?: string | null;
            userAgent?: string | null;
            metadata?: any;
        }>
    ): Promise<{ count: number }> {
        try {
            const result = await db.auditLog.createMany({
                data: logs.map(log => ({
                    userId: log.userId || null,
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId || null,
                    changes: log.changes || null,
                    ipAddress: log.ipAddress || null,
                    userAgent: log.userAgent || null,
                    metadata: log.metadata || null
                }))
            });

            logger.info(`Created ${result.count} audit logs in batch`);
            
            return { count: result.count };
        } catch (error) {
            logger.error('Failed to create audit logs batch', { error, count: logs.length });
            throw new Error('Failed to create audit logs batch');
        }
    }

    // Get user's audit logs
    static async getUserAuditLogs(
        userId: string,
        options: {
            page: number;
            limit: number;
            filters?: {
                action?: string;
                entityType?: string;
                startDate?: Date;
                endDate?: Date;
            };
        }
    ): Promise<{
        auditLogs: AuditLogWithUser[];
        total: number;
        totalPages: number;
    }> {
        // Verify user exists
        const user = await db.user.findUnique({
            where: { id: userId },
            select: { id: true }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const { page, limit, filters = {} } = options;
        const skip = (page - 1) * limit;

        const where: any = { userId };

        if (filters.action) {
            where.action = {
                contains: filters.action,
                mode: 'insensitive'
            };
        }

        if (filters.entityType) {
            where.entityType = {
                contains: filters.entityType,
                mode: 'insensitive'
            };
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }

        const [auditLogs, total] = await Promise.all([
            db.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit
            }),
            db.auditLog.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            auditLogs,
            total,
            totalPages
        };
    }

    // Get audit logs for specific entity
    static async getEntityAuditLogs(
        entityType: string,
        entityId: string,
        page: number = 1,
        limit: number = 20
    ): Promise<{
        auditLogs: AuditLogWithUser[];
        total: number;
        totalPages: number;
    }> {
        const skip = (page - 1) * limit;

        const where = {
            entityType,
            entityId
        };

        const [auditLogs, total] = await Promise.all([
            db.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit
            }),
            db.auditLog.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            auditLogs,
            total,
            totalPages
        };
    }

    // Get audit log statistics
    static async getAuditLogStats(filters?: {
        userId?: string;
        startDate?: Date;
        endDate?: Date;
    }): Promise<{
        totalLogs: number;
        uniqueUsers: number;
        actionBreakdown: Array<{ action: string; count: number }>;
        entityTypeBreakdown: Array<{ entityType: string; count: number }>;
    }> {
        const where: any = {};

        if (filters?.userId) {
            where.userId = filters.userId;
        }

        if (filters?.startDate || filters?.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }

        const [totalLogs, actionBreakdown, entityTypeBreakdown, uniqueUserIds] = await Promise.all([
            db.auditLog.count({ where }),
            db.auditLog.groupBy({
                by: ['action'],
                where,
                _count: {
                    action: true
                },
                orderBy: {
                    _count: {
                        action: 'desc'
                    }
                },
                take: 10
            }),
            db.auditLog.groupBy({
                by: ['entityType'],
                where,
                _count: {
                    entityType: true
                },
                orderBy: {
                    _count: {
                        entityType: 'desc'
                    }
                },
                take: 10
            }),
            db.auditLog.findMany({
                where: {
                    ...where,
                    userId: { not: null }
                },
                select: {
                    userId: true
                },
                distinct: ['userId']
            })
        ]);

        return {
            totalLogs,
            uniqueUsers: uniqueUserIds.length,
            actionBreakdown: actionBreakdown.map(item => ({
                action: item.action,
                count: item._count.action
            })),
            entityTypeBreakdown: entityTypeBreakdown.map(item => ({
                entityType: item.entityType,
                count: item._count.entityType
            }))
        };
    }

    // Search audit logs (advanced search)
    static async searchAuditLogs(
        searchTerm: string,
        options: {
            page: number;
            limit: number;
            filters?: AuditLogFilters;
        }
    ): Promise<{
        auditLogs: AuditLogWithUser[];
        total: number;
        totalPages: number;
    }> {
        const { page, limit, filters = {} } = options;
        const skip = (page - 1) * limit;

        const where: any = {
            OR: [
                { action: { contains: searchTerm, mode: 'insensitive' } },
                { entityType: { contains: searchTerm, mode: 'insensitive' } },
                { entityId: { contains: searchTerm, mode: 'insensitive' } }
            ]
        };

        // Apply additional filters
        if (filters.userId) {
            where.userId = filters.userId;
        }

        if (filters.startDate || filters.endDate) {
            where.createdAt = {};
            if (filters.startDate) {
                where.createdAt.gte = filters.startDate;
            }
            if (filters.endDate) {
                where.createdAt.lte = filters.endDate;
            }
        }

        const [auditLogs, total] = await Promise.all([
            db.auditLog.findMany({
                where,
                include: {
                    user: {
                        select: {
                            id: true,
                            email: true,
                            name: true
                        }
                    }
                },
                orderBy: {
                    createdAt: 'desc'
                },
                skip,
                take: limit
            }),
            db.auditLog.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            auditLogs,
            total,
            totalPages
        };
    }

    // Clean old audit logs (for maintenance)
    static async cleanOldAuditLogs(daysToKeep: number = 90): Promise<{ deletedCount: number }> {
        if (daysToKeep < 1) {
            throw new Error('Days to keep must be at least 1');
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        try {
            const result = await db.auditLog.deleteMany({
                where: {
                    createdAt: {
                        lt: cutoffDate
                    }
                }
            });

            logger.info(`Cleaned ${result.count} audit logs older than ${daysToKeep} days`, {
                cutoffDate: cutoffDate.toISOString(),
                deletedCount: result.count
            });

            return { deletedCount: result.count };
        } catch (error) {
            logger.error('Failed to clean old audit logs', { error, daysToKeep });
            throw new Error('Failed to clean old audit logs');
        }
    }

    // Archive old audit logs (alternative to deletion)
    static async archiveOldAuditLogs(
        daysToKeep: number = 90,
        archiveCallback: (logs: AuditLogWithUser[]) => Promise<void>
    ): Promise<{ archivedCount: number }> {
        if (daysToKeep < 1) {
            throw new Error('Days to keep must be at least 1');
        }

        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

        const batchSize = 1000;
        let totalArchived = 0;

        try {
            while (true) {
                const logsToArchive = await db.auditLog.findMany({
                    where: {
                        createdAt: {
                            lt: cutoffDate
                        }
                    },
                    include: {
                        user: {
                            select: {
                                id: true,
                                email: true,
                                name: true
                            }
                        }
                    },
                    take: batchSize,
                    orderBy: {
                        createdAt: 'asc'
                    }
                });

                if (logsToArchive.length === 0) {
                    break;
                }

                // Call the archive callback (could save to S3, external DB, etc.)
                await archiveCallback(logsToArchive);

                // Delete the archived logs
                await db.auditLog.deleteMany({
                    where: {
                        id: {
                            in: logsToArchive.map(log => log.id)
                        }
                    }
                });

                totalArchived += logsToArchive.length;

                logger.info(`Archived batch of ${logsToArchive.length} audit logs`);

                // Prevent overwhelming the database
                if (logsToArchive.length < batchSize) {
                    break;
                }
            }

            logger.info(`Archived ${totalArchived} audit logs older than ${daysToKeep} days`);

            return { archivedCount: totalArchived };
        } catch (error) {
            logger.error('Failed to archive old audit logs', { error, totalArchived });
            throw new Error(`Failed to archive old audit logs. Archived ${totalArchived} before error.`);
        }
    }
}