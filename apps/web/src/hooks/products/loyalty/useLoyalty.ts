// hooks/products/loyalty/useLoyalty.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import type { LoyaltyTransactionType } from '@/types/products/loyalty/loyalty.types';
import { toast } from 'sonner';
import { loyaltyApiClient } from '@/lib/products/loyalty/loyalty.api';
import { useLoyaltyStore } from '@/hooks/zustand/stores/products/loyalty/use-loyalty-store';
import { useEffect } from 'react';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const loyaltyKeys = {
    all: ['loyalty'] as const,
    account: () => [...loyaltyKeys.all, 'account'] as const,
    summary: () => [...loyaltyKeys.all, 'summary'] as const,
    transactions: () => [...loyaltyKeys.all, 'transactions'] as const,
    transactionsList: (page: number, limit: number, filters?: any) =>
        [...loyaltyKeys.transactions(), { page, limit, filters }] as const,
    leaderboard: () => [...loyaltyKeys.all, 'leaderboard'] as const,
    tierBenefits: (tier: string) => [...loyaltyKeys.all, 'tier', tier] as const,
    admin: () => [...loyaltyKeys.all, 'admin'] as const,
    adminAccounts: () => [...loyaltyKeys.admin(), 'accounts'] as const,
    adminAccountsList: (filters?: any, page?: number, limit?: number) =>
        [...loyaltyKeys.adminAccounts(), { filters, page, limit }] as const,
};

// ─── User Hooks ───────────────────────────────────────────────────────────────

/**
 * Get current user's loyalty account
 */
export const useLoyaltyAccount = (enabled: boolean = true) => {
    const { setAccount, setLoading, setError } = useLoyaltyStore();

    const query = useQuery({
        queryKey: loyaltyKeys.account(),
        queryFn: async () => {
            const response = await loyaltyApiClient.getMyAccount();

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch loyalty account');
            }

            return response.data;
        },
        enabled,
    });

    useEffect(() => {
        setLoading(query.isLoading);
    }, [query.isLoading]);

    useEffect(() => {
        if (query.data) {
            setAccount(query.data);
            setError(null);
        }
    }, [query.data]);

    useEffect(() => {
        if (query.error) {
            setError(query.error.message);
        }
    }, [query.error]);

    return query;
};

export const useLoyaltySummary = (enabled: boolean = true) => {
    const { setSummary, setLoading, setError } = useLoyaltyStore();

    const query = useQuery({
        queryKey: loyaltyKeys.summary(),
        queryFn: async () => {
            const response = await loyaltyApiClient.getMySummary();

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch loyalty summary');
            }

            return response.data;
        },
        enabled,
    });

    useEffect(() => {
        setLoading(query.isLoading);
    }, [query.isLoading]);

    useEffect(() => {
        if (query.data) {
            setSummary(query.data);
            setError(null);
        }
    }, [query.data]);

    useEffect(() => {
        if (query.error) {
            setError(query.error.message);
        }
    }, [query.error]);

    return query;
};

/**
 * Get transaction history
 */
export const useLoyaltyTransactions = (
    page: number = 1,
    limit: number = 20,
    filters?: {
        type?: LoyaltyTransactionType;
        startDate?: Date;
        endDate?: Date;
    },
    enabled: boolean = true
) => {
    return useQuery({
        queryKey: loyaltyKeys.transactionsList(page, limit, filters),
        queryFn: async () => {
            const response = await loyaltyApiClient.getMyTransactions(page, limit, filters);

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch transactions');
            }

            return response.data;
        },
        enabled,
    });
};

/**
 * Get loyalty leaderboard
 */
export const useLoyaltyLeaderboard = (limit: number = 10, enabled: boolean = true) => {
    return useQuery({
        queryKey: loyaltyKeys.leaderboard(),
        queryFn: async () => {
            const response = await loyaltyApiClient.getLeaderboard(limit);

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch leaderboard');
            }

            return response.data;
        },
        enabled,
    });
};

/**
 * Get tier benefits
 */
export const useTierBenefits = (tier: string, enabled: boolean = true) => {
    return useQuery({
        queryKey: loyaltyKeys.tierBenefits(tier),
        queryFn: async () => {
            const response = await loyaltyApiClient.getTierBenefits(tier);

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch tier benefits');
            }

            return response.data;
        },
        enabled: enabled && !!tier,
    });
};

// ─── Admin Hooks ──────────────────────────────────────────────────────────────

/**
 * Get all loyalty accounts (admin only)
 */
export const useAllLoyaltyAccounts = (
    filters?: {
        tier?: string;
        minPoints?: number;
        maxPoints?: number;
        search?: string;
        sortBy?: string;
        sortOrder?: 'asc' | 'desc';
    },
    page: number = 1,
    limit: number = 20,
    enabled: boolean = true
) => {
    return useQuery({
        queryKey: loyaltyKeys.adminAccountsList(filters, page, limit),
        queryFn: async () => {
            const response = await loyaltyApiClient.getAllAccounts(filters, page, limit);

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch loyalty accounts');
            }

            return response.data;
        },
        enabled,
    });
};

/**
 * Get account by user ID (admin only)
 */
export const useLoyaltyAccountByUserId = (userId: string | null, enabled: boolean = true) => {
    return useQuery({
        queryKey: [...loyaltyKeys.adminAccounts(), userId],
        queryFn: async () => {
            if (!userId) throw new Error('User ID is required');
            const response = await loyaltyApiClient.getAccountByUserId(userId);

            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch loyalty account');
            }

            return response.data;
        },
        enabled: enabled && !!userId,
    });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

/**
 * Add bonus points to user (admin only)
 */
export const useAddBonusPoints = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, points, reason }: { userId: string; points: number; reason: string }) =>
            loyaltyApiClient.addBonusPoints(userId, points, reason),

        onSuccess: (response, variables) => {
            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to add bonus points');
            }

            toast.success(`Added ${variables.points} bonus points to user`);

            // Invalidate affected queries
            queryClient.invalidateQueries({ queryKey: loyaltyKeys.adminAccounts() });
            queryClient.invalidateQueries({ queryKey: [...loyaltyKeys.adminAccounts(), variables.userId] });
        },

        onError: (error: Error) => {
            toast.error(error.message || 'Failed to add bonus points');
        },
    });
};

/**
 * Adjust points for user (admin only)
 */
export const useAdjustPoints = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ userId, points, reason }: { userId: string; points: number; reason: string }) =>
            loyaltyApiClient.adjustPoints(userId, points, reason),

        onSuccess: (response, variables) => {
            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to adjust points');
            }

            const action = variables.points > 0 ? 'added' : 'deducted';
            const absPoints = Math.abs(variables.points);
            toast.success(`${action} ${absPoints} points ${variables.points > 0 ? 'to' : 'from'} user`);

            // Invalidate affected queries
            queryClient.invalidateQueries({ queryKey: loyaltyKeys.adminAccounts() });
            queryClient.invalidateQueries({ queryKey: [...loyaltyKeys.adminAccounts(), variables.userId] });
        },

        onError: (error: Error) => {
            toast.error(error.message || 'Failed to adjust points');
        },
    });
};

// ─── Utility Hooks ────────────────────────────────────────────────────────────

/**
 * Hook to refresh loyalty data
 */
export const useRefreshLoyalty = () => {
    const queryClient = useQueryClient();
    const { setAccount, setSummary } = useLoyaltyStore();

    return async () => {
        // Refresh account
        const accountResponse = await loyaltyApiClient.getMyAccount();
        if (accountResponse.success && accountResponse.data) {
            setAccount(accountResponse.data);
        }

        // Refresh summary
        const summaryResponse = await loyaltyApiClient.getMySummary();
        if (summaryResponse.success && summaryResponse.data) {
            setSummary(summaryResponse.data);
        }

        // Invalidate queries
        await queryClient.invalidateQueries({ queryKey: loyaltyKeys.account() });
        await queryClient.invalidateQueries({ queryKey: loyaltyKeys.summary() });
        await queryClient.invalidateQueries({ queryKey: loyaltyKeys.transactions() });
    };
};

/**
 * Hook to get points formatting
 */
export const usePointsFormatter = () => {
    const formatPoints = (points: number, showLabel: boolean = true): string => {
        const formatted = points.toLocaleString();
        return showLabel ? `${formatted} points` : formatted;
    };

    const pointsToCurrency = (points: number): number => {
        return points / 100; // 100 points = 1 KES
    };

    const currencyToPoints = (amount: number): number => {
        return amount * 100;
    };

    return { formatPoints, pointsToCurrency, currencyToPoints };
};

/**
 * Hook to get tier color and badge
 */
export const useTierStyling = () => {
    const getTierColor = (tier: string): string => {
        const colors: Record<string, string> = {
            BRONZE: 'bg-amber-600 text-white',
            SILVER: 'bg-gray-400 text-white',
            GOLD: 'bg-primary text-white',
            PLATINUM: 'bg-purple-600 text-white',
        };
        return colors[tier] ?? 'bg-amber-600 text-white';
    };

    const getTierBadgeVariant = (tier: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        const variants: Record<string, any> = {
            BRONZE: 'secondary',
            SILVER: 'secondary',
            GOLD: 'default',
            PLATINUM: 'default',
        };
        return variants[tier] || 'secondary';
    };

    const getTierIcon = (tier: string): string => {
        const icons: Record<string, string> = {
            BRONZE: '🥉',
            SILVER: '🥈',
            GOLD: '🥇',
            PLATINUM: '💎',
        };
        return icons[tier] || '⭐';
    };

    return { getTierColor, getTierBadgeVariant, getTierIcon };
};