
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import { createPasswordResetToken, createTwoFactorToken, createVerificationToken, deletePasswordResetToken, deleteTwoFactorToken, deleteVerificationToken, getPasswordResetTokenByEmail, getTwoFactorTokenByEmail, getVerificationTokenByEmail } from "@/loginActions/generate-verification-token";


// Types for better type safety
export interface TokenConfig {
    email: string;
    token?: string;
    expires: Date;
    attempts?: number;
    ipAddress?: string;
    userAgent?: string;
}

export interface TokenResult {
    success: boolean;
    token?: string;
    expiresAt?: Date;
    attemptsRemaining?: number;
    error?: string;
    metadata?: {
        ipAddress?: string;
        userAgent?: string;
        createdAt: Date;
    };
}

export interface BatchExpireResult {
    success: boolean;
    processed: number;
    failed: number;
    errors?: Array<{ email: string; error: string }>;
}

// Configuration
const TOKEN_CONFIG = {
    TWO_FACTOR: {
        LENGTH: 6,
        EXPIRY_MINUTES: 15,
        MAX_ATTEMPTS: 3,
        TYPE: 'numeric' as const,
    },
    VERIFICATION: {
        EXPIRY_HOURS: 1,
        TYPE: 'uuid' as const,
    },
    PASSWORD_RESET: {
        EXPIRY_HOURS: 1,
        COOLDOWN_MINUTES: 2,
        TYPE: 'uuid' as const,
    },
} as const;

// Utility functions
const generateNumericToken = (length: number): string => {
    const min = 10 ** (length - 1);
    const max = 10 ** length - 1;
    return crypto.randomInt(min, max).toString();
};

const generateSecureToken = (type: 'numeric' | 'uuid', length?: number): string => {
    switch (type) {
        case 'numeric':
            return generateNumericToken(length || 6);
        case 'uuid':
            return uuidv4();
        default:
            throw new Error(`Unsupported token type: ${type}`);
    }
};


const calculateExpiry = (minutes: number): Date => {
    return new Date(Date.now() + minutes * 60 * 1000);
};

// Token manager class for better organization
export class TokenManager {
    private static readonly TOKEN_CLEANUP_THRESHOLD = 100;
    private static tokenCounter = 0;

    /**
     * Increment the token counter and check if cleanup is needed
     */
    static shouldCleanup(): boolean {
        this.tokenCounter++;
        if (this.tokenCounter >= this.TOKEN_CLEANUP_THRESHOLD) {
            this.tokenCounter = 0;
            return true;
        }
        return false;
    }

    /**
     * Cleanup old tokens for a specific email and token type
     */
    static async cleanupOldTokens(email: string, tokenType: '2fa' | 'verification' | 'password-reset'): Promise<void> {
        try {
            switch (tokenType) {
                case '2fa':
                    const twoFactorToken = await getTwoFactorTokenByEmail(email);
                    if (twoFactorToken) {
                        await deleteTwoFactorToken(twoFactorToken.data?.token.id as string);
                    }
                    break;
                case 'verification':
                    const verificationToken = await getVerificationTokenByEmail(email);
                    if (verificationToken) {
                        await deleteVerificationToken(verificationToken.data?.token.id as string);
                    }
                    break;
                case 'password-reset':
                    const passwordResetToken = await getPasswordResetTokenByEmail(email);
                    if (passwordResetToken) {
                        await deletePasswordResetToken(passwordResetToken.data?.token.id as string);
                    }
                    break;
            }
        } catch (error) {
            // Error during cleanup - silently fail
        }
    }

    /**
     * Generate token with retry logic and exponential backoff
     */
    static async generateTokenWithRetry(
        email: string,
        userId: string,
        tokenType: '2fa' | 'verification' | 'password-reset',
        metadata?: { ipAddress?: string; userAgent?: string },
        maxRetries = 3
    ): Promise<TokenResult> {
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                switch (tokenType) {
                    case '2fa':
                        return await generateTwoFactorToken(email, metadata);
                    case 'verification':
                        return await generateVerificationToken(email, userId, metadata);
                    case 'password-reset':
                        return await generatePasswordResetToken(email, metadata);
                }
            } catch (error) {
                if (attempt === maxRetries) {
                    return {
                        success: false,
                        error: `Failed to generate ${tokenType} token after multiple attempts`,
                    };
                }
                // Exponential backoff: 100ms, 400ms, 1600ms
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 100));
            }
        }
        return {
            success: false,
            error: 'Token generation failed',
        };
    }
}

/**
 * Generate two-factor authentication token with rate limiting and metadata
 */
export const generateTwoFactorToken = async (
    email: string,
    metadata?: { ipAddress?: string; userAgent?: string }
): Promise<TokenResult> => {
    try {
        const token = generateSecureToken(
            TOKEN_CONFIG.TWO_FACTOR.TYPE,
            TOKEN_CONFIG.TWO_FACTOR.LENGTH
        );
        const expires = calculateExpiry(TOKEN_CONFIG.TWO_FACTOR.EXPIRY_MINUTES);

        // Cleanup old tokens periodically
        if (TokenManager.shouldCleanup()) {
            await TokenManager.cleanupOldTokens(email, '2fa');
        }

        // Get and delete existing token
        const existingToken = await getTwoFactorTokenByEmail(email);
        if (existingToken) {
            await deleteTwoFactorToken(existingToken.data?.token.id as string);
        }

        // Create new token with metadata
        await createTwoFactorToken({
            email,
            token,
            expires,
            ...metadata,
        });

        return {
            success: true,
            token,
            expiresAt: expires,
            attemptsRemaining: TOKEN_CONFIG.TWO_FACTOR.MAX_ATTEMPTS,
            metadata: {
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent,
                createdAt: new Date(),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: 'Failed to generate verification code',
        };
    }
};

/**
 * Generate verification token with security features
 */
export const generateVerificationToken = async (
    email: string,
    userId: string,
    metadata?: { ipAddress?: string; userAgent?: string }
): Promise<TokenResult> => {
    try {
        const token = generateSecureToken(TOKEN_CONFIG.VERIFICATION.TYPE);
        const expires = calculateExpiry(TOKEN_CONFIG.VERIFICATION.EXPIRY_HOURS * 60);

        const existingToken = await getVerificationTokenByEmail(email);

        console.log("existing token found", existingToken)

        // Handle existing token cleanup
        if (existingToken) {
            // Check if existing token is still valid (not expired)
            const tokenExpiry = new Date(
                existingToken.data?.token.expires ||
                existingToken.data?.token.expiresAt ||
                new Date()
            );
            if (tokenExpiry > new Date()) {
                // Return existing token if still valid (prevent token flooding)
                return {
                    success: true,
                    token: existingToken.data?.token.token,
                    expiresAt: tokenExpiry,
                    metadata: {
                        ipAddress: metadata?.ipAddress,
                        userAgent: metadata?.userAgent,
                        createdAt: new Date(),
                    },
                };
            }
            await deleteVerificationToken(existingToken.data?.token.id as string);
        }

        await createVerificationToken({
            email,
            userId,
            token,
            expires,
            ...metadata,
        });

        return {
            success: true,
            token,
            expiresAt: expires,
            metadata: {
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent,
                createdAt: new Date(),
            },
        };
    } catch (error) {
        return {
            success: false,
            error: 'Failed to generate verification token',
        };
    }
};

/**
 * Generate password reset token with cooldown protection
 */
export const generatePasswordResetToken = async (
    email: string,
    metadata?: { ipAddress?: string; userAgent?: string }
): Promise<TokenResult> => {
    try {
        const COOLDOWN_PERIOD = (TOKEN_CONFIG.PASSWORD_RESET.COOLDOWN_MINUTES ?? 2) * 60 * 1000;

        const existingToken = await getPasswordResetTokenByEmail(email);

        console.log("existingToken from api", existingToken);

        if (existingToken?.success && existingToken?.data) {
            const tokenData = existingToken.data.token;
            const createdAtMs = new Date(tokenData.createdAt).getTime();
            const timeSinceCreation = Date.now() - createdAtMs;

            console.log("cooldown check", {
                createdAt: tokenData.createdAt,
                createdAtMs,
                now: Date.now(),
                timeSinceCreation,
                COOLDOWN_PERIOD,
                COOLDOWN_MINUTES: TOKEN_CONFIG.PASSWORD_RESET.COOLDOWN_MINUTES,
                isWithinCooldown: timeSinceCreation < COOLDOWN_PERIOD,
                remainingSeconds: Math.ceil((COOLDOWN_PERIOD - timeSinceCreation) / 1000),
            });

            if (timeSinceCreation < COOLDOWN_PERIOD) {
                const remainingCooldown = Math.ceil(
                    (COOLDOWN_PERIOD - timeSinceCreation) / 1000
                );
                return {
                    success: false,
                    error: `Please wait ${remainingCooldown} seconds before requesting another reset token.`,
                    token: tokenData.token,
                    expiresAt: new Date(tokenData.expires),
                };
            }

            // Cooldown passed — delete old token and issue new one
            await deletePasswordResetToken(tokenData.id as string);
        }

        const token = generateSecureToken(TOKEN_CONFIG.PASSWORD_RESET.TYPE);
        const expires = calculateExpiry(TOKEN_CONFIG.PASSWORD_RESET.EXPIRY_HOURS * 60);

        await createPasswordResetToken({
            email,
            token,
            expires,
            ...metadata,
        });

        return {
            success: true,
            token,
            expiresAt: expires,
            metadata: {
                ipAddress: metadata?.ipAddress,
                userAgent: metadata?.userAgent,
                createdAt: new Date(),
            },
        };
    } catch (error) {
        console.error("generatePasswordResetToken error:", error);
        return {
            success: false,
            error: 'Failed to generate password reset token',
        };
    }
};

/**
 * Batch expire tokens for multiple emails (admin/management purposes)
 */
export const batchExpireTokens = async (
    emails: string[],
    tokenType: '2fa' | 'verification' | 'password-reset'
): Promise<BatchExpireResult> => {
    const results: BatchExpireResult = {
        success: true,
        processed: 0,
        failed: 0,
        errors: []
    };

    for (const email of emails) {
        try {
            switch (tokenType) {
                case '2fa':
                    const twoFactorToken = await getTwoFactorTokenByEmail(email);
                    if (twoFactorToken) {
                        await deleteTwoFactorToken(twoFactorToken.data?.token.id as string);
                        results.processed++;
                    }
                    break;
                case 'verification':
                    const verificationToken = await getVerificationTokenByEmail(email);
                    if (verificationToken) {
                        await deleteVerificationToken(verificationToken.data?.token.id as string);
                        results.processed++;
                    }
                    break;
                case 'password-reset':
                    const passwordResetToken = await getPasswordResetTokenByEmail(email);
                    if (passwordResetToken) {
                        await deletePasswordResetToken(passwordResetToken.data?.token.id as string);
                        results.processed++;
                    }
                    break;
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            results.failed++;
            results.success = false;
            results.errors?.push({ email, error: errorMessage });
        }
    }

    return results;
};

/**
 * Validate token format based on expected type
 */
export const validateTokenFormat = (
    token: string,
    expectedType: 'numeric' | 'uuid'
): boolean => {
    if (!token) {
        return false;
    }

    if (expectedType === 'numeric') {
        return /^\d+$/.test(token) && token.length >= 4 && token.length <= 8;
    }

    if (expectedType === 'uuid') {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
    }

    return false;
};

/**
 * Check if a token has expired
 */
export const isTokenExpired = (expiresAt: Date): boolean => {
    return new Date() > new Date(expiresAt);
};

/**
 * Get remaining time for a token in seconds
 */
export const getTokenRemainingTime = (expiresAt: Date): number => {
    const remaining = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.floor(remaining / 1000));
};









