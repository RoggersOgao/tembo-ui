import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'
import { normaliseBranchDriverFilters, NormalisedBranchDriverQuery } from './normalise-branch-driver-filters'


export interface BranchDriverFilterState {
  branchId?: string
  driverId?: string
  isActive?: boolean
  isPrimary?: boolean
  search?: string
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams: URLSearchParams,
  defaultPageSize: number,
): { pagination: PaginationState; filters: BranchDriverFilterState } {
  const parseNum = (key: string): number | undefined => {
    const val = searchParams.get(key)
    if (!val) return undefined
    const n = parseInt(val, 10)
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
      branchId: searchParams.get('branchId') || undefined,
      driverId: searchParams.get('driverId') || undefined,
      isActive: parseBool('isActive'),
      isPrimary: parseBool('isPrimary'),
      search: searchParams.get('search') || undefined,
      sortBy: searchParams.get('sortBy') || undefined,
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters: BranchDriverFilterState,
  pagination: PaginationState,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    page: pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit: pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    branchId: filters.branchId,
    driverId: filters.driverId,
    isActive: filters.isActive !== undefined ? String(filters.isActive) : undefined,
    isPrimary: filters.isPrimary !== undefined ? String(filters.isPrimary) : undefined,
    search: filters.search,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }

  const params = new URLSearchParams(cleanParams(raw) as Record<string, string>)
  return params.toString()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBranchDriverFilterUrlPagination(defaultPageSize = 10) {
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
  const [filters, setFiltersState] = useState<BranchDriverFilterState>(initial.filters)

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
    (nextFilters: BranchDriverFilterState, nextPagination: PaginationState) => {
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
    (value: BranchDriverFilterState | ((prev: BranchDriverFilterState) => BranchDriverFilterState)) => {
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

  // Individual filter setters
  const setBranchId = useCallback(
    (branchId: string | undefined) => handleSetFilters((prev) => ({ ...prev, branchId })),
    [handleSetFilters],
  )

  const setDriverId = useCallback(
    (driverId: string | undefined) => handleSetFilters((prev) => ({ ...prev, driverId })),
    [handleSetFilters],
  )

  const setIsActive = useCallback(
    (isActive: boolean | undefined) => handleSetFilters((prev) => ({ ...prev, isActive })),
    [handleSetFilters],
  )

  const setIsPrimary = useCallback(
    (isPrimary: boolean | undefined) => handleSetFilters((prev) => ({ ...prev, isPrimary })),
    [handleSetFilters],
  )

  const setSearch = useCallback(
    (search: string | undefined) => handleSetFilters((prev) => ({ ...prev, search })),
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
    if (f.branchId) count++
    if (f.driverId) count++
    if (f.isActive !== undefined) count++
    if (f.isPrimary !== undefined) count++
    if (f.search) count++
    return count
  }, [])

  /**
   * branchDriverQuery = stable, API-ready { filters, sortBy, sortOrder }.
   * Pass filters to useBranchDrivers, sortBy/sortOrder separately.
   */
  const branchDriverQuery = useMemo(
    (): NormalisedBranchDriverQuery => normaliseBranchDriverFilters(filters),
    [filters],
  )

  return {
    paginationState,
    setPaginationState: handleSetPagination,
    filters,
    setFilters: handleSetFilters,
    setBranchId,
    setDriverId,
    setIsActive,
    setIsPrimary,
    setSearch,
    setSortBy,
    clearAllFilters,
    getActiveFilterCount,
    branchDriverQuery,
  }
}