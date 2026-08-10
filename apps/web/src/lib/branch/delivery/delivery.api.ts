// lib/deliveries/delivery-api.ts
import { getToken } from "@/lib/get-token";
import type {
  Delivery,
  DeliveryCreateInput,
  DeliveryUpdateInput,
  DeliveryFilterInput,
  DeliveryStatus,
} from "@/types/branch/delivery/delivery-types";

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

export interface DeliveriesListData {
  deliveries: Delivery[];
  pagination?: Pagination;
}

export interface DeliveryStats {
  total: number;
  byStatus: Record<string, number>;
  successRate: number;
  averageRating: number;
  averageDeliveryTime: number;
  ratingBreakdown: {
    speed: number;
    condition: number;
    courtesy: number;
  };
}

export interface DriverPerformance {
  totalDeliveries: number;
  completedDeliveries: number;
  completionRate: number;
  averageRating: number;
  totalRatings: number;
  averageDeliveryTime: number;
  statusBreakdown: Record<string, number>;
}

export interface DeliveryRating {
  id: string;
  deliveryId: string;
  overallRating: number;
  speedRating?: number;
  conditionRating?: number;
  courtesyRating?: number;
  comment?: string;
  createdAt: Date;
}

export interface DeliveryRatingInput {
  overallRating: number;
  speedRating?: number;
  conditionRating?: number;
  courtesyRating?: number;
  comment?: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export type DeliveriesResponse = ApiResponse<DeliveriesListData>;
export type DeliveryDetailResponse = ApiResponse<Delivery>;
export type DeliveryTrackingResponse = ApiResponse<Partial<Delivery>>;
export type DeliveryStatsResponse = ApiResponse<DeliveryStats>;
export type DriverPerformanceResponse = ApiResponse<DriverPerformance>;
export type DeliveryRatingResponse = ApiResponse<DeliveryRating>;

interface ApiErrorData {
  error?: string;
  details?: Array<{ field: string; message: string }>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

class DeliveryApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  // ── Transformers ────────────────────────────────────────────────────────────

  private transformDelivery(delivery: any): Delivery {
    return {
      ...delivery,
      createdAt: delivery.createdAt ? new Date(delivery.createdAt) : undefined,
      updatedAt: delivery.updatedAt ? new Date(delivery.updatedAt) : undefined,
      assignedAt: delivery.assignedAt ? new Date(delivery.assignedAt) : undefined,
      pickedUpAt: delivery.pickedUpAt ? new Date(delivery.pickedUpAt) : undefined,
      deliveredAt: delivery.deliveredAt ? new Date(delivery.deliveredAt) : undefined,
      failedAt: delivery.failedAt ? new Date(delivery.failedAt) : undefined,
    };
  }

  private transformToDeliveriesListData(data: any): DeliveriesListData {
    return {
      deliveries: (data.deliveries ?? data.data ?? []).map((d: any) => this.transformDelivery(d)),
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

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: requireAuth ? 'include' : undefined,
      headers,
    });

    if (res.status === 401) {
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const errorData: ApiErrorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.error ?? `Request failed with status ${res.status}`,
      );
    }

    return res.json() as Promise<T>;
  }

  private async requestFormData<T>(
    endpoint: string,
    formData: FormData,
    method: string = 'POST',
    requireAuth: boolean = true
  ): Promise<T> {
    const token = requireAuth ? await getToken() : null;

    const headers: HeadersInit = {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      method,
      headers,
      body: formData,
      credentials: requireAuth ? 'include' : undefined,
    });

    if (res.status === 401) {
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const errorData: ApiErrorData = await res.json().catch(() => ({}));
      throw new Error(
        errorData.error ?? `Request failed with status ${res.status}`,
      );
    }

    return res.json() as Promise<T>;
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

  // ── Query string builder ────────────────────────────────────────────────────

  private buildQueryString(params: Record<string, any>): string {
    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
      if (value === undefined || value === null) return;

      if (Array.isArray(value)) {
        //  Handle array values (e.g. status: ['PENDING', 'ASSIGNED'])
        value.forEach(v => searchParams.append(key, String(v)));
      } else if (value instanceof Date) {
        //  Handle Date objects
        searchParams.append(key, value.toISOString());
      } else if (typeof value === 'string' && this.isISODateString(value)) {
        //  Handle ISO date strings — pass through as-is
        searchParams.append(key, value);
      } else {
        searchParams.append(key, String(value));
      }
    });

    return searchParams.toString();
  }

  //  Lightweight ISO date string check
  private isISODateString(value: string): boolean {
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
  }

  // ── API Methods ─────────────────────────────────────────────────────────────

  async getDeliveries(
    filters?: DeliveryFilterInput,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<DeliveriesResponse> {
    try {
      const params = this.buildQueryString({
        ...filters,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      const response = await this.request<{
        data: any[];
        pagination: {
          total: number;
          page: number;
          limit: number;
          totalPages: number;
          hasMore: boolean;
        };
        message?: string;
      }>(
        `/api/deliveries?${params}`,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        this.transformToDeliveriesListData({
          deliveries: response.data,
          pagination: response.pagination,
        }),
        response.message ?? 'Deliveries retrieved successfully'
      );
    } catch (error) {
      return this.handleError<DeliveriesListData>(error);
    }
  }

  async getDeliveryById(id: string): Promise<DeliveryDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/deliveries/${id}`,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? 'Delivery retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Delivery>(error);
    }
  }

  async getDeliveryByTrackingCode(trackingCode: string): Promise<DeliveryTrackingResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/deliveries/track/${trackingCode}`,
        { method: "GET" },
        false
      );

      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? 'Delivery tracking retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Partial<Delivery>>(error);
    }
  }

  async createDelivery(data: DeliveryCreateInput): Promise<DeliveryDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        "/api/deliveries",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        true
      );

      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? 'Delivery created successfully'
      );
    } catch (error) {
      return this.handleError<Delivery>(error);
    }
  }

  async updateDelivery(id: string, data: DeliveryUpdateInput): Promise<DeliveryDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/deliveries/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
        true
      );

      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? 'Delivery updated successfully'
      );
    } catch (error) {
      return this.handleError<Delivery>(error);
    }
  }

  async assignDriver(deliveryId: string, driverId: string): Promise<DeliveryDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/deliveries/${deliveryId}/assign`,
        {
          method: "POST",
          body: JSON.stringify({ driverId }),
        },
        true
      );

      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? 'Driver assigned successfully'
      );
    } catch (error) {
      return this.handleError<Delivery>(error);
    }
  }

  async deleteDelivery(id: string, permanent?: boolean): Promise<ApiResponse<void>> {
    try {
      //  Some servers ignore body on DELETE — permanent flag sent as query param too
      const params = permanent ? '?permanent=true' : '';

      await this.request<{ message?: string }>(
        `/api/deliveries/${id}${params}`,
        {
          method: "DELETE",
          body: JSON.stringify({ permanent: permanent ?? false }),
        },
        true
      );

      //  Typed as unknown first to avoid createSuccessResponse<void> issues
      return createSuccessResponse(
        undefined as unknown as void,
        permanent ? 'Delivery permanently deleted' : 'Delivery cancelled successfully'
      );
    } catch (error) {
      return this.handleError<void>(error);
    }
  }

  async updateDeliveryStatus(
    id: string,
    data: DeliveryUpdateInput
  ): Promise<DeliveryDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/deliveries/${id}/status`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
        true
      );
      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? "Delivery status updated successfully"
      );
    } catch (error) {
      return this.handleError<Delivery>(error);
    }
  }

  async uploadProofImage(deliveryId: string, imageFile: File): Promise<DeliveryDetailResponse> {
    try {
      const formData = new FormData();
      formData.append('proofImage', imageFile);

      const response = await this.requestFormData<{ data: any; message?: string }>(
        `/api/deliveries/${deliveryId}/proof`,
        formData,
        'POST',
        true
      );

      return createSuccessResponse(
        this.transformDelivery(response.data),
        response.message ?? 'Proof image uploaded successfully'
      );
    } catch (error) {
      return this.handleError<Delivery>(error);
    }
  }

  async rateDelivery(
    deliveryId: string,
    rating: DeliveryRatingInput
  ): Promise<DeliveryRatingResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/deliveries/${deliveryId}/rate`,
        {
          method: "POST",
          body: JSON.stringify(rating),
        },
        true
      );

      return createSuccessResponse(
        {
          ...response.data,
          createdAt: response.data.createdAt
            ? new Date(response.data.createdAt)
            : new Date(),
        },
        response.message ?? 'Delivery rated successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryRating>(error);
    }
  }

  //  Now accepts string | Date to match the hook's filter type
  async getDeliveryStats(filters?: {
    branchId?: string;
    driverId?: string;
    dateFrom?: Date | string;
    dateTo?: Date | string;
  }): Promise<DeliveryStatsResponse> {
    try {
      const params = this.buildQueryString(filters ?? {});

      const response = await this.request<{ data: DeliveryStats; message?: string }>(
        `/api/deliveries/stats${params ? `?${params}` : ''}`,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Delivery statistics retrieved successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryStats>(error);
    }
  }

  async getDriverPerformance(
    driverId: string,
    period?: { from: Date; to: Date }
  ): Promise<DriverPerformanceResponse> {
    try {
      const params = period
        ? this.buildQueryString({ from: period.from, to: period.to })
        : '';

      const response = await this.request<{ data: DriverPerformance; message?: string }>(
        `/api/deliveries/driver/${driverId}/performance${params ? `?${params}` : ''}`,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Driver performance retrieved successfully'
      );
    } catch (error) {
      return this.handleError<DriverPerformance>(error);
    }
  }
}

export const deliveryApiClient = new DeliveryApiClient();
export default DeliveryApiClient;