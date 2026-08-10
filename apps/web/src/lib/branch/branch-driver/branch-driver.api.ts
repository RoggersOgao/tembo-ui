import { getToken } from "@/lib/get-token";
import type {
    BranchDriverAssignmentResponse,
    BranchDriversListResponse,
    BranchDriverFilterInput,
    AssignDriverInput,
    BulkAssignInput,
    UpdateDriverAssignmentInput,
    BranchDriverStats,
    AvailableDriver,
    DriverBranch,
} from "@/types/branch/branch-driver/branch-driver-types";

import {
    ApiResponse,
    createSuccessResponse,
    createErrorResponse,
    ErrorCode,
} from '@repo/api-utils';


// ─── Response Types ───────────────────────────────────────────────────────────

export type AssignmentResponse = ApiResponse<BranchDriverAssignmentResponse>;
export type AssignmentsListResponse = ApiResponse<BranchDriversListResponse>;
export type BulkAssignResponse = ApiResponse<{ success: boolean; assigned: number; assignments: any[] }>;
export type DriverBranchesResponse = ApiResponse<DriverBranch[]>;
export type PrimaryBranchResponse = ApiResponse<DriverBranch>;
export type BranchDriverStatsResponse = ApiResponse<BranchDriverStats>;
export type AvailableDriversResponse = ApiResponse<AvailableDriver[]>;
export type RemoveAssignmentResponse = ApiResponse<{ id: string; removed: boolean; permanent: boolean; message: string }>;
export type TransferDriverResponse = ApiResponse<BranchDriverAssignmentResponse>;

interface ApiErrorData {
    error?: string;
    details?: Array<{ field: string; message: string }>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

class BranchDriverApiClient {
    private baseURL: string;

    constructor() {
        this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
    }

    // ── Transformers ────────────────────────────────────────────────────────────

    private transformAssignment(assignment: any): BranchDriverAssignmentResponse {
        return {
            ...assignment,
            createdAt: assignment.createdAt,
            updatedAt: assignment.updatedAt,
            driver: assignment.driver,
            branch: assignment.branch,
        };
    }

    private transformDriverBranch(branch: any): DriverBranch {
        return {
            ...branch,
            assignedAt: branch.assignedAt ? new Date(branch.assignedAt) : new Date(),
            updatedAt: branch.updatedAt ? new Date(branch.updatedAt) : new Date(),
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

    /**
     * Get all assignments with filtering and pagination
     * GET /api/branch-resource
     */
    async getAssignments(
        filters?: BranchDriverFilterInput,
        page: number = 1,
        limit: number = 20,
        sortBy: string = 'createdAt',
        sortOrder: 'asc' | 'desc' = 'desc'
    ): Promise<AssignmentsListResponse> {
        try {
            const params = new URLSearchParams();
            if (filters) {
                Object.entries(filters).forEach(([key, value]) => {
                    if (value !== undefined && value !== null) {
                        params.append(key, String(value));
                    }
                });
            }
            params.append('page', String(page));
            params.append('limit', String(limit));
            params.append('sortBy', sortBy);
            params.append('sortOrder', sortOrder);

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
                `/api/branch-resource?${params.toString()}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                {
                    assignments: response.data.map((a: any) => this.transformAssignment(a)), 
                    total: response.pagination.total,
                    page: response.pagination.page,
                    limit: response.pagination.limit,
                    totalPages: response.pagination.totalPages,
                    filters: filters ?? {},
                },
                response.message ?? 'Assignments retrieved successfully'
            );
        } catch (error) {
            return this.handleError<BranchDriversListResponse>(error);
        }
    }

    /**
     * Get assignment by ID
     * GET /api/branch-resource/:id
     */
    async getAssignmentById(id: string): Promise<AssignmentResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branch-resource/${id}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                this.transformAssignment(response.data),
                response.message ?? 'Assignment retrieved successfully'
            );
        } catch (error) {
            return this.handleError<BranchDriverAssignmentResponse>(error);
        }
    }

    /**
     * Get all branches for a driver
     * GET /api/branch-resource/driver/:driverId/branches
     */
    async getDriverBranches(driverId: string, includeInactive: boolean = false): Promise<DriverBranchesResponse> {
        try {
            const params = new URLSearchParams();
            if (includeInactive) params.append('includeInactive', 'true');

            const response = await this.request<{ data: any[]; message?: string }>(
                `/api/branch-resource/driver/${driverId}/branches${params.toString() ? `?${params.toString()}` : ''}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                response.data.map((b: any) => this.transformDriverBranch(b)),
                response.message ?? 'Driver branches retrieved successfully'
            );
        } catch (error) {
            return this.handleError<DriverBranch[]>(error);
        }
    }

    /**
     * Get driver's primary branch
     * GET /api/branch-resource/driver/:driverId/primary-branch
     */
    async getDriverPrimaryBranch(driverId: string): Promise<PrimaryBranchResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branch-resource/driver/${driverId}/primary-branch`,
                { method: "GET" },
                true
            );

            if (!response.data) {
                return createSuccessResponse(null as any, 'No primary branch found');
            }

            return createSuccessResponse(
                this.transformDriverBranch(response.data),
                response.message ?? 'Primary branch retrieved successfully'
            );
        } catch (error) {
            return this.handleError<DriverBranch>(error);
        }
    }

    /**
     * Assign driver to branch
     * POST /api/branch-resource/assign
     */
    async assignDriver(data: AssignDriverInput): Promise<AssignmentResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                "/api/branch-resource/assign",
                {
                    method: "POST",
                    body: JSON.stringify(data),
                },
                true
            );

            return createSuccessResponse(
                this.transformAssignment(response.data),
                response.message ?? 'Driver assigned successfully'
            );
        } catch (error) {
            return this.handleError<BranchDriverAssignmentResponse>(error);
        }
    }

    /**
     * Bulk assign drivers to branch
     * POST /api/branch-resource/bulk-assign
     */
    async bulkAssignDrivers(data: BulkAssignInput): Promise<BulkAssignResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                "/api/branch-resource/bulk-assign",
                {
                    method: "POST",
                    body: JSON.stringify(data),
                },
                true
            );

            return createSuccessResponse(
                response.data,
                response.message ?? `${response.data.assigned} drivers assigned successfully`
            );
        } catch (error) {
            return this.handleError<any>(error);
        }
    }

    /**
     * Update assignment
     * PUT /api/branch-resource/:id
     */
    async updateAssignment(id: string, data: UpdateDriverAssignmentInput): Promise<AssignmentResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branch-resource/${id}`,
                {
                    method: "PUT",
                    body: JSON.stringify(data),
                },
                true
            );

            return createSuccessResponse(
                this.transformAssignment(response.data),
                response.message ?? 'Assignment updated successfully'
            );
        } catch (error) {
            return this.handleError<BranchDriverAssignmentResponse>(error);
        }
    }

    /**
     * Remove assignment (soft delete)
     * DELETE /api/branch-resource/:id
     */
    async removeAssignment(id: string, permanent: boolean = false): Promise<RemoveAssignmentResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branch-resource/${id}${permanent ? '?permanent=true' : ''}`,
                { method: "DELETE" },
                true
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Assignment removed successfully'
            );
        } catch (error) {
            return this.handleError<any>(error);
        }
    }

    /**
     * Get branch driver statistics
     * GET /api/branch-resource/stats/branch/:branchId
     */
    async getBranchDriverStats(branchId: string): Promise<BranchDriverStatsResponse> {
        try {
            const response = await this.request<{ data: BranchDriverStats; message?: string }>(
                `/api/branch-resource/stats/branch/${branchId}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Branch driver stats retrieved successfully'
            );
        } catch (error) {
            return this.handleError<BranchDriverStats>(error);
        }
    }

    /**
     * Get available drivers for a branch
     * GET /api/branch-resource/available?branchId=xxx&search=xxx
     */
    async getAvailableDrivers(branchId: string, search?: string): Promise<AvailableDriversResponse> {
        try {
            const params = new URLSearchParams({ branchId });
            if (search) params.append('search', search);

            const response = await this.request<{ data: any[]; message?: string }>(
                `/api/branch-resource/available?${params.toString()}`,
                { method: "GET" },
                true
            );

            return createSuccessResponse(
                response.data,
                response.message ?? 'Available drivers retrieved successfully'
            );
        } catch (error) {
            return this.handleError<AvailableDriver[]>(error);
        }
    }

    /**
     * Transfer driver to another branch
     * POST /api/branch-resource/:id/transfer
     */
    async transferDriver(assignmentId: string, newBranchId: string): Promise<TransferDriverResponse> {
        try {
            const response = await this.request<{ data: any; message?: string }>(
                `/api/branch-resource/${assignmentId}/transfer`,
                {
                    method: "POST",
                    body: JSON.stringify({ newBranchId }),
                },
                true
            );

            return createSuccessResponse(
                this.transformAssignment(response.data),
                response.message ?? 'Driver transferred successfully'
            );
        } catch (error) {
            return this.handleError<BranchDriverAssignmentResponse>(error);
        }
    }
}

export const branchDriverApiClient = new BranchDriverApiClient();
export default BranchDriverApiClient;