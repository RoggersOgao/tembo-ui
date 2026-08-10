import { getToken } from '@/lib/get-token';
import {
  ApiResponse,
  ErrorCode,
  createSuccessResponse,
  createErrorResponse,
} from '@repo/api-utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export type VerificationStatus = 'NOT_VERIFIED' | 'PENDING' | 'VERIFIED' | 'REJECTED' | 'EXPIRED';
export type VerificationMethod = 'MANUAL' | 'AUTOMATED' | 'THIRD_PARTY';
export type IDDocumentType = 'PASSPORT' | 'DRIVERS_LICENSE' | 'NATIONAL_ID' | 'RESIDENCE_PERMIT' | 'OTHER';
export type ProfileVisibility = 'PUBLIC' | 'PRIVATE';
export type Gender = 'MALE' | 'FEMALE' | 'NON_BINARY' | 'PREFER_NOT_TO_SAY' | 'OTHER';
export type UserRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'STAFF' | 'DELIVERY' | 'SUPPLIER' | 'CUSTOMER' | 'SUPPORT' | 'VIEWER';
export type DeliveryMode = 'DELIVERY' | 'PICKUP';

export interface ProfileUser {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  image: string | null;
  role: UserRole;
  isActive: boolean;
  isSuspended: boolean;
  createdAt: Date;
}

export interface DeliveryAddress {
  id: string;
  profileId: string;
  label: string | null;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  county: string | null;
  postalCode: string | null;
  country: string;
  latitude: number | null;
  longitude: number | null;
  instructions: string | null;
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

export interface Profile {
  id: string;
  userId: string;
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  displayName: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;
  secondaryEmail: string | null;
  secondaryPhone: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;
  idVerificationStatus: VerificationStatus;
  idVerifiedAt: Date | null;
  idVerificationMethod: VerificationMethod | null;
  idDocumentType: IDDocumentType | null;
  idDocumentNumber: string | null;
  idDocumentExpiry: Date | null;
  bio: string | null;
  profileVisibility: ProfileVisibility;
  totalOrders: number;
  totalSpent: number;
  notificationPreferences: Record<string, unknown> | null;
  deliveryMode: DeliveryModeSettings | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  user: ProfileUser;
}

export interface PaginatedProfiles {
  profiles: Profile[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasMore: boolean;
  };
}

export interface ProfileStats {
  overview: {
    totalProfiles: number;
    profilesWithHighCompletion: number;
    profilesWithVerifiedId: number;
    averageSpend: number;
  };
  byRole: Record<string, number>;
  verification: {
    verified: number;
    pending: number;
    notVerified: number;
  };
  recentUpdates: Profile[];
}

export interface ProfileFilter {
  userId?: string;
  firstName?: string;
  lastName?: string;
  city?: string;
  county?: string;
  idVerificationStatus?: VerificationStatus;
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface CreateProfileInput {
  userId: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  dateOfBirth?: string;
  gender?: Gender;
  secondaryEmail?: string;
  secondaryPhone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  country?: string;
  bio?: string;
  profileVisibility?: ProfileVisibility;
  notificationPreferences?: Record<string, unknown>;
}

export interface UpdateProfileInput extends Partial<Omit<CreateProfileInput, 'userId'>> {
  idVerificationStatus?: VerificationStatus;
  idVerifiedAt?: string;
  idVerificationMethod?: VerificationMethod;
  idDocumentType?: IDDocumentType;
  idDocumentNumber?: string;
  idDocumentExpiry?: string;
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

export interface UpdateDeliveryAddressInput extends Partial<CreateDeliveryAddressInput> {}

export interface CreateDeliveryModeSettingsInput {
  defaultDeliveryMode?: DeliveryMode;
  preferredDeliveryTime?: string;
  preferredDeliveryDate?: string;
  contactlessDelivery?: boolean;
  leaveAtDoor?: boolean;
  expressDeliveryEnabled?: boolean;
  expressDeliveryRadius?: number;
  preferredPickupLocation?: string;
  pickupInstructions?: string;
}

// ─── Client ───────────────────────────────────────────────────────────────────

class ProfileApiClient {
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
  private transformProfile(p: any): Profile {
    return {
      ...p,
      dateOfBirth:      p.dateOfBirth      ? new Date(p.dateOfBirth)      : null,
      idVerifiedAt:     p.idVerifiedAt     ? new Date(p.idVerifiedAt)     : null,
      idDocumentExpiry: p.idDocumentExpiry ? new Date(p.idDocumentExpiry) : null,
      createdAt:        new Date(p.createdAt),
      updatedAt:        new Date(p.updatedAt),
      deletedAt:        p.deletedAt        ? new Date(p.deletedAt)        : null,
      user: {
        ...p.user,
        createdAt: new Date(p.user.createdAt),
      },
      deliveryMode: p.deliveryMode
        ? this.transformDeliveryModeSettings(p.deliveryMode)
        : null,
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

  private transformDeliveryAddress(a: any): DeliveryAddress {
    return {
      ...a,
      createdAt: new Date(a.createdAt),
      updatedAt: new Date(a.updatedAt),
    };
  }

  // ─── Profile CRUD ─────────────────────────────────────────────────────────────

  // ── GET /profile/me ──────────────────────────────────────────────────────────
  async getMyProfile(): Promise<ApiResponse<Profile>> {
    try {
      const response = await this.request<{ data: any; message?: string }>('/profile/me');
      return createSuccessResponse(
        this.transformProfile(response.data),
        response.message ?? 'Profile retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Profile>(error);
    }
  }

  // ── GET /profile/:id ─────────────────────────────────────────────────────────
  async getProfileById(id: string): Promise<ApiResponse<Profile>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(`/profile/${id}`);
      return createSuccessResponse(
        this.transformProfile(response.data),
        response.message ?? 'Profile retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Profile>(error);
    }
  }

  // ── GET /profile (paginated) ─────────────────────────────────────────────────
  async getProfiles(filters: ProfileFilter = {}): Promise<ApiResponse<PaginatedProfiles>> {
    try {
      const params = new URLSearchParams();

      if (filters.page)                 params.append('page',                 String(filters.page));
      if (filters.limit)                params.append('limit',                String(filters.limit));
      if (filters.sortBy)               params.append('sortBy',               filters.sortBy);
      if (filters.sortOrder)            params.append('sortOrder',            filters.sortOrder);
      if (filters.search)               params.append('search',               filters.search);
      if (filters.firstName)            params.append('firstName',            filters.firstName);
      if (filters.lastName)             params.append('lastName',             filters.lastName);
      if (filters.city)                 params.append('city',                 filters.city);
      if (filters.county)               params.append('county',               filters.county);
      if (filters.idVerificationStatus) params.append('idVerificationStatus', filters.idVerificationStatus);

      const response = await this.request<{ data: any; message?: string }>(
        `/profile?${params.toString()}`
      );

      return createSuccessResponse(
        {
          profiles: (response.data?.profiles ?? []).map((p: any) => this.transformProfile(p)),
          pagination: response.data?.pagination ?? {
            total:      0,
            page:       filters.page  ?? 1,
            limit:      filters.limit ?? 20,
            totalPages: 0,
            hasMore:    false,
          },
        },
        response.message ?? 'Profiles retrieved successfully'
      );
    } catch (error) {
      return this.handleError<PaginatedProfiles>(error);
    }
  }

  // ── GET /profile/public/:userId ──────────────────────────────────────────────
  async getPublicProfile(userId: string): Promise<ApiResponse<Profile>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/profile/public/${userId}`,
        {},
        false // public — no auth required
      );
      return createSuccessResponse(
        this.transformProfile(response.data),
        response.message ?? 'Public profile retrieved successfully'
      );
    } catch (error) {
      return this.handleError<Profile>(error);
    }
  }

  // ── POST /profile ────────────────────────────────────────────────────────────
  async createProfile(data: CreateProfileInput): Promise<ApiResponse<Profile>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/profile',
        { method: 'POST', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformProfile(response.data),
        response.message ?? 'Profile created successfully'
      );
    } catch (error) {
      return this.handleError<Profile>(error);
    }
  }

  // ── PUT /profile/me ──────────────────────────────────────────────────────────
  async updateMyProfile(data: UpdateProfileInput): Promise<ApiResponse<Profile>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/profile/me',
        { method: 'PUT', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformProfile(response.data),
        response.message ?? 'Profile updated successfully'
      );
    } catch (error) {
      return this.handleError<Profile>(error);
    }
  }

  // ── PUT /profile/:id ─────────────────────────────────────────────────────────
  async updateProfileById(id: string, data: UpdateProfileInput): Promise<ApiResponse<Profile>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/profile/${id}`,
        { method: 'PUT', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformProfile(response.data),
        response.message ?? 'Profile updated successfully'
      );
    } catch (error) {
      return this.handleError<Profile>(error);
    }
  }

  // ── DELETE /profile/:id ──────────────────────────────────────────────────────
  async deleteProfileById(id: string): Promise<ApiResponse<{ id: string; userId: string }>> {
    try {
      const response = await this.request<{ data: { id: string; userId: string }; message?: string }>(
        `/api/profile/${id}`,
        { method: 'DELETE' }
      );
      return createSuccessResponse(
        response.data,
        response.message ?? 'Profile deleted successfully'
      );
    } catch (error) {
      return this.handleError<{ id: string; userId: string }>(error);
    }
  }

  // ── GET /profile/stats ───────────────────────────────────────────────────────
  async getProfileStats(): Promise<ApiResponse<ProfileStats>> {
    try {
      const response = await this.request<{ data: any; message?: string }>('/profile/stats');
      return createSuccessResponse(
        {
          ...response.data,
          recentUpdates: (response.data?.recentUpdates ?? []).map((p: any) =>
            this.transformProfile(p)
          ),
        },
        response.message ?? 'Profile stats retrieved successfully'
      );
    } catch (error) {
      return this.handleError<ProfileStats>(error);
    }
  }

  // ─── Delivery Mode Settings ───────────────────────────────────────────────────

  // ── GET /delivery-mode/settings ──────────────────────────────────────────────
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

  // ── PUT /delivery-mode/settings ───────────────────────────────────────────────
  async updateDeliveryModeSettings(
    data: CreateDeliveryModeSettingsInput
  ): Promise<ApiResponse<DeliveryModeSettings>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        '/api/delivery-mode/settings',
        { method: 'PUT', body: JSON.stringify(data) }
      );
      return createSuccessResponse(
        this.transformDeliveryModeSettings(response.data),
        response.message ?? 'Delivery mode settings updated successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryModeSettings>(error);
    }
  }

  // ─── Delivery Addresses ───────────────────────────────────────────────────────

  // ── GET /delivery-mode/:deliveryMode/addresses ───────────────────────────────
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
          count:        response.data?.count ?? 0,
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

  // ── POST /delivery-mode/addresses ────────────────────────────────────────────
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
        response.message ?? 'Address saved successfully'
      );
    } catch (error) {
      return this.handleError<DeliveryAddress>(error);
    }
  }

  // ── PUT /delivery-mode/addresses/:addressId ───────────────────────────────────
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

  // ── PATCH /delivery-mode/addresses/:addressId ─────────────────────────────────
  // Dedicated endpoint for switching an address between DELIVERY ↔ PICKUP mode.
  // Kept separate from updateDeliveryAddress because the backend may route this
  // differently (e.g. re-validation of default flags across modes).
  async updateAddressDeliveryMode(
    addressId: string,
    deliveryMode: DeliveryMode
  ): Promise<ApiResponse<DeliveryAddress>> {
    try {
      const response = await this.request<{ data: any; message?: string }>(
        `/api/delivery-mode/addresses/${addressId}`,
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
}

// ─── Singleton ────────────────────────────────────────────────────────────────
export const profileApiClient = new ProfileApiClient();
export default ProfileApiClient;