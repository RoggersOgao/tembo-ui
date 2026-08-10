// src/services/device/device.service.ts

import { db } from '@repo/database';
import { logger } from '@repo/logger';
import { createHash, randomBytes } from 'crypto';
import { emailService } from '../email.service';

/**
 * Device Metadata Interface
 */
export interface DeviceMetadata {
    deviceName: string;
    browser: string;
    browserVersion?: string;
    os: string;
    osVersion?: string;
    deviceType?: string;
    screenResolution?: string;
    timezone: string;
    language: string;
    fingerprintHash?: string;
}

/**
 * Device Verification Challenge
 */
export interface DeviceChallenge {
    challengeId: string;
    deviceId: string;
    code: string;
    method: 'email' | 'sms';
    expiresAt: Date;
}

/**
 * Trusted Device (stored in MFADevice with type='DEVICE')
 */
export interface TrustedDevice {
    id: string;
    userId: string;
    deviceId: string;
    deviceToken: string;
    deviceTokenHash: string;
    deviceName: string;
    browser?: string;
    browserVersion?: string;
    os?: string;
    osVersion?: string;
    deviceType?: string;
    location?: string;
    ipAddress?: string;
    trustScore: number;
    verified: boolean;
    firstSeen: Date;
    lastSeen: Date;
    expiresAt: Date;
    revokedAt?: Date;
}

export class DeviceService {
    private static readonly TOKEN_EXPIRY_DAYS = 90;
    private static readonly CODE_EXPIRY_MINUTES = 10;
    private static readonly MAX_VERIFICATION_ATTEMPTS = 3;
    private static readonly CODE_LENGTH = 6;

    /**
     * Register a new device and create verification challenge
     */
    static async registerDevice(
        userId: string,
        metadata: DeviceMetadata,
        ipAddress: string
    ): Promise<{
        deviceId: string;
        challenge: DeviceChallenge;
    }> {
        // Verify user exists
        const user = await db.user.findUnique({
            where: { id: userId }
        });

        if (!user) {
            throw new Error('User not found');
        }

        // Generate unique device ID (server-side)
        const deviceId = this.generateDeviceId();

        // Generate verification challenge
        const challengeId = this.generateChallengeId();
        const code = this.generateVerificationCode();

        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES);

        // Store challenge in database
        await db.deviceVerificationChallenge.create({
            data: {
                userId,
                deviceId,
                challengeId,
                code,
                method: 'email', // Default to email, can be configurable
                attempts: 0,
                maxAttempts: this.MAX_VERIFICATION_ATTEMPTS,
                expiresAt,
            }
        });

        // Store unverified device metadata in MFADevice
        // Using type='DEVICE' to differentiate from TOTP/SMS/EMAIL
        await db.mFADevice.create({
            data: {
                userId,
                name: metadata.deviceName,
                type: 'EMAIL', // We'll use EMAIL type for now, or add 'DEVICE' to enum
                secret: JSON.stringify({
                    deviceId,
                    metadata: {
                        browser: metadata.browser,
                        browserVersion: metadata.browserVersion,
                        os: metadata.os,
                        osVersion: metadata.osVersion,
                        deviceType: metadata.deviceType,
                        timezone: metadata.timezone,
                        language: metadata.language,
                        ipAddress,
                    },
                    trustScore: 50,
                    firstSeen: new Date(),
                    lastSeen: new Date(),
                }), // Store device metadata as JSON
                credentialId: deviceId, // Use deviceId as credentialId for lookups
                isVerified: false,
                isPrimary: false,
            }
        });

        const deviceFingerprint = user.deviceFingerprint as any;
        const networkMetadata = user.networkMetadata as any;

        await emailService.sendDeviceVerification(
            user.email as string,
            code,
            user.name as string,
            {
                deviceName: deviceFingerprint?.os?.name || 'Unknown Device',
                browser: deviceFingerprint?.browser?.name,
                browserVersion: deviceFingerprint?.browser?.version,
                os: deviceFingerprint?.os?.name,
                location: `${networkMetadata?.city || ''}, ${networkMetadata?.country || ''}`.replace(/^, |, $/g, '').trim(),
                ipAddress: networkMetadata?.ipAddress
            }
        );

        logger.info(`Device registration initiated for user ${userId}`, {
            deviceId,
            deviceName: metadata.deviceName
        });

        return {
            deviceId,
            challenge: {
                challengeId,
                deviceId,
                code, // Don't send in production, just for testing
                method: 'email',
                expiresAt,
            }
        };
    }

    /**
     * Verify device with challenge code
     */
    static async verifyDevice(
        userId: string,
        challengeId: string,
        code: string
    ): Promise<{
        deviceId: string;
        deviceToken: string;
        deviceName: string;
        expiresAt: Date;
    }> {
        // Get challenge
        const challenge = await db.deviceVerificationChallenge.findFirst({
            where: {
                userId,
                challengeId,
            }
        });

        if (!challenge) {
            throw new Error('Challenge not found or expired');
        }

        // Check expiry
        if (challenge.expiresAt < new Date()) {
            await db.deviceVerificationChallenge.delete({
                where: { id: challenge.id }
            });
            throw new Error('Verification code expired');
        }

        // Check max attempts
        if (challenge.attempts >= challenge.maxAttempts) {
            await db.deviceVerificationChallenge.delete({
                where: { id: challenge.id }
            });
            throw new Error('Maximum verification attempts exceeded');
        }

        // Verify code
        if (challenge.code !== code) {
            // Increment attempts
            await db.deviceVerificationChallenge.update({
                where: { id: challenge.id },
                data: { attempts: challenge.attempts + 1 }
            });
            throw new Error('Invalid verification code');
        }

        // Generate device token
        const deviceToken = this.generateDeviceToken();
        const deviceTokenHash = this.hashToken(deviceToken);

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + this.TOKEN_EXPIRY_DAYS);

        // Update MFADevice to mark as verified and store token
        const device = await db.mFADevice.findFirst({
            where: {
                userId,
                credentialId: challenge.deviceId,
            }
        });

        if (!device) {
            throw new Error('Device not found');
        }

        // Parse existing metadata
        const existingData = JSON.parse(device.secret || '{}');

        // Update device with token and verification status
        await db.mFADevice.update({
            where: { id: device.id },
            data: {
                isVerified: true,
                secret: JSON.stringify({
                    ...existingData,
                    deviceTokenHash,
                    expiresAt: expiresAt.toISOString(),
                    verifiedAt: new Date().toISOString(),
                }),
                lastUsedAt: new Date(),
            }
        });

        // Delete challenge
        await db.deviceVerificationChallenge.delete({
            where: { id: challenge.id }
        });

        logger.info(`Device verified successfully`, {
            userId,
            deviceId: challenge.deviceId
        });

        return {
            deviceId: challenge.deviceId,
            deviceToken, // Send once to client
            deviceName: device.name,
            expiresAt,
        };
    }

    /**
     * Validate device token
     */
    static async validateDeviceToken(
        userId: string,
        deviceId: string,
        deviceToken: string
    ): Promise<boolean> {
        try {
            const device = await db.mFADevice.findFirst({
                where: {
                    userId,
                    credentialId: deviceId,
                    isVerified: true,
                }
            });

            if (!device) {
                return false;
            }

            // Parse device data
            const deviceData = JSON.parse(device.secret || '{}');

            // Check expiry
            if (deviceData.expiresAt && new Date(deviceData.expiresAt) < new Date()) {
                return false;
            }

            // Verify token hash (constant-time comparison)
            const tokenHash = this.hashToken(deviceToken);
            const isValid = this.constantTimeCompare(
                tokenHash,
                deviceData.deviceTokenHash
            );

            if (isValid) {
                // Update last seen and trust score
                await this.updateDeviceLastSeen(device.id);
                await this.incrementTrustScore(device.id);
            }

            return isValid;
        } catch (error) {
            logger.error('Device token validation error:', { error });
            return false; // Fail closed
        }
    }

    /**
     * List user's devices
     */
    static async listUserDevices(
        userId: string,
        options: {
            page: number;
            limit: number;
            verified?: boolean;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        }
    ): Promise<{
        devices: any[];
        total: number;
        totalPages: number;
    }> {
        const { page, limit, verified, sortBy = 'lastUsedAt', sortOrder = 'desc' } = options;
        const skip = (page - 1) * limit;

        const where: any = {
            userId,
            credentialId: { not: null }, // Only devices (not TOTP/SMS)
        };

        if (verified !== undefined) {
            where.isVerified = verified;
        }

        const [devices, total] = await Promise.all([
            db.mFADevice.findMany({
                where,
                orderBy: { [sortBy]: sortOrder },
                skip,
                take: limit,
            }),
            db.mFADevice.count({ where })
        ]);

        const totalPages = Math.ceil(total / limit);

        // Parse and format devices
        const formattedDevices = devices.map(d => {
            const data = JSON.parse(d.secret || '{}');
            return {
                deviceId: d.credentialId!,
                deviceName: d.name,
                browser: data.metadata?.browser,
                os: data.metadata?.os,
                deviceType: data.metadata?.deviceType,
                location: data.metadata?.location,
                ipAddress: data.metadata?.ipAddress,
                trustScore: data.trustScore || 50,
                verified: d.isVerified,
                firstSeen: data.firstSeen,
                lastSeen: d.lastUsedAt || data.lastSeen,
            };
        });

        return {
            devices: formattedDevices,
            total,
            totalPages
        };
    }

    /**
     * Revoke a device
     */
    static async revokeDevice(userId: string, deviceId: string): Promise<void> {
        const device = await db.mFADevice.findFirst({
            where: {
                userId,
                credentialId: deviceId,
            }
        });

        if (!device) {
            throw new Error('Device not found');
        }

        // Soft delete by updating metadata
        const data = JSON.parse(device.secret || '{}');
        await db.mFADevice.update({
            where: { id: device.id },
            data: {
                isVerified: false,
                secret: JSON.stringify({
                    ...data,
                    revokedAt: new Date().toISOString(),
                }),
            }
        });

        logger.info(`Device revoked`, { userId, deviceId });
    }

    /**
     * Update device last seen timestamp
     */
    private static async updateDeviceLastSeen(deviceId: string): Promise<void> {
        await db.mFADevice.update({
            where: { id: deviceId },
            data: { lastUsedAt: new Date() }
        });
    }

    /**
     * Increment trust score
     */
    private static async incrementTrustScore(deviceId: string): Promise<void> {
        const device = await db.mFADevice.findUnique({
            where: { id: deviceId }
        });

        if (!device) return;

        const data = JSON.parse(device.secret || '{}');
        const currentScore = data.trustScore || 50;
        const newScore = Math.min(100, currentScore + 1); // Max 100

        await db.mFADevice.update({
            where: { id: deviceId },
            data: {
                secret: JSON.stringify({
                    ...data,
                    trustScore: newScore,
                })
            }
        });
    }

    /**
     * Resend verification code
     */
    static async resendVerificationCode(
        userId: string,
        challengeId: string
    ): Promise<void> {
        const challenge = await db.deviceVerificationChallenge.findFirst({
            where: { userId, challengeId }
        });

        if (!challenge) {
            throw new Error('Challenge not found');
        }

        // Check rate limiting (prevent spam)
        const lastSent = challenge.createdAt;
        const timeSinceLastSent = Date.now() - lastSent.getTime();
        if (timeSinceLastSent < 60000) { // 1 minute
            throw new Error('Rate limit: Please wait before requesting another code');
        }

        // Generate new code and extend expiry
        const newCode = this.generateVerificationCode();
        const newExpiresAt = new Date();
        newExpiresAt.setMinutes(newExpiresAt.getMinutes() + this.CODE_EXPIRY_MINUTES);

        await db.deviceVerificationChallenge.update({
            where: { id: challenge.id },
            data: {
                code: newCode,
                attempts: 0, // Reset attempts
                expiresAt: newExpiresAt,
            }
        });

        // Send new code
        const user = await db.user.findUnique({ where: { id: userId } });
        if (user?.email) {
            const deviceFingerprint = user.deviceFingerprint as any;
            const networkMetadata = user.networkMetadata as any;

            await emailService.sendDeviceVerification(
                user.email,
                newCode,
                user.name as string,
                {
                    deviceName: deviceFingerprint?.os?.name || 'Unknown Device',
                    browser: deviceFingerprint?.browser?.name,
                    browserVersion: deviceFingerprint?.browser?.version,
                    os: deviceFingerprint?.os?.name,
                    location: `${networkMetadata?.city || ''}, ${networkMetadata?.country || ''}`.replace(/^, |, $/g, '').trim(),
                    ipAddress: networkMetadata?.ipAddress
                }
            );
        }

        logger.info(`Verification code resent`, { userId, challengeId });
    }

    /**
     * Cleanup expired devices and challenges
     */
    static async cleanupExpired(): Promise<{
        devicesDeleted: number;
        challengesDeleted: number;
    }> {
        const now = new Date();

        // Delete expired challenges
        const deletedChallenges = await db.deviceVerificationChallenge.deleteMany({
            where: {
                expiresAt: { lt: now }
            }
        });

        // Find and delete expired devices
        const devices = await db.mFADevice.findMany({
            where: {
                credentialId: { not: null },
                isVerified: true,
            }
        });

        let expiredCount = 0;
        for (const device of devices) {
            const data = JSON.parse(device.secret || '{}');
            if (data.expiresAt && new Date(data.expiresAt) < now) {
                await db.mFADevice.delete({ where: { id: device.id } });
                expiredCount++;
            }
        }

        logger.info(`Cleanup completed`, {
            devicesDeleted: expiredCount,
            challengesDeleted: deletedChallenges.count
        });

        return {
            devicesDeleted: expiredCount,
            challengesDeleted: deletedChallenges.count
        };
    }

    // ========================================================================
    // HELPER METHODS
    // ========================================================================

    private static generateDeviceId(): string {
        return 'dev_' + randomBytes(16).toString('hex');
    }

    private static generateChallengeId(): string {
        return 'chal_' + randomBytes(16).toString('hex');
    }

    private static generateVerificationCode(): string {
        return Math.floor(100000 + Math.random() * 900000).toString();
    }

    private static generateDeviceToken(): string {
        return randomBytes(32).toString('hex');
    }

    private static hashToken(token: string): string {
        return createHash('sha256').update(token).digest('hex');
    }

    private static constantTimeCompare(a: string, b: string): boolean {
        if (a.length !== b.length) {
            return false;
        }
        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a.charCodeAt(i) ^ b.charCodeAt(i);
        }
        return result === 0;
    }

    async sendDeviceVerification(
        email: string,
        code: string,
        name: string,
        options?: {
            deviceName?: string;
            browser?: string;
            location?: string;
            ipAddress?: string;
        }
    ): Promise<void> {
        // TODO: Implement actual email/SMS sending
        // For now, just log
        logger.info(`Sending verification code to ${email}`, { code: !!code });

        // Example integration with your email service:
        await emailService.sendTwoFactor(email, code, name);

    }
}