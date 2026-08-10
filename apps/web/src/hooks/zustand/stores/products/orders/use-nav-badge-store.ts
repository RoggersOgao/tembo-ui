// store/use-nav-badge-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── Which routes can have badges ────────────────────────────────────────────

export type BadgeRoute =
  | '/orders'
  | '/messages'
  | '/tickets'
  | '/branch/delivery'
  | '/delivery';

export const BADGE_ROUTES: BadgeRoute[] = [
  '/orders',
  '/messages',
  '/tickets',
  '/branch/delivery',
  '/delivery',
];

// ─── State ────────────────────────────────────────────────────────────────────

interface NavBadgeState {
  counts: Record<BadgeRoute, number>;

  /** Increment the count for a route */
  increment: (route: BadgeRoute, by?: number) => void;
  /** Reset count to 0 (called when user navigates to the route) */
  clear: (route: BadgeRoute) => void;
  /** Reset all counts */
  clearAll: () => void;
  /** Get formatted label: '' if 0, '99+' if >99, else the raw number string */
  getLabel: (route: BadgeRoute) => string;
}

const zeroCounts = (): Record<BadgeRoute, number> => ({
  '/orders': 0,
  '/messages': 0,
  '/tickets': 0,
  '/branch/delivery': 0,
  '/delivery': 0,
});

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNavBadgeStore = create<NavBadgeState>()(
  devtools(
    (set, get) => ({
      counts: zeroCounts(),

      increment: (route, by = 1) =>
        set((state) => ({
          counts: {
            ...state.counts,
            [route]: state.counts[route] + by,
          },
        })),

      clear: (route) =>
        set((state) => ({
          counts: { ...state.counts, [route]: 0 },
        })),

      clearAll: () => set({ counts: zeroCounts() }),

      getLabel: (route) => {
        const n = get().counts[route];
        if (n === 0) return '';
        if (n > 99) return '99+';
        return String(n);
      },
    }),
    { name: 'NavBadgeStore' }
  )
);