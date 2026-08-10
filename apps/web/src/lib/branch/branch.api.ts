// lib/branches/branch-api.ts
import type {
    Branch,
    BranchCreateInput,
    BranchUpdateInput,
    BranchFilterInput,
    NearbyBranch,
} from "@/types/branch/branch-types";

import {
    ApiResponse,
    ErrorCode,
    createSuccessResponse,
    createErrorResponse,
} from '@repo/api-utils';

import { getToken } from "../get-token";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface Pagination {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
}

export interface BranchesListData {
    branches: Branch[];
    pagination?: Pagination;
}

export interface BranchInventoryItem {
    productId: string;
    product: { id: string; name: string; sku: string; category: { id: string; name: string } };
    _sum: { quantityAvailable: number; quantityOnHand: number; quantityReserved: number };
    _count: { variantId: number };
}

export interface BranchStats {
    deliveries: {
        total: number;
        byStatus: Record<string, number>;
    };
    inventory: {
        totalItems: number;
        totalQuantity: number;
        reservedQuantity: number;
        lowStockItems: number;
    };
    orders: {
        total: number;
    };
}



// ─── Response Types ───────────────────────────────────────────────────────────

export type BranchesResponse = ApiResponse<BranchesListData>;
export type BranchDetailResponse = ApiResponse<Branch>;
export type NearbyBranchesResponse = ApiResponse<NearbyBranch[]>;
export type BranchInventoryResponse = ApiResponse<BranchInventoryItem[]>;
export type BranchStatsResponse = ApiResponse<BranchStats>;

interface ApiErrorData {
    error?: string;
    details?: Array<{ field: string; message: string }>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

class BranchApiClient {
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    }

    // ── Transformers ────────────────────────────────────────────────────────────

    private transformBranch(branch: any): Branch {
        return {
            ...branch,
            createdAt: branch.createdAt ? new Date(branch.createdAt) : undefined,
            updatedAt: branch.updatedAt ? new Date(branch.updatedAt) : undefined,
        };
    }

    private transformToBranchesListData(data: any): BranchesListData {
        return {
            branches: (data.branches ?? data.data ?? []).map((b: any) => this.transformBranch(b)),
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

    // ── API Methods ─────────────────────────────────────────────────────────────

    async getBranches(
        filters?: BranchFilterInput,
        page: number = 1,
        limit: number = 20,
        sortBy: string = 'createdAt',
        sortOrder: 'asc' | 'desc' = 'desc'
    ): Promise<BranchesResponse> {
        try {
            const params = new URLSearchParams();
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        if (Array.isArray(value)) {
                            value.forEach(v => params.append(key, v));
                        } else {
                            params.append(key, String(value));
                        }
                    }
                });
            }
            params.append('page', String(page));
            params.append('limit', String(limit));
            params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);

            const response = await this.request<{
                data: any[];
                pagination: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean };
                message?: string;
            }>(
                `/api/branches?${params.toString()}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                this.transformToBranchesListData({
                    branches: response.data,
                    pagination: response.pagination,
                }),
                response.message ?? 'Branches retrieved successfully'
            );
        } catch (error) {
            return this.handleError<BranchesListData>(error);
        }
    }

    async getBranchById(id: string): Promise<BranchDetailResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branches/${id}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                this.transformBranch(response.data),
                response.message ?? 'Branch retrieved successfully'
            );
        } catch (error) {
            return this.handleError<Branch>(error);
        }
    }

    private transformNearbyBranch(b: any): NearbyBranch {
        // Validate required fields for NearbyBranch
        if (b.distance == null) {
            throw new Error("Distance is required for nearby branch");
        }

        return {
            // --- Base Branch fields ---
            id: b.id,
            name: b.name,
            address: b.address,
            city: b.city,
            county: b.county ?? null,
            phone: b.phone ?? null,
            email: b.email ?? null,
            latitude: b.latitude ?? null,
            longitude: b.longitude ?? null,
            isActive: b.isActive,
            createdAt: b.createdAt,
            updatedAt: b.updatedAt,

            // --- Nearby-specific overrides ---
            distance: b.distance, //  now guaranteed

            stats: {
                inventoryCount:
                    b.stats?.inventoryCount ??
                    b._count?.inventoryItems ?? // Prisma fallback
                    0,
            },

            // --- Optional relations (only if present) ---
            inventoryItems: b.inventoryItems,
            restockRequests: b.restockRequests,
            purchaseOrders: b.purchaseOrders,
            deliveries: b.deliveries,
        };
    }

    async getNearbyBranches(
        latitude: number,
        longitude: number,
        radiusKm: number = 10
    ): Promise<NearbyBranchesResponse> {
        try {
            const params = new URLSearchParams({
                latitude: String(latitude),
                longitude: String(longitude),
                radius: String(radiusKm),
            });

            const response = await this.request<{ data: any[]; message?: string }>(
                `/api/branches/nearby?${params.toString()}`,
                { method: "GET" },
                true
            );

            const branches: NearbyBranch[] = response.data.map((b: any) =>
                this.transformNearbyBranch(b)
            );

            return createSuccessResponse(
                branches,
                response.message ?? "Nearby branches retrieved successfully"
            );
        } catch (error) {
            return this.handleError<NearbyBranch[]>(error);
        }
    }

    async getBranchInventory(branchId: string): Promise<BranchInventoryResponse> {
        try {
            const response = await this.request<{ data: any[]; message?: string }>(
                `/api/branches/${branchId}/inventory`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Branch inventory retrieved successfully'
            );
        } catch (error) {
            return this.handleError<BranchInventoryItem[]>(error);
        }
    }

    async getBranchStats(branchId: string): Promise<BranchStatsResponse> {
        try {
            const response = await this.request<{ data: BranchStats; message?: string }>(
                `/api/branches/${branchId}/stats`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Branch statistics retrieved successfully'
            );
        } catch (error) {
            return this.handleError<BranchStats>(error);
        }
    }

    async createBranch(data: BranchCreateInput): Promise<BranchDetailResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                "/api/branches",
                {
                    method: "POST",
                    body: JSON.stringify(data),
                },
                true
            );

            return createSuccessResponse(
                this.transformBranch(response.data),
                response.message ?? 'Branch created successfully'
            );
        } catch (error) {
            return this.handleError<Branch>(error);
        }
    }

    async updateBranch(id: string, data: BranchUpdateInput): Promise<BranchDetailResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branches/${id}`,
                {
                    method: "PUT",
                    body: JSON.stringify(data),
                },
                true
            );

            return createSuccessResponse(
                this.transformBranch(response.data),
                response.message ?? 'Branch updated successfully'
            );
        } catch (error) {
            return this.handleError<Branch>(error);
        }
    }

    async deleteBranch(id: string, permanent: boolean = false): Promise<ApiResponse<{ message: string }>> {
        try {
            const response = await this.request<{ message: string }>(
                `/api/branches/${id}${permanent ? '?permanent=true' : ''}`,
                { method: "DELETE" },
                true
            );

            return createSuccessResponse(
                { message: response.message },
                response.message ?? 'Branch deleted successfully'
            );
        } catch (error) {
            return this.handleError<{ message: string }>(error);
        }
    }
}

export const branchApiClient = new BranchApiClient();
export default BranchApiClient;