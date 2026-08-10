"use server"

// Import from shared api-utils package
import {
    ApiResponse,
    ErrorCode,
    createSuccessResponse,
    createErrorResponse
} from '@repo/api-utils';
import { ApiClient } from '@repo/api-utils/client';

// ==================== Type Definitions ====================

export interface VerificationTokenData {
    id: string;
    email: string;
    token: string;
    expires: Date;
    expiresAt?: Date;
    ipAddress?: string;
    userAgent?: string;
}

export interface CreateVerificationTokenInput {
    email: string;
    userId: string;
    token: string;
    expires: Date;
    ipAddress?: string;
    userAgent?: string;
}

export interface TwoFactorTokenData {
    id: string;
    email: string;
    token: string;
    expires: Date;
}
export interface backupCodeData {
    id: string;
    email: string;
    verified: boolean;
    verifiedAt: Date;
}

export interface CreateTwoFactorTokenInput {
    email: string;
    token: string;
    expires: Date;
}

export interface TwoFactorConfirmationData {
    id: string;
    userId: string;
}

export interface CreateTwoFactorConfirmationInput {
    userId: string;
}

export interface PasswordResetTokenData {
    id: string;
    email: string;
    token: string;
    expires: Date;
    createdAt: Date
}

export interface CreatePasswordResetTokenInput {
    email: string;
    token: string;
    expires: Date;
}

export interface AccountData {
    id: string;
    userId: string;
    type: string;
    provider: string;
    providerAccountId: string;
    refresh_token?: string;
    access_token?: string;
    expires_at?: number;
    token_type?: string;
    scope?: string;
    id_token?: string;
    session_state?: string;
}

// Response types
export type VerificationTokenResponse = ApiResponse<{ token: VerificationTokenData }>;
export type backupCodeResponse = ApiResponse<{ token: backupCodeData }>;
export type VerificationTokensResponse = ApiResponse<{ token: VerificationTokenData[] }>;
export type DeleteVerificationTokenResponse = ApiResponse<{ deletedId: string }>;

export type TwoFactorTokenResponse = ApiResponse<{ token: TwoFactorTokenData }>;
export type TwoFactorConfirmationResponse = ApiResponse<{ confirmation: TwoFactorConfirmationData }>;
export type PasswordResetTokenResponse = ApiResponse<{ token: PasswordResetTokenData }>;
export type AccountResponse = ApiResponse<{ account: AccountData }>;

export type DeleteTwoFactorTokenResponse = ApiResponse<{ deletedId: string }>;
export type DeleteTwoFactorConfirmationResponse = ApiResponse<{ deletedId: string }>;
export type DeletePasswordResetTokenResponse = ApiResponse<{ deletedId: string }>;

// ==================== API Client ====================

const createApiClient = () => {
    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    return new ApiClient({ baseUrl });
};

// ==================== Verification Token Functions ====================

/**
 * Fetches a verification token by token string
 */
export const getVerificationTokenByToken = async (
    token: string
): Promise<VerificationTokenResponse> => {
    try {
        if (!token || typeof token !== "string") {
            return createErrorResponse<{ token: VerificationTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid token parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ token: VerificationTokenData }>(
            '/api/tokens/verification-tokens',
            { token }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: VerificationTokenData }>(
                response.data,
                response.message || 'Verification token retrieved successfully',
                response.metadata
            );
        }

        return response as VerificationTokenResponse;
    } catch (error) {
        console.error("Error fetching verification token by token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: VerificationTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as VerificationTokenResponse;
        }

        return createErrorResponse<{ token: VerificationTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Fetches a verification token by email address
 */
export const getVerificationTokenByEmail = async (
    email: string
): Promise<VerificationTokenResponse> => {
    try {
        if (!email || typeof email !== "string") {
            return createErrorResponse<{ token: VerificationTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid email parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ token: VerificationTokenData }>(
            '/api/tokens/verification-tokens',
            { email }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: VerificationTokenData }>(
                response.data,
                response.message || 'Verification token retrieved successfully',
                response.metadata
            );
        }

        return response as VerificationTokenResponse;
    } catch (error) {
        console.error("Error fetching verification token by email:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: VerificationTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as VerificationTokenResponse;
        }

        return createErrorResponse<{ token: VerificationTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Creates a new verification token
 */
export const createVerificationToken = async (
    data: CreateVerificationTokenInput
): Promise<VerificationTokenResponse> => {
    try {
        if (!data.email || !data.token || !data.expires) {
            return createErrorResponse<{ token: VerificationTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Missing required fields: email, token, and expires are required"
            );
        }

        const api = createApiClient();
        const response = await api.post<{ token: VerificationTokenData }>(
            '/api/tokens/verification-tokens',
            data
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: VerificationTokenData }>(
                response.data,
                response.message || 'Verification token created successfully',
                response.metadata
            );
        }

        return response as VerificationTokenResponse;
    } catch (error) {
        console.error("Error creating verification token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: VerificationTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as VerificationTokenResponse;
        }

        return createErrorResponse<{ token: VerificationTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to create verification token"
        );
    }
};

/**
 * Deletes a verification token by ID
 */
export const deleteVerificationToken = async (
    id: string
): Promise<DeleteVerificationTokenResponse> => {
    try {
        if (!id || typeof id !== "string") {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid token ID parameter"
            );
        }

        const api = createApiClient();
        const response = await api.delete<{ deletedId: string }>(
            `/api/tokens/verification-tokens/${id}`
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ deletedId: string }>(
                response.data,
                response.message || 'Verification token deleted successfully',
                response.metadata
            );
        }

        return response as DeleteVerificationTokenResponse;
    } catch (error) {
        console.error("Error deleting verification token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as DeleteVerificationTokenResponse;
        }

        return createErrorResponse<{ deletedId: string }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to delete verification token"
        );
    }
};

// ==================== Two Factor Token Functions ====================

/**
 * Fetches a two-factor token by token string
 */
export const getTwoFactorTokenByToken = async (
    token: string
): Promise<TwoFactorTokenResponse> => {
    try {
        if (!token || typeof token !== "string") {
            return createErrorResponse<{ token: TwoFactorTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid token parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ token: TwoFactorTokenData }>(
            '/api/tokens/two-factor-tokens',
            { token }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: TwoFactorTokenData }>(
                response.data,
                response.message || 'Two-factor token retrieved successfully',
                response.metadata
            );
        }

        return response as TwoFactorTokenResponse;
    } catch (error) {
        console.error("Error fetching two-factor token by token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: TwoFactorTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as TwoFactorTokenResponse;
        }

        return createErrorResponse<{ token: TwoFactorTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Fetches a two-factor token by email address
 */
export const getTwoFactorTokenByEmail = async (
    email: string
): Promise<TwoFactorTokenResponse> => {
    try {
        if (!email || typeof email !== "string") {
            return createErrorResponse<{ token: TwoFactorTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid email parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ token: TwoFactorTokenData }>(
            '/api/tokens/two-factor-tokens',
            { email }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: TwoFactorTokenData }>(
                response.data,
                response.message || 'Two-factor token retrieved successfully',
                response.metadata
            );
        }

        return response as TwoFactorTokenResponse;
    } catch (error) {
        console.error("Error fetching two-factor token by email:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: TwoFactorTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as TwoFactorTokenResponse;
        }

        return createErrorResponse<{ token: TwoFactorTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Fetches a two-factor token by email address
 */
export const validateBackupCode = async (
    userId: string,
    backupCode: string
): Promise<backupCodeResponse> => {
    try {
        if (!userId || typeof userId !== "string") {
            return createErrorResponse<{ token: backupCodeData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid userId parameter"
            );
        }

        if (!backupCode || typeof backupCode !== "string") {
            return createErrorResponse<{ token: backupCodeData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid backup code parameter"
            );
        }
        const api = createApiClient();
        const response = await api.post<{ token: backupCodeData }>(
            '/api/auth-tokens/verify-backup-code',
            { userId, backupCode }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: backupCodeData }>(
                response.data,
                response.message || 'Backup code verified successfully',
                response.metadata
            );
        }
        return response as backupCodeResponse;
    } catch (error) {
        console.error("Error verifying backup code:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: backupCodeData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }
        if (error && typeof error === 'object' && 'success' in error) {
            return error as backupCodeResponse;
        }

        return createErrorResponse<{ token: backupCodeData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Creates a new two-factor token
 */
export const createTwoFactorToken = async (
    data: CreateTwoFactorTokenInput
): Promise<TwoFactorTokenResponse> => {
    try {
        if (!data.email || !data.token || !data.expires) {
            return createErrorResponse<{ token: TwoFactorTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Missing required fields: email, token, and expires are required"
            );
        }

        const api = createApiClient();
        const response = await api.post<{ token: TwoFactorTokenData }>(
            '/api/tokens/two-factor-tokens',
            data
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: TwoFactorTokenData }>(
                response.data,
                response.message || 'Two-factor token created successfully',
                response.metadata
            );
        }

        return response as TwoFactorTokenResponse;
    } catch (error) {
        console.error("Error creating two-factor token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: TwoFactorTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as TwoFactorTokenResponse;
        }

        return createErrorResponse<{ token: TwoFactorTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to create two-factor token"
        );
    }
};

/**
 * Deletes a two-factor token by ID
 */
export const deleteTwoFactorToken = async (
    id: string
): Promise<DeleteTwoFactorTokenResponse> => {
    try {
        if (!id || typeof id !== "string") {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid token ID parameter"
            );
        }

        const api = createApiClient();
        const response = await api.delete<{ deletedId: string }>(
            `/api/tokens/two-factor-tokens/${id}`
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ deletedId: string }>(
                response.data,
                response.message || 'Two-factor token deleted successfully',
                response.metadata
            );
        }

        return response as DeleteTwoFactorTokenResponse;
    } catch (error) {
        console.error("Error deleting two-factor token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as DeleteTwoFactorTokenResponse;
        }

        return createErrorResponse<{ deletedId: string }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to delete two-factor token"
        );
    }
};

// ==================== Two Factor Confirmation Functions ====================

/**
 * Fetches a two-factor confirmation by user ID
 */
export const getTwoFactorConfirmationByUserId = async (
    userId: string
): Promise<TwoFactorConfirmationResponse> => {
    try {
        if (!userId || typeof userId !== "string") {
            return createErrorResponse<{ confirmation: TwoFactorConfirmationData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid user ID parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ confirmation: TwoFactorConfirmationData }>(
            '/api/tokens/two-factor-confirmation',
            { userId }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ confirmation: TwoFactorConfirmationData }>(
                response.data,
                response.message || 'Two-factor confirmation retrieved successfully',
                response.metadata
            );
        }

        return response as TwoFactorConfirmationResponse;
    } catch (error) {
        console.error("Error fetching two-factor confirmation by user ID:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ confirmation: TwoFactorConfirmationData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as TwoFactorConfirmationResponse;
        }

        return createErrorResponse<{ confirmation: TwoFactorConfirmationData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Creates a new two-factor confirmation
 */
export const createTwoFactorConfirmation = async (
    data: CreateTwoFactorConfirmationInput
): Promise<TwoFactorConfirmationResponse> => {
    try {
        if (!data.userId) {
            return createErrorResponse<{ confirmation: TwoFactorConfirmationData }>(
                ErrorCode.VALIDATION_ERROR,
                "Missing required field: userId is required"
            );
        }

        const api = createApiClient();
        const response = await api.post<{ confirmation: TwoFactorConfirmationData }>(
            '/api/tokens/two-factor-confirmation',
            data
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ confirmation: TwoFactorConfirmationData }>(
                response.data,
                response.message || 'Two-factor confirmation created successfully',
                response.metadata
            );
        }

        return response as TwoFactorConfirmationResponse;
    } catch (error) {
        console.error("Error creating two-factor confirmation:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ confirmation: TwoFactorConfirmationData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as TwoFactorConfirmationResponse;
        }

        return createErrorResponse<{ confirmation: TwoFactorConfirmationData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to create two-factor confirmation"
        );
    }
};

/**
 * Deletes a two-factor confirmation by ID
 */
export const deleteTwoFactorConfirmation = async (
    id: string
): Promise<DeleteTwoFactorConfirmationResponse> => {
    try {
        if (!id || typeof id !== "string") {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid confirmation ID parameter"
            );
        }

        const api = createApiClient();
        const response = await api.delete<{ deletedId: string }>(
            `/api/tokens/two-factor-confirmation/${id}`
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ deletedId: string }>(
                response.data,
                response.message || 'Two-factor confirmation deleted successfully',
                response.metadata
            );
        }

        return response as DeleteTwoFactorConfirmationResponse;
    } catch (error) {
        console.error("Error deleting two-factor confirmation:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as DeleteTwoFactorConfirmationResponse;
        }

        return createErrorResponse<{ deletedId: string }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to delete two-factor confirmation"
        );
    }
};

// ==================== Password Reset Token Functions ====================

/**
 * Fetches a password reset token by email address
 */
export const getPasswordResetTokenByEmail = async (
    email: string
): Promise<PasswordResetTokenResponse> => {
    try {
        if (!email || typeof email !== "string") {
            return createErrorResponse<{ token: PasswordResetTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid email parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ token: PasswordResetTokenData }>(
            '/api/tokens/password-tokens',
            { email }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: PasswordResetTokenData }>(
                response.data,
                response.message || 'Password reset token retrieved successfully',
                response.metadata
            );
        }

        return response as PasswordResetTokenResponse;
    } catch (error) {
        console.error("Error fetching password reset token by email:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: PasswordResetTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as PasswordResetTokenResponse;
        }

        return createErrorResponse<{ token: PasswordResetTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};

/**
 * Creates a new password reset token
 */
export const createPasswordResetToken = async (
    data: CreatePasswordResetTokenInput
): Promise<PasswordResetTokenResponse> => {
    try {
        if (!data.email || !data.token || !data.expires) {
            return createErrorResponse<{ token: PasswordResetTokenData }>(
                ErrorCode.VALIDATION_ERROR,
                "Missing required fields: email, token, and expires are required"
            );
        }

        const api = createApiClient();
        const response = await api.post<{ token: PasswordResetTokenData }>(
            '/api/tokens/password-tokens',
            data
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ token: PasswordResetTokenData }>(
                response.data,
                response.message || 'Password reset token created successfully',
                response.metadata
            );
        }

        return response as PasswordResetTokenResponse;
    } catch (error) {
        console.error("Error creating password reset token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ token: PasswordResetTokenData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as PasswordResetTokenResponse;
        }

        return createErrorResponse<{ token: PasswordResetTokenData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to create password reset token"
        );
    }
};

/**
 * Deletes a password reset token by ID
 */
export const deletePasswordResetToken = async (
    id: string
): Promise<DeletePasswordResetTokenResponse> => {
    try {
        if (!id || typeof id !== "string") {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid token ID parameter"
            );
        }

        const api = createApiClient();
        const response = await api.delete<{ deletedId: string }>(
            `/api/tokens/password-tokens/${id}`
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ deletedId: string }>(
                response.data,
                response.message || 'Password reset token deleted successfully',
                response.metadata
            );
        }

        return response as DeletePasswordResetTokenResponse;
    } catch (error) {
        console.error("Error deleting password reset token:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ deletedId: string }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as DeletePasswordResetTokenResponse;
        }

        return createErrorResponse<{ deletedId: string }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "Failed to delete password reset token"
        );
    }
};

// ==================== Account Functions ====================

/**
 * Fetches an account by user ID
 */
export const getAccountByUserId = async (
    userId: string
): Promise<AccountResponse> => {
    try {
        if (!userId || typeof userId !== "string") {
            return createErrorResponse<{ account: AccountData }>(
                ErrorCode.VALIDATION_ERROR,
                "Invalid user ID parameter"
            );
        }

        const api = createApiClient();
        const response = await api.get<{ account: AccountData }>(
            '/api/account',
            { userId }
        );

        if (response.success && response.data) {
            return createSuccessResponse<{ account: AccountData }>(
                response.data,
                response.message || 'Account retrieved successfully',
                response.metadata
            );
        }

        return response as AccountResponse;
    } catch (error) {
        console.error("Error fetching account by user ID:", error);

        if (error instanceof TypeError && error.message.includes("fetch")) {
            return createErrorResponse<{ account: AccountData }>(
                ErrorCode.SERVICE_UNAVAILABLE,
                "Network error: Unable to reach the server"
            );
        }

        if (error && typeof error === 'object' && 'success' in error) {
            return error as AccountResponse;
        }

        return createErrorResponse<{ account: AccountData }>(
            ErrorCode.INTERNAL_ERROR,
            error instanceof Error ? error.message : "An unexpected error occurred"
        );
    }
};