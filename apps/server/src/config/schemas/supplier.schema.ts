// apps/server/src/config/schemas/supplier.schema.ts
import { z } from 'zod';

export const SupplierStatusEnum = z.enum(['PENDING', 'ACTIVE', 'INACTIVE', 'SUSPENDED']);
export type SupplierStatus = z.infer<typeof SupplierStatusEnum>;

// Base supplier schema
export const SupplierSchema = z.object({
    id: z.string().cuid(),
    userId: z.string().cuid(),
    companyName: z.string().min(2).max(100),
    contactPerson: z.string().min(2).max(100).optional().nullable(),
    email: z.string().email(),
    phone: z.string().regex(/^[0-9+\-\s()]{10,20}$/, 'Invalid phone number format').optional().nullable(),
    address: z.string().max(200).optional().nullable(),
    city: z.string().max(100).optional().nullable(),
    county: z.string().max(100).optional().nullable(),
    country: z.string().max(100).default('KE'),
    taxPin: z.string().regex(/^[A-Z0-9]{9,11}$/, 'Invalid tax PIN format').optional().nullable(),
    status: SupplierStatusEnum.default('PENDING'),
    isVerified: z.boolean().default(false),
    verifiedAt: z.date().optional().nullable(),
    rating: z.number().min(0).max(5).default(0),
    leadTimeDays: z.number().int().min(1).max(365).default(1),
    paymentTerms: z.string().max(200).optional().nullable(),
    notes: z.string().optional().nullable(),
    createdAt: z.date(),
    updatedAt: z.date(),
    deletedAt: z.date().optional().nullable(),
});

// Create supplier schema (omitting auto-generated fields)
export const CreateSupplierSchema = SupplierSchema.omit({
    id: true,
    status: true,
    isVerified: true,
    verifiedAt: true,
    rating: true,
    createdAt: true,
    updatedAt: true,
    deletedAt: true,
}).extend({
    userId: z.string().cuid().optional(), // Will be set from auth
});

// Update supplier schema
export const UpdateSupplierSchema = CreateSupplierSchema.partial().extend({
    id: z.string().cuid(),
});

export const SUPPLIER_SORTABLE_FIELDS = [
    'createdAt',
    'updatedAt',
    'companyName',
    'rating',
    'leadTimeDays',
] as const;

export type SupplierSortField = typeof SUPPLIER_SORTABLE_FIELDS[number];
// Supplier filter schema for listing
export const SupplierFilterSchema = z.object({
    search: z.string().optional(),
    status: SupplierStatusEnum.optional(),
    isVerified: z.coerce.boolean().optional(),
    country: z.string().optional(),
    minRating: z.coerce.number().min(0).max(5).optional(),
    maxLeadTimeDays: z.coerce.number().int().min(0).optional(),

    // Pagination + sorting now live in the same schema, so they're validated
    // and defaulted in one place instead of being read raw off req.query.
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20), // hard cap prevents huge unbounded queries
    sortBy: z.enum(SUPPLIER_SORTABLE_FIELDS).default('createdAt'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

// Supplier verification schema
export const VerifySupplierSchema = z.object({
    isVerified: z.boolean(),
    verifiedAt: z.date().default(() => new Date()),
    notes: z.string().optional(),
});

// Supplier status update schema
export const UpdateSupplierStatusSchema = z.object({
    status: SupplierStatusEnum,
    reason: z.string().min(10).optional(), // Required for rejection/suspension
});

// Supplier product association schema
export const SupplierProductSchema = z.object({
    supplierId: z.string().cuid(),
    productId: z.string().cuid(),
    supplierSku: z.string().max(50).optional().nullable(),
    unitCost: z.number().positive(),
    minOrderQty: z.number().positive().default(1),
    isPreferred: z.boolean().default(false),
});

// Bulk supplier product update schema
export const BulkSupplierProductsSchema = z.object({
    products: z.array(SupplierProductSchema.omit({ supplierId: true })).min(1),
});

// Supplier statistics response schema
export const SupplierStatsSchema = z.object({
    totalSuppliers: z.number(),
    pendingVerification: z.number(),
    approvedSuppliers: z.number(),
    rejectedSuppliers: z.number(),
    suspendedSuppliers: z.number(),
    verifiedSuppliers: z.number(),
    averageRating: z.number(),
    averageLeadTime: z.number(),
    topSuppliers: z.array(z.object({
        id: z.string().cuid(),
        companyName: z.string(),
        rating: z.number(),
        productCount: z.number(),
    })),
    recentSuppliers: z.array(z.object({
        id: z.string().cuid(),
        companyName: z.string(),
        status: SupplierStatusEnum,
        createdAt: z.date(),
    })),
});

export type CreateSupplierInput = z.infer<typeof CreateSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof UpdateSupplierSchema>;
export type SupplierFilter = z.infer<typeof SupplierFilterSchema>;
export type VerifySupplierInput = z.infer<typeof VerifySupplierSchema>;
export type UpdateSupplierStatusInput = z.infer<typeof UpdateSupplierStatusSchema>;
export type SupplierProductInput = z.infer<typeof SupplierProductSchema>;
export type SupplierStats = z.infer<typeof SupplierStatsSchema>;