// hooks/use-cart.ts
import { useCallback, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';


import type {
    CartItem,
    AddToCartDTO,
    UpdateCartItemDTO,
    ApplyCouponDTO,
} from '@/types/products/cart/cart.types';
import { GuestCartItem, useCartStore } from '@/hooks/zustand/stores/products/cart/use-cart-store';
import { cartClient } from '@/lib/products/cart/cart.api';

// ── Query key factory ─────────────────────────────────────────────────────────

export const cartKeys = {
    all: ['cart'] as const,
    detail: () => [...cartKeys.all, 'detail'] as const,
};

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useCart(isAuthenticated = false) {
    const queryClient = useQueryClient();

    const {
        // State
        cart,
        items,
        activeCoupon,
        summary,
        guestItems,
        isOpen,
        loading,
        error,
        pendingSync,
        hydrated,

        // Setters
        setCart,
        setAuthenticated,
        setLoading,
        setError,
        setOpen,
        toggleOpen,
        setPendingSync,

        // Optimistic
        optimisticAddItem,
        optimisticRemoveItem,
        optimisticUpdateItem,
        optimisticClearCart,
        optimisticRemoveCoupon,

        // Guest
        guestAddItem,
        guestRemoveItem,
        guestUpdateQty,
        guestClearCart,
        consumeGuestItems,

        // Helpers
        getItemByProduct,
        isInCart,
        getGuestItemCount,
        shouldRefetch,
    } = useCartStore();

    // ─── Sync auth state into store ───────────────────────────────────────────
    useEffect(() => {
        setAuthenticated(isAuthenticated);
    }, [isAuthenticated, setAuthenticated]);

    // ─── Fetch server cart (authenticated users only) ─────────────────────────
    const {
        data: serverCartResponse,
        isLoading: isLoadingCart,
        refetch,
    } = useQuery({
        queryKey: cartKeys.detail(),
        queryFn: () => cartClient.getCart(),
        enabled: isAuthenticated && hydrated,
        staleTime: 60_000,
        select: (res) => (res.success ? res?.data?.cart : null),
    });

    // Push server response into Zustand whenever React Query resolves
    useEffect(() => {
        if (serverCartResponse !== undefined) {
            setCart(serverCartResponse);
        }
    }, [serverCartResponse, setCart]);

    // ─── Guest → server merge on login ───────────────────────────────────────
    // When the user logs in and there are guest items waiting, POST them all
    // then clear the guest cart.
    const mergeMutation = useMutation({
        mutationFn: async (guestBatch: GuestCartItem[]) => {
            await Promise.all(
                guestBatch.map((g) =>
                    cartClient.addToCart({
                        productId: g.productId,
                        variantId: g.variantId,
                        quantity: g.quantity,
                        unitPrice: g.unitPrice,
                        notes: g.notes ?? "",
                    }),
                ),
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onError: (err: Error) => {
            console.error('[useCart] Guest merge failed:', err.message);
            // Re-flag so the user doesn't lose their guest cart items on next load
            setPendingSync(true);
        },
    });

    useEffect(() => {
        if (isAuthenticated && pendingSync && hydrated) {
            const toMerge = consumeGuestItems();
            if (toMerge.length > 0) {
                mergeMutation.mutate(toMerge);
            }
        }
    }, [isAuthenticated, pendingSync, hydrated]); // eslint-disable-line react-hooks/exhaustive-deps

    // ─── Add to cart ──────────────────────────────────────────────────────────
    const addToCartMutation = useMutation({
        mutationFn: (payload: AddToCartDTO) => {
            if (!payload.productId?.trim()) throw new Error('Product ID is required');
            if ((payload.quantity ?? 0) <= 0) throw new Error('Quantity must be greater than 0');
            return cartClient.addToCart({
                ...payload,
                variantId: payload.variantId ?? undefined, 
            });
        },
        onSuccess: (res) => {
            if (res.success && res.data) {
                optimisticAddItem(res.data.item);
            }
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onError: (err: Error) => {
            console.error('[useCart] Error adding to cart:', err.message);
            setError(err.message);
        },
    });

    const addToCart = useCallback(
        async (
            payload: AddToCartDTO,
            guestSnapshot?: GuestCartItem['snapshot'] & { unitPrice: number },
        ) => {
            if (!isAuthenticated) {
                if (!guestSnapshot) {
                    console.warn('[useCart] guestSnapshot required for guest addToCart');
                    return null;
                }
                const { unitPrice, ...snapshot } = guestSnapshot;
                guestAddItem({
                    productId: payload.productId,
                    variantId: payload.variantId ?? null,
                    quantity: payload.quantity,
                    notes: payload.notes ?? null,
                    unitPrice,
                    snapshot,
                });
                setPendingSync(true);
                return null;
            }

            const result = await addToCartMutation.mutateAsync(payload);
            return result.success && result.data ? result.data.item : null;
        },
        [isAuthenticated, addToCartMutation, guestAddItem, setPendingSync],
    );

    // ─── Update cart item ─────────────────────────────────────────────────────
    const updateCartItemMutation = useMutation({
        mutationFn: ({ itemId, payload }: { itemId: string; payload: UpdateCartItemDTO }) => {
            if (!itemId?.trim()) throw new Error('Item ID is required');
            return cartClient.updateCartItem(itemId, payload);
        },
        onMutate: ({ itemId, payload }) => {
            optimisticUpdateItem(itemId, payload as Partial<CartItem>);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onError: (err: Error) => {
            console.error('[useCart] Error updating cart item:', err.message);
            setError(err.message);
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
    });

    const updateCartItem = useCallback(
        async (itemId: string, payload: UpdateCartItemDTO) => {
            if (!isAuthenticated) {
                // For guests, itemId is "productId" or "productId:variantId"
                const parts = itemId.split(':');
                const productId = parts[0];
                const variantId = parts.length > 1 ? parts[1] : null;
                if (payload.quantity !== undefined) {
                    guestUpdateQty(productId as string, variantId as string, payload.quantity);
                }
                return null;
            }
            const result = await updateCartItemMutation.mutateAsync({ itemId, payload });
            return result.success && result.data ? result.data.item : null;
        },
        [isAuthenticated, updateCartItemMutation, guestUpdateQty],
    );

    // ─── Remove cart item ─────────────────────────────────────────────────────
    const removeCartItemMutation = useMutation({
        mutationFn: (itemId: string) => {
            if (!itemId?.trim()) throw new Error('Item ID is required');
            return cartClient.removeCartItem(itemId);
        },
        onMutate: (itemId) => {
            optimisticRemoveItem(itemId);
        },
        onError: (err: Error) => {
            console.error('[useCart] Error removing cart item:', err.message);
            setError(err.message);
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
    });

    const removeCartItem = useCallback(
        async (itemId: string, productId?: string, variantId?: string | null) => {
            if (!isAuthenticated) {
                if (!productId) {
                    console.warn('[useCart] productId required for guest removeCartItem');
                    return;
                }
                guestRemoveItem(productId, variantId ?? null);
                return;
            }
            await removeCartItemMutation.mutateAsync(itemId);
        },
        [isAuthenticated, removeCartItemMutation, guestRemoveItem],
    );

    // ─── Clear cart ───────────────────────────────────────────────────────────
    const clearCartMutation = useMutation({
        mutationFn: () => cartClient.clearCart(),
        onMutate: () => optimisticClearCart(),
        onError: (err: Error) => {
            console.error('[useCart] Error clearing cart:', err.message);
            setError(err.message);
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
    });

    const clearCart = useCallback(async () => {
        if (!isAuthenticated) {
            guestClearCart();
            return;
        }
        await clearCartMutation.mutateAsync();
    }, [isAuthenticated, clearCartMutation, guestClearCart]);

    // ─── Apply coupon ─────────────────────────────────────────────────────────
    const applyCouponMutation = useMutation({
        mutationFn: (payload: ApplyCouponDTO) => {
            if (!payload.code?.trim()) throw new Error('Coupon code is required');
            return cartClient.applyCoupon(payload);
        },
        onSuccess: (res) => {
            if (res.success && res.data) {
                useCartStore.getState().setActiveCoupon(res.data.coupon);
            }
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onError: (err: Error) => {
            console.error('[useCart] Error applying coupon:', err.message);
            setError(err.message);
        },
    });

    const applyCoupon = useCallback(
        async (payload: ApplyCouponDTO) => {
            if (!isAuthenticated) return null;
            const result = await applyCouponMutation.mutateAsync(payload);
            return result.success && result.data ? result.data : null;
        },
        [isAuthenticated, applyCouponMutation],
    );

    // ─── Remove coupon ────────────────────────────────────────────────────────
    const removeCouponMutation = useMutation({
        mutationFn: () => cartClient.removeCoupon(),
        onMutate: () => optimisticRemoveCoupon(),
        onError: (err: Error) => {
            console.error('[useCart] Error removing coupon:', err.message);
            setError(err.message);
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
        onSettled: () => {
            queryClient.invalidateQueries({ queryKey: cartKeys.detail() });
        },
    });

    const removeCoupon = useCallback(async () => {
        if (!isAuthenticated) return;
        await removeCouponMutation.mutateAsync();
    }, [isAuthenticated, removeCouponMutation]);

    // ─── Derived state ────────────────────────────────────────────────────────

    const isSubmitting =
        addToCartMutation.isPending ||
        updateCartItemMutation.isPending ||
        removeCartItemMutation.isPending ||
        clearCartMutation.isPending ||
        applyCouponMutation.isPending ||
        removeCouponMutation.isPending ||
        mergeMutation.isPending;

    const errorMessage: string | null =
        error ??
        addToCartMutation.error?.message ??
        updateCartItemMutation.error?.message ??
        removeCartItemMutation.error?.message ??
        clearCartMutation.error?.message ??
        applyCouponMutation.error?.message ??
        removeCouponMutation.error?.message ??
        null;

    // Unified counts — works for both guest and auth users
    const itemCount = isAuthenticated
        ? (summary?.itemCount ?? 0)
        : getGuestItemCount();

    const totalQuantity = isAuthenticated
        ? (summary?.totalQuantity ?? 0)
        : guestItems.reduce((s, i) => s + i.quantity, 0);

    return {
        // ── State ────────────────────────────────────────────────────────────
        cart,
        items,
        guestItems,
        activeCoupon,
        summary,
        itemCount,
        totalQuantity,
        subtotal: summary?.subtotal ?? 0,
        total: summary?.total ?? 0,
        discountAmount: summary?.discountAmount ?? 0,
        isOpen,
        isLoading: isLoadingCart || loading,
        isSubmitting,
        isMerging: mergeMutation.isPending,
        error: errorMessage,
        hydrated,

        // ── Per-action pending flags ──────────────────────────────────────────
        isAdding: addToCartMutation.isPending,
        isUpdating: updateCartItemMutation.isPending,
        isRemoving: removeCartItemMutation.isPending,
        isClearing: clearCartMutation.isPending,
        isApplyingCoupon: applyCouponMutation.isPending,
        isRemovingCoupon: removeCouponMutation.isPending,

        // ── Actions ───────────────────────────────────────────────────────────
        refetch,
        addToCart,
        updateCartItem,
        removeCartItem,
        clearCart,
        applyCoupon,
        removeCoupon,
        setOpen,
        toggleOpen,
        setError,

        // ── Helpers ───────────────────────────────────────────────────────────
        isInCart,
        getItemByProduct,
        shouldRefetch,
    };
}