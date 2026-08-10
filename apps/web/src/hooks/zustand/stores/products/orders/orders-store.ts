// store/use-order-socket-store.ts

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import { Order, OrderStatus } from '@/types/products/orders.types';

// ─── Socket Event Types ───────────────────────────────────────────────────────

export interface OrderNotificationPayload {
  type:
    | 'order_placed'
    | 'payment_confirmed'
    | 'processing'
    | 'ready_for_pickup'
    | 'out_for_delivery'
    | 'delivered'
    | 'completed'
    | 'cancelled'
    | 'refund_initiated'
    | 'refund_completed'
    | 'stock_low'
    | 'stock_out'
    | 'payment_failed';
  orderId?:      string;
  orderNumber?:  string;
  message:       string;
  data?:         Record<string, any>;
  timestamp?:    string;
}

export interface DriverNotificationPayload {
  type:
    | 'delivery_assigned'
    | 'delivery_updated'
    | 'delivery_cancelled'
    | 'delivery_started'
    | 'delivery_completed';
  deliveryId:   string;
  orderId:      string;
  orderNumber:  string;
  message:      string;
  data?:        Record<string, any>;
  timestamp?:   string;
}

export interface StaffNotificationPayload {
  type:
    | 'new_order'
    | 'order_cancelled'
    | 'payment_failed'
    | 'refund_requested'
    | 'low_stock_alert';
  orderId?:     string;
  orderNumber?: string;
  message:      string;
  data?:        Record<string, any>;
  timestamp?:   string;
}

export interface InventoryNotificationPayload {
  type:
    | 'stock_updated'
    | 'stock_low'
    | 'stock_out'
    | 'stock_reserved'
    | 'stock_released';
  productId:    string;
  variantId?:   string;
  productName:  string;
  message:      string;
  data?:        Record<string, any>;
  timestamp?:   string;
}

// ─── Store State ──────────────────────────────────────────────────────────────

interface OrderSocketState {
  socket:           Socket | null;
  clientId:         string | null;
  isConnected:      boolean;
  connectionError:  string | null;

  subscribedRooms:  Set<string>;

  notifications:    Array<OrderNotificationPayload | StaffNotificationPayload>;
  unreadCount:      number;

  liveOrders:       Map<string, Partial<Order>>;
  driverAssignments: Map<string, DriverNotificationPayload>;
  inventoryAlerts:  InventoryNotificationPayload[];

  initSocket:         (userId?: string, userType?: 'customer' | 'driver' | 'staff' | 'admin') => Promise<Socket>;
  disconnectSocket:   () => void;
  reconnectSocket:    () => Promise<void>;

  subscribeToUser:    (userId: string) => void;
  subscribeToOrder:   (orderId: string) => void;
  subscribeToDriver:  (driverId: string) => void;
  subscribeToBranch:  (branchId: string) => void;
  subscribeToAdmin:   (room: string) => void;
  unsubscribeFromRoom: (room: string) => void;

  addNotification:            (n: OrderNotificationPayload | StaffNotificationPayload) => void;
  markNotificationAsRead:     (index: number) => void;
  markAllNotificationsAsRead: () => void;
  clearNotifications:         () => void;

  updateLiveOrder:  (orderId: string, updates: Partial<Order>) => void;
  getLiveOrder:     (orderId: string) => Partial<Order> | undefined;
  clearLiveOrders:  () => void;

  setDriverAssignment:   (orderId: string, assignment: DriverNotificationPayload) => void;
  getDriverAssignment:   (orderId: string) => DriverNotificationPayload | undefined;
  clearDriverAssignments: () => void;

  addInventoryAlert:   (alert: InventoryNotificationPayload) => void;
  clearInventoryAlerts: () => void;

  reset: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const generateClientId = () =>
  `order-client-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

const getAuthToken = (): string | null => {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('auth-token');
};

const ORDER_STATUS_MAP = {
  order_placed:       OrderStatus.PENDING_PAYMENT,
  payment_confirmed:  OrderStatus.PAYMENT_CONFIRMED,
  processing:         OrderStatus.PROCESSING,
  ready_for_pickup:   OrderStatus.READY_FOR_PICKUP,
  out_for_delivery:   OrderStatus.OUT_FOR_DELIVERY,
  delivered:          OrderStatus.DELIVERED,
  completed:          OrderStatus.COMPLETED,
  cancelled:          OrderStatus.CANCELLED,
} as const;

type MappableEventType = keyof typeof ORDER_STATUS_MAP;

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOrderSocketStore = create<OrderSocketState>()(
  devtools(
    (set, get) => ({
      socket:           null,
      clientId:         null,
      isConnected:      false,
      connectionError:  null,
      subscribedRooms:  new Set(),
      notifications:    [],
      unreadCount:      0,
      liveOrders:       new Map(),
      driverAssignments: new Map(),
      inventoryAlerts:  [],

      // ── Socket Initialization ──────────────────────────────────────────────

      initSocket: async (userId, userType = 'customer') => {
        // Guard against SSR — socket.io requires a browser environment
        if (typeof window === 'undefined') {
          return Promise.reject(new Error('Socket cannot be initialised on the server'));
        }

        const state = get();

        if (state.socket?.connected) {
          return state.socket;
        }

        if (state.socket) {
          state.socket.removeAllListeners();
          state.socket.disconnect();
        }

        const clientId  = generateClientId();
        const token     = getAuthToken();
        const socketUrl = process.env.NEXT_PUBLIC_WS_URL ?? 'http://localhost:5001';

        const socket = io(socketUrl, {
          auth:                 { token },
          transports:           ['websocket', 'polling'],
          reconnection:         true,
          reconnectionDelay:    1000,
          reconnectionAttempts: 5,
        });

        return new Promise((resolve, reject) => {
          // ── Connection ───────────────────────────────────────────────────
          socket.on('connect', () => {
            console.log('[Order Socket] Connected:', socket.id);

            set({ socket, clientId, isConnected: true, connectionError: null });

            // Auto-subscribe based on user type
            if (userId) {
              if (userType === 'customer')              get().subscribeToUser(userId);
              else if (userType === 'driver')           get().subscribeToDriver(userId);
              else if (userType === 'staff' || userType === 'admin') {
                get().subscribeToAdmin('admin:orders');
              }
            }

            // Resubscribe to all previously subscribed rooms using current
            // state (not stale closure) so rooms added after connect are included
            Array.from(get().subscribedRooms).forEach((room) => {
              socket.emit('subscribe', room);
            });

            resolve(socket);
          });

          // ── Order Updates ─────────────────────────────────────────────────
          socket.on('order:update', (data: OrderNotificationPayload) => {
            const notification: OrderNotificationPayload = {
              ...data,
              timestamp: data.timestamp || new Date().toISOString(),
            };

            // Always add to notification list regardless of event type
            get().addNotification(notification);

            // Update live order cache only for known status-mapping events.
            // Unknown event types (e.g. 'refund_initiated') are still
            // notified above but don't update the status cache.
            if (data.orderId && data.type in ORDER_STATUS_MAP) {
              const status = ORDER_STATUS_MAP[data.type as MappableEventType];
              get().updateLiveOrder(data.orderId, {
                status,
                updatedAt: new Date(),
              });
            }
          });

          // ── Staff Notifications ───────────────────────────────────────────
          socket.on('staff:order', (data: StaffNotificationPayload) => {
            get().addNotification({
              ...data,
              timestamp: data.timestamp || new Date().toISOString(),
            });
          });

          // ── Driver Updates ────────────────────────────────────────────────
          socket.on('delivery:update', (data: DriverNotificationPayload) => {
            const timestamp = data.timestamp || new Date().toISOString();

            // Convert to a compatible notification shape instead of casting to any
            const notification: OrderNotificationPayload = {
              type:        'order_placed', // closest neutral fallback type
              orderId:     data.orderId,
              orderNumber: data.orderNumber,
              message:     data.message,
              data:        data.data,
              timestamp,
            };

            get().addNotification(notification);

            if (data.orderId) {
              get().setDriverAssignment(data.orderId, { ...data, timestamp });
            }
          });

          // ── Inventory Updates ─────────────────────────────────────────────
          socket.on('inventory:update', (data: InventoryNotificationPayload) => {
            const alert: InventoryNotificationPayload = {
              ...data,
              timestamp: data.timestamp || new Date().toISOString(),
            };

            get().addInventoryAlert(alert);

            // Surface stock alerts as notifications for staff
            if (data.type === 'stock_low' || data.type === 'stock_out') {
              get().addNotification({
                type:      data.type,
                message:   data.message,
                data:      data.data,
                timestamp: alert.timestamp,
              });
            }
          });

          // ── System Notifications ──────────────────────────────────────────
          socket.on('system:notification', (data: any) => {
            get().addNotification({
              type:      'order_placed',
              message:   data.message ?? 'System notification',
              data:      data.data,
              timestamp: data.timestamp || new Date().toISOString(),
            });
          });

          // ── Connection Events ─────────────────────────────────────────────
          socket.on('connect_error', (error) => {
            console.error('[Order Socket] Connection error:', error);
            set({ isConnected: false, connectionError: 'Failed to connect to server' });
            reject(error);
          });

          socket.on('disconnect', (reason) => {
            console.log('[Order Socket] Disconnected:', reason);
            set({ isConnected: false });
          });

          socket.on('reconnect', (attemptNumber) => {
            console.log('[Order Socket] Reconnected after', attemptNumber, 'attempts');
            set({ isConnected: true, connectionError: null });
          });

          socket.on('reconnect_failed', () => {
            console.error('[Order Socket] Reconnection failed');
            set({ isConnected: false, connectionError: 'Connection to server lost' });
          });

          // Timeout fallback — clean up the socket so we don't leak listeners
          setTimeout(() => {
            if (!socket.connected) {
              socket.removeAllListeners();
              socket.disconnect();
              reject(new Error('Socket connection timeout'));
            }
          }, 10000);
        });
      },

      reconnectSocket: async () => {
        const { socket } = get();
        if (socket) socket.connect();
        else await get().initSocket();
      },

      disconnectSocket: () => {
        const { socket } = get();
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
          set({
            socket:          null,
            clientId:        null,
            isConnected:     false,
            subscribedRooms: new Set(),
          });
        }
      },

      // ── Room Subscriptions ─────────────────────────────────────────────────

      subscribeToUser: (userId) => {
        const { socket } = get();
        if (!socket?.connected) return;
        const room = `user:${userId}`;
        socket.emit('subscribe', room);
        // Create a new Set to avoid mutating the existing reference
        const next = new Set(get().subscribedRooms);
        next.add(room);
        set({ subscribedRooms: next });
        console.log('[Order Socket] Subscribed to', room);
      },

      subscribeToOrder: (orderId) => {
        const { socket } = get();
        if (!socket?.connected) return;
        const room = `order:${orderId}`;
        socket.emit('subscribe', room);
        const next = new Set(get().subscribedRooms);
        next.add(room);
        set({ subscribedRooms: next });
        console.log('[Order Socket] Subscribed to', room);
      },

      subscribeToDriver: (driverId) => {
        const { socket } = get();
        if (!socket?.connected) return;
        const room = `driver:${driverId}`;
        socket.emit('subscribe', room);
        const next = new Set(get().subscribedRooms);
        next.add(room);
        set({ subscribedRooms: next });
        console.log('[Order Socket] Subscribed to', room);
      },

      subscribeToBranch: (branchId) => {
        const { socket } = get();
        if (!socket?.connected) return;
        const room = `branch:${branchId}`;
        socket.emit('subscribe', room);
        const next = new Set(get().subscribedRooms);
        next.add(room);
        set({ subscribedRooms: next });
        console.log('[Order Socket] Subscribed to', room);
      },

      subscribeToAdmin: (room) => {
        const { socket } = get();
        if (!socket?.connected) return;
        socket.emit('subscribe', room);
        const next = new Set(get().subscribedRooms);
        next.add(room);
        set({ subscribedRooms: next });
        console.log('[Order Socket] Subscribed to', room);
      },

      unsubscribeFromRoom: (room) => {
        const { socket } = get();
        if (socket?.connected) socket.emit('unsubscribe', room);
        const next = new Set(get().subscribedRooms);
        next.delete(room);
        set({ subscribedRooms: next });
        console.log('[Order Socket] Unsubscribed from', room);
      },

      // ── Notifications ──────────────────────────────────────────────────────

      addNotification: (notification) =>
        set((state) => ({
          notifications: [notification, ...state.notifications].slice(0, 50),
          unreadCount:   state.unreadCount + 1,
        })),

      markNotificationAsRead: (_index) =>
        set((state) => ({ unreadCount: Math.max(0, state.unreadCount - 1) })),

      markAllNotificationsAsRead: () =>
        set({ unreadCount: 0 }),

      clearNotifications: () =>
        set({ notifications: [], unreadCount: 0 }),

      // ── Live Order Cache ───────────────────────────────────────────────────

      updateLiveOrder: (orderId, updates) =>
        set((state) => {
          // Copy first — never mutate the existing Map reference
          const next = new Map(state.liveOrders);
          next.set(orderId, { ...(next.get(orderId) ?? {}), ...updates });
          return { liveOrders: next };
        }),

      getLiveOrder: (orderId) => get().liveOrders.get(orderId),

      clearLiveOrders: () => set({ liveOrders: new Map() }),

      // ── Driver Assignments ─────────────────────────────────────────────────

      setDriverAssignment: (orderId, assignment) =>
        set((state) => {
          const next = new Map(state.driverAssignments);
          next.set(orderId, assignment);
          return { driverAssignments: next };
        }),

      getDriverAssignment: (orderId) => get().driverAssignments.get(orderId),

      clearDriverAssignments: () => set({ driverAssignments: new Map() }),

      // ── Inventory Alerts ───────────────────────────────────────────────────

      addInventoryAlert: (alert) =>
        set((state) => ({
          inventoryAlerts: [alert, ...state.inventoryAlerts].slice(0, 20),
        })),

      clearInventoryAlerts: () => set({ inventoryAlerts: [] }),

      // ── Reset ──────────────────────────────────────────────────────────────

      reset: () => {
        const { socket } = get();
        if (socket) {
          socket.removeAllListeners();
          socket.disconnect();
        }
        set({
          socket:            null,
          clientId:          null,
          isConnected:       false,
          connectionError:   null,
          subscribedRooms:   new Set(),
          notifications:     [],
          unreadCount:       0,
          liveOrders:        new Map(),
          driverAssignments: new Map(),
          inventoryAlerts:   [],
        });
      },
    }),
    { name: 'OrderSocketStore' },
  ),
);