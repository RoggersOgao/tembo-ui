// hooks/filters-urls/use-shop-filter-url-pagination.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'
import { normaliseShopFilters } from './normalise-product-filters'
import type { NormalisedProductQuery } from './normalise-product-filters'

export type DeliveryMode = 'delivery' | 'pickup'

export interface ShopFilterState {
  tab?:             'orders' | 'favourites' | 'reviews' | 'addresses'
  search?:          string
  status?:          string
  sortBy?:          'createdAt' | 'updatedAt' | 'total' | 'rating' | 'price'
  sortOrder?:       'asc' | 'desc'
  offers?:          string
  deliveryFee?:     string
  time?:            string
  rating?:          string
  sort?:            string
  category?:        string
  priceRange?:      { min: number; max: number }
  isOpen?:          boolean
  minOrderAmount?:  number
  isHalal?:         boolean
  isOrganic?:       boolean
  isFreeRange?:     boolean
}

// Defaults are never written to the URL — only applied for display logic
const DEFAULT_FILTERS: ShopFilterState = {
  tab:       'orders',
  sortBy:    'createdAt',
  sortOrder: 'desc',
}

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams: URLSearchParams,
  defaultPageSize: number,
): { deliveryMode: DeliveryMode; pagination: PaginationState; filters: ShopFilterState } {
  const parseNum = (key: string): number | undefined => {
    const val = searchParams.get(key)
    if (!val) return undefined
    const n = parseInt(val, 10)
    return isNaN(n) ? undefined : n
  }

  const parseBool = (key: string): boolean | undefined => {
    const val = searchParams.get(key)
    if (val === 'true') return true
    return undefined
  }

  const parsePriceRange = (): { min: number; max: number } | undefined => {
    try {
      const raw = searchParams.get('priceRange')
      if (!raw) return undefined
      const parsed = JSON.parse(raw)
      if (
        typeof parsed === 'object' &&
        typeof parsed.min === 'number' &&
        typeof parsed.max === 'number'
      ) return parsed
      return undefined
    } catch {
      return undefined
    }
  }

  return {
    deliveryMode: searchParams.get('deliveryMode') === 'pickup' ? 'pickup' : 'delivery',
    pagination: {
      pageIndex: Math.max(0, (parseNum('page') ?? 1) - 1),
      pageSize:  parseNum('limit') ?? defaultPageSize,
    },
    filters: {
      tab:            (searchParams.get('tab') as ShopFilterState['tab']) || undefined,
      sortBy:         (searchParams.get('sortBy') as ShopFilterState['sortBy']) || undefined,
      sortOrder:      (searchParams.get('sortOrder') as ShopFilterState['sortOrder']) || undefined,
      search:         searchParams.get('search')      || undefined,
      status:         searchParams.get('status')      || undefined,
      offers:         searchParams.get('offers')      || undefined,
      deliveryFee:    searchParams.get('deliveryFee') || undefined,
      time:           searchParams.get('time')        || undefined,
      rating:         searchParams.get('rating')      || undefined,
      sort:           searchParams.get('sort')        || undefined,
      category:       searchParams.get('category')    || undefined,
      priceRange:     parsePriceRange(),
      isOpen:         parseBool('isOpen'),
      minOrderAmount: parseNum('minOrderAmount'),
      isHalal:        parseBool('isHalal'),
      isOrganic:      parseBool('isOrganic'),
      isFreeRange:    parseBool('isFreeRange'),
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters: ShopFilterState,
  pagination: PaginationState,
  mode: DeliveryMode,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    deliveryMode:   mode,
    page:           pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit:          pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    tab:            filters.tab,
    search:         filters.search,
    status:         filters.status,
    sortBy:         filters.sortBy,
    sortOrder:      filters.sortOrder,
    offers:         filters.offers,
    deliveryFee:    filters.deliveryFee,
    time:           filters.time,
    rating:         filters.rating,
    sort:           filters.sort,
    category:       filters.category,
    priceRange:     filters.priceRange ? JSON.stringify(filters.priceRange) : undefined,
    isOpen:         filters.isOpen ? 'true' : undefined,
    minOrderAmount: filters.minOrderAmount?.toString(),
    isHalal:        filters.isHalal ? 'true' : undefined,
    isOrganic:      filters.isOrganic ? 'true' : undefined,
    isFreeRange:    filters.isFreeRange ? 'true' : undefined,
  }

  return new URLSearchParams(cleanParams(raw)).toString()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useShopUrlPaginationWithFilters(defaultPageSize = 10) {
  const router       = useRouter()
  const pathname     = usePathname()
  const searchParams = useSearchParams()

  // Capture initial URL state once on mount
  const mountParamsString = useRef(searchParams.toString())

  const initial = useMemo(
    () => parseSearchParams(new URLSearchParams(mountParamsString.current), defaultPageSize),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [deliveryMode, setDeliveryModeState]       = useState<DeliveryMode>(initial.deliveryMode)
  const [paginationState, setPaginationStateInternal] = useState<PaginationState>(initial.pagination)
  const [filters, setFiltersState]                 = useState<ShopFilterState>(initial.filters)

  const lastPushedQs = useRef(
    serialiseToQueryString(initial.filters, initial.pagination, initial.deliveryMode, defaultPageSize),
  )

  // Stable refs to avoid stale closures
  const routerRef       = useRef(router)
  const pathnameRef     = useRef(pathname)
  const filtersRef      = useRef(filters)
  const paginationRef   = useRef(paginationState)
  const deliveryModeRef = useRef(deliveryMode)

  useEffect(() => { routerRef.current       = router       }, [router])
  useEffect(() => { pathnameRef.current     = pathname     }, [pathname])
  useEffect(() => { filtersRef.current      = filters      }, [filters])
  useEffect(() => { paginationRef.current   = paginationState }, [paginationState])
  useEffect(() => { deliveryModeRef.current = deliveryMode }, [deliveryMode])

  // Write deliveryMode to URL on first load if missing
  useEffect(() => {
    const existing = new URLSearchParams(mountParamsString.current)
    if (existing.has('deliveryMode')) return
    const qs = `deliveryMode=${initial.deliveryMode}`
    lastPushedQs.current = qs
    routerRef.current.replace(`${pathnameRef.current}?${qs}`, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Reset filters on pathname change, keep deliveryMode
  const prevPathnameRef = useRef(pathname)
  useEffect(() => {
    if (prevPathnameRef.current === pathname) return
    prevPathnameRef.current = pathname

    const currentMode     = deliveryModeRef.current
    const resetFilters    = {}
    const resetPagination = { pageIndex: 0, pageSize: defaultPageSize }

    setFiltersState(resetFilters)
    setPaginationStateInternal(resetPagination)

    const qs = `deliveryMode=${currentMode}`
    lastPushedQs.current = qs
    routerRef.current.replace(`${pathname}?${qs}`, { scroll: false })
  }, [pathname, defaultPageSize])

  // Sync state ← browser back/forward
  useEffect(() => {
    const currentQs = searchParams.toString()
    if (currentQs === lastPushedQs.current) return

    const parsed = parseSearchParams(new URLSearchParams(currentQs), defaultPageSize)
    setDeliveryModeState(parsed.deliveryMode)
    setPaginationStateInternal(parsed.pagination)
    setFiltersState(parsed.filters)
    lastPushedQs.current = currentQs
  }, [searchParams, defaultPageSize])

  // ── Core URL push ──────────────────────────────────────────────────────────

  const pushToUrl = useCallback(
    (nextFilters: ShopFilterState, nextPagination: PaginationState, nextMode: DeliveryMode) => {
      const nextQs = serialiseToQueryString(nextFilters, nextPagination, nextMode, defaultPageSize)
      if (nextQs === lastPushedQs.current) return
      lastPushedQs.current = nextQs
      const newUrl = nextQs ? `${pathnameRef.current}?${nextQs}` : pathnameRef.current
      routerRef.current.push(newUrl, { scroll: false })
    },
    [defaultPageSize],
  )

  // ── Setters ────────────────────────────────────────────────────────────────

  const handleSetFilters = useCallback(
    (value: ShopFilterState | ((prev: ShopFilterState) => ShopFilterState)) => {
      const next           = typeof value === 'function' ? value(filtersRef.current) : value
      const nextPagination = { ...paginationRef.current, pageIndex: 0 }
      setFiltersState(next)
      setPaginationStateInternal(nextPagination)
      pushToUrl(next, nextPagination, deliveryModeRef.current)
    },
    [pushToUrl],
  )

  const handleSetDeliveryMode = useCallback(
    (mode: DeliveryMode) => {
      const nextPagination = { ...paginationRef.current, pageIndex: 0 }
      setDeliveryModeState(mode)
      setPaginationStateInternal(nextPagination)
      pushToUrl(filtersRef.current, nextPagination, mode)
    },
    [pushToUrl],
  )

  const handleSetPagination = useCallback(
    (value: PaginationState | ((prev: PaginationState) => PaginationState)) => {
      const next = typeof value === 'function' ? value(paginationRef.current) : value
      setPaginationStateInternal(next)
      pushToUrl(filtersRef.current, next, deliveryModeRef.current)
    },
    [pushToUrl],
  )

  // ── Convenience setters ────────────────────────────────────────────────────

  const setFilterPill = useCallback(
    (key: keyof Pick<ShopFilterState, 'offers' | 'deliveryFee' | 'time' | 'rating' | 'sort'>, value: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, [key]: value })),
    [handleSetFilters],
  )

  const setCategory = useCallback(
    (category: string | undefined) => handleSetFilters((prev) => ({ ...prev, category })),
    [handleSetFilters],
  )

  const setPriceRange = useCallback(
    (min: number, max: number) => handleSetFilters((prev) => ({ ...prev, priceRange: { min, max } })),
    [handleSetFilters],
  )

  const clearPriceRange = useCallback(
    () => handleSetFilters((prev) => ({ ...prev, priceRange: undefined })),
    [handleSetFilters],
  )

  const setIsOpen = useCallback(
    (isOpen: boolean | undefined) => handleSetFilters((prev) => ({ ...prev, isOpen })),
    [handleSetFilters],
  )

  const setMinOrderAmount = useCallback(
    (amount: number | undefined) => handleSetFilters((prev) => ({ ...prev, minOrderAmount: amount })),
    [handleSetFilters],
  )

  const setDietaryFilter = useCallback(
    (key: 'isHalal' | 'isOrganic' | 'isFreeRange', value: boolean) =>
      handleSetFilters((prev) => ({ ...prev, [key]: value || undefined })),
    [handleSetFilters],
  )

  const clearAllFilters = useCallback(
    () => handleSetFilters({}),
    [handleSetFilters],
  )

  // ── Active filter count ────────────────────────────────────────────────────

  const getActiveFilterCount = useCallback((): number => {
    const f = filtersRef.current
    let count = 0
    if (f.search)                        count++
    if (f.status)                        count++
    if (f.offers)                        count++
    if (f.deliveryFee)                   count++
    if (f.time)                          count++
    if (f.rating)                        count++
    if (f.sort && f.sort !== 'recommended') count++
    if (f.category)                      count++
    if (f.priceRange)                    count++
    if (f.isOpen)                        count++
    if (f.minOrderAmount)                count++
    if (f.tab && f.tab !== 'orders')     count++
    if (f.sortBy || f.sortOrder)         count++
    if (f.isHalal)                       count++
    if (f.isOrganic)                     count++
    if (f.isFreeRange)                   count++
    return count
  }, [])

  // ── Derived values ─────────────────────────────────────────────────────────

  /** resolvedFilters = URL values merged over defaults. Use for display/conditional logic. */
  const resolvedFilters = useMemo(() => ({ ...DEFAULT_FILTERS, ...filters }), [filters])

  /**
   * productQuery = stable, API-ready { filters, sortBy, sortOrder }.
   * Pass filters to useProducts, sortBy/sortOrder separately.
   * sortBy/sortOrder are NEVER inside filters — avoids double-keying in React Query.
   */
  const productQuery = useMemo(
    (): NormalisedProductQuery => normaliseShopFilters(filters),
    [filters],
  )

  return {
    // Delivery mode
    deliveryMode,
    setDeliveryMode: handleSetDeliveryMode,
    // Pagination
    paginationState,
    setPaginationState: handleSetPagination,
    // Filters
    filters:        resolvedFilters,  // defaults merged — use for display logic
    rawFilters:     filters,          // raw URL values — use to seed draft state
    productQuery,                     // API-ready — pass directly to useProducts
    // Setters
    setFilters:        handleSetFilters,
    setFilterPill,
    setCategory,
    setPriceRange,
    clearPriceRange,
    setIsOpen,
    setMinOrderAmount,
    setDietaryFilter,
    clearAllFilters,
    getActiveFilterCount,
  }
}