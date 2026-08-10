// lib/products/product-api.ts
import type {
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  ProductFilterInput,
  AssetInput,
  VariantInventoryInput,
} from "@/types/products/product-types";

import {
  ApiResponse,
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '@repo/api-utils';

import { getToken } from "../get-token";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductFilters {
  categoryId?: string;
  status?: string;
  search?: string;
  tags?: string[];
  minPrice?: number;
  maxPrice?: number;
  brand?: string;
}

export interface Pagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ProductsListData {
  products: Product[];
  pagination?: Pagination;
}

export interface SkuCheckData {
  exists: boolean;
  sku: string;
}

// ─── Response Types ───────────────────────────────────────────────────────────

export type ProductsResponse = ApiResponse<ProductsListData>;
export type ProductDetailResponse = ApiResponse<Product>;
export type ProductsListResponse = ApiResponse<Product[]>;
export type SkuCheckResponse = ApiResponse<SkuCheckData>;
export type BulkInventoryResponse = ApiResponse<{ updated: number }>;

interface ApiErrorData {
  error?: string;
  details?: Array<{ field: string; message: string }>;
}

// ─── Client ───────────────────────────────────────────────────────────────────

class ProductApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  // ── Transformers ────────────────────────────────────────────────────────────

  private transformProduct(product: any): Product {
    return {
      ...product,
      createdAt: product.createdAt ? new Date(product.createdAt) : undefined,
      updatedAt: product.updatedAt ? new Date(product.updatedAt) : undefined,
    };
  }

  private transformToProductsListData(data: any): ProductsListData {
    return {
      products: (data.products ?? data.data ?? []).map((p: any) => this.transformProduct(p)),
      pagination: data.pagination,
    };
  }

  // ── Core request handlers ───────────────────────────────────────────────────

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false
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

  // ── Helpers ─────────────────────────────────────────────────────────────────

  private buildFilterParams(filters: Record<string, any>, base = new URLSearchParams()): URLSearchParams {
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          value.forEach(v => base.append(key, v));
        } else {
          base.append(key, value.toString());
        }
      }
    });
    return base;
  }

  // ── API Methods ─────────────────────────────────────────────────────────────

  async getProducts(
    filter?: ProductFilterInput,
    page: number = 1,
    limit: number = 20,
    sortBy: string = 'createdAt',
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<ProductsResponse> {
    try {
      const params = new URLSearchParams();
      if (filter) {
        Object.entries(filter).forEach(([key, value]) => {
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

      // Response shape: { success, data: Product[], pagination: {...}, message, timestamp }
      const response = await this.request<{
        data: any[];
        pagination: { total: number; page: number; limit: number; totalPages: number; hasMore: boolean };
        message?: string;
      }>(
        `/api/products?${params.toString()}`,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        this.transformToProductsListData({
          products: response.data,        // ← array is directly on response.data
          pagination: response.pagination,  // ← pagination is top-level, not inside data
        }),
        response.message ?? 'Products retrieved successfully'
      );
    } catch (error) {
      return this.handleError<ProductsListData>(error);
    }
  }

  async getProductById(id: string): Promise<ProductDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/products/${id}`,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        this.transformProduct(response.data),
        response.message ?? 'Product retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Product>(error);
    }
  }

  async getProductBySlug(slug: string): Promise<ProductDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/products/slug/${slug}`,
        { method: "GET" },
        false
      );

      return createSuccessResponse(
        this.transformProduct(response.data),
        response.message ?? 'Product retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Product>(error);
    }
  }

  async createProduct(data: ProductCreateInput): Promise<ProductDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        "/api/products",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
        true
      );

      return createSuccessResponse(
        this.transformProduct(response.data),
        response.message ?? 'Product created successfully'
      );
    } catch (error) {
      return this.handleError<Product>(error);
    }
  }

  async updateProduct(id: string, data: ProductUpdateInput): Promise<ProductDetailResponse> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/products/${id}`,
        {
          method: "PUT",
          body: JSON.stringify(data),
        },
        true
      );

      return createSuccessResponse(
        this.transformProduct(response.data),
        response.message ?? 'Product updated successfully'
      );
    } catch (error) {
      return this.handleError<Product>(error);
    }
  }

  async deleteProduct(id: string, permanent: boolean = false): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await this.request<{ message: string }>(
        `/api/products/${id}${permanent ? '?permanent=true' : ''}`,
        { method: "DELETE" },
        true
      );

      return createSuccessResponse(
        { message: response.message },
        response.message ?? 'Product deleted successfully'
      );
    } catch (error) {
      return this.handleError<{ message: string }>(error);
    }
  }

  async addProductImages(productId: string, files: File[]): Promise<ApiResponse<AssetInput[]>> {
    try {
      const formData = new FormData();
      files.forEach(file => {
        formData.append('images', file);
      });

      const response = await this.requestFormData<{ data: AssetInput[]; message?: string }>(
        `/api/products/${productId}/images`,
        formData,
        'POST',
        true
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Product images added successfully'
      );
    } catch (error) {
      return this.handleError<AssetInput[]>(error);
    }
  }

  async removeProductImage(assetId: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await this.request<{ message: string }>(
        `/api/products/images/${assetId}`,
        { method: "DELETE" },
        true
      );

      return createSuccessResponse(
        { message: response.message },
        response.message ?? 'Product image removed successfully'
      );
    } catch (error) {
      return this.handleError<{ message: string }>(error);
    }
  }

  async setPrimaryImage(assetId: string): Promise<ApiResponse<{ message: string }>> {
    try {
      const response = await this.request<{ message: string }>(
        `/api/products/images/${assetId}/primary`,
        { method: "PUT" },
        true
      );

      return createSuccessResponse(
        { message: response.message },
        response.message ?? 'Primary image set successfully'
      );
    } catch (error) {
      return this.handleError<{ message: string }>(error);
    }
  }

  async updateInventory(items: VariantInventoryInput[]): Promise<BulkInventoryResponse> {
    try {
      const response = await this.request<{ data: { updated: number }; message?: string }>(
        "/api/products/inventory/bulk-update",
        {
          method: "POST",
          body: JSON.stringify({ items }),
        },
        true
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'Inventory updated successfully'
      );
    } catch (error) {
      return this.handleError<{ updated: number }>(error);
    }
  }

  async checkSku(sku: string, excludeId?: string): Promise<SkuCheckResponse> {
    try {
      const url = excludeId
        ? `/api/products/check-sku/${sku}?excludeId=${excludeId}`
        : `/api/products/check-sku/${sku}`;

      const response = await this.request<{ data: SkuCheckData; message?: string }>(
        url,
        { method: "GET" },
        true
      );

      return createSuccessResponse(
        response.data,
        response.message ?? 'SKU check completed successfully'
      );
    } catch (error) {
      return this.handleError<SkuCheckData>(error);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const productApiClient = new ProductApiClient();
export default ProductApiClient;