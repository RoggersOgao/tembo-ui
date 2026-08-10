import { z } from 'zod';
import {
  ProductStatus,
  PriceType,
  WeightUnit,
  DiscountType
} from '@repo/database';

// Asset schema for image uploads
export const AssetSchema = z.object({
  filename: z.string(),
  s3Key: z.string(),
  contentType: z.string(),
  size: z.number().int().positive(),
  isPrimary: z.boolean().default(false),
});

export type AssetInput = z.infer<typeof AssetSchema>;

// Variant schema
export const ProductVariantSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(100),
  sku: z.string().min(1).max(50),
  priceAdjustment: z.number().default(0),
   stockQuantity: z.number().int().min(0).default(0),
  reservedQuantity: z.number().int().min(0).default(0).optional(),
  weight: z.number().positive().optional(),
  weightUnit: z.nativeEnum(WeightUnit).default(WeightUnit.KILOGRAMS),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true),
});

export type ProductVariantInput = z.infer<typeof ProductVariantSchema>;

// Pricing rule schema
export const PricingRuleSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(1).max(100),
  discountType: z.nativeEnum(DiscountType),
  discountValue: z.number().positive(),
  minQuantity: z.number().positive().optional(),
  maxQuantity: z.number().positive().optional(),
  startsAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  isActive: z.boolean().default(true),
});

export type PricingRuleInput = z.infer<typeof PricingRuleSchema>;

// Tag schema
export const ProductTagSchema = z.object({
  id: z.string().cuid().optional(),
  name: z.string().min(1).max(50),
});

export type ProductTagInput = z.infer<typeof ProductTagSchema>;

// Image schema
const ProductImageSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  size: z.number().positive(),
  type: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
});

const BaseProductSchema = z.object({
  // Basic info
  sku: z.string().min(1).max(50),
  slug: z.string().min(2).max(200),
  description: z.string().max(5000).optional(),
  shortDescription: z.string().max(500).optional(),

  // Category
  categoryId: z.string().cuid(),

  // Pricing
  basePrice: z.number().positive(),
  priceType: z.nativeEnum(PriceType).default(PriceType.FIXED),
  weightUnit: z.nativeEnum(WeightUnit).default(WeightUnit.KILOGRAMS),
  minOrderQty: z.number().positive().default(0.5),
  maxOrderQty: z.number().positive().optional(),

  // Physical attributes
  averageWeight: z.number().positive().optional(),
  packSize: z.number().positive().optional(),
  isHalal: z.boolean().default(true),
  isOrganic: z.boolean().default(false),
  isFreeRange: z.boolean().default(false),

  // Media
  featuredImageKey: z.string().optional(),
  videoUrl: z.string().url().optional(),

  // Images — already uploaded to S3 before this call
  images: z.array(ProductImageSchema).max(10).optional(),

  // Nutrition info (JSON)
  nutritionInfo: z.record(z.any()).optional(),

  // Storage & handling
  storageInstructions: z.string().max(1000).optional(),
  cookingInstructions: z.string().max(1000).optional(),
  shelfLife: z.number().int().min(0).optional(),

  // Status
  status: z.nativeEnum(ProductStatus).default(ProductStatus.DRAFT),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  publishedAt: z.string().datetime().optional(),

  // SEO
  metaTitle: z.string().max(100).optional(),
  metaDescription: z.string().max(300).optional(),

  // Stock management — 0 is a valid value, so min(0) not positive()
  stockQuantity: z.number().int().min(0),
  reservedQuantity: z.number().int().min(0).optional(),

  // Relations
  variants: z.array(ProductVariantSchema).optional(),
  tags: z.array(ProductTagSchema).optional(),
  pricingRules: z.array(PricingRuleSchema).optional(),

  // Supplier info
  supplierId: z.string().cuid().optional(),
  supplierSku: z.string().optional(),
  unitCost: z.number().positive().optional(),
});

const supplierRefinement = <T extends { supplierId?: string; unitCost?: number }>(
  data: T,
  ctx: z.RefinementCtx
) => {
  if (data.supplierId && !data.unitCost) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Unit cost is required when supplier is specified",
      path: ["unitCost"],
    });
  }
};

export const CreateProductSchema = BaseProductSchema.superRefine(supplierRefinement);
export type CreateProductInput = z.infer<typeof CreateProductSchema>;

export const UpdateProductSchema = BaseProductSchema.partial()
  .extend({
    id: z.string().cuid(),
    variants: z
      .array(
        ProductVariantSchema.partial().extend({
          id: z.string().cuid().optional(),
        })
      )
      .optional(),
  })
  .superRefine(supplierRefinement);
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>;


// Product filter schema for list endpoints

export const ProductFilterSchema = z
  .object({
    categoryId:       z.string().cuid().optional(),
    supplierId:       z.string().cuid().optional(),
    status:           z.nativeEnum(ProductStatus).optional(),
    isActive:         z.coerce.boolean().optional(),
    isFeatured:       z.coerce.boolean().optional(),
    isHalal:          z.coerce.boolean().optional(),
    isOrganic:        z.coerce.boolean().optional(),
    isFreeRange:      z.coerce.boolean().optional(),
    // FIX 2: Added the three fields the search service already references
    isGrassFed:       z.coerce.boolean().optional(),
    isAntibioticFree: z.coerce.boolean().optional(),
    isHormoneFree:    z.coerce.boolean().optional(),
    // FIX 4: .positive() rejects 0 — use .nonnegative() so free products are valid
    minPrice:         z.coerce.number().nonnegative().optional(),
    maxPrice:         z.coerce.number().nonnegative().optional(),
    // FIX 7: Bound search length so the search service isn't handed an unbounded string
    search:           z.string().min(1).max(200).optional(),
    // FIX 3: Tags are IDs — validate them as CUIDs, not bare strings
    tags:             z.array(z.string().cuid()).optional(),
    createdAfter:     z.string().datetime().optional(),
    createdBefore:    z.string().datetime().optional(),
  })
  // FIX 1 + 5: Cross-field validation — price range and date range ordering
  .superRefine((data, ctx) => {
    if (
      data.minPrice !== undefined &&
      data.maxPrice !== undefined &&
      data.minPrice > data.maxPrice
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'minPrice must be less than or equal to maxPrice',
        path: ['minPrice'],
      })
    }

    if (data.createdAfter !== undefined && data.createdBefore !== undefined) {
      const after  = new Date(data.createdAfter)
      const before = new Date(data.createdBefore)
      if (after > before) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'createdAfter must be earlier than or equal to createdBefore',
          path: ['createdAfter'],
        })
      }
    }
  })

export type ProductFilterInput = z.infer<typeof ProductFilterSchema>

// Image upload schema
export const ProductImageUploadSchema = z.object({
  productId: z.string().cuid().optional(),
  files: z.array(z.object({
    filename: z.string(),
    size: z.number().int().positive(),
    mimeType: z.string(),
  })),
});

export type ProductImageUploadInput = z.infer<typeof ProductImageUploadSchema>;

// Product variant inventory update schema
export const VariantInventorySchema = z.object({
  variantId: z.string().cuid(),
  branchId: z.string().cuid(),
  quantityOnHand: z.number().min(0),
  reorderPoint: z.number().min(0).optional(),
  reorderQuantity: z.number().min(0).optional(),
});

export type VariantInventoryInput = z.infer<typeof VariantInventorySchema>;