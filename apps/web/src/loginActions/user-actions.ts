
import { UsersListFilters } from '@/hooks/user/useUser';
import { getToken } from '@/lib/get-token';
import { DeviceMetadata } from '@/lib/schemas';
import { RequestMetadata } from '@/types/metadata.types';
import {
    ApiResponse,
    ErrorCode,
    createSuccessResponse,
    createErrorResponse,
} from '@repo/api-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface SecurityStatusResponse {
    accountStatus: {
        isLocked: boolean;
        lockedAt: Date | null;
        unlockedAt: Date | null;
        lockReason: string | null;
        remainingTime: number;
        isActive: boolean;
    };
    loginSecurity: {
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
        lastFailedLoginIp: string | null;
        passwordAgeDays: number | null;
        passwordExpiresAt: Date | null;
        passwordExpiresInDays: number | null;
    };
    multiFactorAuth: {
        isEnabled: boolean;
        method: string | null;
        devicesCount: number;
        devices: Array<any>;
    };
    deviceSecurity: {
        trustedDevicesCount: number;
        trustedDevices: Array<any>;
        activeSessions: number;
        recentSessions: Array<any>;
    };
    securityScore: {
        score: number;
        level: 'HIGH' | 'MEDIUM' | 'LOW';
        recommendations: string[];
    };
}

export type SecurityAlertType =
    | "ACCOUNT_LOCKED"
    | "SUSPICIOUS_LOGIN"
    | "PASSWORD_CHANGED"
    | "MFA_DISABLED"
    | "FAILED_LOGIN_ATTEMPTS"
    | "NEW_DEVICE_LOGIN"
    | "ACCOUNT_RECOVERY"
    | "UNAUTHORIZED_ACCESS";

export type SecurityAlertSeverity = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export interface CreateAuditLogInput {
    action: string;
    userId?: string;
    entityType: string;
    entityId?: string;
    metadata?: any;
    ipAddress?: string;
    userAgent?: string;
}

export interface IncrementFailedAttemptsInput {
    ipAddress?: string;
}

export interface LockAccountInput {
    reason: string;
}

export interface CheckLockResponse {
    isLocked: boolean;
    remainingTime: number;
    lockReason: string | null;
    failedLoginAttempts: number;
    unlockedAt: Date | null;
}

export interface UserData {
    id: string;
    uuid: string;
    email: string;
    name: string;
    phone: string;
    image?: string;
    avatarUrl: string;
    emailVerified: Date;
    phoneVerified: boolean;
    phoneVerifiedAt: Date;
    password?: string;
    passwordHashAlgorithm?: string;
    passwordHistory?: string[];
    passwordLastChanged?: Date;
    passwordExpiresAt: Date;
    failedLoginAttempts: number;
    lastFailedLoginIp?: string;
    lastFailedLoginAt?: Date;
    isLocked?: boolean;
    lockedAt?: Date;
    lockReason?: string;
    unlockedAt?: Date;
    loginLogs?: any[];
    isTwoFactorEnabled: boolean;
    twoFactorMethod?: 'APP' | 'SMS' | 'EMAIL' | 'FIDO2';
    twoFactorSecret?: string;
    backupCodes: string[];
    twoFactorConfirmedAt?: Date;
    mfaDevices: {
        id: string;
        name: string;
        type: 'TOTP' | 'FIDO2' | 'SMS' | 'EMAIL';
        lastUsedAt?: Date;
        isPrimary: boolean;
        isVerified: boolean;
        createdAt: Date;
    }[];
    role: string;
    roleId?: string;
    isActive: boolean;
    isSuspended: boolean;
    suspendedUntil?: Date;
    suspensionReason: string;
    preferences?: any;
    language: string;
    timezone?: string;
    dateFormat?: string;
    currency?: string;
    reputation: number;
    reputationScore: number;
    trustScore: number;
    lastLoginAt: Date;
    lastLoginIp: string;
    lastActiveAt?: Date;
    loginCount: number;
    currentLoginIp?: string;
    trustedIps?: string[];
    isVerified: boolean;
    verificationLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'VERIFIED';
    deviceFingerprint?: any;
    deviceId?: string;
    networkMetadata?: any;
    userAgentMetadata?: any;
    securityMetadata?: any;
    registrationMetadata?: any;
    riskLevel?: string;
    isSuspiciousRegistration: boolean;
    requiresVerification: boolean;
    agencyId: string;
    agencyRole?: 'OWNER' | 'ADMIN' | 'MANAGER' | 'AGENT' | 'VIEWER';
    termsAcceptedAt?: Date;
    termsVersion?: string;
    privacyAcceptedAt?: Date;
    privacyVersion?: string;
    marketingOptIn: boolean;
    dataProcessingConsent: boolean;
    createdAt?: Date;
    updatedAt?: Date;
    deletedAt?: Date;
    createdByIp?: string;
    signupSource?: 'WEB' | 'MOBILE_WEB' | 'IOS' | 'ANDROID' | 'REFERRAL' | 'PARTNER' | 'SOCIAL';
    referrerId?: string;

    termsAccepted?: boolean;
    privacyAccepted?: boolean;
    profile?: {
        firstName?: string;
        lastName?: string;
        middleName?: string;
        displayName?: string;
        dateOfBirth?: string | Date;
        gender?: 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY' | 'OTHER';
        bio?: string;
        secondaryEmail?: string;
        secondaryPhone?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        county?: string;
        postalCode?: string;
        country?: string;
        idDocumentType?: 'NATIONAL_ID' | 'PASSPORT' | 'DRIVING_LICENSE' | 'ALIEN_ID';
        idDocumentNumber?: string;
        idDocumentExpiry?: string | Date;
        occupation?: string;
        company?: string;
        jobTitle?: string;
        yearsOfExperience?: number;
    };
}

export interface MFADevice {
    id: string;
    userId: string;
    name: string;
    type: 'TOTP' | 'FIDO2' | 'SMS' | 'EMAIL';
    secret?: string;
    publicKey?: string;
    credentialId?: string;
    lastUsedAt?: Date;
    isPrimary: boolean;
    isVerified: boolean;
    createdAt: Date;
}

export interface MinimalUserData {
    id: string;
    uuid: string;
    email: string;
    name: string;
    role: string;
    isActive: boolean;
    isVerified: boolean;
    isTwoFactorEnabled: boolean;
    emailVerified: Date;
    image?: string;
    agencyId?: string;
}

export interface PublicUserProfile {
    id: string;
    uuid: string;
    name: string;
    image?: string;
    avatarUrl: string;
    role: string;
    isVerified: boolean;
    verificationLevel: 'BASIC' | 'INTERMEDIATE' | 'ADVANCED' | 'VERIFIED';
    reputation: number;
    reputationScore: number;
    trustScore: number;
    createdAt?: Date;
}

export const UserRole = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    ADMIN: 'ADMIN',
    MANAGER: 'MANAGER',
    STAFF: 'STAFF',
    DELIVERY: 'DELIVERY',
    SUPPLIER: 'SUPPLIER',
    CUSTOMER: 'CUSTOMER',
    SUPPORT: 'SUPPORT',
    VIEWER: 'VIEWER',
} as const

export type UserRole = (typeof UserRole)[keyof typeof UserRole]


export const SignupSource = {
    WEB: "WEB",
    MOBILE_WEB: "MOBILE_WEB",
    IOS: "IOS",
    ANDROID: "ANDROID",
    REFERRAL: "REFERRAL",
    PARTNER: "PARTNER",
    SOCIAL: "SOCIAL"
}

export const TwoFactorMethod = {
    APP: "APP",
    SMS: "SMS",
    EMAIL: "EMAIL"
}
export type SignupSource = (typeof SignupSource)[keyof typeof SignupSource]
export type TwoFactorMethod = (typeof TwoFactorMethod)[keyof typeof TwoFactorMethod]



export const VerificationLevel = {
    BASIC: "BASIC",
    INTERMEDIATE: "INTERMEDIATE",
    ADVANCED: "ADVANCED",
    VERIFIED: "VERIFIED"
}

export type VerificationLevel = (typeof VerificationLevel)[keyof typeof VerificationLevel]



export type UserResponse = ApiResponse<{ user: UserData }>;
export type UsersResponse = ApiResponse<{ users: UserData[]; pagination?: any }>;



export interface VerifyUserDeviceResponse {
    result: {
        deviceId: string;
        deviceToken: string;
        deviceName: string;
        expiresAt: Date;
    }
}

export interface RegisterNewDeviceResponse {
    deviceId: string,
    challenge: {
        challengeId: string;
        method: "email" | "sms";
        expiresAt: Date
    }
}

export interface UserProfile {
    firstName: string;
    lastName: string;
    middleName?: string | null;
    displayName?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    secondaryEmail?: string | null;
    secondaryPhone?: string | null;
    addressLine1?: string | null;
    addressLine2?: string | null;
    city?: string | null;
    county?: string | null;
    postalCode?: string | null;
    country: string;
    bio?: string | null;
    idDocumentType?: string;
    idDocumentNumber?: string;
    idDocumentExpiry?: string;
    occupation?: string | null;
    company?: string | null;
    jobTitle?: string | null;
    yearsOfExperience?: number | null;
}

export interface CreateUserInput {
    name: string;
    email: string;
    phone: string;
    password: string;
    role: UserRole;
    isActive: boolean;
    isSuspended: boolean;
    isTwoFactorEnabled: boolean;
    twoFactorMethod: TwoFactorMethod;
    language: string;
    timezone: string;
    currency: string;
    dateFormat: string;
    termsAccepted: boolean;
    privacyAccepted: boolean;
    marketingOptIn: boolean;
    dataProcessingConsent: boolean;
    isVerified: boolean;
    verificationLevel: VerificationLevel;
    signupSource: SignupSource;
    referrerId?: string | null;
    profile: UserProfile;
}

export interface UpdatePasswordInput {
    password: string;
}

export interface VerifyUserInput {
    email: string;
}

export interface GetUserOptions {
    includePassword?: boolean;
    includeSensitive?: boolean;
    includeRelations?: boolean;
    includeMFA?: boolean;
    includeSecurity?: boolean;
    includeDevices?: boolean;
    timeout?: number;
    role?: string
}

export interface SendSecurityAlertInput {
    userId: string;
    type: SecurityAlertType;
    message: string;
    severity: SecurityAlertSeverity;
    metadata?: Record<string, any>;
}

export interface CheckSuspiciousActivityInput {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    location?: string;
    loginTime: Date;
    deviceId?: string;
}

export interface FlagSuspiciousLoginInput {
    userId: string;
    ipAddress: string;
    reason: string;
    severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    metadata?: {
        userAgent?: string;
        location?: string;
        deviceId?: string;
        attemptedAction?: string;
        [key: string]: any;
    };
}

export interface FlagSuspiciousLoginResult {
    flagged: boolean;
    alertId: string;
    timestamp: Date;
    severity: string;
}

export interface CheckSuspiciousActivityResult {
    isSuspicious: boolean;
    reason?: string;
    confidence: number;
    recommendations: string[];
}

export interface RecordLoginActivityInput {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceId?: string;
    location?: string;
    mfaUsed?: boolean;
    success?: boolean;
    sessionId?: string;
}

export interface CreateActivityLogInput {
    userId: string;
    action: string;
    metadata?: Record<string, any>;
}

export interface RateLimitResult {
    exceeded: boolean;
    attempts: number;
    remainingTime: number;
    resetAt: Date;
}

export interface CreateSessionInput {
    userId: string;
    ipAddress?: string;
    userAgent?: string;
    deviceInfo?: {
        deviceId?: string;
        deviceType?: string;
        location?: string;
    };
    mfaVerified?: boolean;
    isVerified?: boolean;
}

export interface LoginLimitResult {
    currentCount: number;
    isLocked: boolean;
    unlockedAt?: Date;
    remainingAttempts: number;
}

export interface LoginLimitInput {
    userId: string;
    action: 'increment' | 'reset' | 'check';
    type?: 'failed' | 'success';
    ipAddress?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

class UserClient {
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    }

    private transformUser(user: any): UserData {
        return {
            ...user,
            emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
            phoneVerifiedAt: user.phoneVerifiedAt ? new Date(user.phoneVerifiedAt) : null,
            passwordLastChanged: user.passwordLastChanged ? new Date(user.passwordLastChanged) : null,
            passwordExpiresAt: user.passwordExpiresAt ? new Date(user.passwordExpiresAt) : null,
            lastFailedLoginAt: user.lastFailedLoginAt ? new Date(user.lastFailedLoginAt) : null,
            lockedAt: user.lockedAt ? new Date(user.lockedAt) : null,
            unlockedAt: user.unlockedAt ? new Date(user.unlockedAt) : null,
            twoFactorConfirmedAt: user.twoFactorConfirmedAt ? new Date(user.twoFactorConfirmedAt) : null,
            suspendedUntil: user.suspendedUntil ? new Date(user.suspendedUntil) : null,
            lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
            lastActiveAt: user.lastActiveAt ? new Date(user.lastActiveAt) : null,
            termsAcceptedAt: user.termsAcceptedAt ? new Date(user.termsAcceptedAt) : null,
            privacyAcceptedAt: user.privacyAcceptedAt ? new Date(user.privacyAcceptedAt) : null,
            createdAt: user.createdAt ? new Date(user.createdAt) : null,
            updatedAt: user.updatedAt ? new Date(user.updatedAt) : null,
            deletedAt: user.deletedAt ? new Date(user.deletedAt) : null,
            mfaDevices: user.mfaDevices?.map((device: any) => ({
                ...device,
                lastUsedAt: device.lastUsedAt ? new Date(device.lastUsedAt) : null,
                createdAt: device.createdAt ? new Date(device.createdAt) : null,
            })),
        };
    }

    private transformTrustedDevice(device: any): TrustedDeviceWithUser {
        return {
            ...device,
            lastSeen: new Date(device.lastSeen),
            firstSeen: new Date(device.firstSeen),
            expiresAt: new Date(device.expiresAt),
            revokedAt: device.revokedAt ? new Date(device.revokedAt) : null,
            createdAt: new Date(device.createdAt),
            updatedAt: new Date(device.updatedAt),
            user: device.user ? {
                ...device.user,
            } : undefined,
        };
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        requireAuth: boolean = false // Default to false
    ): Promise<T> {
        let token: string | undefined | null;

        if (requireAuth) {
            token = await getToken()
            if (!token) {
                throw new Error('Authorization token is missing. Please log in.');
            }
        }

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const res = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            headers,
        });

        if (res.status === 401) throw new Error('Unauthorized');

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(
                errorData.message || errorData.error || `Request failed with status ${res.status}`
            );
        }

        if (options.method === 'DELETE') {
            const text = await res.text();
            return (text ? JSON.parse(text) : {}) as T;
        }

        return res.json();
    }

    private handleError<T>(error: unknown): ApiResponse<T> {
        if (error instanceof Error) {
            if (error.message === 'Unauthorized') {
                return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, 'Unauthorized');
            }
            if (error.message.includes('Authorization token is missing')) {
                return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, error.message);
            }
            if (error.message.toLowerCase().includes('network') || error.message.includes('fetch')) {
                return createErrorResponse<T>(ErrorCode.SERVICE_UNAVAILABLE, 'Network error: Unable to reach the server');
            }
            return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, error.message);
        }
        return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred');
    }

    // ─── User CRUD Operations ─────────────────────────────────────────────────

    async getUserByEmail(
        email: string,
        options: GetUserOptions = {}
    ): Promise<UserResponse> {
        try {
            if (!email || typeof email !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid email parameter"
                );
            }

            const queryParams = new URLSearchParams({ email });
            if (options.includePassword) queryParams.append('includePassword', 'true');
            if (options.includeSensitive) queryParams.append('includeSensitive', 'true');
            if (options.includeRelations) queryParams.append('includeRelations', 'true');
            if (options.includeMFA) queryParams.append('includeMFA', 'true');
            if (options.includeSecurity) queryParams.append('includeSecurity', 'true');
            if (options.includeDevices) queryParams.append('includeDevices', 'true');

            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                `/api/users?${queryParams.toString()}`,
                {},
                false // requireAuth false for public user lookup
            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'User retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async getUserById(
        id: string,
        options: GetUserOptions = {}
    ): Promise<UserResponse> {
        try {
            if (!id || typeof id !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const queryParams = new URLSearchParams();
            if (options.includePassword) queryParams.append('includePassword', 'true');
            if (options.includeSensitive) queryParams.append('includeSensitive', 'true');
            if (options.includeRelations) queryParams.append('includeRelations', 'true');
            if (options.includeMFA) queryParams.append('includeMFA', 'true');
            if (options.includeSecurity) queryParams.append('includeSecurity', 'true');
            if (options.includeDevices) queryParams.append('includeDevices', 'true');
            if (options.role) queryParams.append('role', options.role)

            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                `/api/users/${id}?${queryParams.toString()}`,
                {}
            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'User retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async getUsers(
        options: UsersListFilters = {}
    ): Promise<UsersResponse> {
        try {
            const queryParams = new URLSearchParams()

            // ── Pagination & sort ─────────────────────────────────────────────────
            if (options.page) queryParams.append('page', options.page.toString())
            if (options.limit) queryParams.append('limit', options.limit.toString())
            if (options.search) queryParams.append('search', options.search)
            if (options.sortBy) queryParams.append('sortBy', options.sortBy)
            if (options.sortOrder) queryParams.append('sortOrder', options.sortOrder)

            // ── Filters ───────────────────────────────────────────────────────────
            if (options.role) queryParams.append('role', options.role)
            if (options.verificationLevel) queryParams.append('verificationLevel', options.verificationLevel)
            if (options.signupSource) queryParams.append('signupSource', options.signupSource)
            if (options.createdAfter) queryParams.append('createdAfter', options.createdAfter)
            if (options.createdBefore) queryParams.append('createdBefore', options.createdBefore)
            if (options.isActive !== undefined) queryParams.append('isActive', String(options.isActive))
            if (options.isVerified !== undefined) queryParams.append('isVerified', String(options.isVerified))
            if (options.isTwoFactorEnabled !== undefined) queryParams.append('isTwoFactorEnabled', String(options.isTwoFactorEnabled))
            if (options.isLocked !== undefined) queryParams.append('isLocked', String(options.isLocked))
            if (options.isSuspended !== undefined) queryParams.append('isSuspended', String(options.isSuspended))

            const response = await this.request<{
                success: boolean
                message?: string
                data: UserData[]
                pagination?: any
                timestamp?: string
            }>(`/api/users?${queryParams.toString()}`, {}, true)

            return createSuccessResponse(
                {
                    users: (response.data ?? []).map(u => this.transformUser(u)),
                    pagination: response.pagination ?? null,
                },
                response.message ?? 'Users retrieved successfully'
            )
        } catch (error) {
            return this.handleError<{ users: UserData[]; pagination?: any }>(error)
        }
    }

    async createUser(data: CreateUserInput): Promise<UserResponse> {
        try {
            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                '/api/users',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                },
                false // requireAuth false for registration
            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'User created successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async createUserForAdmin(data: CreateUserInput): Promise<UserResponse> {
        try {
            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                '/api/usr/admin/create',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                },
                true // requireAuth false for registration
            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'User created successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async updateUser(userId: string, data: Partial<UserData>): Promise<UserResponse> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                `/api/users/${userId}`,
                {
                    method: 'PATCH',
                    body: JSON.stringify(data),
                },


            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'User updated successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async deleteUser(userId: string): Promise<ApiResponse<{ deleted: boolean }>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ deleted: boolean }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{ data: { deleted: boolean }; message?: string }>(
                `/api/users/${userId}`,
                {
                    method: 'DELETE',
                },

            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'User deleted successfully'
            );
        } catch (error) {
            return this.handleError<{ deleted: boolean }>(error);
        }
    }

    async updateUserPassword(userId: string, data: UpdatePasswordInput): Promise<UserResponse> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            if (!data.password || typeof data.password !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Password is required"
                );
            }

            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                `/api/users/hooks?userId=${encodeURIComponent(userId)}`,
                {
                    method: 'PUT',
                    body: JSON.stringify({ password: data.password }),
                },
            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'Password updated successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async verifyExistingUser(userId: string, data: VerifyUserInput): Promise<UserResponse> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{
                data: {
                    email: string;
                    emailVerified: Date;
                    id: string;
                    trustScore: number;
                    verificationLevel: string;
                };
                message: string;
                success: boolean;
            }>(
                `/api/users/${encodeURIComponent(userId)}/verify-email`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ email: data.email }),
                },
                false
            );

            return createSuccessResponse(
                {
                    user: {
                        ...response.data,
                        emailVerified: new Date(response.data.emailVerified)
                    } as unknown as UserData
                },
                response.message ?? 'User verified successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async getUserProfile(userId: string): Promise<ApiResponse<{ user: any }>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ user: any }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{ data: { user: any }; message?: string }>(
                `/api/v1/profile?userId=${userId}`,
                {},
                true // requireAuth true for profile access
            );

            return createSuccessResponse(
                { user: response.data.user },
                response.message ?? 'Profile retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ user: any }>(error);
        }
    }

    // ─── Account Security Operations ──────────────────────────────────────────

    async incrementFailedAttempts(
        userId: string,
        data?: IncrementFailedAttemptsInput
    ): Promise<ApiResponse<{
        failedLoginAttempts: number;
        lastFailedLoginAt: Date;
        isLocked: boolean;
    }>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{
                    failedLoginAttempts: number;
                    lastFailedLoginAt: Date;
                    isLocked: boolean;
                }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{
                data: {
                    failedLoginAttempts: number;
                    lastFailedLoginAt: Date;
                    isLocked: boolean;
                }; message?: string
            }>(
                `/api/users/${userId}/increment-failed-attempts`,
                {
                    method: 'POST',
                    body: JSON.stringify(data || {}),
                },
                false // requireAuth false for login attempts
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    lastFailedLoginAt: new Date(response.data.lastFailedLoginAt)
                },
                response.message ?? 'Failed attempts incremented'
            );
        } catch (error) {
            return this.handleError<{
                failedLoginAttempts: number;
                lastFailedLoginAt: Date;
                isLocked: boolean;
            }>(error);
        }
    }

    async resetFailedAttempts(userId: string): Promise<ApiResponse<{
        failedLoginAttempts: number;
        lastFailedLoginAt: Date | null;
    }>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{
                    failedLoginAttempts: number;
                    lastFailedLoginAt: Date | null;
                }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{
                data: {
                    failedLoginAttempts: number;
                    lastFailedLoginAt: Date | null;
                }; message?: string
            }>(
                `/api/users/${userId}/reset-failed-logins`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({}),
                },
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    lastFailedLoginAt: response.data.lastFailedLoginAt ? new Date(response.data.lastFailedLoginAt) : null
                },
                response.message ?? 'Failed attempts reset'
            );
        } catch (error) {
            return this.handleError<{
                failedLoginAttempts: number;
                lastFailedLoginAt: Date | null;
            }>(error);
        }
    }

    async lockAccount(
        userId: string,
        data: LockAccountInput
    ): Promise<ApiResponse<{ lockedAt: Date; lockReason: string; unlockedAt: Date | null; isLocked: boolean }>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ lockedAt: Date; lockReason: string; unlockedAt: Date | null; isLocked: boolean }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            if (!data.reason || typeof data.reason !== "string") {
                return createErrorResponse<{ lockedAt: Date; lockReason: string; unlockedAt: Date | null; isLocked: boolean }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Lock reason is required"
                );
            }

            const response = await this.request<{
                data: { lockedAt: Date; lockReason: string; unlockedAt: Date | null; isLocked: boolean };
                message?: string;
            }>(
                `/api/users/${userId}/lock`,
                { method: "PATCH", body: JSON.stringify(data) }
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    lockedAt: new Date(response.data.lockedAt),
                    unlockedAt: response.data.unlockedAt ? new Date(response.data.unlockedAt) : null,
                },
                response.message ?? "Account locked successfully"
            );
        } catch (error) {
            return this.handleError<{ lockedAt: Date; lockReason: string; unlockedAt: Date | null; isLocked: boolean }>(error);
        }
    }

    async unlockAccount(userId: string): Promise<ApiResponse<{
        lockedAt: Date | null;
        isLocked: boolean;
        isActive: boolean;
    }>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{
                    lockedAt: Date | null;
                    isLocked: boolean;
                    isActive: boolean;
                }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{
                data: {
                    lockedAt: Date | null;
                    isLocked: boolean;
                    isActive: boolean;
                }; message?: string
            }>(
                `/api/users/${userId}/unlock`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({}),
                },
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    lockedAt: response.data.lockedAt ? new Date(response.data.lockedAt) : null
                },
                response.message ?? 'Account unlocked successfully'
            );
        } catch (error) {
            return this.handleError<{
                lockedAt: Date | null;
                isLocked: boolean;
                isActive: boolean;
            }>(error);
        }
    }

    async checkAccountLock(userId: string): Promise<ApiResponse<CheckLockResponse>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<CheckLockResponse>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{ data: CheckLockResponse; message?: string }>(
                `/api/users/${userId}/check-lock`,
                {},
                false // requireAuth false for lock check
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    unlockedAt: response.data.unlockedAt ? new Date(response.data.unlockedAt) : null
                },
                response.message ?? 'Lock status retrieved'
            );
        } catch (error) {
            return this.handleError<CheckLockResponse>(error);
        }
    }

    async getAccountSecurityStatus(userId: string): Promise<ApiResponse<SecurityStatusResponse>> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<SecurityStatusResponse>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{ data: SecurityStatusResponse; message?: string }>(
                `/api/users/${userId}/security-status`,
                {},
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Security status retrieved'
            );
        } catch (error) {
            return this.handleError<SecurityStatusResponse>(error);
        }
    }

    async verifyUserEmail(userId: string): Promise<UserResponse> {
        try {
            if (!userId || typeof userId !== "string") {
                return createErrorResponse<{ user: UserData }>(
                    ErrorCode.VALIDATION_ERROR,
                    "Invalid user ID"
                );
            }

            const response = await this.request<{ data: { user: UserData }; message?: string }>(
                `/api/users/${encodeURIComponent(userId)}/verify-email`,
                {
                    method: 'PATCH',
                },
            );

            return createSuccessResponse(
                { user: this.transformUser(response.data.user) },
                response.message ?? 'Email verified successfully'
            );
        } catch (error) {
            return this.handleError<{ user: UserData }>(error);
        }
    }

    async getUserStats(): Promise<ApiResponse<any>> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                '/api/users/stats',
                {},
                true // requireAuth true for stats
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Stats retrieved successfully'
            );
        } catch (error) {
            return this.handleError<any>(error);
        }
    }

    // ─── Audit Log Operations ─────────────────────────────────────────────────

    async createAuditLog(data: CreateAuditLogInput): Promise<ApiResponse<{ auditLog: any }>> {
        try {
            const response = await this.request<{ data: { auditLog: any }; message?: string }>(
                '/api/users/v1/audit-logs',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                },
            );

            return createSuccessResponse(
                { auditLog: response.data.auditLog },
                response.message ?? 'Audit log created successfully'
            );
        } catch (error) {
            return this.handleError<{ auditLog: any }>(error);
        }
    }

    async getAuditLogs(
        filters?: {
            userId?: string;
            action?: string;
            entityType?: string;
            entityId?: string;
            startDate?: string;
            endDate?: string;
            page?: number;
            limit?: number;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        }
    ): Promise<ApiResponse<{ logs: any[]; pagination: any }>> {
        try {
            const queryParams = new URLSearchParams();
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined) queryParams.append(key, value.toString());
                });
            }

            const response = await this.request<{ data: { logs: any[]; pagination: any }; message?: string }>(
                `/api/v1/audit-logs?${queryParams.toString()}`,
                {}
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Audit logs retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ logs: any[]; pagination: any }>(error);
        }
    }

    // ─── Session Operations ───────────────────────────────────────────────────

    async createSession(data: CreateSessionInput): Promise<ApiResponse<{ id: string; expires: Date }>> {
        try {
            const sessionData = {
                userId: data.userId,
                sessionToken: this.generateSessionToken(),
                expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
                ipAddress: data.ipAddress,
                userAgent: data.userAgent,
                deviceInfo: data.deviceInfo,
                isVerified: data.isVerified
            };

            const response = await this.request<{ data: { id: string; expires: Date }; message?: string }>(
                '/api/users/v1/sessions',
                {
                    method: 'POST',
                    body: JSON.stringify(sessionData),
                }
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    expires: new Date(response.data.expires)
                },
                response.message ?? 'Session created successfully'
            );
        } catch (error) {
            return this.handleError<{ id: string; expires: Date }>(error);
        }
    }

    async getUserSessions(
        userId: string,
        filters?: {
            isActive?: boolean;
            page?: number;
            limit?: number;
        }
    ): Promise<ApiResponse<{ sessions: any[]; pagination: any }>> {
        try {
            const queryParams = new URLSearchParams({ userId });
            if (filters?.isActive !== undefined) queryParams.append('isActive', filters.isActive.toString());
            if (filters?.page) queryParams.append('page', filters.page.toString());
            if (filters?.limit) queryParams.append('limit', filters.limit.toString());

            const response = await this.request<{ data: { sessions: any[]; pagination: any }; message?: string }>(
                `/api/v1/sessions?${queryParams.toString()}`,
                {}
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Sessions retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ sessions: any[]; pagination: any }>(error);
        }
    }

    async deleteSession(sessionId: string): Promise<ApiResponse<{ deleted: boolean }>> {
        try {
            const response = await this.request<{ data: { deleted: boolean }; message?: string }>(
                `/api/v1/sessions/${sessionId}`,
                {
                    method: 'DELETE',
                }
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Session deleted successfully'
            );
        } catch (error) {
            return this.handleError<{ deleted: boolean }>(error);
        }
    }

    // ─── Trusted Device Operations ────────────────────────────────────────────

    async getTrustedDeviceInfo(userId: string, deviceId: string): Promise<ApiResponse<{ device: TrustedDeviceWithUser }>> {
        try {
            const response = await this.request<{ data: { device: TrustedDeviceWithUser }; message?: string }>(
                `/api/device/trusted-devices/device/${deviceId}?userId=${encodeURIComponent(userId)}`,
                {}
            );

            return createSuccessResponse(
                { device: this.transformTrustedDevice(response.data.device) },
                response.message ?? 'Device info retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ device: TrustedDeviceWithUser }>(error);
        }
    }

    async toggleDeviceTrust(userId: string, deviceId: string, ipAddress: string): Promise<ApiResponse<{ device: TrustedDeviceWithUser }>> {
        try {
            const response = await this.request<{ data: { device: TrustedDeviceWithUser }; message?: string }>(
                `/api/device/trusted-devices/${userId}/trust`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ userId, deviceId, ipAddress }),
                }
            );

            return createSuccessResponse(
                { device: this.transformTrustedDevice(response.data.device) },
                response.message ?? 'Device trust toggled successfully'
            );
        } catch (error) {
            return this.handleError<{ device: TrustedDeviceWithUser }>(error);
        }
    }

    // ─── Security Alert Operations ────────────────────────────────────────────

    async sendSecurityAlert(data: SendSecurityAlertInput): Promise<ApiResponse<{ sent: boolean }>> {
        try {
            const response = await this.request<{ data: { sent: boolean }; message?: string }>(
                '/api/v1/security/alerts',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                }
            );

            return createSuccessResponse(
                { sent: response.data.sent },
                response.message ?? 'Security alert sent successfully'
            );
        } catch (error) {
            return this.handleError<{ sent: boolean }>(error);
        }
    }

    // ─── Suspicious Activity Operations ───────────────────────────────────────

    async checkSuspiciousActivity(data: CheckSuspiciousActivityInput): Promise<ApiResponse<CheckSuspiciousActivityResult>> {
        try {
            const response = await this.request<{ data: CheckSuspiciousActivityResult; message?: string }>(
                '/api/users/suspicious-activity/check',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                },
                false // requireAuth false for suspicious activity check
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Suspicious activity check completed'
            );
        } catch (error) {
            return this.handleError<CheckSuspiciousActivityResult>(error);
        }
    }

    async flagSuspiciousLogin(data: FlagSuspiciousLoginInput): Promise<ApiResponse<FlagSuspiciousLoginResult>> {
        try {
            const response = await this.request<{ data: FlagSuspiciousLoginResult; message?: string }>(
                '/api/users/suspicious-login/flag',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                }
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    timestamp: new Date(response.data.timestamp)
                },
                response.message ?? 'Suspicious login flagged successfully'
            );
        } catch (error) {
            return this.handleError<FlagSuspiciousLoginResult>(error);
        }
    }

    // ─── Login Activity Operations ────────────────────────────────────────────

    async recordLoginActivity(data: RecordLoginActivityInput): Promise<ApiResponse<{ recorded: boolean; activityId: string }>> {
        try {
            const response = await this.request<{ data: { recorded: boolean; activityId: string }; message?: string }>(
                '/api/users/login-activity',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                },
                false // requireAuth false for login activity
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Login activity recorded successfully'
            );
        } catch (error) {
            return this.handleError<{ recorded: boolean; activityId: string }>(error);
        }
    }

    // ─── Login Limit Operations ───────────────────────────────────────────────

    async manageLoginLimits(data: LoginLimitInput): Promise<ApiResponse<LoginLimitResult>> {
        try {
            const response = await this.request<{ data: LoginLimitResult; message?: string }>(
                '/api/users/login-limits',
                {
                    method: 'POST',
                    body: JSON.stringify(data),
                },
                false // requireAuth false for login limits
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    unlockedAt: response.data.unlockedAt ? new Date(response.data.unlockedAt) : undefined
                },
                response.message ?? 'Login limit managed successfully'
            );
        } catch (error) {
            return this.handleError<LoginLimitResult>(error);
        }
    }

    // ─── MFA Operations ───────────────────────────────────────────────────────

    async verifyMFACode(
        type: string,
        userId: string,
        code: string,
        method: 'authenticator' | 'sms' | 'email' | 'backup'
    ): Promise<ApiResponse<{ verified: boolean; backupCodes?: string[] }>> {
        try {
            const response = await this.request<{ data: { verified: boolean; backupCodes?: string[] }; message?: string }>(
                '/api/tokens/verify',
                {
                    method: 'POST',
                    body: JSON.stringify({ type, token: code, userId, method }),
                },
                false // requireAuth false for MFA verification
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'MFA code verified successfully'
            );
        } catch (error) {
            return this.handleError<{ verified: boolean; backupCodes?: string[] }>(error);
        }
    }

    async generateMFACodes(
        userId: string,
        method: 'backup' | 'recovery'
    ): Promise<ApiResponse<{ codes: string[]; expiresAt: Date }>> {
        try {
            const response = await this.request<{ data: { codes: string[]; expiresAt: Date }; message?: string }>(
                '/api/v1/auth/mfa/generate-codes',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, method }),
                },

            );

            return createSuccessResponse(
                {
                    ...response.data,
                    expiresAt: new Date(response.data.expiresAt)
                },
                response.message ?? 'MFA codes generated successfully'
            );
        } catch (error) {
            return this.handleError<{ codes: string[]; expiresAt: Date }>(error);
        }
    }

    // ─── Password Operations ──────────────────────────────────────────────────

    async validatePassword(userId: string, password: string): Promise<ApiResponse<{ valid: boolean; message?: string }>> {
        try {
            const response = await this.request<{
                success: boolean;
                message?: string;
                data: { valid: boolean; message?: string };
                timestamp: string;
            }>(
                `/api/users/${userId}/validate-password`,
                {
                    method: 'POST',
                    body: JSON.stringify({ password }),
                },
                false
            );

            return createSuccessResponse(
                response.data,  // ← unwrap one level
                response.message ?? 'Password validated successfully'
            );
        } catch (error) {
            return this.handleError<{ valid: boolean; message?: string }>(error);
        }
    }

    async updatePasswordHistory(userId: string, passwordHash: string): Promise<ApiResponse<{ updated: boolean }>> {
        try {
            const response = await this.request<{ data: { updated: boolean }; message?: string }>(
                '/api/users/password/history',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, passwordHash }),
                },
            );

            return createSuccessResponse(
                { updated: response.data.updated },
                response.message ?? 'Password history updated successfully'
            );
        } catch (error) {
            return this.handleError<{ updated: boolean }>(error);
        }
    }

    // ─── Account Lock Operations ──────────────────────────────────────────────

    async lockUserAccount(userId: string, reason: string, durationMinutes: number = 15): Promise<ApiResponse<{ locked: boolean; unlockAt: Date }>> {
        try {
            const response = await this.request<{ data: { locked: boolean; unlockAt: Date }; message?: string }>(
                `/api/users/${userId}/lock`,
                {
                    method: 'PATCH',
                    body: JSON.stringify({ userId, reason, durationMinutes }),
                },
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    unlockAt: new Date(response.data.unlockAt)
                },
                response.message ?? 'Account locked successfully'
            );
        } catch (error) {
            return this.handleError<{ locked: boolean; unlockAt: Date }>(error);
        }
    }

    async unlockUserAccount(userId: string): Promise<ApiResponse<{ unlocked: boolean }>> {
        try {
            const response = await this.request<{ data: { unlocked: boolean }; message?: string }>(
                '/api/v1/security/account/unlock',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId }),
                },
            );

            return createSuccessResponse(
                { unlocked: response.data.unlocked },
                response.message ?? 'Account unlocked successfully'
            );
        } catch (error) {
            return this.handleError<{ unlocked: boolean }>(error);
        }
    }

    // ─── Location Operations ──────────────────────────────────────────────────

    async detectLocation(ipAddress?: string): Promise<ApiResponse<{
        country: string;
        region: string;
        city: string;
        latitude: number;
        longitude: number;
        timezone: string;
        isp: string;
        proxy?: boolean;
        vpn?: boolean;
        tor?: boolean;
    }>> {
        try {
            const queryParams = ipAddress ? `?ip=${encodeURIComponent(ipAddress)}` : '';
            const response = await this.request<{ data: any; message?: string }>(
                `/api/users/location/detect${queryParams}`,
                {},
                false // requireAuth false for location detection
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Location detected successfully'
            );
        } catch (error) {
            return this.handleError<any>(error);
        }
    }

    async getRequestMetadata(): Promise<ApiResponse<RequestMetadata>> {
        try {
            const response = await this.request<{ data: RequestMetadata; message?: string }>(
                '/api/users/location/detect',
                {},
                false // requireAuth false for metadata
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Metadata retrieved successfully'
            );
        } catch (error) {
            return this.handleError<RequestMetadata>(error);
        }
    }

    // ─── Batch Operations ─────────────────────────────────────────────────────

    async batchUserOperations(
        operations: Array<{
            type: 'create' | 'update' | 'delete';
            data?: any;
            userId?: string;
        }>
    ): Promise<ApiResponse<any>> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                '/api/users/batch',
                {
                    method: 'POST',
                    body: JSON.stringify({ operations }),
                },
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Batch operations completed successfully'
            );
        } catch (error) {
            return this.handleError<any>(error);
        }
    }

    // ─── Search Operations ────────────────────────────────────────────────────

    async searchUsers(
        query: string,
        filters?: {
            role?: string;
            isVerified?: boolean;
            isTwoFactorEnabled?: boolean;
            page?: number;
            limit?: number;
        }
    ): Promise<UsersResponse> {
        try {
            const queryParams = new URLSearchParams({ q: query });
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined) queryParams.append(key, value.toString());
                });
            }

            const response = await this.request<{ data: { users: UserData[]; pagination?: any }; message?: string }>(
                `/api/users/search?${queryParams.toString()}`,
                {},
                true // requireAuth true for search
            );

            return createSuccessResponse(
                {
                    users: response.data.users.map(u => this.transformUser(u)),
                    pagination: response.data.pagination
                },
                response.message ?? 'Users retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{ users: UserData[]; pagination?: any }>(error);
        }
    }

    // ─── Export Operations ────────────────────────────────────────────────────

    async exportUsers(
        options?: {
            format?: 'csv' | 'json';
            fields?: string[];
            includeSensitive?: boolean;
        }
    ): Promise<ApiResponse<{ url: string; expiresAt: string }>> {
        try {
            const queryParams = new URLSearchParams();
            if (options?.format) queryParams.append('format', options.format);
            if (options?.fields) queryParams.append('fields', options.fields.join(','));
            if (options?.includeSensitive) queryParams.append('includeSensitive', 'true');

            const response = await this.request<{ data: { url: string; expiresAt: string }; message?: string }>(
                `/api/users/export?${queryParams.toString()}`,
                {},
                true // requireAuth true for export
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Export initiated successfully'
            );
        } catch (error) {
            return this.handleError<{ url: string; expiresAt: string }>(error);
        }
    }

    // ─── Device Registration Operations ───────────────────────────────────────

    async registerUserDevice(
        userId: string,
        deviceMetadata: DeviceMetadata,
        ipAddress?: string
    ): Promise<ApiResponse<RegisterNewDeviceResponse>> {
        try {
            const response = await this.request<{ data: RegisterNewDeviceResponse; message?: string }>(
                '/api/mfa-device/register',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        userId,
                        metadata: deviceMetadata,
                        ipAddress: ipAddress || 'unknown',
                    }),
                },
                false
            );

            return createSuccessResponse(
                {
                    ...response.data,
                    challenge: {
                        ...response.data.challenge,
                        expiresAt: new Date(response.data.challenge.expiresAt)
                    }
                },
                response.message ?? 'Device registered successfully'
            );
        } catch (error) {
            return this.handleError<RegisterNewDeviceResponse>(error);
        }
    }

    async verifyUserDevice(
        userId: string,
        challengeId: string,
        verificationCode?: string
    ): Promise<ApiResponse<VerifyUserDeviceResponse>> {
        try {
            const response = await this.request<{ data: VerifyUserDeviceResponse; message?: string }>(
                '/api/mfa-device/verify',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        userId,
                        challengeId,
                        code: verificationCode,
                    }),
                },
                false // requireAuth false for device verification
            );

            return createSuccessResponse(
                {
                    result: {
                        ...response.data.result,
                        expiresAt: new Date(response.data.result.expiresAt)
                    }
                },
                response.message ?? 'Device verified successfully'
            );
        } catch (error) {
            return this.handleError<VerifyUserDeviceResponse>(error);
        }
    }

    async validateDeviceToken(
        userId: string,
        deviceId: string,
        deviceToken: string
    ): Promise<ApiResponse<{ isValid: boolean }>> {
        try {
            const response = await this.request<{ data: { isValid: boolean }; message?: string }>(
                '/api/mfa-device/validate',
                {
                    method: 'POST',
                    body: JSON.stringify({
                        userId,
                        deviceId,
                        deviceToken
                    }),
                },

            );

            return createSuccessResponse(
                { isValid: response.data.isValid },
                response.message ?? 'Device token validated successfully'
            );
        } catch (error) {
            return this.handleError<{ isValid: boolean }>(error);
        }
    }

    // ─── Trusted Device Extended Operations ───────────────────────────────────

    async verifyDeviceToken(
        userId: string,
        deviceId: string,
        deviceToken: string
    ): Promise<ApiResponse<{ device: TrustedDeviceWithUser }>> {
        try {
            const response = await this.request<{ data: { device: TrustedDeviceWithUser }; message?: string }>(
                '/api/device/trusted-devices/verify',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, deviceId, deviceToken }),
                },
                false
            );

            return createSuccessResponse(
                { device: this.transformTrustedDevice(response.data.device) },
                response.message ?? 'Device verified successfully'
            );
        } catch (error) {
            return this.handleError<{ device: TrustedDeviceWithUser }>(error);
        }
    }

    async checkDeviceTrust(
        userId: string,
        deviceId: string
    ): Promise<ApiResponse<{ isTrusted: boolean }>> {
        try {
            const response = await this.request<{ data: { isTrusted: boolean }; message?: string }>(
                '/api/device/trusted-devices/check',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, deviceId }),
                },
                false // requireAuth false for trust check
            );

            return createSuccessResponse(
                { isTrusted: response.data.isTrusted },
                response.message ?? 'Device trust checked successfully'
            );
        } catch (error) {
            return this.handleError<{ isTrusted: boolean }>(error);
        }
    }

    async createTrustedDevice(
        userId: string,
        deviceId: string,
        deviceToken: string,
        deviceName: string,
        deviceMetadata?: {
            deviceType?: string;
            os?: string;
            osVersion?: string;
            browser?: string;
            browserVersion?: string;
            ipAddress?: string;
            location?: string;
            verified?: boolean;
            trustScore?: number;
        }
    ): Promise<ApiResponse<{ device: TrustedDeviceWithUser }>> {
        try {
            const response = await this.request<{ data: { device: TrustedDeviceWithUser }; message?: string }>(
                '/api/device/trusted-devices',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, deviceId, deviceToken, deviceName, ...deviceMetadata }),
                },

            );

            return createSuccessResponse(
                { device: this.transformTrustedDevice(response.data.device) },
                response.message ?? 'Trusted device created successfully'
            );
        } catch (error) {
            return this.handleError<{ device: TrustedDeviceWithUser }>(error);
        }
    }

    async updateDevice(
        deviceId: string,
        updates: {
            deviceName?: string;
            deviceType?: string;
            os?: string;
            osVersion?: string;
            browser?: string;
            browserVersion?: string;
            verified?: boolean;
            trustScore?: number;
            lastSeen?: boolean;
            incrementTrustScore?: number;
        }
    ): Promise<ApiResponse<{ device: TrustedDeviceWithUser }>> {
        try {
            const response = await this.request<{ data: { device: TrustedDeviceWithUser }; message?: string }>(
                `/api/device/trusted-devices/${deviceId}`,
                {
                    method: 'PUT',
                    body: JSON.stringify(updates),
                },

            );

            return createSuccessResponse(
                { device: this.transformTrustedDevice(response.data.device) },
                response.message ?? 'Device updated successfully'
            );
        } catch (error) {
            return this.handleError<{ device: TrustedDeviceWithUser }>(error);
        }
    }

    async revokeDevice(
        userId: string,
        deviceId: string,
        reason?: string
    ): Promise<ApiResponse<null>> {
        try {
            const response = await this.request<{ data: null; message?: string }>(
                '/api/device/trusted-devices/revoke',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, deviceId, reason }),
                }
            );

            return createSuccessResponse(
                null,
                response.message ?? 'Device revoked successfully'
            );
        } catch (error) {
            return this.handleError<null>(error);
        }
    }

    async refreshDeviceToken(
        userId: string,
        deviceId: string
    ): Promise<ApiResponse<null>> {
        try {
            const response = await this.request<{ data: null; message?: string }>(
                '/api/device/trusted-devices/refresh',
                {
                    method: 'POST',
                    body: JSON.stringify({ userId, deviceId }),
                },

            );

            return createSuccessResponse(
                null,
                response.message ?? 'Device token refreshed successfully'
            );
        } catch (error) {
            return this.handleError<null>(error);
        }
    }

    async getUserTrustedDevices(
        userId: string,
        options?: {
            page?: number;
            limit?: number;
            verified?: boolean;
            deviceType?: string;
        }
    ): Promise<ApiResponse<{
        devices: TrustedDeviceWithUser[];
        total: number;
        totalPages: number;
    }>> {
        try {
            const queryParams = new URLSearchParams();
            if (options?.page) queryParams.append('page', options.page.toString());
            if (options?.limit) queryParams.append('limit', options.limit.toString());
            if (options?.verified !== undefined) queryParams.append('verified', options.verified.toString());
            if (options?.deviceType) queryParams.append('deviceType', options.deviceType);

            const response = await this.request<{
                data: {
                    devices: TrustedDeviceWithUser[];
                    total: number;
                    totalPages: number;
                }; message?: string
            }>(
                `/api/device/trusted-devices/users/${userId}?${queryParams.toString()}`,
                {},

            );

            return createSuccessResponse(
                {
                    ...response.data,
                    devices: response.data.devices.map(d => this.transformTrustedDevice(d))
                },
                response.message ?? 'Trusted devices retrieved successfully'
            );
        } catch (error) {
            return this.handleError<{
                devices: TrustedDeviceWithUser[];
                total: number;
                totalPages: number;
            }>(error);
        }
    }

    async deleteTrustedDevice(deviceId: string): Promise<ApiResponse<null>> {
        try {
            const response = await this.request<{ data: null; message?: string }>(
                `/api/device/trusted-devices/${deviceId}`,
                {
                    method: 'DELETE',
                },

            );

            return createSuccessResponse(
                null,
                response.message ?? 'Trusted device deleted successfully'
            );
        } catch (error) {
            return this.handleError<null>(error);
        }
    }

    // ─── Rate Limiting ────────────────────────────────────────────────────────

    async checkRateLimit(
        key: string,
        windowMs: number,
        maxAttempts: number
    ): Promise<RateLimitResult> {
        try {
            // This should ideally be handled by your backend with Redis/cache
            // For now, returning a mock that allows requests
            return {
                exceeded: false,
                attempts: 0,
                remainingTime: 0,
                resetAt: new Date(Date.now() + windowMs)
            };
        } catch (error) {
            console.error("Error checking rate limit:", error);
            return {
                exceeded: false,
                attempts: 0,
                remainingTime: 0,
                resetAt: new Date()
            };
        }
    }

    // ─── Helper Functions ─────────────────────────────────────────────────────

    private generateSessionToken(): string {
        return `session_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const userClient = new UserClient();
export default UserClient;