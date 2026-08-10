// hooks/use-nav-badges.ts
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useOrderSocketStore } from '@/hooks/zustand/stores/products/orders/orders-store';
import { useNavBadgeStore, type BadgeRoute } from '@/hooks/zustand/stores/products/orders/use-nav-badge-store';


// ─── Event → route mapping ────────────────────────────────────────────────────

const ORDER_EVENT_TYPES = new Set([
  'order_placed',
  'payment_confirmed',
  'processing',
  'ready_for_pickup',
  'out_for_delivery',
  'delivered',
  'completed',
  'cancelled',
  'refund_initiated',
  'refund_completed',
  'new_order',
  'order_cancelled',
  'refund_requested',
  'payment_failed',
]);

const DELIVERY_ROUTES: BadgeRoute[] = ['/branch/delivery', '/delivery'];

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useNavBadges() {
  const pathname = usePathname();
  const { increment, clear } = useNavBadgeStore();

  // ── Clear badge when user visits a route ────────────────────────────────
  useEffect(() => {
    const badgeRoute = matchBadgeRoute(pathname);
    if (badgeRoute) clear(badgeRoute);
  }, [pathname, clear]);

  // ── Listen directly on the socket for new events ─────────────────────────
  //
  // Instead of watching the notifications[] array (which has the
  // processedCountRef/trim/stacking bugs), we attach named listeners
  // directly to the socket instance. This runs once per socket connection.
  //
  // We use a stable named handler so the cleanup can remove ONLY our listener
  // without touching other consumers' listeners.

  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);

  useEffect(() => {
    // Handler factories — created once, stable references for cleanup
    const handleOrderUpdate = (data: any) => {
      const type: string = data?.type ?? '';
      if (!ORDER_EVENT_TYPES.has(type)) return;

      const route: BadgeRoute = '/orders';
      if (!isOnRoute(pathnameRef.current, route)) {
        increment(route);
      }
    };

    const handleStaffOrder = (data: any) => {
      const type: string = data?.type ?? '';
      if (!ORDER_EVENT_TYPES.has(type)) return;

      const route: BadgeRoute = '/orders';
      if (!isOnRoute(pathnameRef.current, route)) {
        increment(route);
      }
    };

    const handleDeliveryUpdate = (data: any) => {
      DELIVERY_ROUTES.forEach((route) => {
        if (!isOnRoute(pathnameRef.current, route)) {
          increment(route);
        }
      });
    };

    const handleSystemNotification = (data: any) => {
      const type: string = data?.type ?? '';
      if (type === 'new_message') {
        if (!isOnRoute(pathnameRef.current, '/messages')) increment('/messages');
      }
      if (type === 'new_ticket' || type === 'ticket_updated') {
        if (!isOnRoute(pathnameRef.current, '/tickets')) increment('/tickets');
      }
    };

    // Subscribe to socket store changes to get the socket instance.
    // When the socket connects (or reconnects) we attach our listeners.
    // When it disconnects/changes we remove them and re-attach to the new one.
    let currentSocket: ReturnType<typeof useOrderSocketStore.getState>['socket'] = null;

    const attachListeners = (
      sock: NonNullable<ReturnType<typeof useOrderSocketStore.getState>['socket']>
    ) => {
      sock.on('order:update',         handleOrderUpdate);
      sock.on('staff:order',          handleStaffOrder);
      sock.on('delivery:update',      handleDeliveryUpdate);
      sock.on('system:notification',  handleSystemNotification);
    };

    const detachListeners = (
      sock: NonNullable<ReturnType<typeof useOrderSocketStore.getState>['socket']>
    ) => {
      sock.off('order:update',        handleOrderUpdate);
      sock.off('staff:order',         handleStaffOrder);
      sock.off('delivery:update',     handleDeliveryUpdate);
      sock.off('system:notification', handleSystemNotification);
    };

    // Attach to whichever socket is live right now (if any)
    const initialSocket = useOrderSocketStore.getState().socket;
    if (initialSocket?.connected) {
      currentSocket = initialSocket;
      attachListeners(initialSocket);
    }

    // Watch for socket instance changes (connect / reconnect / disconnect)
    const unsubscribe = useOrderSocketStore.subscribe((state, prev) => {
      const newSocket  = state.socket;
      const prevSocket = prev.socket;

      if (newSocket === prevSocket) return; // socket ref unchanged, skip

      // Remove listeners from the old socket
      if (currentSocket) {
        detachListeners(currentSocket);
        currentSocket = null;
      }

      // Attach listeners to the new socket once it's connected
      if (newSocket?.connected) {
        currentSocket = newSocket;
        attachListeners(newSocket);
      }
    });

    // Also handle the case where the socket connects AFTER this effect runs
    // (initSocket is async — the socket ref may be set before 'connect' fires)
    const handleConnect = () => {
      const sock = useOrderSocketStore.getState().socket;
      if (sock && sock !== currentSocket) {
        if (currentSocket) detachListeners(currentSocket);
        currentSocket = sock;
        attachListeners(sock);
      }
    };

    // Poll once — if the socket is already in the store but not yet 'connected'
    // the 'connect' event on the socket itself will fire handleConnect
    const liveSocket = useOrderSocketStore.getState().socket;
    if (liveSocket && !liveSocket.connected) {
      liveSocket.once('connect', handleConnect);
    }

    return () => {
      unsubscribe();
      if (currentSocket) {
        detachListeners(currentSocket);
        currentSocket = null;
      }
      // Clean up the once() listener if it never fired
      const sock = useOrderSocketStore.getState().socket;
      if (sock) sock.off('connect', handleConnect);
    };
  // This effect must only run once — pathnameRef keeps pathname current
  // without needing it as a dependency.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [increment]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matchBadgeRoute(pathname: string): BadgeRoute | null {
  if (pathname.startsWith('/orders'))          return '/orders';
  if (pathname.startsWith('/messages'))        return '/messages';
  if (pathname.startsWith('/tickets'))         return '/tickets';
  if (pathname.startsWith('/branch/delivery')) return '/branch/delivery';
  if (pathname.startsWith('/delivery'))        return '/delivery';
  return null;
}

function isOnRoute(pathname: string, route: BadgeRoute): boolean {
  return pathname === route || pathname.startsWith(route + '/');
}