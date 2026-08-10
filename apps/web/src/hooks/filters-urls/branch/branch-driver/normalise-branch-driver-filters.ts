import { BranchDriverFilterState } from './use-branch-driver-filter-urls-pagination'

export interface NormalisedBranchDriverQuery {
  filters: BranchDriverFilterInput
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface BranchDriverFilterInput {
  branchId?: string
  driverId?: string
  isActive?: boolean
  isPrimary?: boolean
  search?: string
}

/**
 * Normalises BranchDriverFilterState to API-ready format
 * Strips out any undefined values and ensures types match API expectations
 */
export function normaliseBranchDriverFilters(filters: BranchDriverFilterState): NormalisedBranchDriverQuery {
  const apiFilters: BranchDriverFilterInput = {}

  if (filters.branchId) apiFilters.branchId = filters.branchId
  if (filters.driverId) apiFilters.driverId = filters.driverId
  if (filters.isActive !== undefined) apiFilters.isActive = filters.isActive
  if (filters.isPrimary !== undefined) apiFilters.isPrimary = filters.isPrimary
  if (filters.search) apiFilters.search = filters.search

  return {
    filters: apiFilters,
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc',
  }
}