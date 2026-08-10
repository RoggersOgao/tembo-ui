// hooks/filters-urls/branch-filters/use-branch-filter-url-pagination.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'
import { normaliseBranchFilters } from './normalise-branch-filters'
import type { NormalisedBranchQuery } from './normalise-branch-filters'

export interface BranchFilterState {
  search?: string
  city?: string
  county?: string
  isActive?: boolean
  hasInventory?: boolean
  productId?: string
  minLat?: number
  maxLat?: number
  minLng?: number
  maxLng?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams: URLSearchParams,
  defaultPageSize: number,
): { pagination: PaginationState; filters: BranchFilterState } {
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

  const parseBool = (key: string): boolean | undefined => {
    const val = searchParams.get(key)
    if (val === 'true') return true
    if (val === 'false') return false
    return undefined
  }

  return {
    pagination: {
      pageIndex: Math.max(0, (parseNum('page') ?? 1) - 1),
      pageSize: parseNum('limit') ?? defaultPageSize,
    },
    filters: {
      search: searchParams.get('search') || undefined,
      city: searchParams.get('city') || undefined,
      county: searchParams.get('county') || undefined,
      isActive: parseBool('isActive'),
      hasInventory: parseBool('hasInventory'),
      productId: searchParams.get('productId') || undefined,
      minLat: parseFloat_('minLat'),
      maxLat: parseFloat_('maxLat'),
      minLng: parseFloat_('minLng'),
      maxLng: parseFloat_('maxLng'),
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters: BranchFilterState,
  pagination: PaginationState,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    page: pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit: pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    search: filters.search,
    city: filters.city,
    county: filters.county,
    isActive: filters.isActive !== undefined ? String(filters.isActive) : undefined,
    hasInventory: filters.hasInventory !== undefined ? String(filters.hasInventory) : undefined,
    productId: filters.productId,
    minLat: filters.minLat !== undefined ? String(filters.minLat) : undefined,
    maxLat: filters.maxLat !== undefined ? String(filters.maxLat) : undefined,
    minLng: filters.minLng !== undefined ? String(filters.minLng) : undefined,
    maxLng: filters.maxLng !== undefined ? String(filters.maxLng) : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }

  const params = new URLSearchParams(cleanParams(raw) as Record<string, string>)
  return params.toString()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBranchFilterUrlPagination(defaultPageSize = 10) {
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
  const [filters, setFiltersState] = useState<BranchFilterState>(initial.filters)

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
    (nextFilters: BranchFilterState, nextPagination: PaginationState) => {
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
    (value: BranchFilterState | ((prev: BranchFilterState) => BranchFilterState)) => {
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

  const setCity = useCallback(
    (city: string | undefined) => handleSetFilters((prev) => ({ ...prev, city })),
    [handleSetFilters],
  )

  const setCounty = useCallback(
    (county: string | undefined) => handleSetFilters((prev) => ({ ...prev, county })),
    [handleSetFilters],
  )

  const setIsActive = useCallback(
    (isActive: boolean | undefined) => handleSetFilters((prev) => ({ ...prev, isActive })),
    [handleSetFilters],
  )

  const setHasInventory = useCallback(
    (hasInventory: boolean | undefined) => handleSetFilters((prev) => ({ ...prev, hasInventory })),
    [handleSetFilters],
  )

  const setProductId = useCallback(
    (productId: string | undefined) => handleSetFilters((prev) => ({ ...prev, productId })),
    [handleSetFilters],
  )

  const setLocationBounds = useCallback(
    (bounds: { minLat?: number; maxLat?: number; minLng?: number; maxLng?: number }) =>
      handleSetFilters((prev) => ({ ...prev, ...bounds })),
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
    if (f.city) count++
    if (f.county) count++
    if (f.isActive !== undefined) count++
    if (f.hasInventory !== undefined) count++
    if (f.productId) count++
    if (f.minLat !== undefined) count++
    if (f.maxLat !== undefined) count++
    if (f.minLng !== undefined) count++
    if (f.maxLng !== undefined) count++
    return count
  }, [])

  /**
   * branchQuery = stable, API-ready { filters, sortBy, sortOrder }.
   * Pass filters to useBranches, sortBy/sortOrder separately.
   */
  const branchQuery = useMemo(
    (): NormalisedBranchQuery => normaliseBranchFilters(filters),
    [filters],
  )

  return {
    paginationState,
    setPaginationState: handleSetPagination,
    filters,
    setFilters: handleSetFilters,
    setSearch,
    setCity,
    setCounty,
    setIsActive,
    setHasInventory,
    setProductId,
    setLocationBounds,
    setSortBy,
    clearAllFilters,
    getActiveFilterCount,
    branchQuery,
  }
}