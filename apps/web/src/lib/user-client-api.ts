import {
    type UserData,
    type CreateUserInput,
    type GetUserOptions,
    type IncrementFailedAttemptsInput,
    type LockAccountInput,
    type SecurityStatusResponse,
    type CheckLockResponse,
    type UserResponse,
    type UsersResponse,
    type RegisterNewDeviceResponse,
    type VerifyUserDeviceResponse,
    type TrustedDeviceWithUser,
    userClient,
} from "@/loginActions/user-actions";
import { type ApiResponse } from "@repo/api-utils";

// ─── Discriminated Result Type ────────────────────────────────────────────────
// Every static method returns this — success branch has data, failure has errors

export type Result<T> =
    | { success: true; data: T }
    | { success: false; message: string; errors: { code: string; message: string }[] };

// ─── Helper ───────────────────────────────────────────────────────────────────

function toResult<T>(response: ApiResponse<T>): Result<T> {
    if (!response.success || response.data == null) {
        return {
            success: false,
            message: response.message ?? "An error occurred",
            errors: response.errors ?? [],
        };
    }
    return { success: true, data: response.data };
}

// ─── UserClient Wrapper ───────────────────────────────────────────────────────

export class UserClient {

    // ── User CRUD ─────────────────────────────────────────────────────────────

    static async getByEmail(
        email: string,
        options?: GetUserOptions
    ): Promise<Result<{ user: UserData }>> {
        const response = await userClient.getUserByEmail(email, options);
        return toResult(response);
    }

    static async getById(
        id: string,
        options?: GetUserOptions
    ): Promise<Result<{ user: UserData }>> {
        const response = await userClient.getUserById(id, options);
        return toResult(response);
    }

    static async getAll(
        options?: Parameters<typeof userClient.getUsers>[0]
    ): Promise<Result<{ users: UserData[]; pagination?: any }>> {
        const response = await userClient.getUsers(options);
        return toResult(response);
    }

    static async create(
        data: CreateUserInput
    ): Promise<Result<{ user: UserData }>> {
        const response = await userClient.createUser(data);
        return toResult(response);
    }

    static async update(
        id: string,
        data: Partial<UserData>
    ): Promise<Result<{ user: UserData }>> {
        const response = await userClient.updateUser(id, data);
        return toResult(response);
    }

    static async changePassword(
        userId: string,
        newPassword: string
    ): Promise<Result<{ user: UserData }>> {
        const response = await userClient.updateUserPassword(userId, { password: newPassword });
        return toResult(response);
    }

    static async verify(
        userId: string,
        email: string,
    ): Promise<Result<{ user: any }>> {
        const response = await userClient.verifyExistingUser(userId, { email });

        console.log("verifyResponse", response)
        return toResult(response);
    }

    static async delete(
        userId: string
    ): Promise<Result<{ deleted: boolean }>> {
        const response = await userClient.deleteUser(userId);
        return toResult(response);
    }

    static async getProfile(
        userId: string
    ): Promise<Result<{ user: any }>> {
        const response = await userClient.getUserProfile(userId);
        return toResult(response);
    }

    static async verifyEmail(
        userId: string
    ): Promise<Result<{ user: UserData }>> {
        const response = await userClient.verifyUserEmail(userId);
        return toResult(response);
    }

    static async search(
        query: string,
        filters?: Parameters<typeof userClient.searchUsers>[1]
    ): Promise<Result<{ users: UserData[]; pagination?: any }>> {
        const response = await userClient.searchUsers(query, filters);
        return toResult(response);
    }

    static async exportData(
        options?: Parameters<typeof userClient.exportUsers>[0]
    ): Promise<Result<{ url: string; expiresAt: string }>> {
        const response = await userClient.exportUsers(options);
        return toResult(response);
    }

    // ── Security ──────────────────────────────────────────────────────────────

    static async incrementFailedAttempts(
        userId: string,
        data?: IncrementFailedAttemptsInput
    ): Promise<Result<{ failedLoginAttempts: number; lastFailedLoginAt: Date; isLocked: boolean }>> {
        const response = await userClient.incrementFailedAttempts(userId, data);
        return toResult(response);
    }

    static async resetFailedAttempts(
        userId: string
    ): Promise<Result<{ failedLoginAttempts: number; lastFailedLoginAt: Date | null }>> {
        const response = await userClient.resetFailedAttempts(userId);
        return toResult(response);
    }

    static async lockAccount(
        userId: string,
        data: LockAccountInput
    ): Promise<Result<{ lockedAt: Date; lockReason: string; unlockedAt: Date | null; isLocked: boolean }>> {
        const response = await userClient.lockAccount(userId, data);
        return toResult(response);
    }

    static async unlockAccount(
        userId: string
    ): Promise<Result<{ lockedAt: Date | null; isLocked: boolean; isActive: boolean }>> {
        const response = await userClient.unlockAccount(userId);
        return toResult(response);
    }

    static async checkAccountLock(
        userId: string
    ): Promise<Result<CheckLockResponse>> {
        const response = await userClient.checkAccountLock(userId);
        return toResult(response);
    }

    static async getAccountSecurityStatus(
        userId: string
    ): Promise<Result<SecurityStatusResponse>> {
        const response = await userClient.getAccountSecurityStatus(userId);
        return toResult(response);
    }

    // ── Devices ───────────────────────────────────────────────────────────────

    static async registerDevice(
        userId: string,
        deviceMetadata: Parameters<typeof userClient.registerUserDevice>[1],
        ipAddress?: string
    ): Promise<Result<RegisterNewDeviceResponse>> {
        const response = await userClient.registerUserDevice(userId, deviceMetadata, ipAddress);
        return toResult(response);
    }

    static async verifyDevice(
        userId: string,
        challengeId: string,
        verificationCode?: string
    ): Promise<Result<VerifyUserDeviceResponse>> {
        const response = await userClient.verifyUserDevice(userId, challengeId, verificationCode);
        return toResult(response);
    }

    static async validateDeviceToken(
        userId: string,
        deviceId: string,
        deviceToken: string
    ): Promise<Result<{ isValid: boolean }>> {
        const response = await userClient.validateDeviceToken(userId, deviceId, deviceToken);
        return toResult(response);
    }

    static async getTrustedDevices(
        userId: string,
        options?: Parameters<typeof userClient.getUserTrustedDevices>[1]
    ): Promise<Result<{ devices: TrustedDeviceWithUser[]; total: number; totalPages: number }>> {
        const response = await userClient.getUserTrustedDevices(userId, options);
        return toResult(response);
    }

    static async checkDeviceTrust(
        userId: string,
        deviceId: string
    ): Promise<Result<{ isTrusted: boolean }>> {
        const response = await userClient.checkDeviceTrust(userId, deviceId);
        return toResult(response);
    }

    static async revokeDevice(
        userId: string,
        deviceId: string,
        reason?: string
    ): Promise<Result<null>> {
        const response = await userClient.revokeDevice(userId, deviceId, reason);
        return toResult(response);
    }

    static async deleteTrustedDevice(
        deviceId: string
    ): Promise<Result<null>> {
        const response = await userClient.deleteTrustedDevice(deviceId);
        return toResult(response);
    }

    // ── Sessions ──────────────────────────────────────────────────────────────

    static async getUserSessions(
        userId: string,
        filters?: Parameters<typeof userClient.getUserSessions>[1]
    ): Promise<Result<{ sessions: any[]; pagination: any }>> {
        const response = await userClient.getUserSessions(userId, filters);
        return toResult(response);
    }

    static async deleteSession(
        sessionId: string
    ): Promise<Result<{ deleted: boolean }>> {
        const response = await userClient.deleteSession(sessionId);
        return toResult(response);
    }

    // ── Audit Logs ────────────────────────────────────────────────────────────

    static async getAuditLogs(
        filters?: Parameters<typeof userClient.getAuditLogs>[0]
    ): Promise<Result<{ logs: any[]; pagination: any }>> {
        const response = await userClient.getAuditLogs(filters);
        return toResult(response);
    }

    // ── MFA ───────────────────────────────────────────────────────────────────

    static async generateMFACodes(
        userId: string,
        method: "backup" | "recovery"
    ): Promise<Result<{ codes: string[]; expiresAt: Date }>> {
        const response = await userClient.generateMFACodes(userId, method);
        return toResult(response);
    }

    // ── Stats ─────────────────────────────────────────────────────────────────

    static async getStats(): Promise<Result<any>> {
        const response = await userClient.getUserStats();
        return toResult(response);
    }
}

// ─── Hook-style Usage Helper ──────────────────────────────────────────────────

export function useUserActions() {
    return {
        // User CRUD
        getUserByEmail: userClient.getUserByEmail.bind(userClient),
        getUserById: userClient.getUserById.bind(userClient),
        getUsers: userClient.getUsers.bind(userClient),
        createUser: userClient.createUser.bind(userClient),
        updateUser: userClient.updateUser.bind(userClient),
        updateUserPassword: userClient.updateUserPassword.bind(userClient),
        verifyExistingUser: userClient.verifyExistingUser.bind(userClient),
        deleteUser: userClient.deleteUser.bind(userClient),
        getUserProfile: userClient.getUserProfile.bind(userClient),
        verifyUserEmail: userClient.verifyUserEmail.bind(userClient),
        searchUsers: userClient.searchUsers.bind(userClient),
        exportUsers: userClient.exportUsers.bind(userClient),
        // Security
        incrementFailedAttempts: userClient.incrementFailedAttempts.bind(userClient),
        resetFailedAttempts: userClient.resetFailedAttempts.bind(userClient),
        lockAccount: userClient.lockAccount.bind(userClient),
        unlockAccount: userClient.unlockAccount.bind(userClient),
        checkAccountLock: userClient.checkAccountLock.bind(userClient),
        getAccountSecurityStatus: userClient.getAccountSecurityStatus.bind(userClient),
        // Devices
        registerUserDevice: userClient.registerUserDevice.bind(userClient),
        verifyUserDevice: userClient.verifyUserDevice.bind(userClient),
        validateDeviceToken: userClient.validateDeviceToken.bind(userClient),
        getUserTrustedDevices: userClient.getUserTrustedDevices.bind(userClient),
        checkDeviceTrust: userClient.checkDeviceTrust.bind(userClient),
        revokeDevice: userClient.revokeDevice.bind(userClient),
        deleteTrustedDevice: userClient.deleteTrustedDevice.bind(userClient),
        // Sessions
        getUserSessions: userClient.getUserSessions.bind(userClient),
        deleteSession: userClient.deleteSession.bind(userClient),
        // Audit logs
        getAuditLogs: userClient.getAuditLogs.bind(userClient),
        // MFA
        generateMFACodes: userClient.generateMFACodes.bind(userClient),
        // Stats
        getUserStats: userClient.getUserStats.bind(userClient),
    };
}