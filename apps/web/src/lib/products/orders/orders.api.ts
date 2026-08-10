// lib/orders/order-api.ts
import { getToken } from '@/lib/get-token';
import { Delivery } from '@/types/branch/delivery/delivery-types';
import type {
  Order,
  CreateOrderFromCartInput,
  OrderFilters,
  OrderStats,
  OrderTracking,
  OrderNote,
  DeliveryAssignment,
  DeliveryTracking,
  Refund,
  ExportOptions,
  RevenueAnalytics,
  ProductPerformance,
  BulkUpdateResult,
  PaymentMethod,
} from '@/types/products/orders.types';

import {
  ApiResponse,
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '@repo/api-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaymentResult {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  checkoutRequestId?: string; // ← add this, it's already returned but not typed
  error?: string;
}
export interface OrdersListData {
  orders: Order[];
  pagination?: Pagination;
}

export interface OrderStatsData extends OrderStats {
  timeSeriesData?: Array<{
    period: string;
    count: number;
    revenue: number;
  }>;
  topProducts?: ProductPerformance[];
}

interface ApiErrorData {
  error?: string;
  details?: Array<{ field: string; message: string }>;
}

export interface CreateOrderInput extends CreateOrderFromCartInput {
  paymentMethod: PaymentMethod;
  couponCode?: string;
  giftWrap?: boolean;
  giftMessage?: string;
  loyaltyPointsToRedeem?: number;
}

export interface UpdateOrderStatusInput {
  status: string;
  staffNotes?: string;
  notifyCustomer?: boolean;
  reason?: string;
}

export interface BulkUpdateStatusInput {
  orderIds: string[];
  status: string;
  notifyCustomers?: boolean;
}

export interface ProcessPaymentInput {
  paymentMethod: string;
  paymentDetails: Record<string, any>;
}

export interface RefundInput {
  amount: number;
  reason: string;
  refundToOriginalMethod?: boolean;
}

// In your order-api.ts, update the AssignDeliveryInput interface
export interface AssignDeliveryInput {
  driverId: string;
  branchId: string;
  estimatedDeliveryTime?: Date;
  estimatedDistance?: number;
  estimatedDuration?: number;
  deliveryNotes?: string;
  priority?: 'NORMAL' | 'EXPRESS';
}

export interface UpdateDeliveryTrackingInput {
  status: string;
  location?: string;
  notes?: string;
}

export interface ManualDiscountInput {
  amount: number;
  reason: string;
  type: 'FIXED' | 'PERCENTAGE';
}

export interface ArchiveOrdersInput {
  olderThanDays: number;
  status?: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export type OrdersResponse = ApiResponse<OrdersListData>;
export type OrderDetailResponse = ApiResponse<Order>;
export type OrderStatsResponse = ApiResponse<OrderStatsData>;
export type CancelOrderResponse = ApiResponse<Order>;
export type OrderTrackingResponse = ApiResponse<OrderTracking>;
export type OrderNotesResponse = ApiResponse<OrderNote[]>;
export type OrderNoteResponse = ApiResponse<OrderNote>;
export type DeliveryAssignmentResponse = ApiResponse<DeliveryAssignment>;
export type DeliveryTrackingResponse = ApiResponse<DeliveryTracking>;
export type RefundResponse = ApiResponse<Refund>;
export type RevenueAnalyticsResponse = ApiResponse<RevenueAnalytics>;
export type ProductPerformanceResponse = ApiResponse<ProductPerformance[]>;
export type BulkUpdateResponse = ApiResponse<BulkUpdateResult[]>;
export type ExportResponse = Promise<Blob>;
export type InvoiceResponse = Promise<Blob>;

// ─── Client ───────────────────────────────────────────────────────────────────

class OrderApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  // ── Transformers ────────────────────────────────────────────────────────────

  private transformOrder(order: any): Order {
    return {
      ...order,
      createdAt: order.createdAt ? new Date(order.createdAt) : undefined,
      updatedAt: order.updatedAt ? new Date(order.updatedAt) : undefined,
      confirmedAt: order.confirmedAt ? new Date(order.confirmedAt) : undefined,
      processedAt: order.processedAt ? new Date(order.processedAt) : undefined,
      readyAt: order.readyAt ? new Date(order.readyAt) : undefined,
      deliveredAt: order.deliveredAt ? new Date(order.deliveredAt) : undefined,
      cancelledAt: order.cancelledAt ? new Date(order.cancelledAt) : undefined,
      requestedDeliveryAt: order.requestedDeliveryAt ? new Date(order.requestedDeliveryAt) : undefined,
      estimatedDeliveryAt: order.estimatedDeliveryAt ? new Date(order.estimatedDeliveryAt) : undefined,
    };
  }

  private transformToOrdersListData(data: any): OrdersListData {
    return {
      orders: (data.orders ?? data.data ?? []).map((o: any) => this.transformOrder(o)),
      pagination: data.pagination,
    };
  }

  // ── Core request handlers ───────────────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const token = requireAuth ? await getToken() : null;

    // Normalize headers into a Headers instance
    const headers = new Headers(options.headers);

    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: requireAuth ? 'include' : undefined,
      headers,
    });

    if (res.status === 401) {
      throw new Error('Unauthorized');
    }

    if (!res.ok) {
      const errorData: ApiErrorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error ?? `Request failed with status ${res.status}`);
    }

    // Safely check Accept header (case-insensitive)
    const accept = headers.get('accept');

    if (options.method === 'GET' && accept?.includes('application/pdf')) {
      return res as unknown as T;
    }

    return res.json() as Promise<T>;
  }

  private async requestBlob(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<Blob> {
    const token = await getToken();

    const headers: HeadersInit = {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: 'include',
      headers,
    });

    if (!res.ok) {
      const errorData: ApiErrorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error ?? `Request failed with status ${res.status}`);
    }

    return res.blob();
  }

  // ── Error handler ───────────────────────────────────────────────────────────

  private handleError<T>(error: unknown): ApiResponse<T> {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, 'Unauthorized');
      }
      if (error.message.includes('Authorization token is missing')) {
        return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, error.message);
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildFilterParams(
    filters: Record<string, any> = {},
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
  // USER ORDER ROUTES
  // =========================================================================

  /**
   * Get the current user's orders (paginated)
   * GET /api/orders
   */
  async getUserOrders(
    filters?: OrderFilters,
    page: number = 1,
    limit: number = 20
  ): Promise<OrdersResponse> {
    try {
      const params = this.buildFilterParams((filters ?? {}) as Record<string, any>);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await this.request<{
        data: { orders: any[]; pagination: Pagination };
        message?: string;
      }>(`/api/orders?${params.toString()}`, { method: 'GET' });

      console.log("api response", response)
      return createSuccessResponse(
        this.transformToOrdersListData({
          orders: response.data.orders,
          pagination: response.data.pagination,
        }),
        response.message ?? 'Orders retrieved successfully'
      );
    } catch (error) {
      return this.handleError<OrdersListData>(error);
    }
  }

  /**
   * Get order statistics for current user
   * GET /api/orders/stats
   */
  async getOrderStats(options?: {
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'day' | 'week' | 'month' | 'year';
    includeDetailed?: boolean;
  }): Promise<OrderStatsResponse> {
    try {
      const params = new URLSearchParams();
      if (options?.startDate) params.append('startDate', options.startDate.toISOString());
      if (options?.endDate) params.append('endDate', options.endDate.toISOString());
      if (options?.groupBy) params.append('groupBy', options.groupBy);
      if (options?.includeDetailed) params.append('includeDetailed', 'true');

      const response = await this.request<{ data: OrderStatsData; message?: string }>(
        `/api/orders/stats?${params.toString()}`,
        { method: 'GET' }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Order statistics retrieved successfully'
      );
    } catch (error) {
      return this.handleError<OrderStatsData>(error);
    }
  }

  /**
   * Get a single order by ID
   * GET /api/orders/:orderId
   */
  async getOrderById(orderId: string): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/${orderId}`,
        { method: 'GET' }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Order retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Track order status
   * GET /api/orders/:orderId/track
   */
  async trackOrder(orderId: string): Promise<OrderTrackingResponse> {
    try {
      const response = await this.request<{ data: OrderTracking; message?: string }>(
        `/api/orders/${orderId}/track`,
        { method: 'GET' }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Order tracking retrieved successfully'
      );
    } catch (error) {
      return this.handleError<OrderTracking>(error);
    }
  }

  /**
   * Generate order invoice
   * GET /api/orders/:orderId/invoice
   */
  async generateInvoice(orderId: string): Promise<InvoiceResponse> {
    try {
      const blob = await this.requestBlob(`/api/orders/${orderId}/invoice`, {
        method: 'GET',
        headers: {
          Accept: 'application/pdf',
        },
      });
      return blob;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Get order notes
   * GET /api/orders/:orderId/notes
   */
  async getOrderNotes(orderId: string): Promise<OrderNotesResponse> {
    try {
      const response = await this.request<{ data: OrderNote[]; message?: string }>(
        `/api/orders/${orderId}/notes`,
        { method: 'GET' }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Notes retrieved successfully'
      );
    } catch (error) {
      return this.handleError<OrderNote[]>(error);
    }
  }

// Add to your OrderApiClient class in orders.api.ts

async getOrderDelivery(orderId: string): Promise<ApiResponse<Delivery>> {
  try {
    const response = await this.request<{ data: Delivery; message?: string }>(
      `/api/orders/${orderId}/delivery`,
      { method: 'GET' },
      true
    );
    
    return createSuccessResponse(
      response.data,
      response.message ?? 'Delivery retrieved successfully'
    );
  } catch (error) {
    // Handle 404 gracefully (no delivery yet)
    if (error instanceof Error && error.message.includes('404')) {
      return createSuccessResponse(null as any, 'No delivery assigned');
    }
    return this.handleError<Delivery>(error);
  }
}

  
  /**
   * Create an order from the current cart
   * POST /api/orders
   */
  async createOrderFromCart(input: CreateOrderInput): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/orders',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Order created successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Cancel an order
   * POST /api/orders/:orderId/cancel
   */
  async cancelOrder(orderId: string, reason?: string, refundPayment?: boolean): Promise<CancelOrderResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/${orderId}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason, refundPayment }),
        }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Order cancelled successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Reorder from existing order
   * POST /api/orders/:orderId/reorder
   */
  async reorder(orderId: string): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/${orderId}/reorder`,
        { method: 'POST' }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Order recreated successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Apply coupon to order
   * POST /api/orders/:orderId/coupon
   */
  async applyCoupon(orderId: string, couponCode: string): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/${orderId}/coupon`,
        {
          method: 'POST',
          body: JSON.stringify({ couponCode }),
        }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Coupon applied successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Remove coupon from order
   * DELETE /api/orders/:orderId/coupon
   */
  async removeCoupon(orderId: string): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/${orderId}/coupon`,
        { method: 'DELETE' }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Coupon removed successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Process payment for order
   * POST /api/orders/:orderId/payment
   */
  async processPayment(orderId: string, input: ProcessPaymentInput): Promise<ApiResponse<PaymentResult>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/${orderId}/payment`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Payment processed successfully'
      );
    } catch (error) {
      return this.handleError<any>(error);
    }
  }

  /**
   * Add note to order
   * POST /api/orders/:orderId/notes
   */
  async addOrderNote(orderId: string, note: string, isInternal: boolean = false): Promise<OrderNoteResponse> {
    try {
      const response = await this.request<{ data: OrderNote; message?: string }>(
        `/api/orders/${orderId}/notes`,
        {
          method: 'POST',
          body: JSON.stringify({ note, isInternal }),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Note added successfully'
      );
    } catch (error) {
      return this.handleError<OrderNote>(error);
    }
  }

  // =========================================================================
  // ADMIN ORDER MANAGEMENT ROUTES
  // =========================================================================

  /**
   * Get all orders — admin / manager view
   * GET /api/admin/orders
   */
  async getAllOrders(
    filters?: OrderFilters & {
      paymentStatus?: string;
      deliveryStatus?: string;
      includeDeleted?: boolean;
    },
    page: number = 1,
    limit: number = 20
  ): Promise<OrdersResponse> {
    try {
      const params = this.buildFilterParams(filters as Record<string, any>);
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await this.request<{
        data: { orders: any[]; pagination: Pagination };
        message?: string;
      }>(`/api/orders/admin/orders?${params.toString()}`, { method: 'GET' });

      return createSuccessResponse(
        this.transformToOrdersListData({
          orders: response.data.orders,
          pagination: response.data.pagination,
        }),
        response.message ?? 'Orders retrieved successfully'
      );
    } catch (error) {
      return this.handleError<OrdersListData>(error);
    }
  }

  /**
   * Update an order's status — admin / manager / staff
   * PATCH /api/admin/orders/:orderId/status
   */
  async updateOrderStatus(
    orderId: string,
    input: UpdateOrderStatusInput
  ): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/admin/orders/${orderId}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Order status updated successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Bulk update order statuses
   * PATCH /api/admin/orders/bulk/status
   */
  async bulkUpdateOrderStatus(input: BulkUpdateStatusInput): Promise<BulkUpdateResponse> {
    try {
      const response = await this.request<{ data: BulkUpdateResult[]; message?: string }>(
        '/api/orders/admin/orders/bulk/status',
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Bulk status update completed'
      );
    } catch (error) {
      return this.handleError<BulkUpdateResult[]>(error);
    }
  }

  /**
   * Process refund for order
   * POST /api/admin/orders/:orderId/refund
   */
  async processRefund(orderId: string, input: RefundInput): Promise<RefundResponse> {
    try {
      const response = await this.request<{ data: Refund; message?: string }>(
        `/api/orders/admin/orders/${orderId}/refund`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Refund processed successfully'
      );
    } catch (error) {
      return this.handleError<Refund>(error);
    }
  }

  /**
   * Assign delivery to order
   * POST /api/admin/orders/:orderId/assign-delivery
   */
  async assignDelivery(orderId: string, input: AssignDeliveryInput): Promise<DeliveryAssignmentResponse> {
    try {
      const response = await this.request<{ data: DeliveryAssignment; message?: string }>(
        `/api/orders/admin/orders/${orderId}/assign-delivery`,
        {
          method: 'POST',
          body: JSON.stringify({
            driverId: input.driverId,
            branchId: input.branchId,
            estimatedDeliveryTime: input.estimatedDeliveryTime,
            estimatedDistance: input.estimatedDistance,
            estimatedDuration: input.estimatedDuration,
            deliveryNotes: input.deliveryNotes,
            priority: input.priority,
          }),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Delivery assigned successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAssignment>(error);
    }
  }

  /**
   * Update delivery tracking
   * PATCH /api/admin/delivery/:deliveryId/tracking
   */
  async updateDeliveryTracking(deliveryId: string, input: UpdateDeliveryTrackingInput): Promise<DeliveryTrackingResponse> {
    try {
      const response = await this.request<{ data: DeliveryTracking; message?: string }>(
        `/api/orders/admin/delivery/${deliveryId}/tracking`,
        {
          method: 'PATCH',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Delivery tracking updated'
      );
    } catch (error) {
      return this.handleError<DeliveryTracking>(error);
    }
  }

  /**
   * Apply manual discount to order
   * POST /api/orders/admin/orders/:orderId/discount
   */
  async applyManualDiscount(orderId: string, input: ManualDiscountInput): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/admin/orders/${orderId}/discount`,
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Manual discount applied successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  /**
   * Archive old orders
   * POST /api/admin/orders/archive
   */
  async archiveOrders(input: ArchiveOrdersInput): Promise<ApiResponse<{ archived: number }>> {
    try {
      const response = await this.request<{ data: { archived: number }; message?: string }>(
        '/api/orders/admin/orders/archive',
        {
          method: 'POST',
          body: JSON.stringify(input),
        }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Orders archived successfully'
      );
    } catch (error) {
      return this.handleError<{ archived: number }>(error);
    }
  }

  /**
   * Restore archived order
   * POST /api/admin/orders/:orderId/restore
   */
  async restoreOrder(orderId: string): Promise<OrderDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/orders/admin/orders/${orderId}/restore`,
        { method: 'POST' }
      );

      return createSuccessResponse(
        this.transformOrder(response.data),
        response.message ?? 'Order restored successfully'
      );
    } catch (error) {
      return this.handleError<Order>(error);
    }
  }

  // =========================================================================
  // ANALYTICS & REPORTING
  // =========================================================================

  /**
   * Get revenue analytics
   * GET /api/admin/analytics/revenue
   */
  async getRevenueAnalytics(
    startDate: Date,
    endDate: Date,
    interval: 'hour' | 'day' | 'week' | 'month' = 'day',
    metrics?: string[]
  ): Promise<RevenueAnalyticsResponse> {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      params.append('interval', interval);
      if (metrics) params.append('metrics', metrics.join(','));

      const response = await this.request<{ data: RevenueAnalytics; message?: string }>(
        `/api/orders/admin/analytics/revenue?${params.toString()}`,
        { method: 'GET' }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Revenue analytics retrieved successfully'
      );
    } catch (error) {
      return this.handleError<RevenueAnalytics>(error);
    }
  }

  /**
   * Get product performance analytics
   * GET /api/admin/analytics/products
   */
  async getProductPerformance(
    startDate: Date,
    endDate: Date,
    limit: number = 20,
    sortBy: 'quantity' | 'totalRevenue' | 'averageOrderValue' = 'totalRevenue'
  ): Promise<ProductPerformanceResponse> {
    try {
      const params = new URLSearchParams();
      params.append('startDate', startDate.toISOString());
      params.append('endDate', endDate.toISOString());
      params.append('limit', String(limit));
      params.append('sortBy', sortBy);

      const response = await this.request<{ data: ProductPerformance[]; message?: string }>(
        `/api/orders/admin/analytics/products?${params.toString()}`,
        { method: 'GET' }
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Product performance retrieved successfully'
      );
    } catch (error) {
      return this.handleError<ProductPerformance[]>(error);
    }
  }

  /**
   * Export orders
   * GET /api/admin/orders/export
   */
  async exportOrders(options: ExportOptions): Promise<ExportResponse> {
    try {
      const params = new URLSearchParams();
      params.append('format', options.format);
      if (options.startDate) params.append('startDate', options.startDate.toISOString());
      if (options.endDate) params.append('endDate', options.endDate.toISOString());
      if (options.status) params.append('status', options.status);
      if (options.fields) params.append('fields', options.fields.join(','));

      const blob = await this.requestBlob(`/api/admin/orders/export?${params.toString()}`, {
        method: 'GET',
      });
      return blob;
    } catch (error) {
      throw error;
    }
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Download blob as file
   */
  downloadBlob(blob: Blob, filename: string): void {
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  }

  /**
   * Download invoice
   */
  async downloadInvoice(orderId: string): Promise<void> {
    try {
      const blob = await this.generateInvoice(orderId);
      this.downloadBlob(blob, `invoice-${orderId}.pdf`);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      throw error;
    }
  }

  /**
   * Download exported orders
   */
  async downloadExportedOrders(options: ExportOptions): Promise<void> {
    try {
      const blob = await this.exportOrders(options);
      const extension = options.format === 'csv' ? 'csv' : 'xlsx';
      const filename = `orders-export-${Date.now()}.${extension}`;
      this.downloadBlob(blob, filename);
    } catch (error) {
      console.error('Failed to download export:', error);
      throw error;
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const orderApiClient = new OrderApiClient();
export default OrderApiClient;