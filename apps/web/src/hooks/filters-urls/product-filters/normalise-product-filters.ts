// hooks/filters-urls/normalise-product-filters.ts
//
// Single source of truth for mapping any filter state → ProductFilterInput.
// Both the shop hook and dashboard hook call this — the useProducts hook
// never does its own mapping.

import type { ProductFilterInput } from '@/types/products/product-types'

export interface NormalisedProductQuery {
  filters: ProductFilterInput
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

// ─── Shop filter → API ────────────────────────────────────────────────────────

export interface ShopApiFilters {
  search?: string
  category?: string
  isOpen?: boolean
  priceRange?: { min: number; max: number }
  rating?: string
  isHalal?: boolean
  isOrganic?: boolean
  isFreeRange?: boolean
  sort?: string
  sortBy?: 'createdAt' | 'updatedAt' | 'total' | 'rating' | 'price'
  sortOrder?: 'asc' | 'desc'
}

export function normaliseShopFilters(
  f: ShopApiFilters,
  variantSortBy = 'createdAt',
  variantSortOrder: 'asc' | 'desc' = 'desc',
): NormalisedProductQuery {
  const filters: ProductFilterInput = {}

  if (f.search)                     filters.search    = f.search
  if (f.category)                   filters.categoryId = f.category
  if (f.isOpen !== undefined)       filters.isActive  = f.isOpen
  if (f.priceRange) {
    filters.minPrice = f.priceRange.min
    filters.maxPrice = f.priceRange.max
  }
  if (f.isHalal)                    filters.isHalal   = true
  if (f.isOrganic)                  filters.isOrganic = true
  if (f.isFreeRange)                filters.isFreeRange = true

  // Resolve sort — explicit sortBy/sortOrder win over sort pill, which wins
  // over the variant default.
  let sortBy    = variantSortBy
  let sortOrder = variantSortOrder

  if (f.sort) {
    switch (f.sort) {
      case 'price-asc':  sortBy = 'price';     sortOrder = 'asc';  break
      case 'price-desc': sortBy = 'price';     sortOrder = 'desc'; break
      case 'rating':     sortBy = 'rating';    sortOrder = 'desc'; break
      case 'newest':     sortBy = 'createdAt'; sortOrder = 'desc'; break
    }
  }

  if (f.sortBy)    sortBy    = f.sortBy
  if (f.sortOrder) sortOrder = f.sortOrder

  return { filters, sortBy, sortOrder }
}

// ─── Dashboard filter → API ───────────────────────────────────────────────────

export interface DashboardApiFilters {
  search?:        string
  categoryId?:    string
  isActive?:      boolean
  isFeatured?:    boolean
  isHalal?:       boolean
  isOrganic?:     boolean
  isFreeRange?:   boolean
  minPrice?:      number
  maxPrice?:      number
  tags?:          string[]
  supplierId?:    string
  createdAfter?:  string
  createdBefore?: string
  sortBy?:        string
  sortOrder?:     'asc' | 'desc'
}

export function normaliseDashboardFilters(
  f: DashboardApiFilters,
  variantSortBy = 'createdAt',
  variantSortOrder: 'asc' | 'desc' = 'desc',
): NormalisedProductQuery {
  const filters: ProductFilterInput = {}

  if (f.search)                            filters.search        = f.search
  if (f.categoryId)                        filters.categoryId    = f.categoryId
  if (f.isActive !== undefined)            filters.isActive      = f.isActive
  if (f.isFeatured !== undefined)          filters.isFeatured    = f.isFeatured
  if (f.isHalal !== undefined)             filters.isHalal       = f.isHalal
  if (f.isOrganic !== undefined)           filters.isOrganic     = f.isOrganic
  if (f.isFreeRange !== undefined)         filters.isFreeRange   = f.isFreeRange
  if (f.minPrice !== undefined)            filters.minPrice      = f.minPrice
  if (f.maxPrice !== undefined)            filters.maxPrice      = f.maxPrice
  if (f.tags?.length)                      filters.tags          = f.tags
  if (f.supplierId)                        filters.supplierId    = f.supplierId
  if (f.createdAfter)                      filters.createdAfter  = f.createdAfter
  if (f.createdBefore)                     filters.createdBefore = f.createdBefore

  return {
    filters,
    sortBy:    f.sortBy    ?? variantSortBy,
    sortOrder: f.sortOrder ?? variantSortOrder,
  }
}