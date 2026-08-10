// hooks/filters-urls/use-dashboard-filter-url-pagination.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'
import { normaliseDashboardFilters } from './normalise-product-filters'
import type { NormalisedProductQuery } from './normalise-product-filters'

export interface ProductFilterState {
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

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams: URLSearchParams,
  defaultPageSize: number,
): { pagination: PaginationState; filters: ProductFilterState } {
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
    if (val === 'true')  return true
    if (val === 'false') return false
    return undefined
  }

  const parseStringArray = (key: string): string[] | undefined => {
    const val = searchParams.getAll(key)
    return val.length > 0 ? val : undefined
  }

  return {
    pagination: {
      pageIndex: Math.max(0, (parseNum('page') ?? 1) - 1),
      pageSize:  parseNum('limit') ?? defaultPageSize,
    },
    filters: {
      search:        searchParams.get('search')        || undefined,
      categoryId:    searchParams.get('categoryId')    || undefined,
      isActive:      parseBool('isActive'),
      isFeatured:    parseBool('isFeatured'),
      isHalal:       parseBool('isHalal'),
      isOrganic:     parseBool('isOrganic'),
      isFreeRange:   parseBool('isFreeRange'),
      minPrice:      parseFloat_('minPrice'),
      maxPrice:      parseFloat_('maxPrice'),
      tags:          parseStringArray('tags'),
      supplierId:    searchParams.get('supplierId')    || undefined,
      createdAfter:  searchParams.get('createdAfter')  || undefined,
      createdBefore: searchParams.get('createdBefore') || undefined,
      sortBy:        searchParams.get('sortBy')        || undefined,
      sortOrder:     (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters: ProductFilterState,
  pagination: PaginationState,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    page:          pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit:         pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    search:        filters.search,
    categoryId:    filters.categoryId,
    isActive:      filters.isActive  !== undefined ? String(filters.isActive)  : undefined,
    isFeatured:    filters.isFeatured !== undefined ? String(filters.isFeatured) : undefined,
    isHalal:       filters.isHalal   !== undefined ? String(filters.isHalal)   : undefined,
    isOrganic:     filters.isOrganic  !== undefined ? String(filters.isOrganic)  : undefined,
    isFreeRange:   filters.isFreeRange !== undefined ? String(filters.isFreeRange) : undefined,
    minPrice:      filters.minPrice   !== undefined ? String(filters.minPrice)  : undefined,
    maxPrice:      filters.maxPrice   !== undefined ? String(filters.maxPrice)  : undefined,
    supplierId:    filters.supplierId,
    createdAfter:  filters.createdAfter,
    createdBefore: filters.createdBefore,
    sortBy:        filters.sortBy,
    sortOrder:     filters.sortOrder,
  }

  const params = new URLSearchParams(cleanParams(raw) as Record<string, string>)

  // tags[] repeats the key
  if (filters.tags?.length) {
    filters.tags.forEach((tag) => params.append('tags', tag))
  }

  return params.toString()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardFilterUrlPagination(defaultPageSize = 10) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  const mountParamsString = useRef(searchParams.toString())

  const initial = useMemo(
    () => parseSearchParams(new URLSearchParams(mountParamsString.current), defaultPageSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [paginationState, setPaginationStateInternal] = useState<PaginationState>(initial.pagination)
  const [filters, setFiltersState]                    = useState<ProductFilterState>(initial.filters)

  const lastPushedQs = useRef(
    serialiseToQueryString(initial.filters, initial.pagination, defaultPageSize),
  )

  const routerRef     = useRef(router)
  const pathnameRef   = useRef(pathname)
  const filtersRef    = useRef(filters)
  const paginationRef = useRef(paginationState)

  useEffect(() => { routerRef.current     = router         }, [router])
  useEffect(() => { pathnameRef.current   = pathname       }, [pathname])
  useEffect(() => { filtersRef.current    = filters        }, [filters])
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
    (nextFilters: ProductFilterState, nextPagination: PaginationState) => {
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
    (value: ProductFilterState | ((prev: ProductFilterState) => ProductFilterState)) => {
      const next           = typeof value === 'function' ? value(filtersRef.current) : value
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

  const setCategory = useCallback(
    (categoryId: string | undefined) => handleSetFilters((prev) => ({ ...prev, categoryId })),
    [handleSetFilters],
  )

  const setSupplier = useCallback(
    (supplierId: string | undefined) => handleSetFilters((prev) => ({ ...prev, supplierId })),
    [handleSetFilters],
  )

  const setDateRange = useCallback(
    (createdAfter: string | undefined, createdBefore: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, createdAfter, createdBefore })),
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
    if (f.search)        count++
    if (f.categoryId)    count++
    if (f.supplierId)    count++
    if (f.isActive !== undefined)   count++
    if (f.isFeatured !== undefined) count++
    if (f.isHalal !== undefined)    count++
    if (f.isOrganic !== undefined)  count++
    if (f.isFreeRange !== undefined) count++
    if (f.minPrice !== undefined)   count++
    if (f.maxPrice !== undefined)   count++
    if (f.tags?.length)             count++
    if (f.createdAfter)             count++
    if (f.createdBefore)            count++
    return count
  }, [])

  /**
   * productQuery = stable, API-ready { filters, sortBy, sortOrder }.
   * Pass filters to useProducts, sortBy/sortOrder separately.
   */
  const productQuery = useMemo(
    (): NormalisedProductQuery => normaliseDashboardFilters(filters),
    [filters],
  )

  return {
    paginationState,
    setPaginationState: handleSetPagination,
    filters,
    setFilters:         handleSetFilters,
    setSearch,
    setCategory,
    setSupplier,
    setDateRange,
    setSortBy,
    clearAllFilters,
    getActiveFilterCount,
    productQuery,
  }
}