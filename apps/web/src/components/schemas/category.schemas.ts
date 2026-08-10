// lib/validations/category.validation.ts
import { z } from 'zod';

// ============================================
// Base Category Schema (shared fields)
// ============================================


export const categorySchemaDTO = z.object({
  id: z.string(),
  name: z.string(),
  slug: z.string(),
  parentId: z.string().optional(),
  descriptions: z.string(),
  icon: z.string().optional(),
  displayOrder: z.number().optional(),
  isActive: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});

type Category = z.infer<typeof categorySchemaDTO>;

export const categoryBaseSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  description: z.string().nullable().optional(),
  icon: z.string().nullable().optional(),
});

// ============================================
// Create Category Schema (FORM + CREATE API)
// ============================================

export const createCategorySchema = categoryBaseSchema.extend({
  parentId: z.string().nullable().optional(),
  displayOrder: z.coerce.number().min(0),
});

export type CreateCategoryFormData = z.infer<typeof createCategorySchema>;
export type AddCategoryFormData = z.infer<typeof createCategorySchema>;

// ============================================
// Update Category Schema (FORM + UPDATE API)
// ============================================

export const updateCategoryFormSchema = categoryBaseSchema.extend({
  parentId: z.string().nullable().optional(),
  displayOrder: z.coerce.number().min(0),
  isActive: z.boolean(),
});

export type UpdateCategoryFormData = z.infer<typeof updateCategoryFormSchema>;

// ============================================
// Update Category API Schema (PATCH API ONLY)
// ============================================
// [!] This is NOT meant for useForm()
// Everything is optional by design

export const updateCategoryApiSchema = categoryBaseSchema
  .extend({
    parentId: z.string().uuid('Parent ID must be a valid UUID').nullable().optional(),
    displayOrder: z.number().min(0).optional(),
    isActive: z.boolean().optional(),
  })
  .partial();

export type UpdateCategoryApiData = z.infer<typeof updateCategoryApiSchema>;

// ============================================
// Reorder Categories Schema
// ============================================

export const reorderItemSchema = z.object({
  id: z.string().uuid('ID must be a valid UUID'),
  displayOrder: z.number().int().min(0),
});

export const reorderCategoriesSchema = z.object({
  items: z
    .array(reorderItemSchema)
    .min(1, 'At least one item is required')
    .refine(
      (items) => {
        const ids = items.map((item) => item.id);
        return new Set(ids).size === ids.length;
      },
      {
        message: 'Duplicate category IDs are not allowed',
      }
    ),
});

export type ReorderCategoriesFormData = z.infer<typeof reorderCategoriesSchema>;

// ============================================
// Category Query Schema
// ============================================

export const categoryQuerySchema = z.object({
  includeInactive: z.boolean().optional().default(false),
  page: z.number().int().min(1).optional().default(1),
  limit: z.number().int().min(1).max(200).optional().default(100),
  sortBy: z
    .enum(['displayOrder', 'name', 'createdAt', 'propertiesCount'])
    .optional()
    .default('displayOrder'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('asc'),
  search: z.string().trim().optional(),
  parentId: z.string().uuid().optional().nullable(),
});

export type CategoryQueryFormData = z.infer<typeof categoryQuerySchema>;

// ============================================
// Category Tree Options Schema
// ============================================

export const categoryTreeOptionsSchema = z.object({
  maxDepth: z.number().int().min(1).max(10).optional().default(3),
  includeInactive: z.boolean().optional().default(false),
  includePropertiesCount: z.boolean().optional().default(true),
  includeAncestors: z.boolean().optional().default(false),
});

export type CategoryTreeOptionsFormData = z.infer<typeof categoryTreeOptionsSchema>;

// ============================================
// Category Detail Options Schema
// ============================================















export const categoryDetailOptionsSchema = z.object({
  includeAncestors: z.boolean().optional().default(false),
  includeDescendants: z.boolean().optional().default(false),
  includePropertiesCount: z.boolean().optional().default(true),
});

export type CategoryDetailOptionsFormData = z.infer<typeof categoryDetailOptionsSchema>;



/**
 * Validate slug uniqueness (for client-side validation)
 */
export function validateSlugUniqueness(
  slug: string,
  existingSlugs: string[],
  currentSlug?: string
): boolean {
  if (currentSlug && slug === currentSlug) {
    return true; // Same slug as current is valid
  }
  return !existingSlugs.includes(slug);
}

/**
 * Validate parent selection (prevent circular references)
 */
export function validateParentSelection(
  categoryId: string,
  parentId: string,
  categories: Array<{ id: string; parentId: string | null }>
): boolean {
  if (categoryId === parentId) {
    return false; // Can't be its own parent
  }

  // Check for circular reference
  let currentId = parentId;
  const visited = new Set<string>();

  while (currentId) {
    if (visited.has(currentId)) {
      return false; // Circular reference detected
    }

    if (currentId === categoryId) {
      return false; // Would create circular reference
    }

    visited.add(currentId);

    const parent = categories.find((cat) => cat.id === currentId);
    currentId = parent?.parentId || '';
  }

  return true;
}