// hooks/use-order-socket.ts
import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
// import { useOrderSocketStore } from '@/store/use-order-socket-store';
// import { useOrderUIStore } from '@/store/use-order-ui-store';
// import { orderKeys } from '@/hooks/use-orders';
import type { OrderWithRelations } from '@/types/products/orders.types';
// import type { OrdersResponse } from '@/hooks/use-orders';
import type { Socket } from 'socket.io-client';
import { useOrderSocketStore } from '@/hooks/zustand/stores/products/orders/orders-store';
import { useOrderUIStore } from '@/hooks/zustand/stores/products/orders/use-order-ui-store';
import { orderKeys, OrdersResponse } from './useOrders';

// ─── Types ────────────────────────────────────────────────────────────────────

export type OrderSocketUserType = 'customer' | 'driver' | 'staff' | 'admin';

export interface UseOrderSocketOptions {
  userId:    string | null | undefined;
  userType:  OrderSocketUserType;
  branchId?: string | null;
  orderId?:  string | null;
  enabled?:  boolean;
}

export interface UseOrderSocketReturn {
  isConnected: boolean;
  clientId:    string | null;
  socket:      Socket | null;
}

function isValidId(id: string | null | undefined): id is string {
  return !!id && id !== 'undefined' && id !== 'null';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useOrderSocket({
  userId,
  userType,
  branchId,
  orderId,
  enabled = true,
}: UseOrderSocketOptions): UseOrderSocketReturn {
  const queryClient = useQueryClient();

  const {
    initSocket,
    subscribeToUser,
    subscribeToDriver,
    subscribeToBranch,
    subscribeToAdmin,
    subscribeToOrder,
    unsubscribeFromRoom,
    updateLiveOrder,
    socket,
    isConnected,
    clientId,
  } = useOrderSocketStore();

  const syncUIStore = useOrderUIStore((s) => s.syncOrderFromSocket);

  // Stable refs — keep current values without re-triggering effects
  const userIdRef   = useRef(userId);
  const branchIdRef = useRef(branchId);
  const orderIdRef  = useRef(orderId);
  useEffect(() => { userIdRef.current   = userId;   }, [userId]);
  useEffect(() => { branchIdRef.current = branchId; }, [branchId]);
  useEffect(() => { orderIdRef.current  = orderId;  }, [orderId]);

  // Track which rooms THIS effect instance subscribed to so cleanup is exact
  const subscribedRoomsRef = useRef<Set<string>>(new Set());

  const subscribeOnce = useCallback((
    room: string,
    fn: (r: string) => void
  ) => {
    if (subscribedRoomsRef.current.has(room)) return; // already subscribed
    fn(room);
    subscribedRoomsRef.current.add(room);
  }, []);

  // ── Patch helpers ──────────────────────────────────────────────────────────

  const patchOrderInLists = useCallback(
    (oid: string, updates: Partial<OrderWithRelations>) => {
      queryClient.setQueriesData<OrdersResponse>(
        { queryKey: [...orderKeys.admin()], exact: false },
        (old) => old ? {
          ...old,
          orders: old.orders.map((o) =>
            o.id === oid ? { ...o, ...updates, updatedAt: new Date() } : o
          ),
        } : old
      );
      queryClient.setQueriesData<OrdersResponse>(
        { queryKey: [...orderKeys.lists()], exact: false },
        (old) => old ? {
          ...old,
          orders: old.orders.map((o) =>
            o.id === oid ? { ...o, ...updates, updatedAt: new Date() } : o
          ),
        } : old
      );
    },
    [queryClient]
  );

  // ── Main setup effect ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!enabled || !isValidId(userId)) return;

    let mounted = true;

    const setup = async () => {
      try {
        const sock = await initSocket(userId, userType);
        if (!mounted) return;

        // ── Subscribe rooms (guarded against duplicates) ──────────────────
        if (userType === 'customer') {
          subscribeOnce(`user:${userId}`,   () => subscribeToUser(userId));
        }
        if (userType === 'driver') {
          subscribeOnce(`driver:${userId}`, () => subscribeToDriver(userId));
        }
        if (userType === 'staff' || userType === 'admin') {
          subscribeOnce('admin:orders',    () => subscribeToAdmin('admin:orders'));
          subscribeOnce('admin:inventory', () => subscribeToAdmin('admin:inventory'));
          if (isValidId(branchIdRef.current)) {
            subscribeOnce(`branch:${branchIdRef.current}`, () =>
              subscribeToBranch(branchIdRef.current!)
            );
          }
        }
        if (isValidId(orderIdRef.current)) {
          subscribeOnce(`order:${orderIdRef.current}`, () =>
            subscribeToOrder(orderIdRef.current!)
          );
        }

        // ── Named handlers so cleanup removes ONLY ours ───────────────────

        const onOrderUpdate = (data: any) => {
          if (!mounted) return;
          const oid = data.orderId as string | undefined;
          if (!isValidId(oid)) {
            queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()], exact: false });
            return;
          }

          const statusUpdates: Partial<OrderWithRelations> = {
            updatedAt: new Date(),
            ...(data.type === 'cancelled'          && { status: 'CANCELLED'          as any }),
            ...(data.type === 'processing'         && { status: 'PROCESSING'         as any }),
            ...(data.type === 'out_for_delivery'   && { status: 'OUT_FOR_DELIVERY'   as any }),
            ...(data.type === 'delivered'          && { status: 'DELIVERED'          as any }),
            ...(data.type === 'completed'          && { status: 'COMPLETED'          as any }),
            ...(data.type === 'payment_confirmed'  && { status: 'PAYMENT_CONFIRMED'  as any }),
            ...(data.type === 'ready_for_pickup'   && { status: 'READY_FOR_PICKUP'   as any }),
          };

          queryClient.setQueryData<OrderWithRelations>(
            orderKeys.detail(oid),
            (old) => (old ? { ...old, ...statusUpdates } : old)
          );
          patchOrderInLists(oid, statusUpdates);

          if (statusUpdates.status) {
            updateLiveOrder(oid, statusUpdates);
            syncUIStore(oid, statusUpdates);
          }

          setTimeout(() => {
            if (!mounted) return;
            queryClient.invalidateQueries({ queryKey: orderKeys.detail(oid) });
          }, 800);

          queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()], exact: false });
        };

        const onStaffOrder = (data: any) => {
          if (!mounted) return;
          const oid = data.orderId as string | undefined;

          if (data.type === 'new_order') {
            queryClient.setQueriesData<OrdersResponse>(
              { queryKey: [...orderKeys.admin()], exact: false },
              (old) => old ? {
                ...old,
                pagination: old.pagination
                  ? { ...old.pagination, total: old.pagination.total + 1 }
                  : undefined,
              } : old
            );
          }

          queryClient.invalidateQueries({ queryKey: [...orderKeys.admin()], exact: false });

          if (isValidId(oid)) {
            queryClient.invalidateQueries({ queryKey: orderKeys.detail(oid) });
            if (data.type === 'order_cancelled') {
              patchOrderInLists(oid, { status: 'CANCELLED' as any, updatedAt: new Date() });
              updateLiveOrder(oid, { status: 'CANCELLED' as any, updatedAt: new Date() });
            }
          }

          queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()], exact: false });
        };

        const onDeliveryUpdate = (data: any) => {
          if (!mounted) return;
          const oid = data.orderId as string | undefined;
          if (isValidId(oid)) {
            queryClient.invalidateQueries({ queryKey: orderKeys.detail(oid) });
            queryClient.invalidateQueries({ queryKey: orderKeys.deliveryByOrder(oid) });
            queryClient.invalidateQueries({ queryKey: orderKeys.trackingDetail(oid) });
            if (data.data?.trackingCode) updateLiveOrder(oid, { updatedAt: new Date() });
          }
          queryClient.invalidateQueries({ queryKey: [...orderKeys.admin()], exact: false });
        };

        const onInventoryUpdate = (_data: any) => {
          if (!mounted) return;
          queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()], exact: false });
        };

        sock.on('order:update',    onOrderUpdate);
        sock.on('staff:order',     onStaffOrder);
        sock.on('delivery:update', onDeliveryUpdate);
        sock.on('inventory:update',onInventoryUpdate);

        // Store cleanup fns so the return() can remove exactly these handlers
        return () => {
          sock.off('order:update',    onOrderUpdate);
          sock.off('staff:order',     onStaffOrder);
          sock.off('delivery:update', onDeliveryUpdate);
          sock.off('inventory:update',onInventoryUpdate);
        };
      } catch (error) {
        console.error('[useOrderSocket] Failed to initialize socket:', error);
      }
    };

    // setup() returns a Promise<cleanup | void>; hold the cleanup fn
    let socketCleanup: (() => void) | undefined;
    setup().then((fn) => { socketCleanup = fn; });

    return () => {
      mounted = false;

      // Remove socket event listeners
      socketCleanup?.();

      // Unsubscribe rooms this effect instance joined
      subscribedRoomsRef.current.forEach((room) => unsubscribeFromRoom(room));
      subscribedRoomsRef.current.clear();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, userId, userType]);

  // ── Dynamic branchId subscription ─────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;
    if (userType !== 'staff' && userType !== 'admin') return;
    if (!isValidId(branchId)) return;

    const room = `branch:${branchId}`;
    if (subscribedRoomsRef.current.has(room)) return;

    subscribeToBranch(branchId);
    subscribedRoomsRef.current.add(room);

    return () => {
      unsubscribeFromRoom(room);
      subscribedRoomsRef.current.delete(room);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchId, isConnected, userType]);

  // ── Dynamic orderId subscription ──────────────────────────────────────────
  useEffect(() => {
    if (!isConnected) return;
    if (!isValidId(orderId)) return;

    const room = `order:${orderId}`;
    if (subscribedRoomsRef.current.has(room)) return;

    subscribeToOrder(orderId);
    subscribedRoomsRef.current.add(room);

    return () => {
      unsubscribeFromRoom(room);
      subscribedRoomsRef.current.delete(room);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, isConnected]);

  return { isConnected, clientId, socket };
}

// ─── Convenience wrappers ─────────────────────────────────────────────────────

export function useCustomerOrderSocket(
  userId: string | null | undefined,
  orderId?: string | null
): UseOrderSocketReturn {
  return useOrderSocket({ userId, userType: 'customer', orderId, enabled: isValidId(userId) });
}

export function useAdminOrderSocket(
  userId: string | null | undefined,
  branchId?: string | null
): UseOrderSocketReturn {
  return useOrderSocket({ userId, userType: 'admin', branchId, enabled: isValidId(userId) });
}

export function useDriverOrderSocket(
  driverId: string | null | undefined
): UseOrderSocketReturn {
  return useOrderSocket({ userId: driverId, userType: 'driver', enabled: isValidId(driverId) });
}

export { isValidId };