// schemas/profile.schemas.ts
import { z } from 'zod';
import {
    Gender,
    IDDocumentType,
    ProfileVisibility,
    VerificationMethod,
    VerificationStatus,
    UserRole,
} from '@repo/database';

// ── Enum schemas ──────────────────────────────────────────────

export const GenderEnum             = z.nativeEnum(Gender);
export const IDDocumentTypeEnum     = z.nativeEnum(IDDocumentType);
export const ProfileVisibilityEnum  = z.nativeEnum(ProfileVisibility);
export const VerificationStatusEnum = z.nativeEnum(VerificationStatus);
export const VerificationMethodEnum = z.nativeEnum(VerificationMethod);
export const UserRoleEnum           = z.nativeEnum(UserRole);

// ── Date helper ───────────────────────────────────────────────

const DateOrString = z.coerce.string();

// ── Base profile input ────────────────────────────────────────
// Fields match the Profile model in schema.prisma exactly.

export const ProfileInputSchema = z.object({
    // Personal
    firstName:   z.string().min(1).max(100).optional(),
    lastName:    z.string().min(1).max(100).optional(),
    displayName: z.string().max(150).optional(),
    dateOfBirth: DateOrString.optional(),
    gender:      GenderEnum.optional(),

    // Contact
    secondaryEmail: z.string().email().max(255).optional(),
    secondaryPhone: z.string().max(20).optional(),

    // Primary delivery address
    addressLine1: z.string().max(255).optional(),
    addressLine2: z.string().max(255).optional(),
    city:         z.string().max(100).optional(),
    county:       z.string().max(100).optional(),
    postalCode:   z.string().max(20).optional(),
    country:      z.string().length(2).default('KE').optional(),

    // Identity verification
    idVerificationStatus: VerificationStatusEnum.default('NOT_VERIFIED'),
    idVerifiedAt:         DateOrString.optional(),
    idVerificationMethod: VerificationMethodEnum.optional(),
    idDocumentType:       IDDocumentTypeEnum.optional(),
    idDocumentNumber:     z.string().max(100).optional(),
    idDocumentExpiry:     DateOrString.optional(),

    // Social
    bio:               z.string().max(1000).optional(),
    profileVisibility: ProfileVisibilityEnum.default('PUBLIC').optional(),

    // Notification preferences (free-form JSON column)
      notificationPreferences: z.any().optional(),
});

// ── Create — userId required ──────────────────────────────────

export const CreateProfileSchema = ProfileInputSchema.extend({
    userId: z.string().cuid(),
});

// ── Update — userId not required ──────────────────────────────

export const UpdateProfileSchema = ProfileInputSchema;

// ── Inferred types ────────────────────────────────────────────

export type ProfileInput       = z.infer<typeof ProfileInputSchema>;
export type CreateProfileInput = z.infer<typeof CreateProfileSchema>;
export type UpdateProfileInput = z.infer<typeof UpdateProfileSchema>;

// ── Filters ───────────────────────────────────────────────────
// Only fields that exist on Profile and are meaningful to filter by.

export const ProfileFiltersSchema = z.object({
    userId:               z.string().cuid().optional(),
    firstName:            z.string().optional(),
    lastName:             z.string().optional(),
    search:               z.string().optional(),
    idVerificationStatus: VerificationStatusEnum.optional(),
    page:                 z.coerce.number().int().min(1).default(1),
    limit:                z.coerce.number().int().min(1).max(100).default(20),
    sortBy:               z.enum([
                              'createdAt',
                              'updatedAt',
                              'firstName',
                              'lastName',
                              'totalOrders',
                              'totalSpent',
                          ]).default('createdAt'),
    sortOrder:            z.enum(['asc', 'desc']).default('desc'),
});

export type ProfileFilters = z.infer<typeof ProfileFiltersSchema>;

// ── Stats ─────────────────────────────────────────────────────

export const ProfileStatsSchema = z.object({
    overview: z.object({
        totalProfiles:          z.number(),
        profilesWithVerifiedId: z.number(),
    }),
    byRole:        z.record(z.number()),
    recentUpdates: z.array(z.unknown()),
});

export type ProfileStats = z.infer<typeof ProfileStatsSchema>;

// ── Completion metrics ────────────────────────────────────────

export const ProfileCompletionMetricsSchema = z.object({
    completion: z.number().min(0).max(100),
    sections: z.object({
        personal:     z.number(),  // firstName, lastName, dateOfBirth, gender   (40%)
        contact:      z.number(),  // secondaryEmail, secondaryPhone             (30%)
        verification: z.number(),  // idVerificationStatus === VERIFIED          (30%)
    }),
    missingFields:   z.array(z.string()),
    recommendations: z.array(z.string()),
});

export type ProfileCompletionMetrics = z.infer<typeof ProfileCompletionMetricsSchema>;