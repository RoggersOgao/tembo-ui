import { z } from 'zod';

// =============================================================================
// ENUMS
// =============================================================================

export const PropertyTypeEnum = z.enum([
    'APARTMENT', 'HOUSE', 'TOWNHOUSE', 'STUDIO',
    'DUPLEX', 'VILLA', 'CONDO', 'OFFICE',
]);

export const ListingTypeEnum = z.enum([
    'FOR_RENT', 'FOR_SALE', 'FOR_LEASE',
    'HOURLY_RENTAL', 'DAILY_RENTAL', 'BOTH_RENT_SALE',
]);

export const ListingTransactionTypeEnum = z.enum([
    'FOR_RENT', 'FOR_SALE', 'FOR_LEASE', 'HOURLY_RENTAL', 'DAILY_RENTAL',
]);

export const ListingStatusEnum = z.enum([
    'DRAFT', 'PENDING_REVIEW', 'ACTIVE', 'PENDING_SALE',
    'PENDING_RENTAL', 'SOLD', 'RENTED', 'EXPIRED', 'ARCHIVED',
]);

export const PriceTypeEnum = z.enum([
    'FIXED', 'NEGOTIABLE', 'CONTACT_FOR_PRICE', 'AUCTION',
]);

export const BillingPeriodSchema = z.enum([
    'HOURLY', 'DAILY', 'WEEKLY', 'MONTHLY',
    'QUARTERLY', 'SEMI_ANNUAL', 'ANNUAL', 'ONE_TIME',
]);

export const DiscountTypeSchema = z.enum(['PERCENTAGE', 'FIXED_AMOUNT']);

// =============================================================================
// SHARED PRIMITIVES
// =============================================================================

export const LocationSchema = z.object({
    address:   z.string().min(1, 'Address is required'),
    latitude:  z.number().min(-90).max(90),
    longitude: z.number().min(-180).max(180),
});

// =============================================================================
// PRICING — CREATE SCHEMAS
// Used by createProperty. Fields have defaults matching Prisma.
// =============================================================================

export const PricingDiscountCreateSchema = z.object({
    termLength:    z.number().int().positive('Term length must be a positive integer'),
    discountType:  DiscountTypeSchema,
    discountValue: z.number().positive('Discount value must be positive'),
    isActive:      z.boolean().default(true),
});

export const PricingOptionCreateSchema = z.object({
    amount:        z.number().positive('Amount must be positive'),
    currency:      z.string().length(3, 'Currency must be a 3-letter ISO code').default('USD'),
    billingPeriod: BillingPeriodSchema,
    minimumTerm:   z.number().int().positive().nullable().optional(),
    maximumTerm:   z.number().int().positive().nullable().optional(),
    isDefault:     z.boolean().default(false),
    isActive:      z.boolean().default(true),
    discounts:     z.array(PricingDiscountCreateSchema).optional(),
});

export const CustomFeeCreateSchema = z.object({
    name:        z.string().min(1, 'Fee name is required'),
    description: z.string().nullable().optional(),
    amount:      z.number(),
    frequency:   BillingPeriodSchema.default('MONTHLY'),
    isRequired:  z.boolean().default(false),
    isActive:    z.boolean().default(true),
});

export const PricingConfigCreateSchema = z.object({
    securityDeposit: z.number().nonnegative().nullable().optional(),
    applicationFee:  z.number().nonnegative().nullable().optional(),
    processingFee:   z.number().nonnegative().nullable().optional(),
    salePrice:       z.number().nonnegative().nullable().optional(),
    downPayment:     z.number().nonnegative().nullable().optional(),
    isActive:        z.boolean().default(true),
    pricingOptions:  z.array(PricingOptionCreateSchema).optional(),
    customFees:      z.array(CustomFeeCreateSchema).optional(),
});

export type PricingDiscountCreate = z.infer<typeof PricingDiscountCreateSchema>;
export type PricingOptionCreate   = z.infer<typeof PricingOptionCreateSchema>;
export type CustomFeeCreate       = z.infer<typeof CustomFeeCreateSchema>;
export type PricingConfigCreate   = z.infer<typeof PricingConfigCreateSchema>;

// =============================================================================
// PRICING — PATCH SCHEMAS
// Used by updateProperty. Each array item carries an `op` discriminant so the
// service can create/update/delete individual rows without touching the rest.
// No .default() — absent keys must stay undefined so filterUndefined() works.
// =============================================================================

// ── Pricing Option Patches ────────────────────────────────────────────────────

const PricingOptionCreatePatchSchema = z.object({
    op:   z.literal('create'),
    data: z.object({
        amount:        z.number().positive(),
        currency:      z.string().length(3).optional(),
        billingPeriod: BillingPeriodSchema,
        minimumTerm:   z.number().int().positive().nullable().optional(),
        maximumTerm:   z.number().int().positive().nullable().optional(),
        isDefault:     z.boolean().optional(),
        isActive:      z.boolean().optional(),
        discounts:     z.array(PricingDiscountCreateSchema).optional(),
    }),
});

const PricingOptionUpdatePatchSchema = z.object({
    op:   z.literal('update'),
    id:   z.string().cuid('Invalid pricing option ID'),
    data: z.object({
        amount:        z.number().positive().optional(),
        currency:      z.string().length(3).optional(),
        billingPeriod: BillingPeriodSchema.optional(),
        minimumTerm:   z.number().int().positive().nullable().optional(),
        maximumTerm:   z.number().int().positive().nullable().optional(),
        isDefault:     z.boolean().optional(),
        isActive:      z.boolean().optional(),
        discounts:     z.array(PricingDiscountCreateSchema).optional(),
    }),
});

const PricingOptionDeletePatchSchema = z.object({
    op: z.literal('delete'),
    id: z.string().cuid('Invalid pricing option ID'),
});

export const PricingOptionPatchSchema = z.discriminatedUnion('op', [
    PricingOptionCreatePatchSchema,
    PricingOptionUpdatePatchSchema,
    PricingOptionDeletePatchSchema,
]);

// ── Custom Fee Patches ────────────────────────────────────────────────────────

const CustomFeeCreatePatchSchema = z.object({
    op:   z.literal('create'),
    data: z.object({
        name:        z.string().min(1),
        description: z.string().nullable().optional(),
        amount:      z.number(),
        frequency:   BillingPeriodSchema.optional(),
        isRequired:  z.boolean().optional(),
        isActive:    z.boolean().optional(),
    }),
});

const CustomFeeUpdatePatchSchema = z.object({
    op:   z.literal('update'),
    id:   z.string().cuid('Invalid custom fee ID'),
    data: z.object({
        name:        z.string().min(1).optional(),
        description: z.string().nullable().optional(),
        amount:      z.number().optional(),
        frequency:   BillingPeriodSchema.optional(),
        isRequired:  z.boolean().optional(),
        isActive:    z.boolean().optional(),
    }),
});

const CustomFeeDeletePatchSchema = z.object({
    op: z.literal('delete'),
    id: z.string().cuid('Invalid custom fee ID'),
});

export const CustomFeePatchSchema = z.discriminatedUnion('op', [
    CustomFeeCreatePatchSchema,
    CustomFeeUpdatePatchSchema,
    CustomFeeDeletePatchSchema,
]);

// ── Pricing Config Update (scalars + patch arrays) ────────────────────────────

export const PricingConfigUpdateSchema = z.object({
    securityDeposit: z.number().nonnegative().nullable().optional(),
    applicationFee:  z.number().nonnegative().nullable().optional(),
    processingFee:   z.number().nonnegative().nullable().optional(),
    salePrice:       z.number().nonnegative().nullable().optional(),
    downPayment:     z.number().nonnegative().nullable().optional(),
    isActive:        z.boolean().optional(),
    pricingOptions:  z.array(PricingOptionPatchSchema).optional(),
    customFees:      z.array(CustomFeePatchSchema).optional(),
});

export type PricingOptionPatch   = z.infer<typeof PricingOptionPatchSchema>;
export type CustomFeePatch        = z.infer<typeof CustomFeePatchSchema>;
export type PricingConfigUpdate   = z.infer<typeof PricingConfigUpdateSchema>;

// =============================================================================
// PRICING — RECORD TYPES (mirror DB response shape)
// deletedAt removed from options/fees — no longer soft-deleted
// =============================================================================

export interface PricingDiscountRecord {
    id:              string;
    pricingOptionId: string;
    termLength:      number;
    discountType:    DiscountType;
    discountValue:   number;
    isActive:        boolean;
    createdAt:       Date;
    updatedAt:       Date;
}

export interface PricingOptionRecord {
    id:              string;
    pricingConfigId: string;
    amount:          number;
    currency:        string;
    billingPeriod:   BillingPeriod;
    minimumTerm:     number | null;
    maximumTerm:     number | null;
    isDefault:       boolean;
    isActive:        boolean;
    createdAt:       Date;
    updatedAt:       Date;
    discounts:       PricingDiscountRecord[];
}

export interface CustomFeeRecord {
    id:              string;
    pricingConfigId: string;
    name:            string;
    description:     string | null;
    amount:          number;
    frequency:       BillingPeriod;
    isRequired:      boolean;
    isActive:        boolean;
    createdAt:       Date;
    updatedAt:       Date;
}

export interface PricingConfigRecord {
    id:              string;
    propertyId:      string;
    securityDeposit: number | null;
    applicationFee:  number | null;
    processingFee:   number | null;
    salePrice:       number | null;
    downPayment:     number | null;
    isActive:        boolean;
    deletedAt:       Date | null;
    createdAt:       Date;
    updatedAt:       Date;
    pricingOptions:  PricingOptionRecord[];
    customFees:      CustomFeeRecord[];
}

// =============================================================================
// PROPERTY — CREATE
// =============================================================================

export const PropertyDataSchema = z.object({
    name:              z.string().min(1, 'Property name is required'),
    description:       z.string().min(1, 'Description is required'),
    categoryId:        z.string().cuid('Invalid category ID'),
    amenities:         z.array(z.string()).default([]),
    highlights:        z.array(z.string()).default([]),
    youtubeLink:       z.string().url('Invalid YouTube URL').optional().or(z.literal('')),
    beds:              z.number().nullable().optional(),
    baths:             z.number().nullable().optional(),
    lotSize:           z.number().positive().nullable().optional(),
    yearBuilt:         z.number().positive().nullable().optional(),
    unitCount:         z.number().nullable().optional(),
    isParkingIncluded: z.boolean().default(false),
    isPetsAllowed:     z.boolean().default(false),
    isActive:          z.boolean().default(true),
    siteId:            z.string().cuid('Invalid site ID').optional(),
    pricingConfig:     PricingConfigCreateSchema.optional(),
});

export const CreatePropertySchema = z.object({
    data:         PropertyDataSchema,
    locationData: LocationSchema,
    tagIds:       z.array(z.string().cuid('Invalid tag ID')).optional().default([]),
});

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>;
export type PropertyData        = z.infer<typeof PropertyDataSchema>;

// =============================================================================
// PROPERTY — UPDATE
// =============================================================================

export const UpdatePropertyDataSchema = z.object({
    name:              z.string().min(1).optional(),
    description:       z.string().min(1).optional(),
    categoryId:        z.string().cuid('Invalid category ID').optional(),
    amenities:         z.array(z.string()).optional(),
    highlights:        z.array(z.string()).optional(),
    youtubeLink:       z.string().url().or(z.literal('')).optional(),
    beds:              z.number().nullable().optional(),
    baths:             z.number().nullable().optional(),
    lotSize:           z.number().positive().nullable().optional(),
    yearBuilt:         z.number().positive().nullable().optional(),
    unitCount:         z.number().nullable().optional(),
    isParkingIncluded: z.boolean().optional(),
    isPetsAllowed:     z.boolean().optional(),
    isActive:          z.boolean().optional(),
    siteId:            z.string().optional(),
    pricingConfig:     PricingConfigUpdateSchema.optional(),
});

export const UpdatePropertySchema = z.object({
    data: UpdatePropertyDataSchema.optional(),
    locationData: z.object({
        address:   z.string().optional(),
        latitude:  z.number().optional(),
        longitude: z.number().optional(),
    }).optional(),
    tagIds: z.array(z.string().cuid('Invalid tag ID')).optional(),
    images: z.object({
        deleted:  z.array(z.string().cuid('Invalid asset ID')).optional(),
        new:      z.array(z.string()).optional(),
        existing: z.array(z.string().cuid('Invalid asset ID')).optional(),
    }).optional(),
});

export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>;

// =============================================================================
// PROPERTY — QUERY
// =============================================================================

export const PropertyQuery = z.object({
    page:          z.coerce.number().int().positive().default(1),
    limit:         z.coerce.number().int().positive().min(1).max(100).default(10),
    search:        z.string().trim().min(1).optional().or(z.literal('')),
    categoryId:    z.string().cuid().optional(),
    categorySlug:  z.string().trim().toLowerCase().optional(),
    propertyType:  PropertyTypeEnum.optional(),
    propertyTypes: z.array(PropertyTypeEnum).optional(),
    tagIds:        z.array(z.string().cuid()).optional(),
    minPrice:      z.coerce.number().nonnegative().optional(),
    maxPrice:      z.coerce.number().positive().optional(),
    beds:          z.coerce.number().int().nonnegative().optional(),
    baths:         z.coerce.number().nonnegative().optional(),
    minLotSize:    z.coerce.number().positive().optional(),
    maxLotSize:    z.coerce.number().positive().optional(),
    minYearBuilt:  z.coerce.number().int().min(1800).max(new Date().getFullYear() + 2).optional(),
    maxYearBuilt:  z.coerce.number().int().min(1800).max(new Date().getFullYear() + 2).optional(),
    billingPeriod: BillingPeriodSchema.optional(),
    isActive:      z.coerce.boolean().default(true),
    includeDeleted: z.coerce.boolean().default(false).optional(),
    managerUserId: z.string().cuid().optional(),
    userId:        z.string().cuid().optional(),
    location:      z.string().trim().optional(),
    createdAfter:  z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    createdBefore: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    updatedAfter:  z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    updatedBefore: z.string().datetime().optional().transform(v => v ? new Date(v) : undefined),
    minRating:     z.coerce.number().min(0).max(5).optional(),
    maxRating:     z.coerce.number().min(0).max(5).optional(),

    city:    z.string().trim().optional(),
    state:   z.string().trim().optional(),
    country: z.string().trim().length(2).optional(), 
    zipCode: z.string().trim().optional(),
    amenities:     z.union([
        z.string().transform(v => v.split(',')),
        z.array(z.string()),
    ]).optional(),
    hasVirtualTour: z.coerce.boolean().optional(),
    agencyId:      z.string().cuid().optional(),
    sortBy:        z.enum([
        'createdAt', 'updatedAt', 'name', 'price',
        'averageRating', 'totalRatings', 'beds', 'baths', 'lotSize', 'yearBuilt',
    ]).default('createdAt'),
    sortOrder:     z.enum(['asc', 'desc']).default('desc'),
    latitude:      z.coerce.number().min(-90).max(90).optional(),
    longitude:     z.coerce.number().min(-180).max(180).optional(),
    radius:        z.coerce.number().positive().max(500).optional(),
}).superRefine((data, ctx) => {
    if (data.propertyType && data.propertyTypes?.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cannot specify both propertyType and propertyTypes', path: ['propertyType'] });
    }
    if (data.minPrice !== undefined && data.maxPrice !== undefined && data.maxPrice <= data.minPrice) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxPrice must be greater than minPrice', path: ['maxPrice'] });
    }
    if (data.minLotSize !== undefined && data.maxLotSize !== undefined && data.maxLotSize <= data.minLotSize) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxLotSize must be greater than minLotSize', path: ['maxLotSize'] });
    }
    if (data.minYearBuilt !== undefined && data.maxYearBuilt !== undefined && data.maxYearBuilt <= data.minYearBuilt) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxYearBuilt must be greater than minYearBuilt', path: ['maxYearBuilt'] });
    }
    if (data.minRating !== undefined && data.maxRating !== undefined && data.maxRating <= data.minRating) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxRating must be greater than minRating', path: ['maxRating'] });
    }
    if (data.userId && data.managerUserId) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cannot specify both userId and managerUserId', path: ['userId'] });
    }
    if (
        (data.latitude !== undefined || data.longitude !== undefined || data.radius !== undefined) &&
        !(data.latitude !== undefined && data.longitude !== undefined && data.radius !== undefined)
    ) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'latitude, longitude, and radius must all be provided together', path: ['latitude'] });
    }
});

export type PropertyQueryInput = z.infer<typeof PropertyQuery>;

// =============================================================================
// LISTING
// =============================================================================

export const ListingDataSchema = z.object({
    title:               z.string().min(1, 'Title is required'),
    slug:                z.string().min(1).regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
    description:         z.string().optional(),
    shortDescription:    z.string().max(200).optional(),
    transactionType:     ListingTransactionTypeEnum,
    status:              ListingStatusEnum.default('DRAFT'),
    price:               z.number().positive().optional(),
    currency:            z.string().default('USD'),
    priceType:           PriceTypeEnum.default('FIXED'),
    priceDisplay:        z.string().optional(),
    minPrice:            z.number().positive().optional(),
    maxPrice:            z.number().positive().optional(),
    deposit:             z.number().positive().default(0),
    monthlyFee:          z.number().positive().optional(),
    utilitiesIncluded:   z.boolean().default(false),
    commissionRate:      z.number().min(0).max(100).optional(),
    availableFrom:       z.string().datetime().optional(),
    availableUntil:      z.string().datetime().optional(),
    immediatePossession: z.boolean().default(false),
    leaseTerm:           z.number().int().positive().optional(),
    leaseType:           z.string().optional(),
    propertyId:          z.string().cuid('Invalid property ID'),
    agentId:             z.string().cuid().optional(),
    agencyId:            z.string().cuid().optional(),
    featuredImage:       z.string().url().optional(),
    images:              z.array(z.string().url()).default([]),
    videos:              z.array(z.string().url()).default([]),
    floorPlans:          z.array(z.string().url()).default([]),
    contactName:         z.string().optional(),
    contactEmail:        z.string().email().optional(),
    contactPhone:        z.string().optional(),
    showContactInfo:     z.boolean().default(true),
    disclaimer:          z.string().optional(),
    publishedAt:         z.string().datetime().optional(),
    expiresAt:           z.string().datetime().optional(),
    featuredUntil:       z.string().datetime().optional(),
});

export const CreateListingSchema = z.object({ data: ListingDataSchema });
export const UpdateListingSchema = z.object({ data: ListingDataSchema.partial() });

export const ListingQuerySchema = z.object({
    page:            z.coerce.number().int().positive().default(1),
    limit:           z.coerce.number().int().positive().max(100).default(10),
    search:          z.string().optional(),
    propertyId:      z.string().cuid().optional(),
    propertyType:    PropertyTypeEnum.optional(),
    transactionType: ListingTransactionTypeEnum.optional(),
    status:          ListingStatusEnum.optional(),
    statuses:        z.array(ListingStatusEnum).optional(),
    minPrice:        z.coerce.number().positive().optional(),
    maxPrice:        z.coerce.number().positive().optional(),
    priceType:       PriceTypeEnum.optional(),
    availableFrom:   z.string().datetime().optional(),
    availableUntil:  z.string().datetime().optional(),
    publishedAfter:  z.string().datetime().optional(),
    publishedBefore: z.string().datetime().optional(),
    expiresAfter:    z.string().datetime().optional(),
    expiresBefore:   z.string().datetime().optional(),
    city:            z.string().optional(),
    state:           z.string().optional(),
    country:         z.string().optional(),
    agentId:         z.string().cuid().optional(),
    agencyId:        z.string().cuid().optional(),
    minBeds:         z.coerce.number().int().nonnegative().optional(),
    maxBeds:         z.coerce.number().int().positive().optional(),
    minBaths:        z.coerce.number().positive().optional(),
    maxBaths:        z.coerce.number().positive().optional(),
    minLotSize:      z.coerce.number().positive().optional(),
    maxLotSize:      z.coerce.number().positive().optional(),
    sortBy:          z.enum(['createdAt', 'updatedAt', 'publishedAt', 'price', 'title', 'viewCount']).default('createdAt'),
    sortOrder:       z.enum(['asc', 'desc']).default('desc'),
    minViews:        z.coerce.number().int().nonnegative().optional(),
    maxViews:        z.coerce.number().int().positive().optional(),
    isVerified:      z.coerce.boolean().optional(),
    isFeatured:      z.coerce.boolean().optional(),
    isActive:        z.coerce.boolean().default(true),
    isDeleted:       z.coerce.boolean().default(false),
}).superRefine((data, ctx) => {
    if (data.minPrice !== undefined && data.maxPrice !== undefined && data.maxPrice <= data.minPrice) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxPrice must be greater than minPrice', path: ['maxPrice'] });
    }
    if (data.minBeds !== undefined && data.maxBeds !== undefined && data.maxBeds <= data.minBeds) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxBeds must be greater than minBeds', path: ['maxBeds'] });
    }
    if (data.minBaths !== undefined && data.maxBaths !== undefined && data.maxBaths <= data.minBaths) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxBaths must be greater than minBaths', path: ['maxBaths'] });
    }
    if (data.minLotSize !== undefined && data.maxLotSize !== undefined && data.maxLotSize <= data.minLotSize) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxLotSize must be greater than minLotSize', path: ['maxLotSize'] });
    }
    if (data.minViews !== undefined && data.maxViews !== undefined && data.maxViews <= data.minViews) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxViews must be greater than minViews', path: ['maxViews'] });
    }
    if (data.publishedAfter && data.publishedBefore && new Date(data.publishedAfter) >= new Date(data.publishedBefore)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'publishedAfter must be before publishedBefore', path: ['publishedAfter'] });
    }
    if (data.availableFrom && data.availableUntil && new Date(data.availableFrom) >= new Date(data.availableUntil)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'availableFrom must be before availableUntil', path: ['availableFrom'] });
    }
    if (data.expiresAfter && data.expiresBefore && new Date(data.expiresAfter) >= new Date(data.expiresBefore)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'expiresAfter must be before expiresBefore', path: ['expiresAfter'] });
    }
});

export type CreateListingInput = z.infer<typeof CreateListingSchema>;
export type UpdateListingInput = z.infer<typeof UpdateListingSchema>;
export type ListingQuery       = z.infer<typeof ListingQuerySchema>;
export type ListingData        = z.infer<typeof ListingDataSchema>;

// =============================================================================
// RATINGS
// =============================================================================

export const AddRatingSchema = z.object({
    stars:  z.number().int().min(1).max(5, 'Rating must be between 1 and 5 stars'),
    review: z.string().min(1).max(2000).optional(),
});

export const UpdateRatingSchema = z.object({
    stars:  z.number().int().min(1).max(5).optional(),
    review: z.string().max(2000).optional(),
});

export const ReviewQuerySchema = z.object({
    page:      z.coerce.number().int().positive().default(1),
    limit:     z.coerce.number().int().positive().max(100).default(10),
    minStars:  z.coerce.number().int().min(1).max(5).optional(),
    maxStars:  z.coerce.number().int().min(1).max(5).optional(),
    sortBy:    z.enum(['createdAt', 'stars']).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
}).superRefine((data, ctx) => {
    if (data.minStars && data.maxStars && data.maxStars <= data.minStars) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'maxStars must be greater than minStars', path: ['maxStars'] });
    }
});

export type AddRatingInput    = z.infer<typeof AddRatingSchema>;
export type UpdateRatingInput = z.infer<typeof UpdateRatingSchema>;
export type ReviewQuery       = z.infer<typeof ReviewQuerySchema>;

// =============================================================================
// CATEGORIES & TAGS
// =============================================================================

export const CreateCategorySchema = z.object({
    name:         z.string().min(1),
    slug:         z.string().min(1).regex(/^[a-z0-9-]+$/),
    parentId:     z.string().cuid().optional(),
    description:  z.string().optional(),
    icon:         z.string().optional(),
    displayOrder: z.number().int().default(0),
});

export const UpdateCategorySchema = CreateCategorySchema.partial();

export const CreateTagSchema = z.object({
    name:        z.string().min(1),
    slug:        z.string().min(1).regex(/^[a-z0-9-]+$/),
    description: z.string().optional(),
});

export const UpdateTagSchema = CreateTagSchema.partial();

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>;
export type CreateTagInput      = z.infer<typeof CreateTagSchema>;
export type UpdateTagInput      = z.infer<typeof UpdateTagSchema>;

// =============================================================================
// INQUIRIES & OFFERS
// =============================================================================

export const CreateInquirySchema = z.object({
    propertyId: z.string().cuid().optional(),
    listingId:  z.string().cuid().optional(),
    name:       z.string().min(1, 'Name is required'),
    email:      z.string().email('Valid email is required'),
    phone:      z.string().optional(),
    message:    z.string().min(1, 'Message is required').max(2000),
});

export const CreateOfferSchema = z.object({
    listingId:       z.string().cuid('Valid listing ID is required'),
    amount:          z.number().positive(),
    counteredAmount: z.number().positive(),
    currency:        z.string().default('USD'),
    message:         z.string().max(1000).optional(),
    terms:           z.record(z.any()).optional(),
    expiresAt:       z.string().datetime().optional(),
});

export const UpdateOfferSchema = CreateOfferSchema.partial().extend({
    status: z.enum([
        'DRAFT', 'PENDING', 'SUBMITTED', 'UNDER_REVIEW', 'COUNTERED',
        'ACCEPTED', 'REJECTED', 'EXPIRED', 'WITHDRAWN',
    ]).optional(),
});

export type CreateInquiryInput = z.infer<typeof CreateInquirySchema>;
export type CreateOfferInput   = z.infer<typeof CreateOfferSchema>;
export type UpdateOfferInput   = z.infer<typeof UpdateOfferSchema>;

// =============================================================================
// VIEWINGS
// =============================================================================

export const CreateViewingSlotSchema = z.object({
    listingId: z.string().cuid('Valid listing ID is required'),
    startTime: z.string().datetime('Valid start time is required'),
    endTime:   z.string().datetime('Valid end time is required'),
});

export const CreateViewingAttendanceSchema = z.object({
    slotId: z.string().cuid('Valid slot ID is required'),
    status: z.enum(['PENDING', 'CONFIRMED', 'CANCELLED']).default('PENDING'),
    notes:  z.string().max(500).optional(),
});

export type CreateViewingSlotInput       = z.infer<typeof CreateViewingSlotSchema>;
export type CreateViewingAttendanceInput = z.infer<typeof CreateViewingAttendanceSchema>;

// =============================================================================
// AGENTS
// =============================================================================

export const AgentProfileDataSchema = z.object({
    occupation:                    z.string().optional(),
    company:                       z.string().optional(),
    jobTitle:                      z.string().optional(),
    yearsOfExperience:             z.number().int().nonnegative().optional(),
    realtorLicenseNumber:          z.string().optional(),
    licenseState:                  z.string().optional(),
    licenseExpiry:                 z.string().datetime().optional(),
    yearsAsAgent:                  z.number().int().nonnegative().optional(),
    specialties:                   z.array(z.string()).optional(),
    certifications:                z.array(z.string()).optional(),
    agentBio:                      z.string().max(5000).optional(),
    serviceAreas:                  z.array(z.string()).optional(),
    languagesSpoken:               z.array(z.string()).optional(),
    totalTransactions:             z.number().int().nonnegative().default(0),
    totalVolume:                   z.number().nonnegative().default(0),
    averageDaysOnMarket:           z.number().nonnegative().optional(),
    clientSatisfaction:            z.number().min(0).max(5).default(0),
    linkedinUrl:                   z.string().url().optional().or(z.literal('')),
    portfolioUrl:                  z.string().url().optional().or(z.literal('')),
    resumeUrl:                     z.string().url().optional().or(z.literal('')),
    isProfessionalVerified:        z.boolean().default(false),
    professionalVerificationLevel: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED', 'VERIFIED']).default('BASIC'),
    firstName:                     z.string().optional(),
    lastName:                      z.string().optional(),
    displayName:                   z.string().optional(),
    bio:                           z.string().max(2000).optional(),
    headline:                      z.string().max(200).optional(),
    socialMedia:                   z.record(z.any()).optional(),
});

export const CreateAgentSchema = z.object({
    userId:      z.string().cuid('Valid user ID is required'),
    profileData: AgentProfileDataSchema.partial().optional(),
    agencyId:    z.string().cuid().optional(),
});

export const UpdateAgentSchema = z.object({
    profileData: AgentProfileDataSchema.partial().optional(),
    agencyId:    z.string().cuid().optional().nullable(),
});

export const AgentQuerySchema = z.object({
    // Pagination
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),

    // Search
    search: z.string().optional(),

    // Agency filters
    agencyId: z.string().cuid().optional(),
    agencyName: z.string().optional(),

    // Professional filters
    licenseState: z.string().optional(),
    minExperience: z.coerce.number().int().nonnegative().optional(),
    maxExperience: z.coerce.number().int().nonnegative().optional(),
    minTransactions: z.coerce.number().int().nonnegative().optional(),
    maxTransactions: z.coerce.number().int().nonnegative().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxRating: z.coerce.number().min(0).max(5).optional(),

    // Specializations
    specialties: z.array(z.string()).optional(),
    serviceAreas: z.array(z.string()).optional(),

    // Verification status
    isVerified: z.coerce.boolean().optional(),

    // Sort options
    sortBy: z.enum([
        'createdAt',
        'name',
        'experience',
        'transactions',
        'rating'
    ]).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),

    // Performance metrics
    minClientSatisfaction: z.coerce.number().min(0).max(5).optional(),
    maxClientSatisfaction: z.coerce.number().min(0).max(5).optional()
}).superRefine((data, ctx) => {
    // Validate experience range
    if (data.minExperience !== undefined && data.maxExperience !== undefined) {
        if (data.maxExperience <= data.minExperience) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'maxExperience must be greater than minExperience',
                path: ['maxExperience']
            });
        }
    }

    // Validate transactions range
    if (data.minTransactions !== undefined && data.maxTransactions !== undefined) {
        if (data.maxTransactions <= data.minTransactions) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'maxTransactions must be greater than minTransactions',
                path: ['maxTransactions']
            });
        }
    }

    // Validate rating ranges
    if (data.minRating !== undefined && data.maxRating !== undefined) {
        if (data.maxRating <= data.minRating) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'maxRating must be greater than minRating',
                path: ['maxRating']
            });
        }
    }

    if (data.minClientSatisfaction !== undefined && data.maxClientSatisfaction !== undefined) {
        if (data.maxClientSatisfaction <= data.minClientSatisfaction) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'maxClientSatisfaction must be greater than minClientSatisfaction',
                path: ['maxClientSatisfaction']
            });
        }
    }
});

export const TransferListingsSchema = z.object({
    toAgentId:  z.string().cuid('Valid destination agent ID is required'),
    listingIds: z.array(z.string().cuid('Valid listing ID is required')).min(1),
});

export const VerifyAgentSchema = z.object({
    verificationLevel: z.enum(['BASIC', 'INTERMEDIATE', 'ADVANCED', 'VERIFIED']),
    notes:             z.string().max(1000).optional(),
});

export type AgentProfileData      = z.infer<typeof AgentProfileDataSchema>;
export type CreateAgentInput      = z.infer<typeof CreateAgentSchema>;
export type UpdateAgentInput      = z.infer<typeof UpdateAgentSchema>;
export type AgentQuery            = z.infer<typeof AgentQuerySchema>;
export type TransferListingsInput = z.infer<typeof TransferListingsSchema>;
export type VerifyAgentInput      = z.infer<typeof VerifyAgentSchema>;

// =============================================================================
// AUTH / USER SCHEMAS
// =============================================================================

export const TwoFactorTokenSchema = z.object({
    email:   z.string().email(),
    token:   z.string().min(6),
    expires: z.coerce.date(),
});

export const VerificationTokenSchema = z.object({
    email:   z.string().email(),
    token:   z.string().min(6),
    expires: z.coerce.date(),
});

export const PasswordTokenSchema = z.object({
    email:   z.string().email(),
    token:   z.string().min(6),
    expires: z.coerce.date(),
});


export const AgentStatisticsQuerySchema = z.object({
    period: z.enum(['7days', '30days', '90days', 'year', 'all']).default('30days'),
    includeDetails: z.coerce.boolean().default(false)
});

export const AgentListingsQuerySchema = z.object({
    // Pagination
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(10),

    // Listing filters
    status: z.union([
        ListingStatusEnum,
        z.array(ListingStatusEnum)
    ]).optional(),
    transactionType: ListingTransactionTypeEnum.optional(),

    // Price filters
    minPrice: z.coerce.number().positive().optional(),
    maxPrice: z.coerce.number().positive().optional(),

    // Sort options
    sortBy: z.enum([
        'createdAt',
        'updatedAt',
        'publishedAt',
        'price',
        'title',
        'property'
    ]).optional(),
    sortOrder: z.enum(['asc', 'desc']).default('desc')
}).superRefine((data, ctx) => {
    if (data.minPrice !== undefined && data.maxPrice !== undefined) {
        if (data.maxPrice <= data.minPrice) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'maxPrice must be greater than minPrice',
                path: ['maxPrice']
            });
        }
    }
});

// =============================================================================
// PARAM SCHEMAS
// =============================================================================

export const propertyParamsSchema  = z.object({ id:       z.string().cuid('Valid property ID is required') });
export const listingParamsSchema   = z.object({ id:       z.string().cuid('Valid listing ID is required') });
export const agentParamsSchema     = z.object({ id:       z.string().cuid('Valid agent ID is required') });
export const slugParamsSchema      = z.object({ slug:     z.string().min(1) });
export const offerParamsSchema     = z.object({ offerId:  z.string().cuid('Valid offer ID is required') });
export const viewingSlotParamsSchema = z.object({ slotId: z.string().cuid('Valid viewing slot ID is required') });
export const ratingParamsSchema    = z.object({
    id:       z.string().cuid('Valid property ID is required'),
    ratingId: z.string().cuid('Valid rating ID is required').optional(),
});
export const renewListingSchema    = z.object({ expiresAt: z.string().datetime().optional() });
export const CalculatePriceSchema  = z.object({
    termLength:    z.number().int().positive(),
    billingPeriod: BillingPeriodSchema,
    optionId:      z.string().cuid().optional(),
});

export type PropertyParams         = z.infer<typeof propertyParamsSchema>;
export type ListingParams          = z.infer<typeof listingParamsSchema>;
export type AgentParams            = z.infer<typeof agentParamsSchema>;
export type RatingParams           = z.infer<typeof ratingParamsSchema>;
export type CalculatePriceInput    = z.infer<typeof CalculatePriceSchema>;

// =============================================================================
// SCALAR TYPE EXPORTS
// =============================================================================

export type PropertyType          = z.infer<typeof PropertyTypeEnum>;
export type ListingTransactionType = z.infer<typeof ListingTransactionTypeEnum>;
export type ListingStatus         = z.infer<typeof ListingStatusEnum>;
export type PriceType             = z.infer<typeof PriceTypeEnum>;
export type BillingPeriod         = z.infer<typeof BillingPeriodSchema>;
export type DiscountType          = z.infer<typeof DiscountTypeSchema>;
export type LocationInput         = z.infer<typeof LocationSchema>;
export type PropertyQuery         = z.infer<typeof PropertyQuery>;
export type PricingConfigInput    = z.infer<typeof PricingConfigCreateSchema>;

// =============================================================================
// QUERY UTILITIES
// =============================================================================

export const sanitizePropertyQuery = (query: PropertyQueryInput) =>
    Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined));

export const buildPropertyQueryString = (query: Partial<PropertyQueryInput>): string => {
    const params = new URLSearchParams();
    Object.entries(query).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
                value.forEach(v => params.append(key, String(v)));
            } else {
                params.append(key, String(value));
            }
        }
    });
    return params.toString();
};

export const validatePropertyQuery = async (query: unknown) => {
    try {
        return { success: true, data: PropertyQuery.parse(query) };
    } catch (error) {
        if (error instanceof z.ZodError) {
            return {
                success: false,
                errors: error.errors.map(err => ({ path: err.path.join('.'), message: err.message })),
            };
        }
        throw error;
    }
};




