import {
    Gender,
    ProfileVisibility,
    VerificationStatus,
    VerificationMethod,
    IDDocumentType,
    UserRole,
    DeliveryMode, // PICKUP | DELIVERY only
} from '@repo/database';
import { Prisma } from '@repo/database';

// ========== PROFILE TYPES ==========

export interface ProfileWithUser {
  id: string;
  userId: string;
  // Personal Information
  firstName: string | null;
  lastName: string | null;
  middleName: string | null;
  displayName: string | null;
  dateOfBirth: Date | null;
  gender: Gender | null;

  // Contact Information
  secondaryEmail: string | null;
  secondaryPhone: string | null;

  // Address
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  county: string | null;
  postalCode: string | null;
  country: string | null;

  // Verification Status
  idVerificationStatus: VerificationStatus;
  idVerifiedAt: Date | null;
  idVerificationMethod: VerificationMethod | null;
  idDocumentType: IDDocumentType | null;
  idDocumentNumber: string | null;
  idDocumentExpiry: Date | null;

  // Social
  bio: string | null;
  profileVisibility: ProfileVisibility;

  // Stats
  totalOrders: number;
  totalSpent: number;

  // Preferences
  notificationPreferences: Prisma.JsonValue | null;

  // Relations — delivery mode is a separate model, not a scalar on Profile
  deliveryMode: DeliveryModeSettings | null;

  // Metadata
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;

  // User relation
  user: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    image: string | null;
    role: UserRole;
    isActive: boolean;
    isSuspended: boolean;
    createdAt: Date;
  };
}

export interface PaginatedProfiles {
    profiles: ProfileWithUser[];
    pagination: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
        hasMore: boolean;
    };
}

export interface ProfileCompletionMetrics {
    completion: number;
    sections: {
        personal: number;
        contact: number;
        address: number;
        verification: number;
    };
    missingFields: string[];
    recommendations: string[];
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
    recentUpdates: ProfileWithUser[];
}

export interface ProfileFilters {
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
    sortOrder?: "asc" | "desc";
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
    notificationPreferences?: Prisma.InputJsonValue;
}

export interface UpdateProfileInput {
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
    notificationPreferences?: Prisma.InputJsonValue;
    idVerificationStatus?: VerificationStatus;
    idVerifiedAt?: string;
    idVerificationMethod?: VerificationMethod;
    idDocumentType?: IDDocumentType;
    idDocumentNumber?: string;
    idDocumentExpiry?: string;
    // deliveryMode is managed via DeliveryModeSetting — use dedicated endpoints
}

// ========== DELIVERY ADDRESS TYPES ==========

// Re-export DeliveryMode from DB package — schema defines: PICKUP | DELIVERY
export { DeliveryMode } from '@repo/database';

/**
 * @deprecated Use DeliveryMode from '@repo/database' directly.
 * EXPRESS is not a valid value in the schema.
 */
export enum PreferredDeliveryTime {
    MORNING = "MORNING",   // 06:00 – 10:00
    MIDDAY = "MIDDAY",     // 10:00 – 14:00
    AFTERNOON = "AFTERNOON",// 14:00 – 18:00
    EVENING = "EVENING",   // 18:00 – 21:00
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
    deliveryMode: DeliveryMode; // PICKUP | DELIVERY
}

export interface UpdateDeliveryAddressInput {
    label?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    country?: string;
    latitude?: number;
    longitude?: number;
    instructions?: string;
    isDefault?: boolean;
    deliveryMode?: DeliveryMode; // PICKUP | DELIVERY
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
    deliveryMode: DeliveryMode; // PICKUP | DELIVERY
    createdAt: Date;
    updatedAt: Date;
}

export interface CreateDeliveryModeSettingsInput {
    defaultDeliveryMode?: DeliveryMode; // PICKUP | DELIVERY
    preferredDeliveryTime?: string;     // free-form string in schema; use PreferredDeliveryTime values as convention
    preferredDeliveryDate?: Date | string;
    contactlessDelivery?: boolean;
    leaveAtDoor?: boolean;
    expressDeliveryEnabled?: boolean;
    expressDeliveryRadius?: number;     // kilometres
    preferredPickupLocation?: string;
    pickupInstructions?: string;
}

export interface UpdateDeliveryModeSettingsInput {
    defaultDeliveryMode?: DeliveryMode; // PICKUP | DELIVERY
    preferredDeliveryTime?: string;
    preferredDeliveryDate?: Date | string;
    contactlessDelivery?: boolean;
    leaveAtDoor?: boolean;
    expressDeliveryEnabled?: boolean;
    expressDeliveryRadius?: number;
    preferredPickupLocation?: string;
    pickupInstructions?: string;
}

// Matches the DeliveryModeSetting model (@@unique([profileId]) — one per profile)
export interface DeliveryModeSettings {
    id: string;
    profileId: string;
    defaultDeliveryMode: DeliveryMode; // PICKUP | DELIVERY
    preferredDeliveryTime: string | null;
    preferredDeliveryDate: Date | null;
    contactlessDelivery: boolean;
    leaveAtDoor: boolean;
    expressDeliveryEnabled: boolean;
    expressDeliveryRadius: number | null; // Float in schema (kilometres)
    preferredPickupLocation: string | null;
    pickupInstructions: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Optional utility types
export interface DeliveryAddressWithMetadata extends DeliveryAddress {
    fullAddress?: string;
    isEditable?: boolean;
}

export interface BulkDeliveryAddressResponse {
    addresses: DeliveryAddress[];
    total: number;
    defaultAddress: DeliveryAddress | null;
}

export interface AddressValidationResult {
    isValid: boolean;
    errors?: string[];
    normalizedAddress?: Partial<DeliveryAddress>;
}