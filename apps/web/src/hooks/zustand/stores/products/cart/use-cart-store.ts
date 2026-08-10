// stores/use-cart-store.ts
import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import type {
  Cart,
  CartItem,
  CartCoupon,
  CartSummary,
  AddToCartDTO,
  UpdateCartItemDTO,
} from '@/types/products/cart/cart.types';

// ─── Hydration helper (matches category store pattern) ────────────────────────

interface StoreHydration {
  hydrated:     boolean;
  setHydrated:  () => void;
}

// ─── Guest cart item (lighter shape for localStorage) ────────────────────────
// We only persist what we need to reconstruct the cart on the server
// once the user logs in. Full CartItem (with nested product) lives in
// server state (React Query); this is the offline / guest layer only.

export interface GuestCartItem {
  productId:  string;
  variantId:  string | null;
  quantity:   number;
  unitPrice:  number;
  notes:      string | null;
  // Snapshot for display while offline / before server sync
  snapshot: {
    name:          string;
    slug:          string;
    featuredImage: string | null;
    weightUnit:    string;
    
    priceType?:    "FIXED" | "PER_KG";
    minOrderQty?:  number;
  };
}

// ─── State shape ──────────────────────────────────────────────────────────────

interface CartState extends StoreHydration {
  // ── Auth awareness ───────────────────────────────────────────────────────
  isAuthenticated: boolean;

  // ── Server-synced state (populated by useCart hook after API calls) ──────
  cart:            Cart | null;
  items:           CartItem[];
  activeCoupon:    CartCoupon | null;
  summary:         CartSummary | null;

  // ── Guest state (persisted to localStorage when not logged in) ──────────
  guestItems:      GuestCartItem[];

  // ── UI state ─────────────────────────────────────────────────────────────
  isOpen:          boolean;   // cart drawer / sheet open
  loading:         boolean;
  error:           string | null;
  lastSyncedAt:    number;    // timestamp of last successful server sync
  pendingSync:     boolean;   // guest items waiting to be merged on login

  // ── Setters (called by useCart hook after API responses) ─────────────────
  setCart:             (cart: Cart | null)         => void;
  setItems:            (items: CartItem[])         => void;
  setActiveCoupon:     (coupon: CartCoupon | null) => void;
  setSummary:          (summary: CartSummary | null) => void;
  setAuthenticated:    (auth: boolean)             => void;
  setLoading:          (loading: boolean)          => void;
  setError:            (error: string | null)      => void;
  setOpen:             (open: boolean)             => void;
  toggleOpen:          ()                          => void;
  setLastSyncedAt:     (time: number)              => void;
  setPendingSync:      (pending: boolean)          => void;

  // ── Optimistic updates (called immediately; hook confirms with server) ───
  optimisticAddItem:    (item: CartItem)                              => void;
  optimisticRemoveItem: (itemId: string)                             => void;
  optimisticUpdateItem: (itemId: string, patch: Partial<CartItem>)   => void;
  optimisticClearCart:  ()                                           => void;
  optimisticRemoveCoupon: ()                                         => void;

  // ── Guest cart actions (localStorage, no auth required) ──────────────────
  guestAddItem:    (item: GuestCartItem)                                   => void;
  guestRemoveItem: (productId: string, variantId: string | null)           => void;
  guestUpdateQty:  (productId: string, variantId: string | null, qty: number) => void;
  guestClearCart:  ()                                                      => void;

  // ── Merge & sync helpers ──────────────────────────────────────────────────
  // Returns the guest items that need to be POSTed on login, then clears them
  consumeGuestItems: () => GuestCartItem[];
  clearGuestItems:   () => void;

  // ── Derived helpers ───────────────────────────────────────────────────────
  getItemByProduct:    (productId: string, variantId?: string | null) => CartItem | undefined;
  isInCart:            (productId: string, variantId?: string | null) => boolean;
  getGuestItemCount:   () => number;
  getEffectiveItems:   () => CartItem[] | GuestCartItem[];  // whichever is active

  // ── Utilities ─────────────────────────────────────────────────────────────
  reset:           () => void;
  shouldRefetch:   (staleMs?: number) => boolean;
}

// ─── Derived summary helper ───────────────────────────────────────────────────

function computeSummary(items: CartItem[], coupon: CartCoupon | null): CartSummary {
  const subtotal      = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0);
  const totalQuantity = items.reduce((s, i) => s + i.quantity, 0);

  let discountAmount = 0;
  if (coupon) {
    if (coupon.discountType === 'PERCENTAGE') {
      discountAmount = subtotal * (coupon.discountValue / 100);
    } else if (coupon.discountType === 'FIXED_AMOUNT') {
      discountAmount = coupon.discountValue;
    }
    if (coupon.maxDiscount) {
      discountAmount = Math.min(discountAmount, coupon.maxDiscount);
    }
  }

  return {
    itemCount:      items.length,
    totalQuantity,
    subtotal,
    discountAmount,
    deliveryFee:    0,   // resolved server-side at checkout
    total:          Math.max(0, subtotal - discountAmount),
    currency:       'KES',
  };
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  hydrated:        false,
  isAuthenticated: false,
  cart:            null,
  items:           [] as CartItem[],
  activeCoupon:    null,
  summary:         null,
  guestItems:      [] as GuestCartItem[],
  isOpen:          false,
  loading:         false,
  error:           null,
  lastSyncedAt:    0,
  pendingSync:     false,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ── Hydration ────────────────────────────────────────────────────────
        setHydrated: () => set({ hydrated: true }, false, 'setHydrated'),

        // ── Setters ──────────────────────────────────────────────────────────

        setCart: (cart) =>
          set(
            {
              cart,
              items:       cart?.items   ?? [],
              activeCoupon: cart?.coupon ?? null,
              summary:     cart ? computeSummary(cart.items, cart.coupon) : null,
              lastSyncedAt: Date.now(),
            },
            false,
            'setCart',
          ),

        setItems: (items) =>
          set(
            (state) => ({
              items,
              summary: computeSummary(items, state.activeCoupon),
            }),
            false,
            'setItems',
          ),

        setActiveCoupon: (coupon) =>
          set(
            (state) => ({
              activeCoupon: coupon,
              summary: computeSummary(state.items, coupon),
            }),
            false,
            'setActiveCoupon',
          ),

        setSummary:       (summary)  => set({ summary },          false, 'setSummary'),
        setAuthenticated: (auth)     => set({ isAuthenticated: auth }, false, 'setAuthenticated'),
        setLoading:       (loading)  => set({ loading },           false, 'setLoading'),
        setError:         (error)    => set({ error },             false, 'setError'),
        setOpen:          (isOpen)   => set({ isOpen },            false, 'setOpen'),
        toggleOpen:       ()         => set((s) => ({ isOpen: !s.isOpen }), false, 'toggleOpen'),
        setLastSyncedAt:  (time)     => set({ lastSyncedAt: time }, false, 'setLastSyncedAt'),
        setPendingSync:   (pending)  => set({ pendingSync: pending }, false, 'setPendingSync'),

        // ── Optimistic updates ────────────────────────────────────────────────

        optimisticAddItem: (item) =>
          set(
            (state) => {
              const exists = state.items.find((i) => i.id === item.id);
              const updated = exists
                ? state.items.map((i) =>
                    i.id === item.id
                      ? { ...i, quantity: i.quantity + item.quantity }
                      : i,
                  )
                : [...state.items, item];
              return { items: updated, summary: computeSummary(updated, state.activeCoupon) };
            },
            false,
            'optimisticAddItem',
          ),

        optimisticRemoveItem: (itemId) =>
          set(
            (state) => {
              const updated = state.items.filter((i) => i.id !== itemId);
              return { items: updated, summary: computeSummary(updated, state.activeCoupon) };
            },
            false,
            'optimisticRemoveItem',
          ),

        optimisticUpdateItem: (itemId, patch) =>
          set(
            (state) => {
              const updated = state.items.map((i) =>
                i.id === itemId ? { ...i, ...patch } : i,
              );
              return { items: updated, summary: computeSummary(updated, state.activeCoupon) };
            },
            false,
            'optimisticUpdateItem',
          ),

        optimisticClearCart: () =>
          set(
            { items: [], activeCoupon: null, summary: computeSummary([], null) },
            false,
            'optimisticClearCart',
          ),

        optimisticRemoveCoupon: () =>
          set(
            (state) => ({
              activeCoupon: null,
              summary: computeSummary(state.items, null),
            }),
            false,
            'optimisticRemoveCoupon',
          ),

        // ── Guest cart ────────────────────────────────────────────────────────

        guestAddItem: (item) =>
          set(
            (state) => {
              const exists = state.guestItems.find(
                (i) => i.productId === item.productId && i.variantId === item.variantId,
              );
              const updated = exists
                ? state.guestItems.map((i) =>
                    i.productId === item.productId && i.variantId === item.variantId
                      ? { ...i, quantity: i.quantity + item.quantity }
                      : i,
                  )
                : [...state.guestItems, item];
              return { guestItems: updated };
            },
            false,
            'guestAddItem',
          ),

        guestRemoveItem: (productId, variantId) =>
          set(
            (state) => ({
              guestItems: state.guestItems.filter(
                (i) => !(i.productId === productId && i.variantId === variantId),
              ),
            }),
            false,
            'guestRemoveItem',
          ),

        guestUpdateQty: (productId, variantId, qty) =>
          set(
            (state) => ({
              guestItems:
                qty <= 0
                  ? state.guestItems.filter(
                      (i) => !(i.productId === productId && i.variantId === variantId),
                    )
                  : state.guestItems.map((i) =>
                      i.productId === productId && i.variantId === variantId
                        ? { ...i, quantity: qty }
                        : i,
                    ),
            }),
            false,
            'guestUpdateQty',
          ),

        guestClearCart: () => set({ guestItems: [] }, false, 'guestClearCart'),

        // ── Merge helpers ─────────────────────────────────────────────────────

        consumeGuestItems: () => {
          const items = get().guestItems;
          set({ guestItems: [], pendingSync: false }, false, 'consumeGuestItems');
          return items;
        },

        clearGuestItems: () =>
          set({ guestItems: [], pendingSync: false }, false, 'clearGuestItems'),

        // ── Derived helpers ───────────────────────────────────────────────────

        getItemByProduct: (productId, variantId) => {
          const { items } = get();
          return items.find(
            (i) =>
              i.productId === productId &&
              (variantId !== undefined ? i.variantId === variantId : true),
          );
        },

        isInCart: (productId, variantId) => {
          const { items } = get();
          return items.some(
            (i) =>
              i.productId === productId &&
              (variantId !== undefined ? i.variantId === variantId : true),
          );
        },

        getGuestItemCount: () =>
          get().guestItems.reduce((s, i) => s + i.quantity, 0),

        getEffectiveItems: () => {
          const { isAuthenticated, items, guestItems } = get();
          return isAuthenticated ? items : guestItems;
        },

        // ── Utilities ─────────────────────────────────────────────────────────

        shouldRefetch: (staleMs = 60_000) =>
          Date.now() - get().lastSyncedAt > staleMs,

        reset: () =>
          set({ ...initialState, hydrated: true }, false, 'reset'),
      }),

      {
        name: 'kuku-cart',

        // Only persist the guest layer + auth flag to localStorage.
        // Authenticated cart lives in React Query cache / server.
        partialize: (state) => ({
          guestItems:      state.guestItems,
          pendingSync:     state.pendingSync,
          isAuthenticated: state.isAuthenticated,
          hydrated:        state.hydrated,
        }),

        storage: createJSONStorage(() => localStorage),

        onRehydrateStorage: () => (state) => {
          if (state) {
            state.setHydrated();
            // If there are guest items and the user is now logged in,
            // flag them for server merge (useCart hook picks this up)
            if (state.guestItems.length > 0 && state.isAuthenticated) {
              state.setPendingSync(true);
            }
          }
        },
      },
    ),
    { name: 'CartStore' },
  ),
);