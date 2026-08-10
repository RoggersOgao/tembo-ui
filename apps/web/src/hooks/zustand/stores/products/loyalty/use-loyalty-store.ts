// hooks/zustand/stores/loyalty/use-loyalty-store.ts

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
    LoyaltyAccount,
    LoyaltyTransaction,
    LoyaltySummary,
    LoyaltyTier,
} from '@/types/products/loyalty/loyalty.types';

interface LoyaltyState {
    // State
    account: LoyaltyAccount | null;
    summary: LoyaltySummary | null;
    recentTransactions: LoyaltyTransaction[];
    isLoading: boolean;
    error: string | null;

    // Actions
    setAccount: (account: LoyaltyAccount | null) => void;
    setSummary: (summary: LoyaltySummary | null) => void;
    setRecentTransactions: (transactions: LoyaltyTransaction[]) => void;
    setLoading: (isLoading: boolean) => void;
    setError: (error: string | null) => void;

    // Computed
    getPointsProgress: () => number;
    getNextTierInfo: () => { nextTier: LoyaltyTier | null; pointsNeeded: number } | null;

    // Reset
    reset: () => void;
}

const initialState = {
    account: null,
    summary: null,
    recentTransactions: [],
    isLoading: false,
    error: null,
};

export const useLoyaltyStore = create<LoyaltyState>()(
    persist(
        (set, get) => ({
            ...initialState,

            setAccount: (account) => set({ account }),
            setSummary: (summary) => set({ summary }),
            setRecentTransactions: (transactions) => set({ recentTransactions: transactions }),
            setLoading: (isLoading) => set({ isLoading }),
            setError: (error) => set({ error }),

            getPointsProgress: () => {
                const { summary } = get();
                if (!summary) return 0;

                const tiers = {
                    BRONZE: { current: 0, next: 1000 },
                    SILVER: { current: 1000, next: 5000 },
                    GOLD: { current: 5000, next: 10000 },
                    PLATINUM: { current: 10000, next: null },
                };

                const currentTier = summary.tier;
                const tierInfo = tiers[currentTier];

                if (!tierInfo.next) return 100;

                const pointsInTier = summary.lifetimePoints - tierInfo.current;
                const tierRange = tierInfo.next - tierInfo.current;

                return (pointsInTier / tierRange) * 100;
            },

            getNextTierInfo: () => {
                const { summary } = get();
                if (!summary) return null;

                const tiers: Record<LoyaltyTier, LoyaltyTier | null> = {
                    BRONZE: 'SILVER',
                    SILVER: 'GOLD',
                    GOLD: 'PLATINUM',
                    PLATINUM: null,
                };

                const nextTier = tiers[summary.tier];
                if (!nextTier) return null;

                const thresholds: Record<LoyaltyTier, number> = {
                    BRONZE: 0,
                    SILVER: 1000,
                    GOLD: 5000,
                    PLATINUM: 10000,
                };

                const pointsNeeded = thresholds[nextTier] - summary.lifetimePoints;

                return { nextTier, pointsNeeded: Math.max(0, pointsNeeded) };
            },

            reset: () => set(initialState),
        }),
        {
            name: 'loyalty-storage',
            partialize: (state) => ({
                account: state.account,
                summary: state.summary,
            }),
        }
    )
);