// hooks/filters-urls/delivery-filters/normalise-delivery-filters.ts
import { DeliveryStatus } from '@/types/branch/delivery/delivery-types'
import { DeliveryFilterState } from './use-delivery-filter-url-pagination'

export interface NormalisedDeliveryQuery {
  filters: DeliveryFilterInput
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export interface DeliveryFilterInput {
  search?: string
  status?: DeliveryStatus | DeliveryStatus[]
  branchId?: string
  driverId?: string
  customerId?: string
  dateFrom?: Date
  dateTo?: Date
  minRating?: number
  maxRating?: number
}

/**
 * Normalises DeliveryFilterState to API-ready format
 * Converts date strings to Date objects and strips out undefined values
 */
export function normaliseDeliveryFilters(filters: DeliveryFilterState): NormalisedDeliveryQuery {
  const apiFilters: DeliveryFilterInput = {}

  if (filters.search) apiFilters.search = filters.search
  if (filters.status) apiFilters.status = filters.status
  if (filters.branchId) apiFilters.branchId = filters.branchId
  if (filters.driverId) apiFilters.driverId = filters.driverId
  if (filters.customerId) apiFilters.customerId = filters.customerId
  if (filters.dateFrom) apiFilters.dateFrom = new Date(filters.dateFrom)
  if (filters.dateTo) apiFilters.dateTo = new Date(filters.dateTo)
  if (filters.minRating !== undefined) apiFilters.minRating = filters.minRating
  if (filters.maxRating !== undefined) apiFilters.maxRating = filters.maxRating

  return {
    filters: apiFilters,
    sortBy: filters.sortBy || 'createdAt',
    sortOrder: filters.sortOrder || 'desc',
  }
}