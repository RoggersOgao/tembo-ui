// lib/api/delivery-settings.api.ts
import { getToken } from '@/lib/get-token';
import {
  ApiResponse,
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '@repo/api-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DeliveryMode = 'DELIVERY' | 'PICKUP'

export const DELIVERY_MODES = ['DELIVERY', 'PICKUP'] as const satisfies DeliveryMode[];
export interface DeliveryAddress {
  id: string;
  profileId: string;
  label?: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  county?: string;
  postalCode?: string;
  country?: string;
  latitude: number;
  longitude?: number;
  instructions?: string;
  isDefault: boolean;
  isActive: boolean;
  deliveryMode: DeliveryMode;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeliveryModeSettings {
  id: string;
  profileId: string;
  defaultDeliveryMode: DeliveryMode;
  preferredDeliveryTime: string | null;
  preferredDeliveryDate: Date | null;
  contactlessDelivery: boolean;
  leaveAtDoor: boolean;
  expressDeliveryEnabled: boolean;
  expressDeliveryRadius: number | null;
  preferredPickupLocation: string | null;
  pickupInstructions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateDeliveryAddressInput {
  label?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  county?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  instructions?: string;
  isDefault?: boolean;
  deliveryMode: DeliveryMode;
}

export interface UpdateDeliveryAddressInput extends Partial<CreateDeliveryAddressInput> {
  isActive?: boolean;
}

export interface CreateDeliveryModeSettingsInput {
  defaultDeliveryMode?: DeliveryMode;
  preferredDeliveryTime?: string;
  preferredDeliveryDate?: Date;
  contactlessDelivery?: boolean;
  leaveAtDoor?: boolean;
  expressDeliveryEnabled?: boolean;
  expressDeliveryRadius?: number;
  preferredPickupLocation?: string;
  pickupInstructions?: string;
}

export interface AddressStats {
  total: number;
  byMode: Record<DeliveryMode, number>;
  hasDefault: boolean;
  defaultAddress: DeliveryAddress | null;
  recentAddresses: DeliveryAddress[];
}

export interface AddressValidationResult {
  isValid: boolean;
  errors: Array<{ field: string; message: string }>;
  validatedData: Partial<CreateDeliveryAddressInput>;
}

export interface GeocodeResult {
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string;
  confidence: number;
}

export interface ExpressEligibilityResult {
  isEligible: boolean;
  expressDeliveryEnabled: boolean;
  expressDeliveryRadius: number | null;
  address: {
    id: string;
    label: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface AddressHistoryEntry extends DeliveryAddress {
  lastUsedAt: Date;
  usageCount: number;
}

export interface BulkUpdateResult {
  results: Array<{
    userId: string;
    success: boolean;
    settings?: DeliveryModeSettings;
    error?: string;
  }>;
  successCount: number;
  failureCount: number;
}

export interface SettingsWithDetails {
  settings: DeliveryModeSettings | null;
  addressSummary: {
    total: number;
    byMode: Record<DeliveryMode, number>;
    hasDefault: boolean;
    defaultAddress: DeliveryAddress | null;
  };
}

export interface PaginatedAdminSettings {
  settings: Array<DeliveryModeSettings & {
    profile: {
      user: {
        name: string;
        email: string;
      };
    };
  }>;
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ─── Client ───────────────────────────────────────────────────────────────────

class DeliverySettingsApiClient {
  private baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;

  // ── Core request ────────────────────────────────────────────────────────────
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    const token = requireAuth ? await getToken() : null;

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });

    if (res.status === 401) throw new Error('Unauthorized');

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message ?? `Request failed with status ${res.status}`);
    }

    if (options.method === 'DELETE') {
      const text = await res.text();
      return (text ? JSON.parse(text) : {}) as T;
    }

    return res.json();
  }

  // ── Error handler ───────────────────────────────────────────────────────────
  private handleError<T>(error: unknown): ApiResponse<T> {
    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return createErrorResponse<T>(ErrorCode.UNAUTHORIZED, 'Unauthorized');
      }
      return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, error.message);
    }
    return createErrorResponse<T>(ErrorCode.INTERNAL_ERROR, 'An unexpected error occurred');
  }

  // ── Transformers ─────────────────────────────────────────────────────────────
  private transformDeliveryAddress(a: any): DeliveryAddress {
    return {
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    };
  }

  private transformDeliveryModeSettings(s: any): DeliveryModeSettings {
    return {
      ...s,
      preferredDeliveryDate: s.preferredDeliveryDate
        ? new Date(s.preferredDeliveryDate)
        : null,
      createdAt: new Date(s.createdAt),
      updatedAt: new Date(s.updatedAt),
    };
  }

  // ─── Delivery Address CRUD ───────────────────────────────────────────────────

  /**
   * Add a new delivery address
   * POST /delivery-mode/addresses
   */
  async addDeliveryAddress(
    data: CreateDeliveryAddressInput
  ): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/addresses',
        { method: 'POST', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformDeliveryAddress(response.data),
        response.message ?? 'Address added successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  /**
   * Get all delivery addresses for current user
   * GET /delivery-mode/addresses?deliveryMode=:mode
   */
  async getDeliveryAddresses(
    deliveryMode?: DeliveryMode
  ): Promise<ApiResponse<{ deliveryAddresses: DeliveryAddress[]; count: number }>> {
    try {
      const params = new URLSearchParams();
      if (deliveryMode) params.append('deliveryMode', deliveryMode);

      const endpoint = `/api/delivery-mode/addresses${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await this.request<{ data: any; message?: string }>(endpoint);

      return createSuccessResponse(
        {
          deliveryAddresses: (response.data?.deliveryAddresses ?? []).map((a: any) =>
            this.transformDeliveryAddress(a)
          ),
          count: response.data?.count ?? 0,
        },
        response.message ?? 'Delivery addresses retrieved successfully'
      );
    } catch (error) {
      return this.handleError<{ deliveryAddresses: DeliveryAddress[]; count: number }>(error);
    }
  }

  /**
   * Get a single delivery address by ID
   * GET /delivery-mode/addresses/:addressId
   */
  async getDeliveryAddressById(addressId: string): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}`
      );
      return createSuccessResponse(
        this.transformDeliveryAddress(response.data),
        response.message ?? 'Delivery address retrieved successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  /**
   * Update a delivery address
   * PUT /delivery-mode/addresses/:addressId
   */
  async updateDeliveryAddress(
    addressId: string,
    data: UpdateDeliveryAddressInput
  ): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}`,
        { method: 'PUT', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformDeliveryAddress(response.data),
        response.message ?? 'Address updated successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  /**
   * Partially update a delivery address
   * PATCH /delivery-mode/addresses/:addressId
   */
  async patchDeliveryAddress(
    addressId: string,
    data: UpdateDeliveryAddressInput
  ): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}`,
        { method: 'PATCH', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformDeliveryAddress(response.data),
        response.message ?? 'Address updated successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  /**
   * Remove (soft delete) a delivery address
   * DELETE /delivery-mode/addresses/:addressId
   */
  async removeDeliveryAddress(addressId: string): Promise<ApiResponse<{ id: string }>> {
    try {
      const response = await this.request<{ data: { id: string }; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}`,
        { method: 'DELETE' }
      );
      return createSuccessResponse(
        response.data,
        response.message ?? 'Address removed successfully'
      );
    } catch (error) {
      return this.handleError<{ id: string }>(error);
    }
  }

  /**
   * Set a delivery address as default
   * PATCH /delivery-mode/addresses/:addressId/default
   */
  async setDefaultDeliveryAddress(addressId: string): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}/default`,
        { method: 'PATCH' }
      );
      return createSuccessResponse(
        this.transformDeliveryAddress(response.data),
        response.message ?? 'Default address set successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  /**
   * Update delivery mode for a specific address
   * PATCH /delivery-mode/addresses/:addressId/mode
   */
  async updateAddressDeliveryMode(
    addressId: string,
    deliveryMode: DeliveryMode
  ): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}/mode`,
        { method: 'PATCH', body: JSON.stringify({ deliveryMode }) }
      );
      return createSuccessResponse(
        this.transformDeliveryAddress(response.data),
        response.message ?? 'Address delivery mode updated successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  /**
   * Batch update multiple delivery addresses
   * POST /delivery-mode/addresses/batch
   */
  async batchUpdateDeliveryAddresses(
    updates: Array<{ id: string } & UpdateDeliveryAddressInput>
  ): Promise<ApiResponse<{ updatedAddresses: DeliveryAddress[]; successCount: number; failureCount: number }>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/addresses/batch',
        { method: 'POST', body: JSON.stringify({ addresses: updates }) }
      );
      return createSuccessResponse(
        {
          updatedAddresses: (response.data?.updatedAddresses ?? []).map((a: any) =>
            this.transformDeliveryAddress(a)
          ),
          successCount: response.data?.successCount ?? 0,
          failureCount: response.data?.failureCount ?? 0,
        },
        response.message ?? 'Batch update completed'
      );
    } catch (error) {
      return this.handleError<{
        updatedAddresses: DeliveryAddress[];
        successCount: number;
        failureCount: number;
      }>(error);
    }
  }

  /**
   * Get delivery address statistics
   * GET /delivery-mode/addresses/stats
   */
  async getDeliveryAddressStats(): Promise<ApiResponse<AddressStats>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/addresses/stats'
      );
      return createSuccessResponse(
        {
          ...response.data,
          defaultAddress: response.data?.defaultAddress
            ? this.transformDeliveryAddress(response.data.defaultAddress)
            : null,
          recentAddresses: (response.data?.recentAddresses ?? []).map((a: any) =>
            this.transformDeliveryAddress(a)
          ),
        },
        response.message ?? 'Address statistics retrieved successfully'
      );
    } catch (error) {
      return this.handleError<AddressStats>(error);
    }
  }

  // ─── Delivery Mode Settings ───────────────────────────────────────────────────

  /**
   * Get delivery mode settings
   * GET /delivery-mode/settings
   */
  async getDeliveryModeSettings(): Promise<ApiResponse<DeliveryModeSettings | null>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/settings'
      );
      return createSuccessResponse(
        response.data ? this.transformDeliveryModeSettings(response.data) : null,
        response.message ?? 'Delivery mode settings retrieved successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryModeSettings | null>(error);
    }
  }

  /**
   * Get delivery mode settings with details
   * GET /delivery-mode/settings/details
   */
  async getDeliveryModeSettingsWithDetails(): Promise<ApiResponse<SettingsWithDetails>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/settings/details'
      );
      return createSuccessResponse(
        {
          settings: response.data?.settings
            ? this.transformDeliveryModeSettings(response.data.settings)
            : null,
          addressSummary: response.data?.addressSummary ?? {
            total: 0,
            byMode: { DELIVERY: 0, PICKUP: 0 },
            hasDefault: false,
            defaultAddress: null,
          },
        },
        response.message ?? 'Delivery mode settings retrieved successfully'
      );
    } catch (error) {
      return this.handleError<SettingsWithDetails>(error);
    }
  }

  /**
   * Create or update delivery mode settings
   * POST /delivery-mode/settings
   */
  async upsertDeliveryModeSettings(
    data: CreateDeliveryModeSettingsInput
  ): Promise<ApiResponse<DeliveryModeSettings>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/settings',
        { method: 'POST', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformDeliveryModeSettings(response.data),
        response.message ?? 'Delivery mode settings updated successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryModeSettings>(error);
    }
  }

  // ─── Delivery Mode Filtered Addresses ────────────────────────────────────────

  /**
   * Get addresses by delivery mode
   * GET /delivery-mode/:deliveryMode/addresses
   */
  async getAddressesByDeliveryMode(
    deliveryMode: DeliveryMode
  ): Promise<ApiResponse<{ deliveryAddresses: DeliveryAddress[]; count: number; deliveryMode: DeliveryMode }>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/${deliveryMode}/addresses`
      );
      return createSuccessResponse(
        {
          deliveryAddresses: (response.data?.deliveryAddresses ?? []).map((a: any) =>
            this.transformDeliveryAddress(a)
          ),
          count: response.data?.count ?? 0,
          deliveryMode,
        },
        response.message ?? `Delivery addresses for ${deliveryMode} mode retrieved successfully`
      );
    } catch (error) {
      return this.handleError<{
        deliveryAddresses: DeliveryAddress[];
        count: number;
        deliveryMode: DeliveryMode;
      }>(error);
    }
  }

  /**
   * Get default address for specific delivery mode
   * GET /delivery-mode/:deliveryMode/addresses/default
   */
  async getDefaultAddressByDeliveryMode(
    deliveryMode: DeliveryMode
  ): Promise<ApiResponse<DeliveryAddress | null>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/${deliveryMode}/addresses/default`
      );
      return createSuccessResponse(
        response.data ? this.transformDeliveryAddress(response.data) : null,
        response.message ?? `Default ${deliveryMode} address retrieved successfully`
      );
    } catch (error) {
      return this.handleError<DeliveryAddress | null>(error);
    }
  }

  // ─── Address Validation and Geocoding ────────────────────────────────────────

  /**
   * Validate address data
   * POST /delivery-mode/addresses/validate
   */
  async validateAddress(
    addressData: Partial<CreateDeliveryAddressInput>
  ): Promise<ApiResponse<AddressValidationResult>> {
    try {
      const response = await this.request<{ data: AddressValidationResult; message?: string }>(
        '/api/delivery-mode/addresses/validate',
        { method: 'POST', body: JSON.stringify(addressData) }
      );
      return createSuccessResponse(
        response.data,
        response.message ?? 'Address validation completed'
      );
    } catch (error) {
      return this.handleError<AddressValidationResult>(error);
    }
  }

  /**
   * Geocode address to get coordinates
   * POST /delivery-mode/addresses/geocode
   */
  async geocodeAddress(
    addressData: Partial<CreateDeliveryAddressInput>
  ): Promise<ApiResponse<GeocodeResult>> {
    try {
      const response = await this.request<{ data: GeocodeResult; message?: string }>(
        '/api/delivery-mode/addresses/geocode',
        { method: 'POST', body: JSON.stringify(addressData) }
      );
      return createSuccessResponse(
        response.data,
        response.message ?? 'Address geocoded successfully'
      );
    } catch (error) {
      return this.handleError<GeocodeResult>(error);
    }
  }

  // ─── Express Delivery Specific ───────────────────────────────────────────────

  /**
   * Check express delivery eligibility for an address
   * GET /delivery-mode/express/addresses/:addressId/eligibility
   */
  async checkExpressDeliveryEligibility(
    addressId: string
  ): Promise<ApiResponse<ExpressEligibilityResult>> {
    try {
      const response = await this.request<{ data: ExpressEligibilityResult; message?: string }>(
        `/api/delivery-mode/express/addresses/${addressId}/eligibility`
      );
      return createSuccessResponse(
        response.data,
        response.message ?? 'Express delivery eligibility checked'
      );
    } catch (error) {
      return this.handleError<ExpressEligibilityResult>(error);
    }
  }

  // ─── Address History ─────────────────────────────────────────────────────────

  /**
   * Get address history with usage tracking
   * GET /delivery-mode/addresses/history?limit=:limit
   */
  async getAddressHistory(limit: number = 10): Promise<ApiResponse<{ history: AddressHistoryEntry[]; count: number }>> {
    try {
      const params = new URLSearchParams();
      params.append('limit', String(limit));

      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/history?${params.toString()}`
      );
      return createSuccessResponse(
        {
          history: (response.data?.history ?? []).map((h: any) => ({
            ...this.transformDeliveryAddress(h),
            lastUsedAt: new Date(h.lastUsedAt),
            usageCount: h.usageCount,
          })),
          count: response.data?.count ?? 0,
        },
        response.message ?? 'Address history retrieved successfully'
      );
    } catch (error) {
      return this.handleError<{ history: AddressHistoryEntry[]; count: number }>(error);
    }
  }

  // ─── Admin Functions ─────────────────────────────────────────────────────────

  /**
   * Bulk update delivery mode settings for multiple users (admin only)
   * POST /admin/delivery-mode/settings/bulk
   */
  async bulkUpdateDeliveryModeSettings(
    updates: Array<{
      userId: string;
      defaultDeliveryMode?: DeliveryMode;
      expressDeliveryEnabled?: boolean;
      contactlessDelivery?: boolean;
    }>
  ): Promise<ApiResponse<BulkUpdateResult>> {
    try {
      const response = await this.request<{ data: BulkUpdateResult; message?: string }>(
        '/api/admin/delivery-mode/settings/bulk',
        { method: 'POST', body: JSON.stringify({ updates }) }
      );
      return createSuccessResponse(
        response.data,
        response.message ?? 'Bulk update completed'
      );
    } catch (error) {
      return this.handleError<BulkUpdateResult>(error);
    }
  }

  /**
   * Get all delivery mode settings with pagination (admin only)
   * GET /admin/delivery-mode/settings?page=:page&limit=:limit
   */
  async getAllDeliveryModeSettings(
    page: number = 1,
    limit: number = 20
  ): Promise<ApiResponse<PaginatedAdminSettings>> {
    try {
      const params = new URLSearchParams();
      params.append('page', String(page));
      params.append('limit', String(limit));

      const response = await this.request<{ data: any; message?: string }>(
        `/api/admin/delivery-mode/settings?${params.toString()}`
      );
      return createSuccessResponse(
        {
          settings: (response.data?.settings ?? []).map((s: any) => ({
            ...this.transformDeliveryModeSettings(s),
            profile: s.profile,
          })),
          pagination: response.data?.pagination ?? {
            total: 0,
            page,
            limit,
            totalPages: 0,
          },
        },
        response.message ?? 'All delivery mode settings retrieved successfully'
      );
    } catch (error) {
      return this.handleError<PaginatedAdminSettings>(error);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const deliverySettingsApiClient = new DeliverySettingsApiClient();
export default DeliverySettingsApiClient;