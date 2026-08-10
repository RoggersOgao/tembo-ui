// ============================================
// Types & Interfaces

import { getToken } from "@/lib/get-token";

// ============================================
export interface BreadcrumbItem {
    id: string;
    name: string;
    slug: string;
    level: number;
    isLast: boolean;
    url: string;
}

export interface CategoryWithProductsOptions {
    maxDepth?: number;
    includeInactive?: boolean;
    includeProductsCount?: boolean;
    minProductCount?: number; // threshold — default 1 (has at least 1 product)
}

export interface CategoryTreeNode {
    id: string;
    name: string;
    slug: string;
    description: string | null;
    icon: string | null;
    isActive: boolean;
    displayOrder: number;
    parentId: string | null;
    hasChildren: boolean;
    directProductCount: number;
    totalProductCount: number;
    level: number;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    children: CategoryTreeNode[];
}


// CategoryWithProductsNode IS a CategoryTreeNode — same shape, just filtered
export type CategoryWithProductsNode = CategoryTreeNode;

export interface CategoryApiResponse {
    success: boolean;
    message: string;
    data: {
        selected: {
            id: string;
            name: string;
            slug: string;
            description: string;
            level: number;
            propertiesCount: number;
        };
        currentLevel: {
            level: number;
            label: string;
            categories: Array<{
                id: string;
                name: string;
                slug: string;
                parentId: string;
                description: string;
                icon: string;
                displayOrder: number;
                isActive: boolean;
                deletedAt: string | null;
                createdAt: string;
                updatedAt: string;
                _count: {
                    properties: number;
                    children: number;
                };
                level: number;
                hasChildren: boolean;
            }>;
            selectedId: string;
            totalCategories: number;
        };
        breadcrumb?: BreadcrumbItem[];
        ancestors?: Array<{
            id: string;
            name: string;
            slug: string;
            level: number;
            isRoot: boolean;
            url: string;
        }>;
        summary: {
            totalLevels: number;
            currentLevel: number;
            siblingsCount: number;
            hasParent: boolean;
            isRoot: boolean;
        };
    };
    timestamp: string;
}
export interface Category {
    id: string;
    name: string;
    slug: string;
    parentId: string | null;
    description: string | null;
    icon: string | null;
    displayOrder: number;
    isActive: boolean;
    path: string | null;
    createdAt: string;
    updatedAt: string;
    deletedAt: string | null;
    parent?: {
        id: string;
        name: string;
        slug: string;
    } | null;
    children?: Category[];
    _count?: {
        properties: number;
        children: number;
    };
    level?: number;
    hasChildren?: boolean;
    productsCount?: number;
    ancestors?: Category[];
    descendants?: Category[];
    fullPath?: string;
}

export interface CategoryTreeNode extends Category {
    children: CategoryTreeNode[];
}

export interface CreateCategoryInput {
    name: string;
    slug: string;
    parentId?: string | null;
    description?: string | null;
    icon?: string | null;
    displayOrder?: number;
}

export interface UpdateCategoryInput {
    name?: string;
    slug?: string;
    parentId?: string | null;
    description?: string | null;
    icon?: string | null;
    displayOrder?: number;
    isActive?: boolean;
}

export interface CategoryQueryOptions {
    includeInactive?: boolean;
    page?: number;
    limit?: number;
    sortBy?: 'displayOrder' | 'name' | 'createdAt' | 'propertiesCount';
    sortOrder?: 'asc' | 'desc';
    search?: string;
    parentId?: string | null;
}

export interface CategoryTreeOptions {
    maxDepth?: number;
    includeInactive?: boolean;
    includePropertiesCount?: boolean;
    includeAncestors?: boolean;
}

export interface CategoryDetailOptions {
    includeAncestors?: boolean;
    includeDescendants?: boolean;
    includePropertiesCount?: boolean;
}

export interface PropertiesInCategoryOptions {
    includeChildren?: boolean;
    page?: number;
    limit?: number;
    status?: string;
    sortBy?: string;
    minPrice?: number;
    maxPrice?: number;
    locationId?: string;
}

export interface Pagination {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
}

export interface CategoryStatistics {
    totalCategories: number;
    activeCategories: number;
    inactiveCategories: number;
    categoriesWithProperties: number;
    categoriesWithoutProperties: number;
    deepestLevel: number;
    averagePropertiesPerCategory: number;
    rootCategories: number;
    leafCategories: number;
    categoriesByDepth: Array<{ depth: number; count: number }>;
}

export interface BreadcrumbItem {
    id: string;
    name: string;
    slug: string;
    level: number;
    isLast: boolean;
    url: string;
}

export interface ReorderItem {
    id: string;
    displayOrder: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data: T;
    message?: string;
    metadata?: Record<string, any>;
}

export interface PaginatedApiResponse<T> extends ApiResponse<T> {
    pagination: Pagination;
}

// ============================================
// API Client Class
// ============================================
class RequestController {
  private controllers: Map<string, AbortController> = new Map();

  getController(key: string): AbortController {
    const existing = this.controllers.get(key);
    if (existing) {
      existing.abort();
      this.controllers.delete(key);
    }

    const controller = new AbortController();
    this.controllers.set(key, controller);
    return controller;
  }

  abort(key: string) {
    const controller = this.controllers.get(key);
    if (controller) {
      controller.abort();
      this.controllers.delete(key);
    }
  }

  abortAll() {
    this.controllers.forEach(controller => controller.abort());
    this.controllers.clear();
  }
}


class CategoryApiClient {
  private baseURL: string;
  private requestController = new RequestController();

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = false,
    requestKey?: string
  ): Promise<T> {
    let token: string | undefined | null;

    if (requireAuth) {
     token = await getToken()
      if (!token) {
        throw new Error("Authorization token is missing. Please log in.");
      }
    }

    const controller = requestKey 
      ? this.requestController.getController(requestKey)
      : new AbortController();

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    try {
      const res = await fetch(`${this.baseURL}${endpoint}`, {
        ...options,
        headers,
        signal: controller.signal,
      });

      if (res.status === 401) {
        throw new Error("Unauthorized");
      }

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(
          errorData.message || errorData.error || `Request failed with ${res.status}`
        );
      }

      return res.json();
    } catch (error: any) {
      if (error.name === 'AbortError') {
        console.log('Request aborted:', endpoint);
        throw new Error('Request cancelled');
      }
      throw error;
    }
  }

  // Add request cancellation method
  cancelRequest(key: string) {
    this.requestController.abort(key);
  }

    /**
     * Build query string from object
     */
    private buildQueryString(params: Record<string, any>): string {
        const filtered = Object.entries(params).reduce((acc, [key, value]) => {
            if (value !== undefined && value !== null && value !== '') {
                acc[key] = String(value);
            }
            return acc;
        }, {} as Record<string, string>);

        const queryString = new URLSearchParams(filtered).toString();
        return queryString ? `?${queryString}` : '';
    }

    // ============================================
    // Public API Methods
    // ============================================

    /**
     * Get all categories with pagination and filtering
     */
    async getAll(
        options?: CategoryQueryOptions
    ): Promise<PaginatedApiResponse<Category[]>> {
        const query = options ? this.buildQueryString(options) : '';
        return this.request<PaginatedApiResponse<Category[]>>(
            `/api/categories${query}`,
            { method: "GET" }
        );
    }

    /**
     * Get category tree (hierarchical structure)
     */
    async getTree(
        options?: CategoryTreeOptions
    ): Promise<ApiResponse<CategoryTreeNode[]>> {
        const query = options ? this.buildQueryString(options) : '';
        return this.request<ApiResponse<CategoryTreeNode[]>>(
            `/api/categories/tree${query}`,
            { method: "GET" }
        );
    }

    // category.api-client.ts
    async getCategoriesWithProducts(
        options?: CategoryWithProductsOptions
    ): Promise<ApiResponse<CategoryWithProductsNode[]>> {
        const query = options ? this.buildQueryString(options) : '';
        return this.request<ApiResponse<CategoryWithProductsNode[]>>(
            `/api/categories/with-products${query}`,
            { method: 'GET' }
        );
    }
    /**
     * Get category tree (hierarchial structure) curent path with-siblings
     */

    async getTreeFromId(
        identifier: string
    ): Promise<ApiResponse<CategoryApiResponse[]>> {
        return this.request<ApiResponse<CategoryApiResponse[]>>(
            `/api/categories/${identifier}/path-with-siblings`,
            { method: "GET" }
        );
    }

    /**
     * Get single category by ID or slug
     */
    async getById(
        identifier: string,
        options?: CategoryDetailOptions
    ): Promise<ApiResponse<Category>> {
        const query = options ? this.buildQueryString(options) : '';
        return this.request<ApiResponse<Category>>(
            `/api/categories/${identifier}${query}`,
            { method: "GET" }
        );
    }

    /**
     * Get category breadcrumb
     */
    async getBreadcrumb(
        identifier: string
    ): Promise<ApiResponse<BreadcrumbItem[]>> {
        return this.request<ApiResponse<BreadcrumbItem[]>>(
            `/api/categories/${identifier}/breadcrumb`,
            { method: "GET" }
        );
    }

    /**
     * Get properties in a category
     */
    async getPropertiesInCategory(
        identifier: string,
        options?: PropertiesInCategoryOptions
    ): Promise<PaginatedApiResponse<any[]>> {
        const query = options ? this.buildQueryString(options) : '';
        return this.request<PaginatedApiResponse<any[]>>(
            `/api/categories/${identifier}/products${query}`,
            { method: "GET" }
        );
    }

    /**
     * Create a new category (requires authentication)
     */
    async create(
        input: CreateCategoryInput
    ): Promise<ApiResponse<Category>> {
        return this.request<ApiResponse<Category>>(
            "/api/categories",
            {
                method: "POST",
                body: JSON.stringify(input),
            },
            true
        );
    }

    /**
     * Update a category (requires authentication)
     */
    async update(
        id: string,
        input: UpdateCategoryInput
    ): Promise<ApiResponse<Category>> {
        return this.request<ApiResponse<Category>>(
            `/api/categories/${id}`,
            {
                method: "PUT",
                body: JSON.stringify(input),
            },
            true
        );
    }

    /**
     * Delete a category (soft delete, requires authentication)
     */
    async delete(id: string): Promise<ApiResponse<null>> {
        return this.request<ApiResponse<null>>(
            `/api/categories/${id}`,
            { method: "DELETE" },
            true
        );
    }

    /**
     * Restore a deleted category (requires authentication)
     */
    async restore(id: string): Promise<ApiResponse<Category>> {
        return this.request<ApiResponse<Category>>(
            `/api/categories/${id}/restore`,
            { method: "PATCH" },
            true
        );
    }

    /**
     * Reorder categories (requires authentication)
     */
    async reorder(items: ReorderItem[]): Promise<ApiResponse<null>> {
        return this.request<ApiResponse<null>>(
            "/api/categories/reorder",
            {
                method: "PUT",
                body: JSON.stringify({ items }),
            },
            true
        );
    }

    /**
     * Get category statistics (requires authentication)
     */
    async getStatistics(): Promise<ApiResponse<CategoryStatistics>> {
        return this.request<ApiResponse<CategoryStatistics>>(
            "/api/categories/stats",
            { method: "GET" },
            true
        );
    }
}

export const categoryApiClient = new CategoryApiClient();