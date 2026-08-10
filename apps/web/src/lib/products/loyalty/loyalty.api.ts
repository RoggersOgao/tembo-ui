// lib/products/loyalty/loyalty.api.ts
import { getToken } from '@/lib/get-token';
import type {
    LoyaltyAccount,
    LoyaltyTransaction,
    LoyaltySummary,
    LoyaltyTier,
} from '@/types/products/loyalty/loyalty.types';
import {
    ApiResponse,
    ErrorCode,
    createSuccessResponse,
    createErrorResponse,
} from '@repo/api-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationInfo {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface TransactionsListData {
    transactions: LoyaltyTransaction[];
    pagination: PaginationInfo;
}

export interface LeaderboardEntry {
    id: string;
    points: number;
    lifetimePoints: number;
    tier: LoyaltyTier;
    user: {
        id: string;
        email: string;
        profile: {
            firstName: string;
            lastName: string;
        };
    };
}

export interface TierBenefits {
    tier: LoyaltyTier;
    benefits: string[];
    discountRate: number;
    multiplier: number;
    pointsToNextTier: number | null;
}

export interface AdminAccountListData {
    accounts: Array<LoyaltyAccount & {
        user: {
            id: string;
            email: string;
            phone: string;
            profile: {
                firstName: string;
                lastName: string;
            };
        };
    }>;
    pagination: PaginationInfo;
}

export interface AddBonusPointsData {
    account: LoyaltyAccount;
    transaction: LoyaltyTransaction;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export type GetMyAccountResponse = ApiResponse<LoyaltyAccount>;
export type GetMySummaryResponse = ApiResponse<LoyaltySummary>;
export type GetTransactionsResponse = ApiResponse<TransactionsListData>;
export type GetLeaderboardResponse = ApiResponse<LeaderboardEntry[]>;
export type GetTierBenefitsResponse = ApiResponse<TierBenefits>;
export type GetAllAccountsResponse = ApiResponse<AdminAccountListData>;
export type AddBonusPointsResponse = ApiResponse<AddBonusPointsData>;
export type AdjustPointsResponse = ApiResponse<AddBonusPointsData>;

// ─── Client ───────────────────────────────────────────────────────────────────

class LoyaltyApiClient {
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    }

    // ── Transformers ────────────────────────────────────────────────────────────

    private transformTransaction(transaction: any): LoyaltyTransaction {
        return {
            ...transaction,
            createdAt: transaction.createdAt ? new Date(transaction.createdAt) : undefined,
        };
    }

    private transformAccount(account: any): LoyaltyAccount {
        return {
            ...account,
            createdAt: account.createdAt ? new Date(account.createdAt) : undefined,
            updatedAt: account.updatedAt ? new Date(account.updatedAt) : undefined,
        };
    }

    private transformSummary(summary: any): LoyaltySummary {
        return {
            ...summary,
        };
    }

    // ── Core request handlers ───────────────────────────────────────────────────

    private async request<T>(
        endpoint: string,
        options: RequestInit = {},
        requireAuth: boolean = true
    ): Promise<T> {
        const token = requireAuth ? await getToken() : null;

        const headers: HeadersInit = {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
            ...options.headers,
        };

        const res = await fetch(`${this.baseURL}${endpoint}`, {
            ...options,
            credentials: requireAuth ? 'include' : undefined,
            headers,
        });

        if (res.status === 401) {
            throw new Error('Unauthorized');
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.error ?? `Request failed with status ${res.status}`);
        }

        return res.json() as Promise<T>;
    }

    private handleError<T>(error: unknown): ApiResponse<T> {
        if (error instanceof Error) {
            if (error.message === 'Unauthorized') {
                return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, 'Unauthorized');
            }
            if (
                error.message.toLowerCase().includes('network') ||
                error.message.includes('fetch')
            ) {
                return createErrorResponse<T>(
                    ErrorCode.SERVICE_UNAVAILABLE,
                    'Network error: Unable to reach the server'
                );
            }
            return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, error.message);
        }
        return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred');
    }

    private buildFilterParams(
        filters: Record<string, any>,
        base = new URLSearchParams()
    ): URLSearchParams {
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                if (value instanceof Date) {
                    base.append(key, value.toISOString());
                } else if (Array.isArray(value)) {
                    value.forEach(v => base.append(key, v));
                } else {
                    base.append(key, value.toString());
                }
            }
        });
        return base;
    }

    // ─── API Methods ────────────────────────────────────────────────────────────

    // =========================================================================
    // USER LOYALTY ROUTES
    // =========================================================================

    /**
     * Get current user's loyalty account
     * GET /api/loyalty/account
     */
    async getMyAccount(): Promise<GetMyAccountResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                '/api/loyalty/account',
                { method: 'GET' }
            );

            return createSuccessResponse(
                this.transformAccount(response.data),
                response.message ?? 'Loyalty account retrieved successfully'
            );
        } catch (error) {
            return this.handleError<LoyaltyAccount>(error);
        }
    }

    /**
     * Get loyalty summary for current user
     * GET /api/loyalty/summary
     */
    async getMySummary(): Promise<GetMySummaryResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                '/api/loyalty/summary',
                { method: 'GET' }
            );

            return createSuccessResponse(
                this.transformSummary(response.data),
                response.message ?? 'Loyalty summary retrieved successfully'
            );
        } catch (error) {
            return this.handleError<LoyaltySummary>(error);
        }
    }

    /**
     * Get transaction history for current user
     * GET /api/loyalty/transactions
     */
    async getMyTransactions(
        page: number = 1,
        limit: number = 20,
        filters?: {
            type?: string;
            startDate?: Date;
            endDate?: Date;
        }
    ): Promise<GetTransactionsResponse> {
        try {
            const params = this.buildFilterParams({
                page,
                limit,
                ...(filters?.type && { type: filters.type }),
                ...(filters?.startDate && { startDate: filters.startDate.toISOString() }),
                ...(filters?.endDate && { endDate: filters.endDate.toISOString() }),
            });

            const response = await this.request<{ data: { transactions: any[]; pagination: PaginationInfo }; message?: string }>(
                `/api/loyalty/transactions?${params.toString()}`,
                { method: 'GET' }
            );

            return createSuccessResponse(
                {
                    transactions: response.data.transactions.map(t => this.transformTransaction(t)),
                    pagination: response.data.pagination,
                },
                response.message ?? 'Transactions retrieved successfully'
            );
        } catch (error) {
            return this.handleError<TransactionsListData>(error);
        }
    }

    /**
     * Get loyalty leaderboard
     * GET /api/loyalty/leaderboard
     */
    async getLeaderboard(limit: number = 10): Promise<GetLeaderboardResponse> {
        try {
            const response = await this.request<{ data: any[]; message?: string }>(
                `/api/loyalty/leaderboard?limit=${limit}`,
                { method: 'GET' }
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Leaderboard retrieved successfully'
            );
        } catch (error) {
            return this.handleError<LeaderboardEntry[]>(error);
        }
    }

    /**
     * Get tier benefits
     * GET /api/loyalty/tiers/:tier
     */
    async getTierBenefits(tier: string): Promise<GetTierBenefitsResponse> {
        try {
            const response = await this.request<{ data: TierBenefits; message?: string }>(
                `/api/loyalty/tiers/${tier}`,
                { method: 'GET' }
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Tier benefits retrieved successfully'
            );
        } catch (error) {
            return this.handleError<TierBenefits>(error);
        }
    }

    // =========================================================================
    // ADMIN LOYALTY MANAGEMENT ROUTES
    // =========================================================================

    /**
     * Get all loyalty accounts (admin only)
     * GET /api/admin/loyalty/accounts
     */
    async getAllAccounts(
        filters?: {
            tier?: string;
            minPoints?: number;
            maxPoints?: number;
            search?: string;
            sortBy?: string;
            sortOrder?: 'asc' | 'desc';
        },
        page: number = 1,
        limit: number = 20
    ): Promise<GetAllAccountsResponse> {
        try {
            const params = this.buildFilterParams({ page, limit, ...filters });

            const response = await this.request<{ data: AdminAccountListData; message?: string }>(
                `/api/admin/loyalty/accounts?${params.toString()}`,
                { method: 'GET' }
            );

            return createSuccessResponse(
                {
                    accounts: response.data.accounts.map(a => ({
                        ...this.transformAccount(a),
                        user: a.user,
                    })),
                    pagination: response.data.pagination,
                },
                response.message ?? 'Loyalty accounts retrieved successfully'
            );
        } catch (error) {
            return this.handleError<AdminAccountListData>(error);
        }
    }

    /**
     * Get account by user ID (admin only)
     * GET /api/admin/loyalty/accounts/:userId
     */
    async getAccountByUserId(userId: string): Promise<GetMyAccountResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/admin/loyalty/accounts/${userId}`,
                { method: 'GET' }
            );

            return createSuccessResponse(
                this.transformAccount(response.data),
                response.message ?? 'Loyalty account retrieved successfully'
            );
        } catch (error) {
            return this.handleError<LoyaltyAccount>(error);
        }
    }

    /**
     * Add bonus points to user (admin only)
     * POST /api/admin/loyalty/accounts/:userId/bonus
     */
    async addBonusPoints(
        userId: string,
        points: number,
        reason: string
    ): Promise<AddBonusPointsResponse> {
        try {
            const response = await this.request<{ data: AddBonusPointsData; message?: string }>(
                `/api/admin/loyalty/accounts/${userId}/bonus`,
                {
                    method: 'POST',
                    body: JSON.stringify({ points, reason }),
                }
            );

            return createSuccessResponse(
                {
                    account: this.transformAccount(response.data.account),
                    transaction: this.transformTransaction(response.data.transaction),
                },
                response.message ?? 'Bonus points added successfully'
            );
        } catch (error) {
            return this.handleError<AddBonusPointsData>(error);
        }
    }

    /**
     * Adjust points for user (admin only)
     * POST /api/admin/loyalty/accounts/:userId/adjust
     */
    async adjustPoints(
        userId: string,
        points: number,
        reason: string
    ): Promise<AdjustPointsResponse> {
        try {
            const response = await this.request<{ data: AddBonusPointsData; message?: string }>(
                `/api/admin/loyalty/accounts/${userId}/adjust`,
                {
                    method: 'POST',
                    body: JSON.stringify({ points, reason }),
                }
            );

            return createSuccessResponse(
                {
                    account: this.transformAccount(response.data.account),
                    transaction: this.transformTransaction(response.data.transaction),
                },
                response.message ?? 'Points adjusted successfully'
            );
        } catch (error) {
            return this.handleError<AddBonusPointsData>(error);
        }
    }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const loyaltyApiClient = new LoyaltyApiClient();
export default LoyaltyApiClient;