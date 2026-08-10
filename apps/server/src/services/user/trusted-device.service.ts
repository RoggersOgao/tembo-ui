import { db } from '@repo/database';
import { logger } from '@repo/logger';
import trustedDeviceCacheService from '../../cache/user/trustedDevice.cache.service';

export interface TrustedDeviceFilters {
    verified?: boolean;
    deviceType?: string;
}

export interface GetTrustedDevicesOptions {
    page: number;
    limit: number;
    filters?: TrustedDeviceFilters;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
}

export interface TrustedDeviceWithUser {
    id: string;
    userId: string;
    deviceId: string;
    deviceName: string;
    deviceType: string | null;
    os: string | null;
    browser: string | null;
    browserVersion: string | null;
    osVersion: string | null;
    lastSeen: Date;
    firstSeen: Date;
    ipAddress: string | null;
    verified: boolean;
    trustScore: number;
    location: string | null;
    expiresAt: Date;
    revokedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: string;
        email: string | null;
        name: string | null;
    };
}

export interface CreateTrustedDeviceData {
    userId: string;
    deviceId: string;
    deviceToken: string;
    deviceName: string;
    deviceType?: string;
    os?: string;
    osVersion?: string;
    browser?: string;
    browserVersion?: string;
    ipAddress?: string;
    location?: string;
    verified?: boolean;
    trustScore?: number;
    expiresAt?: Date;
}

export class TrustedDeviceService {
    // Get trusted device by ID with user relation
    static async getTrustedDeviceById(id: string): Promise<TrustedDeviceWithUser> {
        // Try to get from cache
        const cachedDevice = await trustedDeviceCacheService.getDevice(id);
        if (cachedDevice) {
            logger.debug('Trusted device cache hit', { deviceId: id });
            return cachedDevice;
        }

        logger.debug('Trusted device cache miss, fetching from DB', { deviceId: id });

        const device = await db.trustedDevice.findUnique({
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

        if (!device) {
            throw new Error('Trusted device not found');
        }

        // Cache the device
        await trustedDeviceCacheService.setDevice(id, device);

        return device;
    }

    // Get trusted device by device ID with user relation
    static async getTrustedDeviceByDeviceId(deviceId: string, userId: string): Promise<TrustedDeviceWithUser> {
        // Try to get from cache
        const cachedDevice = await trustedDeviceCacheService.getDeviceByFingerprint(userId, deviceId);
        if (cachedDevice) {
            logger.debug('Trusted device by fingerprint cache hit', { deviceId, userId });
            return cachedDevice;
        }

        logger.debug('Trusted device by fingerprint cache miss, fetching from DB', { deviceId, userId });

        const device = await db.trustedDevice.findFirst({
            where: { 
                userId, 
                deviceId 
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

        if (!device) {
            throw new Error('Trusted device not found');
        }

        // Cache the device
        await trustedDeviceCacheService.setDeviceByFingerprint(userId, deviceId, device);

        return device;
    }

    /**
     * Get all trusted devices for a user with pagination and filters
     * Useful for device management UI
     */
    static async getUserTrustedDevices(
        userId: string,
        options?: GetTrustedDevicesOptions
    ): Promise<{
        devices: TrustedDeviceWithUser[];
        total: number;
        totalPages: number;
    }> {
        // Try to get from cache
        const cachedResult = await trustedDeviceCacheService.getUserDevices(userId, options);
        if (cachedResult) {
            logger.debug('User trusted devices cache hit', { userId, options });
            return cachedResult;
        }

        logger.debug('User trusted devices cache miss, fetching from DB', { userId, options });

        // Verify user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // If no options provided, return all devices without pagination
        if (!options) {
            const devices = await db.trustedDevice.findMany({
                where: {
                    userId,
                    revokedAt: null,
                    expiresAt: { gte: new Date() }
                },
                orderBy: {
                    lastSeen: 'desc'
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

            const result = {
                devices,
                total: devices.length,
                totalPages: 1
            };

            // Cache the result
            await trustedDeviceCacheService.setUserDevices(userId, result, options);

            return result;
        }

        const { page, limit, filters = {}, sortBy = 'lastSeen', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;

        const where: any = { 
            userId,
            revokedAt: null,
            expiresAt: { gte: new Date() }
        };

        if (filters.verified !== undefined) {
            where.verified = filters.verified;
        }

        if (filters.deviceType) {
            where.deviceType = filters.deviceType;
        }

        const [devices, total] = await Promise.all([
            db.trustedDevice.findMany({
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
            db.trustedDevice.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);
        const result = {
            devices,
            total,
            totalPages
        };

        // Cache the result
        await trustedDeviceCacheService.setUserDevices(userId, result, options);

        return result;
    }

    /**
     * Determine if device is trusted and get full device info
     * @param userId 
     * @param deviceId 
     * @returns 
     */
    static async getTrustedDeviceByFingerprint(
        userId: string,
        deviceId: string
    ): Promise<TrustedDeviceWithUser | null> {
        // Try to get from cache
        const cachedDevice = await trustedDeviceCacheService.getDeviceByFingerprint(userId, deviceId);
        if (cachedDevice) {
            logger.debug('Trusted device by fingerprint cache hit', { userId, deviceId });
            return cachedDevice;
        }

        logger.debug('Trusted device by fingerprint cache miss, fetching from DB', { userId, deviceId });

        try {
            const device = await db.trustedDevice.findFirst({
                where: {
                    userId,
                    deviceId,
                    verified: true,
                    revokedAt: null,
                    expiresAt: { gte: new Date() }
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

            if (device) {
                // Cache the device
                await trustedDeviceCacheService.setDeviceByFingerprint(userId, deviceId, device);
            }

            return device;
        } catch (error) {
            logger.error("Error getting trusted device:", { error });
            return null;
        }
    }

    // Create trusted device
    static async createTrustedDevice(data: CreateTrustedDeviceData): Promise<TrustedDeviceWithUser> {
        // Check if user exists
        console.log(data);
        const user = await db.user.findUnique({
            where: { id: data.userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Check if device ID already exists for this user
        const existingDevice = await db.trustedDevice.findFirst({
            where: { 
                userId: data.userId,
                deviceId: data.deviceId 
            }
        });

        if (existingDevice) {
            throw new Error('Device ID already exists for this user');
        }

        // Set default expiry to 90 days if not provided
        const expiresAt = data.expiresAt || new Date(Date.now() + 90 * 24 * 60 * 60 * 1000);

        const device = await db.trustedDevice.create({
            data: {
                userId: data.userId,
                deviceId: data.deviceId,
                deviceTokenHash: data.deviceToken,
                deviceName: data.deviceName,
                deviceType: data.deviceType,
                os: data.os,
                osVersion: data.osVersion,
                browser: data.browser,
                browserVersion: data.browserVersion,
                ipAddress: data.ipAddress,
                location: data.location,
                verified: data.verified ?? true,
                trustScore: data.trustScore ?? 50,
                expiresAt
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

        logger.info(`Trusted device created: ${device.id} for user ${data.userId}`);

        // Invalidate user devices cache
        await trustedDeviceCacheService.invalidateUserDevices(data.userId);

        return device;
    }

    // Update trusted device
    static async updateTrustedDevice(
        id: string,
        data: {
            deviceName?: string;
            deviceType?: string;
            os?: string;
            osVersion?: string;
            browser?: string;
            browserVersion?: string;
            verified?: boolean;
            trustScore?: number;
        }
    ): Promise<TrustedDeviceWithUser> {
        try {
            // Get the device first to know userId for cache invalidation
            const existingDevice = await db.trustedDevice.findUnique({
                where: { id },
                select: { userId: true, deviceId: true }
            });

            if (!existingDevice) {
                throw new Error('Trusted device not found');
            }

            const device = await db.trustedDevice.update({
                where: { id },
                data: {
                    deviceName: data.deviceName,
                    deviceType: data.deviceType,
                    os: data.os,
                    osVersion: data.osVersion,
                    browser: data.browser,
                    browserVersion: data.browserVersion,
                    verified: data.verified,
                    trustScore: data.trustScore,
                    updatedAt: new Date()
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

            // Invalidate device cache
            await trustedDeviceCacheService.invalidateDevice(id, existingDevice.userId, existingDevice.deviceId);

            return device;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Trusted device not found');
            }
            throw error;
        }
    }

    // Update device last used time
    static async updateDeviceLastUsed(id: string): Promise<TrustedDeviceWithUser> {
        try {
            // Get the device first to know userId for cache invalidation
            const existingDevice = await db.trustedDevice.findUnique({
                where: { id },
                select: { userId: true, deviceId: true }
            });

            if (!existingDevice) {
                throw new Error('Trusted device not found');
            }

            const device = await db.trustedDevice.update({
                where: { id },
                data: {
                    lastSeen: new Date()
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

            // Update cache but don't invalidate user devices list (just update the specific device)
            await trustedDeviceCacheService.setDevice(id, device);
            await trustedDeviceCacheService.setDeviceByFingerprint(existingDevice.userId, existingDevice.deviceId, device);

            return device;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Trusted device not found');
            }
            throw error;
        }
    }

    // Toggle device verification status
    static async toggleDeviceTrust(
        userId: string, 
        verified: boolean, 
        ipAddress: string, 
        deviceId: string
    ): Promise<TrustedDeviceWithUser> {
        try {
            const device = await db.trustedDevice.findFirst({
                where: { userId, deviceId }
            });

            if (!device) {
                throw new Error('Trusted device not found');
            }

            const updated = await db.trustedDevice.update({
                where: { id: device.id },
                data: {
                    verified,
                    lastSeen: new Date(),
                    ipAddress: ipAddress
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

            logger.info(`Device ${deviceId} verification status changed to: ${verified}`);

            // Invalidate device cache
            await trustedDeviceCacheService.invalidateDevice(device.id, userId, deviceId);

            return updated;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Trusted device not found');
            }
            throw error;
        }
    }

    // Delete trusted device
    static async deleteTrustedDevice(id: string): Promise<void> {
        try {
            // Get the device first to know userId for cache invalidation
            const existingDevice = await db.trustedDevice.findUnique({
                where: { id },
                select: { userId: true, deviceId: true }
            });

            if (!existingDevice) {
                throw new Error('Trusted device not found');
            }

            await db.trustedDevice.delete({
                where: { id }
            });

            logger.info(`Trusted device deleted: ${id}`);

            // Invalidate device cache
            await trustedDeviceCacheService.invalidateDevice(id, existingDevice.userId, existingDevice.deviceId);
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Trusted device not found');
            }
            throw error;
        }
    }

    // Check if device is trusted for user
    static async isDeviceTrusted(userId: string, deviceId: string): Promise<boolean> {
        // Try to get from cache first
        const cachedDevice = await trustedDeviceCacheService.getDeviceByFingerprint(userId, deviceId);
        
        if (cachedDevice && cachedDevice.verified) {
            // Update last used asynchronously (don't await)
            this.updateDeviceLastUsed(cachedDevice.id).catch(error => {
                logger.error('Failed to update device last used', { error });
            });
            return true;
        }

        const device = await db.trustedDevice.findFirst({
            where: {
                userId,
                deviceId,
                verified: true,
                revokedAt: null,
                expiresAt: { gte: new Date() }
            }
        });

        if (!device) {
            return false;
        }

        // Update last used time when checking (don't await)
        this.updateDeviceLastUsed(device.id).catch(error => {
            logger.error('Failed to update device last used', { error });
        });

        return true;
    }

    // Register or update device as trusted
    static async registerDevice(
        userId: string,
        deviceId: string,
        data: {
            deviceToken: string;
            deviceName: string;
            deviceType?: string;
            os?: string;
            osVersion?: string;
            browser?: string;
            browserVersion?: string;
            ipAddress?: string;
            location?: string;
        }
    ): Promise<TrustedDeviceWithUser> {
        // Check if device already exists for user
        const existingDevice = await db.trustedDevice.findFirst({
            where: {
                userId,
                deviceId
            }
        });

        let result: TrustedDeviceWithUser;

        if (existingDevice) {
            // Update existing device
            result = await this.updateTrustedDevice(existingDevice.id, {
                deviceName: data.deviceName,
                deviceType: data.deviceType,
                os: data.os,
                osVersion: data.osVersion,
                browser: data.browser,
                browserVersion: data.browserVersion
            });
        } else {
            // Create new trusted device
            result = await this.createTrustedDevice({
                userId,
                deviceId,
                deviceToken: data.deviceToken,
                deviceName: data.deviceName,
                deviceType: data.deviceType,
                os: data.os,
                osVersion: data.osVersion,
                browser: data.browser,
                browserVersion: data.browserVersion,
                ipAddress: data.ipAddress,
                location: data.location,
                verified: true
            });
        }

        // Invalidate user devices cache
        await trustedDeviceCacheService.invalidateUserDevices(userId);

        return result;
    }

    // Clean old unused trusted devices
    static async cleanOldTrustedDevices(daysThreshold: number = 90): Promise<number> {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - daysThreshold);

        // Get affected users before deletion for cache invalidation
        const devicesToDelete = await db.trustedDevice.findMany({
            where: {
                lastSeen: {
                    lt: cutoffDate
                }
            },
            select: { userId: true }
        });

        const affectedUserIds = [...new Set(devicesToDelete.map(d => d.userId))];

        const result = await db.trustedDevice.deleteMany({
            where: {
                lastSeen: {
                    lt: cutoffDate
                }
            }
        });

        logger.info(`Cleaned ${result.count} old devices (unused for ${daysThreshold} days)`);

        // Invalidate caches for affected users
        for (const userId of affectedUserIds) {
            await trustedDeviceCacheService.invalidateUserDevices(userId);
        }

        return result.count;
    }

    // Get device statistics
    static async getDeviceStatistics(userId: string): Promise<{
        totalDevices: number;
        trustedDevices: number;
        untrustedDevices: number;
        recentlyUsed: number;
        byDeviceType: Record<string, number>;
    }> {
        // Try to get from cache
        const cachedStats = await trustedDeviceCacheService.getDeviceStats(userId);
        if (cachedStats) {
            logger.debug('Device statistics cache hit', { userId });
            return cachedStats;
        }

        logger.debug('Device statistics cache miss, fetching from DB', { userId });

        const devices = await db.trustedDevice.findMany({
            where: { 
                userId,
                revokedAt: null 
            },
            select: {
                verified: true,
                deviceType: true,
                lastSeen: true
            }
        });

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const deviceTypeCount: Record<string, number> = {};
        devices.forEach(device => {
            const type = device.deviceType || 'Unknown';
            deviceTypeCount[type] = (deviceTypeCount[type] || 0) + 1;
        });

        const stats = {
            totalDevices: devices.length,
            trustedDevices: devices.filter(d => d.verified).length,
            untrustedDevices: devices.filter(d => !d.verified).length,
            recentlyUsed: devices.filter(d => d.lastSeen > sevenDaysAgo).length,
            byDeviceType: deviceTypeCount
        };

        // Cache the stats
        await trustedDeviceCacheService.setDeviceStats(userId, stats);

        return stats;
    }

    /**
     * Revoke a trusted device
     * Useful when user wants to remove a device from trusted list
     */
    static async revokeDevice(
        deviceId: string,
        userId: string,
        reason?: string
    ): Promise<boolean> {
        try {
            const result = await db.trustedDevice.updateMany({
                where: {
                    deviceId,
                    userId,
                    revokedAt: null
                },
                data: {
                    revokedAt: new Date()
                }
            });

            if (result.count > 0) {
                logger.info("Device revoked", {
                    deviceId: deviceId.substring(0, 8) + "...",
                    userId,
                    reason: reason || 'User request'
                });

                // Create audit log
                await db.auditLog.create({
                    data: {
                        userId,
                        action: 'DEVICE_REVOKED',
                        entityType: 'TRUSTED_DEVICE',
                        entityId: deviceId,
                        changes: {
                            deviceId,
                            reason: reason || 'User request',
                            revokedAt: new Date()
                        } as any,
                        metadata: {
                            automated: !reason
                        } as any
                    }
                });

                // Invalidate user devices cache
                await trustedDeviceCacheService.invalidateUserDevices(userId);

                return true;
            }

            return false;

        } catch (error) {
            logger.error("Failed to revoke device:", {error});
            return false;
        }
    }

    /**
     * Clean up expired devices (run this periodically, e.g., daily cron job)
     */
    static async cleanupExpiredDevices(): Promise<number> {
        try {
            // Get affected users before deletion for cache invalidation
            const devicesToDelete = await db.trustedDevice.findMany({
                where: {
                    OR: [
                        { expiresAt: { lt: new Date() } },
                        {
                            revokedAt: {
                                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                            }
                        }
                    ]
                },
                select: { userId: true }
            });

            const affectedUserIds = [...new Set(devicesToDelete.map(d => d.userId))];

            const result = await db.trustedDevice.deleteMany({
                where: {
                    OR: [
                        { expiresAt: { lt: new Date() } },
                        {
                            revokedAt: {
                                lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                            }
                        }
                    ]
                }
            });

            logger.info("Cleaned up expired devices", {
                count: result.count
            });

            // Invalidate caches for affected users
            for (const userId of affectedUserIds) {
                await trustedDeviceCacheService.invalidateUserDevices(userId);
            }

            return result.count;

        } catch (error) {
            logger.error("Failed to cleanup devices:", {error});
            return 0;
        }
    }

    /**
     * Refresh device token (extend expiry by 90 days)
     * Call this on successful login to keep active devices valid
     */
    static async refreshDeviceToken(
        deviceId: string,
        userId: string
    ): Promise<void> {
        try {
            const newExpiresAt = new Date();
            newExpiresAt.setDate(newExpiresAt.getDate() + 90);

            await db.trustedDevice.updateMany({
                where: {
                    deviceId,
                    userId,
                    revokedAt: null
                },
                data: {
                    expiresAt: newExpiresAt,
                    lastSeen: new Date()
                }
            });

            logger.info("Device token refreshed", {
                deviceId: deviceId.substring(0, 8) + "...",
                newExpiresAt
            });

            // Invalidate user devices cache
            await trustedDeviceCacheService.invalidateUserDevices(userId);

        } catch (error) {
            logger.error("Failed to refresh device token:", {error});
        }
    }

    /**
     * Check if device needs re-verification
     * Returns true if device trust score is too low or hasn't been used recently
     */
    static async deviceNeedsReverification(
        deviceId: string,
        userId: string
    ): Promise<boolean> {
        try {
            const device = await db.trustedDevice.findFirst({
                where: {
                    deviceId,
                    userId,
                    revokedAt: null
                }
            });

            if (!device) return true;

            // Check trust score
            if (device.trustScore < 30) {
                logger.warn("Device has low trust score", {
                    deviceId: deviceId.substring(0, 8) + "...",
                    trustScore: device.trustScore
                });
                return true;
            }

            // Check if not used in last 60 days
            const daysSinceLastSeen = Math.ceil(
                (Date.now() - device.lastSeen.getTime()) / (1000 * 60 * 60 * 24)
            );

            if (daysSinceLastSeen > 60) {
                logger.warn("Device hasn't been used recently", {
                    deviceId: deviceId.substring(0, 8) + "...",
                    daysSinceLastSeen
                });
                return true;
            }

            return false;

        } catch (error) {
            logger.error("Failed to check device verification status:", {error});
            return true;
        }
    }

    /**
     * Update device trust score based on behavior
     * Call this when detecting suspicious activity
     */
    static async updateDeviceTrustScore(
        deviceId: string,
        userId: string,
        adjustment: number,
        reason: string
    ): Promise<void> {
        try {
            const device = await db.trustedDevice.findFirst({
                where: { deviceId, userId, revokedAt: null }
            });

            if (!device) return;

            const newScore = Math.max(0, Math.min(100, device.trustScore + adjustment));

            await db.trustedDevice.update({
                where: { id: device.id },
                data: { trustScore: newScore }
            });

            logger.info("Device trust score updated", {
                deviceId: deviceId.substring(0, 8) + "...",
                oldScore: device.trustScore,
                newScore,
                adjustment,
                reason
            });

            // Update cache
            await trustedDeviceCacheService.invalidateDevice(device.id, userId, deviceId);

            // If trust score drops too low, consider revoking
            if (newScore < 20) {
                logger.warn("Device trust score critical - consider revoking", {
                    deviceId: deviceId.substring(0, 8) + "...",
                    trustScore: newScore
                });

                // Optionally auto-revoke
                await this.revokeDevice(deviceId, userId, `Low trust score: ${newScore}`);
            }

        } catch (error) {
            logger.error("Failed to update device trust score:", {error});
        }
    }

    /**
     * Verify device by token hash - NEW METHOD
     * This combines finding the device and updating last used in one call
     */
    static async verifyDeviceByToken(
        userId: string,
        deviceId: string,
    ): Promise<TrustedDeviceWithUser | null> {

        logger.warn("data", {
            userId,
            deviceId: deviceId,
        });
        
        try {
            // Find device with token hash
            const device = await db.trustedDevice.findFirst({
                where: {
                    userId,
                    deviceId,
                    revokedAt: null,
                    expiresAt: { gt: new Date() }
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

            if (!device) {
                return null;
            }

            // Update last seen and increment trust score
            const updatedDevice = await db.trustedDevice.update({
                where: { id: device.id },
                data: {
                    lastSeen: new Date(),
                    trustScore: { increment: 5 }
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

            logger.info("Device verified successfully", {
                deviceId: deviceId.substring(0, 8) + "...",
                userId,
                newTrustScore: updatedDevice.trustScore
            });

            // Update cache
            await trustedDeviceCacheService.invalidateDevice(device.id, userId, deviceId);

            return updatedDevice;
        } catch (error) {
            logger.error("Error verifying device token:", { error });
            return null;
        }
    }

    /**
     * Multipurpose update device method - SIMPLIFIED
     */
    static async updateDevice(
        id: string,
        data: {
            deviceName?: string;
            deviceType?: string;
            os?: string;
            osVersion?: string;
            browser?: string;
            browserVersion?: string;
            verified?: boolean;
            trustScore?: number;
            updateLastSeen?: boolean;
            trustScoreIncrement?: number;
        }
    ): Promise<TrustedDeviceWithUser> {
        try {
            // Get the device first to know userId for cache invalidation
            const existingDevice = await db.trustedDevice.findUnique({
                where: { id },
                select: { userId: true, deviceId: true }
            });

            if (!existingDevice) {
                throw new Error('Trusted device not found');
            }

            const { updateLastSeen, trustScoreIncrement, ...updateData } = data;

            // Build update object dynamically
            const updateObject: any = {
                ...updateData,
                updatedAt: new Date()
            };

            // Update lastSeen if requested
            if (updateLastSeen) {
                updateObject.lastSeen = new Date();
            }

            // Increment trust score if requested
            if (trustScoreIncrement !== undefined) {
                updateObject.trustScore = { increment: trustScoreIncrement };
            }

            const device = await db.trustedDevice.update({
                where: { id },
                data: updateObject,
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

            logger.info("Device updated", {
                deviceId: id,
                updates: Object.keys(updateData)
            });

            // Invalidate device cache
            await trustedDeviceCacheService.invalidateDevice(id, existingDevice.userId, existingDevice.deviceId);

            return device;
        } catch (error: any) {
            if (error.code === 'P2025') {
                throw new Error('Trusted device not found');
            }
            throw error;
        }
    }

    /**
     * Find device with specific criteria (for your exact use case)
     * This is what you need for the login verification flow
     */
    static async findDeviceWithToken(
        userId: string,
        deviceId: string,
        deviceTokenHash: string
    ): Promise<TrustedDeviceWithUser | null> {
        // Try to get from cache
        const cachedDevice = await trustedDeviceCacheService.getDeviceByFingerprint(userId, deviceId);
        
        if (cachedDevice && cachedDevice.deviceTokenHash === deviceTokenHash) {
            logger.debug('Device with token cache hit', { userId, deviceId });
            return cachedDevice;
        }

        logger.debug('Device with token cache miss, fetching from DB', { userId, deviceId });

        try {
            const device = await db.trustedDevice.findFirst({
                where: {
                    userId,
                    deviceId,
                    deviceTokenHash,
                    revokedAt: null,
                    expiresAt: { gt: new Date() }
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

            if (device) {
                // Cache the device
                await trustedDeviceCacheService.setDeviceByFingerprint(userId, deviceId, device);
            }

            return device;
        } catch (error) {
            logger.error("Error finding device with token:", { error });
            return null;
        }
    }

    /**
     * Get cache statistics for trusted devices
     */
    static async getCacheStats() {
        return trustedDeviceCacheService.getStats();
    }

    /**
     * Clear all trusted device cache
     */
    static async clearCache(): Promise<void> {
        await trustedDeviceCacheService.clearAll();
    }

    /**
     * Clear cache for a specific user's devices
     */
    static async clearUserDeviceCache(userId: string): Promise<void> {
        await trustedDeviceCacheService.invalidateUserDevices(userId);
    }

    /**
     * Check if cache service is healthy
     */
    static async healthCheck(): Promise<{
        cacheService: { 
            healthy: boolean; 
            mode: string; 
            memorySize?: number;
            error?: string;
        };
        database: boolean;
        overall: boolean;
    }> {
        try {
            const health = await trustedDeviceCacheService.healthCheck();
            
            // Check database connectivity
            let databaseHealthy = false;
            try {
                await db.$queryRaw`SELECT 1`;
                databaseHealthy = true;
            } catch (error) {
                logger.error('Database health check failed', { error });
            }
            
            return {
                cacheService: health,
                database: databaseHealthy,
                overall: health.healthy && databaseHealthy,
            };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            return {
                cacheService: { 
                    healthy: false, 
                    mode: 'unknown',
                    error: errorMessage 
                },
                database: false,
                overall: false,
            };
        }
    }
}