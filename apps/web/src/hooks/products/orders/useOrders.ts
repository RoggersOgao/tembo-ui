// hooks/use-orders.ts
import { useQuery, useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import type {
  Order,
  OrderWithRelations,
  CreateOrderFromCartInput,
  OrderFilters,
  OrderStats,
  OrderTracking,
  OrderNote,
  DeliveryAssignment,
  DeliveryTracking,
  Refund,
  RevenueAnalytics,
  ProductPerformance,
  BulkUpdateResult,
  ExportOptions,
} from '@/types/products/orders.types';
import { orderApiClient } from '@/lib/products/orders/orders.api';

// ─── Debounced Invalidation Helper ───────────────────────────────────────────

class DebouncedInvalidation {
  private timeouts: Map<string, NodeJS.Timeout> = new Map();
  
  constructor(private delay: number = 300) {}
  
  invalidate(queryClient: QueryClient, queryKey: unknown[], key: string) {
    const existing = this.timeouts.get(key);
    if (existing) clearTimeout(existing);
    
    const timeout = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey, exact: false });
      this.timeouts.delete(key);
    }, this.delay);
    
    this.timeouts.set(key, timeout);
  }
  
  cancel(key: string) {
    const existing = this.timeouts.get(key);
    if (existing) {
      clearTimeout(existing);
      this.timeouts.delete(key);
    }
  }
}

const debouncedInvalidate = new DebouncedInvalidation(300);

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const orderKeys = {
  all: ['orders'] as const,
  lists: () => [...orderKeys.all, 'list'] as const,
  list: (filters: OrderFilters | undefined, page: number, limit: number) =>
    [...orderKeys.lists(), { filters, page, limit }] as const,
  admin: () => [...orderKeys.all, 'admin'] as const,
  adminList: (filters: OrderFilters | undefined, page: number, limit: number) =>
    [...orderKeys.admin(), { filters, page, limit }] as const,
  details: () => [...orderKeys.all, 'detail'] as const,
  detail: (id: string) => [...orderKeys.details(), id] as const,
  stats: () => [...orderKeys.all, 'stats'] as const,
  tracking: () => [...orderKeys.all, 'tracking'] as const,
  trackingDetail: (id: string) => [...orderKeys.tracking(), id] as const,
  notes: () => [...orderKeys.all, 'notes'] as const,
  notesList: (orderId: string) => [...orderKeys.notes(), orderId] as const,
  analytics: () => [...orderKeys.all, 'analytics'] as const,
  revenue: () => [...orderKeys.analytics(), 'revenue'] as const,
  products: () => [...orderKeys.analytics(), 'products'] as const,
  delivery: () => [...orderKeys.all, 'delivery'] as const,
  deliveryByOrder: (orderId: string) => [...orderKeys.delivery(), orderId] as const,
  deliveryTracking: () => [...orderKeys.all, 'deliveryTracking'] as const,
  deliveryTrackingDetail: (deliveryId: string) => [...orderKeys.deliveryTracking(), deliveryId] as const,
};

// Helper function to invalidate admin orders queries (immediate)
const invalidateAdminOrders = (queryClient: QueryClient) => {
  queryClient.invalidateQueries({ 
    queryKey: [...orderKeys.admin()],
    exact: false 
  });
};

// Helper to update admin list cache optimistically
const updateAdminListCache = (
  queryClient: QueryClient,
  orderId: string,
  updater: (oldOrder: OrderWithRelations) => OrderWithRelations
) => {
  queryClient.setQueriesData<OrdersResponse>(
    { queryKey: [...orderKeys.admin()], exact: false },
    (old) => {
      if (!old) return old;
      return {
        ...old,
        orders: old.orders.map((o) =>
          o.id === orderId ? updater(o) : o
        ),
      };
    }
  );
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PaginationInfo {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrdersResponse {
  orders: OrderWithRelations[];
  pagination: PaginationInfo | undefined;
}

// ─── User Order Hooks ─────────────────────────────────────────────────────────

export interface UseUserOrdersOptions {
  filters?: OrderFilters;
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export const useUserOrders = (options: UseUserOrdersOptions = {}) => {
  const { filters, page = 1, limit = 20, enabled = true } = options;

  return useQuery({
    queryKey: orderKeys.list(filters, page, limit),
    queryFn: async (): Promise<OrdersResponse> => {
      const response = await orderApiClient.getUserOrders(filters, page, limit);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch orders');
      }

      return {
        orders: (response.data?.orders ?? []) as OrderWithRelations[],
        pagination: response.data?.pagination ?? undefined,
      };
    },
    enabled,
    staleTime: 0,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

export const useOrder = (orderId: string | null) => {
  return useQuery({
    queryKey: orderKeys.detail(orderId!),
    queryFn: async (): Promise<OrderWithRelations | null> => {
      const response = await orderApiClient.getOrderById(orderId!);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch order');
      }

      return response.data as OrderWithRelations;
    },
    enabled: !!orderId,
    staleTime: 0,
  });
};

export const useOrderStats = (options?: {
  startDate?: Date;
  endDate?: Date;
  groupBy?: 'day' | 'week' | 'month' | 'year';
  includeDetailed?: boolean;
  enabled?: boolean;
}) => {
  const { startDate, endDate, groupBy, includeDetailed, enabled = true } = options || {};

  return useQuery({
    queryKey: [...orderKeys.stats(), { startDate, endDate, groupBy, includeDetailed }],
    queryFn: async () => {
      const response = await orderApiClient.getOrderStats({
        startDate,
        endDate,
        groupBy,
        includeDetailed,
      });

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch order stats');
      }

      return response.data as OrderStats;
    },
    enabled,
    staleTime: 0,
  });
};

export const useTrackOrder = (orderId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: orderKeys.trackingDetail(orderId!),
    queryFn: async () => {
      const response = await orderApiClient.trackOrder(orderId!);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to track order');
      }

      return response.data as OrderTracking;
    },
    enabled: !!orderId && enabled,
    staleTime: 0,
  });
};

export const useOrderNotes = (orderId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: orderKeys.notesList(orderId!),
    queryFn: async () => {
      const response = await orderApiClient.getOrderNotes(orderId!);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch order notes');
      }

      return response.data as OrderNote[];
    },
    enabled: !!orderId && enabled,
    staleTime: 0,
  });
};

export const useOrderDelivery = (orderId: string | null, enabled: boolean = true) => {
  return useQuery({
    queryKey: orderKeys.deliveryByOrder(orderId!),
    queryFn: async () => {
      const response = await orderApiClient.getOrderDelivery(orderId!);
      if (!response.success) {
        if (
          response.errors?.[0]?.code === 'NOT_FOUND' ||
          response.errors?.[0]?.message?.includes('not found')
        ) {
          return null;
        }
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch order delivery');
      }
      return response.data;
    },
    enabled: !!orderId && enabled,
    staleTime: 0,
    retry: (failureCount, error) => {
      if (error instanceof Error && error.message.includes('not found')) return false;
      return failureCount < 2;
    },
  });
};

// ─── M-Pesa Polling ───────────────────────────────────────────────────────────

export const usePollMpesaStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      checkoutRequestId,
      orderId,
      maxAttempts = 12,
      intervalMs = 5000,
    }: {
      checkoutRequestId: string;
      orderId: string;
      maxAttempts?: number;
      intervalMs?: number;
    }) => {
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise((r) => setTimeout(r, intervalMs));

        const response = await fetch(`/api/orders/mpesa/status/${checkoutRequestId}`);
        const data = await response.json();
        const status = data?.data?.status;

        if (status === 'SUCCESS') return { success: true, orderId };
        if (status === 'FAILED') {
          throw new Error(data?.data?.failReason ?? 'M-Pesa payment failed');
        }
      }
      throw new Error('Payment timed out. Please check your M-Pesa and try again.');
    },

    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: [...orderKeys.lists()] });
      queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()] });
      invalidateAdminOrders(queryClient);
    },
  });
};

// ─── Admin Order Hooks ────────────────────────────────────────────────────────

export interface UseAllOrdersOptions {
  filters?: OrderFilters & {
    paymentStatus?: string;
    deliveryStatus?: string;
    includeDeleted?: boolean;
  };
  page?: number;
  limit?: number;
  enabled?: boolean;
}

export const useAllOrders = (options: UseAllOrdersOptions = {}) => {
  const { filters, page = 1, limit = 20, enabled = true } = options;

  return useQuery({
    queryKey: orderKeys.adminList(filters, page, limit),
    queryFn: async (): Promise<OrdersResponse> => {
      const response = await orderApiClient.getAllOrders(filters, page, limit);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch orders');
      }

      return {
        orders: (response.data?.orders ?? []) as OrderWithRelations[],
        pagination: response.data?.pagination ?? undefined,
      };
    },
    enabled,
    staleTime: 0,
    gcTime: 0, //don't keep old data in memory at all
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

export const useRevenueAnalytics = (
  startDate: Date,
  endDate: Date,
  interval: 'hour' | 'day' | 'week' | 'month' = 'day',
  metrics?: string[],
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [...orderKeys.revenue(), { startDate, endDate, interval, metrics }],
    queryFn: async () => {
      const response = await orderApiClient.getRevenueAnalytics(startDate, endDate, interval, metrics);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch revenue analytics');
      }

      return response.data as RevenueAnalytics;
    },
    enabled,
    staleTime: 0,
  });
};

export const useProductPerformance = (
  startDate: Date,
  endDate: Date,
  limit: number = 20,
  sortBy: 'quantity' | 'totalRevenue' | 'averageOrderValue' = 'totalRevenue',
  enabled: boolean = true
) => {
  return useQuery({
    queryKey: [...orderKeys.products(), { startDate, endDate, limit, sortBy }],
    queryFn: async () => {
      const response = await orderApiClient.getProductPerformance(startDate, endDate, limit, sortBy);

      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch product performance');
      }

      return response.data as ProductPerformance[];
    },
    enabled,
    staleTime: 0,
  });
};

// ─── Mutations with Optimistic Updates ────────────────────────────────────────

export const useCreateOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      input: CreateOrderFromCartInput & {
        paymentMethod: string;
        couponCode?: string;
        giftWrap?: boolean;
        giftMessage?: string;
        loyaltyPointsToRedeem?: number;
      }
    ) => {
      const response = await orderApiClient.createOrderFromCart(input);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to create order');
      }
      return response.data as OrderWithRelations;
    },

    onSuccess: (newOrder) => {
      if (newOrder?.id) {
        // Set individual order cache
        queryClient.setQueryData(orderKeys.detail(newOrder.id), newOrder);
        
        // Optimistically add to admin list cache
        queryClient.setQueriesData<OrdersResponse>(
          { queryKey: [...orderKeys.admin()], exact: false },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              orders: [newOrder, ...old.orders],
              pagination: old.pagination ? {
                ...old.pagination,
                total: old.pagination.total + 1,
              } : undefined,
            };
          }
        );
        
        // Optimistically add to user orders list
        queryClient.setQueriesData<OrdersResponse>(
          { queryKey: [...orderKeys.lists()], exact: false },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              orders: [newOrder, ...old.orders],
              pagination: old.pagination ? {
                ...old.pagination,
                total: old.pagination.total + 1,
              } : undefined,
            };
          }
        );
      }
      
      // Debounced invalidation to ensure consistency without overwhelming the server
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.lists()], 'user-orders');
      queryClient.invalidateQueries({ queryKey: [...orderKeys.admin()], exact: false });
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.stats()], 'stats');
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      status,
      staffNotes,
      notifyCustomer,
      reason,
    }: {
      orderId: string;
      status: string;
      staffNotes?: string;
      notifyCustomer?: boolean;
      reason?: string;
    }) => {
      const response = await orderApiClient.updateOrderStatus(orderId, {
        status,
        staffNotes,
        notifyCustomer,
        reason,
      });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to update order status');
      }
      return response.data as OrderWithRelations;
    },

    onMutate: async ({ orderId, status }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(orderId) });

      const previousOrder = queryClient.getQueryData<OrderWithRelations>(orderKeys.detail(orderId));

      if (previousOrder) {
        // Update detail cache optimistically
        const updatedOrder = {
          ...previousOrder,
          status: status as Order['status'],
          updatedAt: new Date(),
        };
        queryClient.setQueryData(orderKeys.detail(orderId), updatedOrder);
        
        // Update admin list cache optimistically
        updateAdminListCache(queryClient, orderId, () => updatedOrder);
      }

      return { previousOrder };
    },

    onSuccess: (updatedOrder, variables) => {
      queryClient.setQueryData(orderKeys.detail(variables.orderId), updatedOrder);
      updateAdminListCache(queryClient, variables.orderId, () => updatedOrder);
    },

    onError: (_err, variables, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(orderKeys.detail(variables.orderId), context.previousOrder);
      }
      // Force refetch on error to ensure consistency
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
    },

    onSettled: (_data, _err, variables) => {
      // Debounced invalidation for lists and stats
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.lists()], 'user-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.admin()], 'admin-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.stats()], 'stats');
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
    },
  });
};

export const useBulkUpdateOrderStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderIds,
      status,
      notifyCustomers,
    }: {
      orderIds: string[];
      status: string;
      notifyCustomers?: boolean;
    }) => {
      const response = await orderApiClient.bulkUpdateOrderStatus({ orderIds, status, notifyCustomers });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to bulk update order status');
      }
      return response.data;
    },

    onSuccess: (_data, variables) => {
      // Update each order optimistically
      variables.orderIds.forEach((orderId) => {
        const currentOrder = queryClient.getQueryData<OrderWithRelations>(orderKeys.detail(orderId));
        if (currentOrder) {
          const updatedOrder = {
            ...currentOrder,
            status: variables.status as Order['status'],
            updatedAt: new Date(),
          };
          queryClient.setQueryData(orderKeys.detail(orderId), updatedOrder);
          updateAdminListCache(queryClient, orderId, () => updatedOrder);
        }
        queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      });
      
      // Debounced invalidation
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.lists()], 'user-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.admin()], 'admin-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.stats()], 'stats');
    },
  });
};

export const useCancelOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      reason,
      refundPayment,
    }: {
      orderId: string;
      reason?: string;
      refundPayment?: boolean;
    }) => {
      const response = await orderApiClient.cancelOrder(orderId, reason, refundPayment);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to cancel order');
      }
      return response.data as OrderWithRelations;
    },

    onMutate: async ({ orderId }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(orderId) });

      const previousOrder = queryClient.getQueryData<OrderWithRelations>(orderKeys.detail(orderId));

      if (previousOrder) {
        const cancelledOrder = {
          ...previousOrder,
          status: 'CANCELLED' as Order['status'],
          cancelledAt: new Date(),
          updatedAt: new Date(),
        };
        
        queryClient.setQueryData(orderKeys.detail(orderId), cancelledOrder);
        updateAdminListCache(queryClient, orderId, () => cancelledOrder);
      }

      return { previousOrder };
    },

    onSuccess: (updatedOrder, variables) => {
      queryClient.setQueryData(orderKeys.detail(variables.orderId), updatedOrder);
      updateAdminListCache(queryClient, variables.orderId, () => updatedOrder);
    },

    onError: (_err, variables, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(orderKeys.detail(variables.orderId), context.previousOrder);
      }
    },

    onSettled: (_data, _err, variables) => {
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.lists()], 'user-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.admin()], 'admin-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.stats()], 'stats');
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
    },
  });
};

export const useReorder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await orderApiClient.reorder(orderId);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to reorder');
      }
      return response.data as OrderWithRelations;
    },

    onSuccess: (newOrder) => {
      if (newOrder?.id) {
        queryClient.setQueryData(orderKeys.detail(newOrder.id), newOrder);
        
        // Optimistically add to lists
        queryClient.setQueriesData<OrdersResponse>(
          { queryKey: [...orderKeys.lists()], exact: false },
          (old) => {
            if (!old) return old;
            return {
              ...old,
              orders: [newOrder, ...old.orders],
            };
          }
        );
      }
      
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.lists()], 'user-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.admin()], 'admin-orders');
      debouncedInvalidate.invalidate(queryClient, [...orderKeys.stats()], 'stats');
    },
  });
};

export const useApplyCoupon = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ orderId, couponCode }: { orderId: string; couponCode: string }) => {
      const response = await orderApiClient.applyCoupon(orderId, couponCode);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to apply coupon');
      }
      return { data: response.data as OrderWithRelations, orderId };
    },

    onSuccess: ({ data, orderId }) => {
      queryClient.setQueryData(orderKeys.detail(orderId), data);
      updateAdminListCache(queryClient, orderId, () => data);
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
};

export const useRemoveCoupon = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await orderApiClient.removeCoupon(orderId);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to remove coupon');
      }
      return { data: response.data as OrderWithRelations, orderId };
    },

    onSuccess: ({ data, orderId }) => {
      queryClient.setQueryData(orderKeys.detail(orderId), data);
      updateAdminListCache(queryClient, orderId, () => data);
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
    },
  });
};

export const useProcessPayment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      paymentMethod,
      paymentDetails,
    }: {
      orderId: string;
      paymentMethod: string;
      paymentDetails: Record<string, unknown>;
    }) => {
      const response = await orderApiClient.processPayment(orderId, { paymentMethod, paymentDetails });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to process payment');
      }
      return { data: response.data, orderId };
    },

    onSuccess: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()] });
      invalidateAdminOrders(queryClient);
    },
  });
};

export const useAddOrderNote = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      note,
      isInternal,
    }: {
      orderId: string;
      note: string;
      isInternal?: boolean;
    }) => {
      const response = await orderApiClient.addOrderNote(orderId, note, isInternal || false);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to add note');
      }
      return { orderId };
    },

    onSuccess: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.notesList(orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      invalidateAdminOrders(queryClient);
    },
  });
};

// ─── Admin Mutations ──────────────────────────────────────────────────────────

export const useProcessRefund = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      reason,
      refundToOriginalMethod,
    }: {
      orderId: string;
      amount: number;
      reason: string;
      refundToOriginalMethod?: boolean;
    }) => {
      const response = await orderApiClient.processRefund(orderId, { amount, reason, refundToOriginalMethod });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to process refund');
      }
      return { data: response.data, orderId };
    },

    onSuccess: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()] });
      invalidateAdminOrders(queryClient);
    },
  });
};

export const useAssignDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      branchId,
      driverId,
      priority = 'NORMAL',
      estimatedDeliveryTime,
      notes,
    }: {
      orderId: string;
      branchId: string;
      driverId: string;
      priority?: 'NORMAL' | 'EXPRESS';
      estimatedDeliveryTime?: Date;
      notes?: string;
    }) => {
      const response = await orderApiClient.assignDelivery(orderId, {
        driverId,
        branchId,
        priority,
        estimatedDeliveryTime,
        deliveryNotes: notes,
      });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to assign delivery');
      }
      return response.data;
    },

    onMutate: async ({ orderId, driverId, branchId }) => {
      await queryClient.cancelQueries({ queryKey: orderKeys.detail(orderId) });
      await queryClient.cancelQueries({ queryKey: [...orderKeys.admin()] });

      const previousOrder = queryClient.getQueryData<OrderWithRelations>(orderKeys.detail(orderId));
      const previousAdminCache = queryClient.getQueriesData<OrdersResponse>({
        queryKey: [...orderKeys.admin()],
      });

      const optimisticDelivery = {
        id: '__optimistic__',
        driverId,
        branchId,
        status: 'ASSIGNED',
        assignedAt: new Date().toISOString(),
      } as any;

      if (previousOrder) {
        queryClient.setQueryData<OrderWithRelations>(orderKeys.detail(orderId), {
          ...previousOrder,
          delivery: { ...previousOrder.delivery, ...optimisticDelivery },
        });
      }

      queryClient.setQueriesData<OrdersResponse>({ queryKey: [...orderKeys.admin()] }, (old) => {
        if (!old) return old;
        return {
          ...old,
          orders: old.orders.map((o) =>
            o.id !== orderId
              ? o
              : { ...o, delivery: { ...o.delivery, ...optimisticDelivery } }
          ),
        };
      });

      return { previousOrder, previousAdminCache };
    },

    onError: (_err, variables, context) => {
      if (context?.previousOrder) {
        queryClient.setQueryData(orderKeys.detail(variables.orderId), context.previousOrder);
      }
      if (context?.previousAdminCache) {
        context.previousAdminCache.forEach(([queryKey, data]) => {
          queryClient.setQueryData(queryKey, data);
        });
      }
      invalidateAdminOrders(queryClient);
    },

    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.deliveryByOrder(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: orderKeys.trackingDetail(variables.orderId) });
      queryClient.invalidateQueries({ queryKey: ['deliveries'] });
      queryClient.invalidateQueries({ queryKey: ['branch-drivers', 'available', variables.branchId] });
      queryClient.invalidateQueries({ queryKey: ['branch-drivers', 'stats', variables.branchId] });
      invalidateAdminOrders(queryClient);
    },
  });
};

export const useUpdateDeliveryTracking = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deliveryId,
      status,
      location,
      notes,
    }: {
      deliveryId: string;
      status: string;
      location?: string;
      notes?: string;
    }) => {
      const response = await orderApiClient.updateDeliveryTracking(deliveryId, { status, location, notes });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to update delivery tracking');
      }
      return { deliveryId };
    },

    onSuccess: ({ deliveryId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.deliveryTrackingDetail(deliveryId) });
      invalidateAdminOrders(queryClient);
    },
  });
};

export const useApplyManualDiscount = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      orderId,
      amount,
      reason,
      type,
    }: {
      orderId: string;
      amount: number;
      reason: string;
      type: 'FIXED' | 'PERCENTAGE';
    }) => {
      const response = await orderApiClient.applyManualDiscount(orderId, { amount, reason, type });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to apply discount');
      }
      return { data: response.data as OrderWithRelations, orderId };
    },

    onSuccess: ({ data, orderId }) => {
      queryClient.setQueryData(orderKeys.detail(orderId), data);
      updateAdminListCache(queryClient, orderId, () => data);
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      invalidateAdminOrders(queryClient);
    },
  });
};

export const useArchiveOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ olderThanDays, status }: { olderThanDays: number; status?: string }) => {
      const response = await orderApiClient.archiveOrders({ olderThanDays, status });
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to archive orders');
      }
      return response.data;
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [...orderKeys.stats()] });
      invalidateAdminOrders(queryClient);
    },
  });
};

export const useRestoreOrder = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (orderId: string) => {
      const response = await orderApiClient.restoreOrder(orderId);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to restore order');
      }
      return { data: response.data as OrderWithRelations, orderId };
    },

    onSuccess: ({ orderId }) => {
      queryClient.invalidateQueries({ queryKey: orderKeys.detail(orderId) });
      invalidateAdminOrders(queryClient);
    },
  });
};

// ─── Export Hooks ─────────────────────────────────────────────────────────────

export const useExportOrders = () => {
  return useMutation({
    mutationFn: (options: ExportOptions) => orderApiClient.exportOrders(options),
  });
};

export const useDownloadInvoice = () => {
  return useMutation({
    mutationFn: (orderId: string) => orderApiClient.downloadInvoice(orderId),
  });
};

// ─── Combined Admin Dashboard Hook ───────────────────────────────────────────

export const useAdminDashboard = (dateRange: { startDate: Date; endDate: Date }) => {
  const stats = useOrderStats({
    startDate: dateRange.startDate,
    endDate: dateRange.endDate,
    includeDetailed: true,
  });

  const revenue = useRevenueAnalytics(
    dateRange.startDate,
    dateRange.endDate,
    'day',
    ['totalRevenue', 'averageOrderValue', 'totalOrders']
  );

  const topProducts = useProductPerformance(
    dateRange.startDate,
    dateRange.endDate,
    10,
    'totalRevenue'
  );

  const recentOrders = useAllOrders({
    page: 1,
    limit: 10,
    filters: {
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
    },
  });

  return {
    stats,
    revenue,
    topProducts,
    recentOrders,
    isLoading:
      stats.isLoading || revenue.isLoading || topProducts.isLoading || recentOrders.isLoading,
    error: stats.error || revenue.error || topProducts.error || recentOrders.error,
  };
};

// ─── Utility Hooks ───────────────────────────────────────────────────────────

export const useInvalidateOrders = () => {
  const queryClient = useQueryClient();

  return () => {
    queryClient.invalidateQueries({ queryKey: [...orderKeys.all] });
  };
};

export const usePrefetchOrder = () => {
  const queryClient = useQueryClient();

  return (orderId: string) => {
    queryClient.prefetchQuery({
      queryKey: orderKeys.detail(orderId),
      queryFn: async (): Promise<OrderWithRelations> => {
        const response = await orderApiClient.getOrderById(orderId);
        if (!response.success) {
          throw new Error(response.errors?.[0]?.message ?? 'Failed to prefetch order');
        }
        return response.data as OrderWithRelations;
      },
    });
  };
};