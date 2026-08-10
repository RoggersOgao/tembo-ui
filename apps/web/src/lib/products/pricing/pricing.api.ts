
import { getToken } from "@/lib/get-token";
import { BillingPeriod } from "@/types/products/pricing.types";

// ========================
// Request Interfaces
// ========================

export interface CreatePricingOptionInput {
  amount: number;
  billingPeriod: BillingPeriod;
  currency?: string;
  minimumTerm?: number;
  maximumTerm?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CreatePricingConfigInput {
  pricingOptions?: CreatePricingOptionInput[];
  securityDeposit?: number;
  applicationFee?: number;
  processingFee?: number;
  salePrice?: number;
  downPayment?: number;
}

export interface UpdatePricingConfigInput {
  securityDeposit?: number;
  applicationFee?: number;
  processingFee?: number;
  salePrice?: number;
  downPayment?: number;
  isActive?: boolean;
}

export interface UpdatePricingOptionInput {
  amount?: number;
  billingPeriod?: BillingPeriod;
  currency?: string;
  minimumTerm?: number;
  maximumTerm?: number;
  isDefault?: boolean;
  isActive?: boolean;
}

export interface CalculatePriceInput {
  termLength: number;
  billingPeriod: BillingPeriod;
  optionId?: string;
  includeFees?: boolean;
  discountCode?: string;
}

export interface PricingOptionsQuery {
  includeInactive?: boolean;
  billingPeriod?: BillingPeriod;
}

// ========================
// Response Interfaces
// ========================

export interface PricingOption {
  id: string;
  pricingConfigId: string;
  amount: number;
  currency: string;
  billingPeriod: BillingPeriod;
  minimumTerm?: number;
  maximumTerm?: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
}

export interface PricingConfig {
  id: string;
  propertyId: string;
  securityDeposit?: number;
  applicationFee?: number;
  processingFee?: number;
  salePrice?: number;
  downPayment?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string;
  pricingOptions?: PricingOption[];
}

export interface PriceCalculation {
  pricingOption: {
    id: string;
    amount: number;
    billingPeriod: BillingPeriod;
    currency: string;
    minimumTerm?: number;
    maximumTerm?: number;
  };
  termLength: number;
  basePrice: number;
  discount?: {
    type: string;
    value: number;
    amount: number;
    description: string;
  };
  subtotal: number;
  customFees: number;
  oneTimeFees: {
    securityDeposit: number;
    applicationFee: number;
    processingFee: number;
  };
  oneTimeTotal: number;
  total: number;
  grandTotal: number;
  currency: string;
  breakdown: {
    basePrice: number;
    discount: number;
    customFees: number;
    oneTimeFees: number;
  };
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Array<{ field?: string; message: string; code?: string }>;
  metadata?: Record<string, any>;
}

// ========================
// API Client Class
// ========================

class PricingApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  /**
   * Generic request handler with automatic token injection
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<ApiResponse<T>> {
    let token: string | undefined | null;

    if (requireAuth) {
      token = await getToken()

      if (!token) {
        throw new Error("Authorization token is missing. Please log in.");
      }
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });

    if (res.status === 401) {
      console.log("Unauthorized pricing request");
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({ message: "Request failed" }));
      throw new Error(errorData.message || `Request failed: ${res.status}`);
    }

    return res.json();
  }

  // ========================
  // Pricing Configuration Methods
  // ========================

  /**
   * Create pricing configuration for a property
   * POST /api/v1/products/:propertyId/pricing
   */
  async createPricingConfig(
    propertyId: string,
    data: CreatePricingConfigInput
  ): Promise<ApiResponse<PricingConfig>> {
    return await this.request<PricingConfig>(
      `/api/v1/products/${propertyId}/pricing`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Get pricing configuration by property ID
   * GET /api/v1/products/:propertyId/pricing
   */
  async getPricingByProperty(
    propertyId: string,
    includeInactive: boolean = false
  ): Promise<ApiResponse<PricingConfig>> {
    const params = new URLSearchParams();
    if (includeInactive) params.append("includeInactive", "true");

    return await this.request<PricingConfig>(
      `/api/v1/products/${propertyId}/pricing?${params.toString()}`,
      { method: "GET" }
    );
  }

  /**
   * Update pricing configuration
   * PUT /api/pricing/:id
   */
  async updatePricingConfig(
    id: string,
    data: UpdatePricingConfigInput
  ): Promise<ApiResponse<PricingConfig>> {
    return await this.request<PricingConfig>(
      `/api/pricing/${id}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete pricing configuration (soft delete)
   * DELETE /api/pricing/:id
   */
  async deletePricingConfig(id: string): Promise<ApiResponse<null>> {
    return await this.request<null>(
      `/api/pricing/${id}`,
      { method: "DELETE" }
    );
  }

  // ========================
  // Pricing Options Methods
  // ========================

  /**
   * Add pricing option to configuration
   * POST /api/pricing/:pricingConfigId/options
   */
  async addPricingOption(
    pricingConfigId: string,
    data: CreatePricingOptionInput
  ): Promise<ApiResponse<PricingOption>> {
    return await this.request<PricingOption>(
      `/api/pricing/${pricingConfigId}/options`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Get pricing options for a configuration
   * GET /api/pricing/:pricingConfigId/options
   */
  async getPricingOptions(
    pricingConfigId: string,
    query?: PricingOptionsQuery
  ): Promise<ApiResponse<PricingOption[]>> {
    const params = new URLSearchParams();
    if (query?.includeInactive) params.append("includeInactive", "true");
    if (query?.billingPeriod) params.append("billingPeriod", query.billingPeriod);

    return await this.request<PricingOption[]>(
      `/api/pricing/${pricingConfigId}/options?${params.toString()}`,
      { method: "GET" }
    );
  }

  /**
   * Update pricing option
   * PUT /api/pricing/options/:optionId
   */
  async updatePricingOption(
    optionId: string,
    data: UpdatePricingOptionInput
  ): Promise<ApiResponse<PricingOption>> {
    return await this.request<PricingOption>(
      `/api/pricing/options/${optionId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  }

  /**
   * Delete pricing option (soft delete)
   * DELETE /api/pricing/options/:optionId
   */
  async deletePricingOption(optionId: string): Promise<ApiResponse<null>> {
    return await this.request<null>(
      `/api/pricing/options/${optionId}`,
      { method: "DELETE" }
    );
  }

  /**
   * Set default pricing option
   * PATCH /api/pricing/options/:optionId/set-default
   */
  async setDefaultPricingOption(
    optionId: string
  ): Promise<ApiResponse<PricingOption>> {
    return await this.request<PricingOption>(
      `/api/pricing/options/${optionId}/set-default`,
      { method: "PATCH" }
    );
  }

  // ========================
  // Price Calculation Methods
  // ========================

  /**
   * Calculate total price for a term
   * POST /api/pricing/:pricingConfigId/calculate
   */
  async calculatePrice(
    pricingConfigId: string,
    data: CalculatePriceInput
  ): Promise<ApiResponse<PriceCalculation>> {
    return await this.request<PriceCalculation>(
      `/api/pricing/${pricingConfigId}/calculate`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  }

  // ========================
  // Helper Methods
  // ========================

  /**
   * Get authentication token for external use
   */
  async getAuthToken(): Promise<string | null> {
    return await getToken()
  }
}

export const pricingApiClient = new PricingApiClient();