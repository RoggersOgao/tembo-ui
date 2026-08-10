// lib/login-client.ts
"use client"

import { ErrorCode } from "@repo/api-utils"

// Map login-specific scenarios to existing error codes
export const LoginErrorMap = {
    // Authentication
    INVALID_CREDENTIALS: ErrorCode.UNAUTHORIZED,
    AUTHENTICATION_FAILED: ErrorCode.UNAUTHORIZED,

    // Account Status
    ACCOUNT_LOCKED: ErrorCode.RESOURCE_LOCKED,
    ACCOUNT_SUSPENDED: ErrorCode.FORBIDDEN,
    ACCOUNT_DEACTIVATED: ErrorCode.FORBIDDEN,
    EMAIL_NOT_VERIFIED: ErrorCode.FORBIDDEN,
    PASSWORD_EXPIRED: ErrorCode.FORBIDDEN,
    ALREADY_VERIFIED: ErrorCode.INVALID_STATE,

    // MFA/2FA
    MFA_REQUIRED: ErrorCode.UNAUTHORIZED,
    MFA_NOT_ENABLED: ErrorCode.INVALID_STATE,
    MFA_GENERATION_FAILED: ErrorCode.INTERNAL_ERROR,
    INVALID_MFA_CODE: ErrorCode.UNAUTHORIZED,
    INVALID_DEVICE_CODE: ErrorCode.UNAUTHORIZED,
    INVALID_MFA_DEVICE: ErrorCode.BAD_REQUEST,
    MFA_METHOD_UNAVAILABLE: ErrorCode.BAD_REQUEST,
    INVALID_BACKUP_CODE: ErrorCode.UNAUTHORIZED,
    DEVICE_VERIFICATION_REQUIRED: ErrorCode.UNAUTHORIZED,

    // Token
    TOKEN_GENERATION_FAILED: ErrorCode.INTERNAL_ERROR,
    INVALID_TOKEN: ErrorCode.UNAUTHORIZED,
    TOKEN_EXPIRED: ErrorCode.UNAUTHORIZED,

    // Email
    EMAIL_SEND_FAILED: ErrorCode.EXTERNAL_SERVICE_ERROR,

    // User
    USER_NOT_FOUND: ErrorCode.NOT_FOUND,

    // Network
    NETWORK_ERROR: ErrorCode.SERVICE_UNAVAILABLE,

    // Session
    SESSION_CREATION_FAILED: ErrorCode.INTERNAL_ERROR,

    // Account Type
    OAUTH_ONLY_ACCOUNT: ErrorCode.BAD_REQUEST,

    // Security
    SUSPICIOUS_ACTIVITY: ErrorCode.FORBIDDEN,

    // Success
    SUCCESS: ErrorCode.VALIDATION_ERROR, // Placeholder, won't be used for errors
} as const

export type LoginErrorType = keyof typeof LoginErrorMap

export interface LoginRequest {
    email: string
    password: string
    code?: string
    backupCode?: string
    mfaDeviceId?: string
    rememberDevice?: boolean
    metadata?: {
        ipAddress?: string
        userAgent?: string
        deviceId?: string
        location?: string
    }
}

export interface DeviceVerificationChallenge {
    challengeId: string;
    deviceId: string;
    deviceHash?: string; // Optional: the hash/fingerprint of the device
    method: "email" | "sms";
    expiresAt?: Date;
    metadata?: {
        deviceName?: string;
        deviceType?: string;
        browser?: string;
        os?: string;
        ipAddress?: string;
        createdAt?: Date;
    };
}

export interface LoginResponse {
    success?: boolean
    error?: string
    message?: string
    instruction?: string
    twoFactor?: boolean
    mfaRequired?: boolean
    deviceVerificationRequired?: boolean // NEW: Flag for device verification
    redirect?: string
    user?: {
        id: string
        email: string | null
        name: string | null
        image: string | null
        role: string
        isTwoFactorEnabled: boolean
        emailVerified: Date | null
        phoneVerified?: boolean
        phoneVerifiedAt: Date | null
        profileCompletion?: number
        verificationStatus?: string | null
        session?: {
            id: string
            expires: Date
        }
        agency?: {
            id: string
            name: string
            logo: string | null
        } | null
    }
    device?:{
        deviceToken: string;
        deviceId: string;
        expiresAt: any
    },
    security?: {
        newDevice?: boolean
        locationChanged?: boolean
        mfaUsed: boolean
        suspiciousActivity?: boolean
        deviceVerified?: boolean // NEW: Device verification status
    }
    metadata?: {
        loginTime: string
        duration: number
    }
    code?: ErrorCode
    errorType?: LoginErrorType  // Additional field for specific error type
    attemptsRemaining?: number
    expiresAt?: Date
    lockDuration?: number
    isLocked?: boolean
    retryAfter?: number
    mfaMethods?: string[]

    // Device Verification Challenge
    deviceChallenge?: DeviceVerificationChallenge // NEW: Device verification challenge details

    backupCodesAvailable?: boolean
    isNewDevice?: boolean
    supportRequired?: boolean
    supportContact?: string
    canResend?: boolean
    availableMethods?: string[]
    resetToken?: string
    recoveryOptions?: any
}

export interface CheckLoginStatusResponse {
    exists: boolean
    emailVerified?: Date | null
    mfaEnabled?: boolean
    mfaMethods?: string[]
    accountLocked?: boolean
    accountSuspended?: boolean
    requiresPasswordReset?: boolean
    trustedDevice?: boolean
    lastLoginIp?: string | null
    failedAttempts?: number
    code: ErrorCode
    errorType?: LoginErrorType
}

export interface ResendVerificationResponse {
    success?: string
    error?: string
    expiresAt?: Date
    code: ErrorCode
    errorType?: LoginErrorType
    retryAfter?: number
}

export interface ResendTwoFactorResponse {
    success?: string
    error?: string
    method?: string
    expiresAt?: Date
    attemptsRemaining?: number
    code: ErrorCode
    errorType?: LoginErrorType
    availableMethods?: string[]
}

class LoginClient {
    private static instance: LoginClient
    private baseUrl: string

    private constructor() {
        this.baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || "/api"
    }

    static getInstance(): LoginClient {
        if (!LoginClient.instance) {
            LoginClient.instance = new LoginClient()
        }
        return LoginClient.instance
    }

    private mapErrorCode(errorType?: LoginErrorType): ErrorCode {
        if (!errorType) return ErrorCode.INTERNAL_ERROR
        return LoginErrorMap[errorType] || ErrorCode.INTERNAL_ERROR
    }

    async login(data: LoginRequest): Promise<LoginResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/login`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-Requested-With": "XMLHttpRequest"
                },
                body: JSON.stringify(data)
            })

            const result = await response.json()

            if (!response.ok) {
                const errorType = result.errorType as LoginErrorType
                return {
                    error: result.error || "Login failed",
                    message: result.message,
                    instruction: result.instruction,
                    code: result.code || this.mapErrorCode(errorType),
                    errorType,
                    ...(result.retryAfter && { retryAfter: result.retryAfter }),
                    ...(result.lockDuration && { lockDuration: result.lockDuration }),
                    ...(result.attemptsRemaining !== undefined && { attemptsRemaining: result.attemptsRemaining }),
                    ...(result.mfaRequired && { mfaRequired: result.mfaRequired }),
                    ...(result.mfaMethods && { mfaMethods: result.mfaMethods }),
                    ...(result.backupCodesAvailable !== undefined && { backupCodesAvailable: result.backupCodesAvailable }),
                }
            }

            return {
                success: result.success || true,
                message: result.message,
                redirect: result.redirect,
                user: result.user,
                security: result.security,
                metadata: result.metadata,
                code: result.code || ErrorCode.VALIDATION_ERROR, // Use VALIDATION_ERROR as success placeholder
                errorType: result.errorType,
                ...(result.twoFactor && { twoFactor: result.twoFactor }),
                ...(result.mfaRequired && { mfaRequired: result.mfaRequired }),
                ...(result.expiresAt && { expiresAt: new Date(result.expiresAt) }),
            }
        } catch (error) {
            console.error("Login client error:", error)
            return {
                error: "Network error. Please check your connection and try again.",
                code: ErrorCode.SERVICE_UNAVAILABLE,
                errorType: 'NETWORK_ERROR'
            }
        }
    }

    async resendVerificationEmail(email: string, metadata?: any): Promise<ResendVerificationResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/resend-verification`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, metadata })
            })

            const result = await response.json()

            if (!response.ok) {
                const errorType = result.errorType as LoginErrorType
                return {
                    error: result.error || "Failed to resend verification email",
                    code: result.code || this.mapErrorCode(errorType),
                    errorType,
                    ...(result.retryAfter && { retryAfter: result.retryAfter })
                }
            }

            return {
                success: result.success,
                expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
                code: result.code || ErrorCode.VALIDATION_ERROR,
                errorType: result.errorType
            }
        } catch (error) {
            console.error("Resend verification error:", error)
            return {
                error: "Network error. Please try again later.",
                code: ErrorCode.SERVICE_UNAVAILABLE,
                errorType: 'NETWORK_ERROR'
            }
        }
    }

    async resendTwoFactorCode(email: string, method?: string, metadata?: any): Promise<ResendTwoFactorResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/resend-two-factor`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, method, metadata })
            })

            const result = await response.json()

            if (!response.ok) {
                const errorType = result.errorType as LoginErrorType
                return {
                    error: result.error || "Failed to resend authentication code",
                    code: result.code || this.mapErrorCode(errorType),
                    errorType,
                    ...(result.availableMethods && { availableMethods: result.availableMethods })
                }
            }

            return {
                success: result.success,
                method: result.method,
                expiresAt: result.expiresAt ? new Date(result.expiresAt) : undefined,
                attemptsRemaining: result.attemptsRemaining,
                code: result.code || ErrorCode.VALIDATION_ERROR,
                errorType: result.errorType
            }
        } catch (error) {
            console.error("Resend two-factor error:", error)
            return {
                error: "Network error. Please try again later.",
                code: ErrorCode.SERVICE_UNAVAILABLE,
                errorType: 'NETWORK_ERROR'
            }
        }
    }

    async checkLoginStatus(email: string, metadata?: any): Promise<CheckLoginStatusResponse> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/check-status`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, metadata })
            })

            const result = await response.json()

            if (!response.ok) {
                const errorType = result.errorType as LoginErrorType
                return {
                    exists: false,
                    code: result.code || this.mapErrorCode(errorType),
                    errorType
                }
            }

            return {
                exists: result.exists,
                emailVerified: result.emailVerified,
                mfaEnabled: result.mfaEnabled,
                mfaMethods: result.mfaMethods || [],
                accountLocked: result.accountLocked,
                accountSuspended: result.accountSuspended,
                requiresPasswordReset: result.requiresPasswordReset,
                trustedDevice: result.trustedDevice,
                lastLoginIp: result.lastLoginIp,
                failedAttempts: result.failedAttempts,
                code: result.code || ErrorCode.VALIDATION_ERROR,
                errorType: result.errorType
            }
        } catch (error) {
            console.error("Check login status error:", error)
            return {
                exists: false,
                code: ErrorCode.SERVICE_UNAVAILABLE,
                errorType: 'NETWORK_ERROR'
            }
        }
    }

    async validateTwoFactorCode(email: string, code: string): Promise<{
        valid: boolean
        error?: string
        code?: ErrorCode
        errorType?: LoginErrorType
    }> {
        try {
            const response = await fetch(`${this.baseUrl}/auth/validate-two-factor`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ email, code })
            })

            const result = await response.json()

            if (!response.ok) {
                const errorType = result.errorType as LoginErrorType
                return {
                    valid: false,
                    error: result.error || "Invalid code",
                    code: result.code || this.mapErrorCode(errorType),
                    errorType
                }
            }

            return {
                valid: true
            }
        } catch (error) {
            console.error("Validate two-factor error:", error)
            return {
                valid: false,
                error: "Network error. Please try again.",
                code: ErrorCode.SERVICE_UNAVAILABLE,
                errorType: 'NETWORK_ERROR'
            }
        }
    }
}

export const loginClient = LoginClient.getInstance()