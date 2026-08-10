// hooks/filters-urls/delivery-filters/use-delivery-filter-url-pagination.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'
import { DeliveryStatus } from '@/types/branch/delivery/delivery-types'
import { NormalisedDeliveryQuery, normaliseDeliveryFilters } from './normalise-branch-filters'


export interface DeliveryFilterState {
  search?: string
  status?: DeliveryStatus | DeliveryStatus[]
  branchId?: string
  driverId?: string
  customerId?: string
  dateFrom?: string | string
  dateTo?: string | string
  minRating?: number
  maxRating?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams: URLSearchParams,
  defaultPageSize: number,
): { pagination: PaginationState; filters: DeliveryFilterState } {
  const parseNum = (key: string): number | undefined => {
    const val = searchParams.get(key)
    if (!val) return undefined
    const n = parseInt(val, 10)
    return isNaN(n) ? undefined : n
  }

  const parseFloat_ = (key: string): number | undefined => {
    const val = searchParams.get(key)
    if (!val) return undefined
    const n = parseFloat(val)
    return isNaN(n) ? undefined : n
  }

  const parseStatusArray = (key: string): DeliveryStatus[] | undefined => {
    const vals = searchParams.getAll(key)
    return vals.length > 0 ? (vals as DeliveryStatus[]) : undefined
  }

  const parseSingleStatus = (key: string): DeliveryStatus | undefined => {
    const val = searchParams.get(key)
    return val ? (val as DeliveryStatus) : undefined
  }

  return {
    pagination: {
      pageIndex: Math.max(0, (parseNum('page') ?? 1) - 1),
      pageSize: parseNum('limit') ?? defaultPageSize,
    },
    filters: {
      search: searchParams.get('search') || undefined,
      status: parseStatusArray('status') || parseSingleStatus('status'),
      branchId: searchParams.get('branchId') || undefined,
      driverId: searchParams.get('driverId') || undefined,
      customerId: searchParams.get('customerId') || undefined,
      dateFrom: searchParams.get('dateFrom') || undefined,
      dateTo: searchParams.get('dateTo') || undefined,
      minRating: parseFloat_('minRating'),
      maxRating: parseFloat_('maxRating'),
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters: DeliveryFilterState,
  pagination: PaginationState,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    page: pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit: pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    search: filters.search,
    branchId: filters.branchId,
    driverId: filters.driverId,
    customerId: filters.customerId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    minRating: filters.minRating !== undefined ? String(filters.minRating) : undefined,
    maxRating: filters.maxRating !== undefined ? String(filters.maxRating) : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }

  const params = new URLSearchParams(cleanParams(raw) as Record<string, string>)

  // Handle status (can be single or multiple)
  if (filters.status) {
    if (Array.isArray(filters.status)) {
      filters.status.forEach((status) => params.append('status', status))
    } else {
      params.append('status', filters.status)
    }
  }

  return params.toString()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDeliveryFilterUrlPagination(defaultPageSize = 10) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const mountParamsString = useRef(searchParams.toString())

  const initial = useMemo(
    () => parseSearchParams(new URLSearchParams(mountParamsString.current), defaultPageSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [paginationState, setPaginationStateInternal] = useState<PaginationState>(initial.pagination)
  const [filters, setFiltersState] = useState<DeliveryFilterState>(initial.filters)

  const lastPushedQs = useRef(
    serialiseToQueryString(initial.filters, initial.pagination, defaultPageSize),
  )

  const routerRef = useRef(router)
  const pathnameRef = useRef(pathname)
  const filtersRef = useRef(filters)
  const paginationRef = useRef(paginationState)

  useEffect(() => { routerRef.current = router }, [router])
  useEffect(() => { pathnameRef.current = pathname }, [pathname])
  useEffect(() => { filtersRef.current = filters }, [filters])
  useEffect(() => { paginationRef.current = paginationState }, [paginationState])

  // Sync state ← browser back/forward
  useEffect(() => {
    const currentQs = searchParams.toString()
    if (currentQs === lastPushedQs.current) return
    const parsed = parseSearchParams(new URLSearchParams(currentQs), defaultPageSize)
    setPaginationStateInternal(parsed.pagination)
    setFiltersState(parsed.filters)
    lastPushedQs.current = currentQs
  }, [searchParams, defaultPageSize])

  // ── Core URL push ──────────────────────────────────────────────────────────

  const pushToUrl = useCallback(
    (nextFilters: DeliveryFilterState, nextPagination: PaginationState) => {
      const nextQs = serialiseToQueryString(nextFilters, nextPagination, defaultPageSize)
      if (nextQs === lastPushedQs.current) return
      lastPushedQs.current = nextQs
      const newUrl = nextQs ? `${pathnameRef.current}?${nextQs}` : pathnameRef.current
      routerRef.current.push(newUrl, { scroll: false })
    },
    [defaultPageSize],
  )

  // ── Setters ────────────────────────────────────────────────────────────────

  const handleSetFilters = useCallback(
    (value: DeliveryFilterState | ((prev: DeliveryFilterState) => DeliveryFilterState)) => {
      const next = typeof value === 'function' ? value(filtersRef.current) : value
      const nextPagination = { ...paginationRef.current, pageIndex: 0 }
      setFiltersState(next)
      setPaginationStateInternal(nextPagination)
      pushToUrl(next, nextPagination)
    },
    [pushToUrl],
  )

  const handleSetPagination = useCallback(
    (value: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      const next = typeof value === 'function' ? value(paginationRef.current) : value
      setPaginationStateInternal(next)
      pushToUrl(filtersRef.current, next)
    },
    [pushToUrl],
  )

  const setSearch = useCallback(
    (search: string | undefined) => handleSetFilters((prev) => ({ ...prev, search })),
    [handleSetFilters],
  )

  const setStatus = useCallback(
    (status: DeliveryStatus | DeliveryStatus[] | undefined) => 
      handleSetFilters((prev) => ({ ...prev, status })),
    [handleSetFilters],
  )

  const addStatus = useCallback(
    (status: DeliveryStatus) =>
      handleSetFilters((prev) => {
        const currentStatus = prev.status
        if (!currentStatus) return { ...prev, status: [status] }
        if (Array.isArray(currentStatus)) {
          return { ...prev, status: [...currentStatus, status] }
        }
        return { ...prev, status: [currentStatus, status] }
      }),
    [handleSetFilters],
  )

  const removeStatus = useCallback(
    (status: DeliveryStatus) =>
      handleSetFilters((prev) => {
        const currentStatus = prev.status
        if (!currentStatus) return prev
        if (Array.isArray(currentStatus)) {
          const newStatus = currentStatus.filter(s => s !== status)
          return { ...prev, status: newStatus.length ? newStatus : undefined }
        }
        return currentStatus === status ? { ...prev, status: undefined } : prev
      }),
    [handleSetFilters],
  )

  const setBranchId = useCallback(
    (branchId: string | undefined) => handleSetFilters((prev) => ({ ...prev, branchId })),
    [handleSetFilters],
  )

  const setDriverId = useCallback(
    (driverId: string | undefined) => handleSetFilters((prev) => ({ ...prev, driverId })),
    [handleSetFilters],
  )

  const setCustomerId = useCallback(
    (customerId: string | undefined) => handleSetFilters((prev) => ({ ...prev, customerId })),
    [handleSetFilters],
  )

  const setDateRange = useCallback(
    (dateFrom: string | undefined, dateTo: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, dateFrom, dateTo })),
    [handleSetFilters],
  )

  const setRatingRange = useCallback(
    (minRating: number | undefined, maxRating: number | undefined) =>
      handleSetFilters((prev) => ({ ...prev, minRating, maxRating })),
    [handleSetFilters],
  )

  const setSortBy = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc' = 'desc') =>
      handleSetFilters((prev) => ({ ...prev, sortBy, sortOrder })),
    [handleSetFilters],
  )

  const clearAllFilters = useCallback(
    () => handleSetFilters({}),
    [handleSetFilters],
  )

  const getActiveFilterCount = useCallback((): number => {
    const f = filtersRef.current
    let count = 0
    if (f.search) count++
    if (f.status) {
      count += Array.isArray(f.status) ? f.status.length : 1
    }
    if (f.branchId) count++
    if (f.driverId) count++
    if (f.customerId) count++
    if (f.dateFrom) count++
    if (f.dateTo) count++
    if (f.minRating !== undefined) count++
    if (f.maxRating !== undefined) count++
    return count
  }, [])

  /**
   * deliveryQuery = stable, API-ready { filters, sortBy, sortOrder }.
   * Pass filters to useDeliveries, sortBy/sortOrder separately.
   */
  const deliveryQuery = useMemo(
    (): NormalisedDeliveryQuery => normaliseDeliveryFilters(filters),
    [filters],
  )

  return {
    paginationState,
    setPaginationState: handleSetPagination,
    filters,
    setFilters: handleSetFilters,
    setSearch,
    setStatus,
    addStatus,
    removeStatus,
    setBranchId,
    setDriverId,
    setCustomerId,
    setDateRange,
    setRatingRange,
    setSortBy,
    clearAllFilters,
    getActiveFilterCount,
    deliveryQuery,
  }
}