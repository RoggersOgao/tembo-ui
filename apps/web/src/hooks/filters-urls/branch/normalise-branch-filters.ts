// hooks/filters-urls/branch-filters/normalise-branch-filters.ts
import { BranchFilterState } from './use-branch-filter-url-pagination'

export interface NormalisedBranchQuery {
  filters: BranchFilterInput
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface BranchFilterInput {
  search?: string
  city?: string
  county?: string
  isActive?: boolean
  hasInventory?: boolean
  productId?: string
}

/**
 * Normalises BranchFilterState to API-ready format
 * Strips out any undefined values and ensures types match API expectations
 */
export function normaliseBranchFilters(filters: BranchFilterState): NormalisedBranchQuery {
  const apiFilters: BranchFilterInput = {}

  if (filters.search) apiFilters.search = filters.search
  if (filters.city) apiFilters.city = filters.city
  if (filters.county) apiFilters.county = filters.county
  if (filters.isActive !== undefined) apiFilters.isActive = filters.isActive
  if (filters.hasInventory !== undefined) apiFilters.hasInventory = filters.hasInventory
  if (filters.productId) apiFilters.productId = filters.productId

  return {
    filters: apiFilters,
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc',
  }
}