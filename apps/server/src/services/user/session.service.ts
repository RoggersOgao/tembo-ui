import { db } from "@repo/database";
import {logger} from "@repo/logger";

export interface SessionFilters {
    isActive?: boolean;
    deviceType?: string;
}

export interface GetSessionsOptions {
    page: number;
    limit: number;
    filters?: SessionFilters;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface SessionWithUser {
    id: string;
    userId: string;
    sessionToken: string;
    expires: Date;
    ipAddress: string | null;
    userAgent: string | null;
    deviceInfo: any;
    isActive: boolean;
    lastUsedAt: Date;
    createdAt: Date;
    user: {
        id: string;
        email: string | null;
        name: string | null;
    };
}

export interface CreateSessionData {
    userId: string;
    sessionToken: string;
    expires: Date;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: any;
    isVerified?:boolean;
}

export class SessionService {
    // Get session by ID with user relation
    static async getSessionById(id: string): Promise<SessionWithUser> {
        const session = await db.session.findUnique({
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

        if (!session) {
            throw new Error('Session not found');
        }

        return session;
    }

    // Get session by token with user relation
    static async getSessionByToken(token: string): Promise<SessionWithUser> {
        const session = await db.session.findUnique({
            where: { sessionToken: token },
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

        if (!session) {
            throw new Error('Session not found');
        }

        return session;
    }

    // Get user sessions with pagination and filters
    static async getUserSessions(
        userId: string,
        options: GetSessionsOptions
    ): Promise<{
        sessions: SessionWithUser[];
        total: number;
        totalPages: number;
    }> {
        // Verify user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const { page, limit, filters = {}, sortBy = 'lastUsedAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;

        const where: any = { userId };

        if (filters.isActive !== undefined) {
            where.isActive = filters.isActive;
        }

        if (filters.deviceType) {
            where.deviceInfo = {
                path: ['deviceType'],
                equals: filters.deviceType
            };
        }

        // Also filter out expired sessions from active ones
        if (filters.isActive === true) {
            where.expires = {
                gt: new Date()
            };
        }

        const [sessions, total] = await Promise.all([
            db.session.findMany({
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
                    [sortBy]: sortOrder
                },
                skip,
                take: limit
            }),
            db.session.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        return {
            sessions,
            total,
            totalPages
        };
    }

    // Create session
    static async createSession(data: CreateSessionData): Promise<SessionWithUser> {
        // Check if user exists
        const user = await db.user.findUnique({
            where: { id: data.userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check if session token already exists
        const existingSession = await db.session.findUnique({
            where: { sessionToken: data.sessionToken }
        });

        if (existingSession) {
            throw new Error('Session token already exists');
        }

        const session = await db.session.create({
            data: {
                userId: data.userId,
                sessionToken: data.sessionToken,
                expires: data.expires,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                deviceInfo: data.deviceInfo,
                isActive: data.isVerified
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

        logger.info(`Session created: ${session.id} for user ${data.userId}`);

        return session;
    }

    // Update session
    static async updateSession(
        id: string,
        data: {
            isActive?: boolean;
            deviceInfo?: any;
            lastUsedAt?: Date;
        }
    ): Promise<SessionWithUser> {
        try {
            const session = await db.session.update({
                where: { id },
                data: {
                    isActive: data.isActive,
                    deviceInfo: data.deviceInfo,
                    lastUsedAt: data.lastUsedAt || new Date()
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

            return session;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Session not found');
            }
            throw error;
        }
    }

    // Refresh session (update lastUsedAt)
    static async refreshSession(id: string): Promise<SessionWithUser> {
        const session = await db.session.findUnique({
            where: { id }
        });

        if (!session) {
            throw new Error('Session not found');
        }

        if (!session.isActive) {
            throw new Error('Session is not active');
        }

        if (session.expires < new Date()) {
            throw new Error('Session has expired');
        }

        const updatedSession = await db.session.update({
            where: { id },
            data: {
                lastUsedAt: new Date()
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

        return updatedSession;
    }

    // Deactivate session
    static async deactivateSession(id: string): Promise<SessionWithUser> {
        try {
            const session = await db.session.update({
                where: { id },
                data: {
                    isActive: false,
                    lastUsedAt: new Date()
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

            logger.info(`Session deactivated: ${id} for user ${session.userId}`);

            return session;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Session not found');
            }
            throw error;
        }
    }

    // Delete session
    static async deleteSession(id: string): Promise<void> {
        try {
            await db.session.delete({
                where: { id }
            });

            logger.info(`Session deleted: ${id}`);
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Session not found');
            }
            throw error;
        }
    }

    // Deactivate all user sessions
    static async deactivateAllUserSessions(userId: string): Promise<number> {
        // Verify user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        const result = await db.session.updateMany({
            where: {
                userId,
                isActive: true
            },
            data: {
                isActive: false,
                lastUsedAt: new Date()
            }
        });

        logger.info(`Deactivated all sessions for user: ${userId}, count: ${result.count}`);

        return result.count;
    }

    // Deactivate all other sessions except current one
    static async deactivateAllOtherSessions(userId: string, currentSessionId: string): Promise<number> {
        const result = await db.session.updateMany({
            where: {
                userId,
                isActive: true,
                id: { not: currentSessionId }
            },
            data: {
                isActive: false,
                lastUsedAt: new Date()
            }
        });

        logger.info(`Deactivated other sessions for user: ${userId}, count: ${result.count}`);

        return result.count;
    }

    // Clean expired sessions
    static async cleanExpiredSessions(): Promise<number> {
        const result = await db.session.deleteMany({
            where: {
                expires: {
                    lt: new Date()
                }
            }
        });

        logger.info(`Cleaned ${result.count} expired sessions`);

        return result.count;
    }

    // Validate session
    static async validateSession(token: string): Promise<{
        isValid: boolean;
        session?: SessionWithUser;
        reason?: string;
    }> {
        try {
            const session = await this.getSessionByToken(token);

            if (!session.isActive) {
                return {
                    isValid: false,
                    reason: 'Session is not active'
                };
            }

            if (session.expires < new Date()) {
                return {
                    isValid: false,
                    reason: 'Session has expired'
                };
            }

            // Update last used timestamp
            await this.refreshSession(session.id);

            return {
                isValid: true,
                session
            };
        } catch (error: any) {
            return {
                isValid: false,
                reason: error.message
            };
        }
    }

    // Get session statistics
    static async getSessionStatistics(userId: string): Promise<{
        totalSessions: number;
        activeSessions: number;
        expiredSessions: number;
        recentlyUsed: number;
    }> {
        const sessions = await db.session.findMany({
            where: { userId },
            select: {
                isActive: true,
                expires: true,
                lastUsedAt: true
            }
        });

        const now = new Date();
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        return {
            totalSessions: sessions.length,
            activeSessions: sessions.filter(s => s.isActive && s.expires > now).length,
            expiredSessions: sessions.filter(s => s.expires < now).length,
            recentlyUsed: sessions.filter(s => s.lastUsedAt > sevenDaysAgo).length
        };
    }
}