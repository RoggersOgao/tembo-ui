// hooks/orders/use-orders-filter-url-pagination.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'
import type { OrderFilters, OrderStatus, OrderType, PaymentStatus, DeliveryStatus } from '@/types/products/orders.types'

export interface OrderFilterState {
  search?: string
  userId?: string
  status?: OrderStatus | OrderStatus[]
  orderType?: OrderType
  paymentStatus?: PaymentStatus
  deliveryStatus?: DeliveryStatus
  couponId?: string
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
}

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams: URLSearchParams,
  defaultPageSize: number,
  isAdmin: boolean,
): { pagination: PaginationState; filters: OrderFilterState } {
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

  const parseStatus = (): OrderStatus | OrderStatus[] | undefined => {
    const vals = searchParams.getAll('status') as OrderStatus[]
    if (vals.length === 0) return undefined
    if (vals.length === 1) return vals[0]
    return vals
  }

  const parsePaymentStatus = (): PaymentStatus | undefined => {
    const val = searchParams.get('paymentStatus')
    if (!val || val === 'all') return undefined
    return val as PaymentStatus
  }

  const parseDeliveryStatus = (): DeliveryStatus | undefined => {
    const val = searchParams.get('deliveryStatus')
    if (!val || val === 'all') return undefined
    return val as DeliveryStatus
  }

  return {
    pagination: {
      pageIndex: Math.max(0, (parseNum('page') ?? 1) - 1),
      pageSize: parseNum('limit') ?? defaultPageSize,
    },
    filters: {
      search: searchParams.get('search') || undefined,
      userId: searchParams.get('userId') || undefined,
      status: parseStatus(),
      orderType: (searchParams.get('orderType') as OrderType) || undefined,
      paymentStatus: isAdmin ? parsePaymentStatus() : undefined,
      deliveryStatus: isAdmin ? parseDeliveryStatus() : undefined,
      couponId: searchParams.get('couponId') || undefined,
      startDate: searchParams.get('startDate') || undefined,
      endDate: searchParams.get('endDate') || undefined,
      minAmount: parseFloat_('minAmount'),
      maxAmount: parseFloat_('maxAmount'),
      sortBy: searchParams.get('sortBy') || 'createdAt',
      sortOrder: (searchParams.get('sortOrder') as 'asc' | 'desc') || 'desc',
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters: OrderFilterState,
  pagination: PaginationState,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    page: pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit: pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    search: filters.search,
    userId: filters.userId,
    orderType: filters.orderType,
    paymentStatus: filters.paymentStatus,
    deliveryStatus: filters.deliveryStatus,
    couponId: filters.couponId,
    startDate: filters.startDate,
    endDate: filters.endDate,
    minAmount: filters.minAmount !== undefined ? String(filters.minAmount) : undefined,
    maxAmount: filters.maxAmount !== undefined ? String(filters.maxAmount) : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  }

  const params = new URLSearchParams(cleanParams(raw) as Record<string, string>)

  // Handle status array (multiple status values)
  if (filters.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status]
    statuses.forEach((status) => params.append('status', status))
  }

  return params.toString()
}

// ─── Normalise orders for API ─────────────────────────────────────────────────

export interface NormalisedOrderQuery {
  filters: OrderFilters
  sortBy: string
  sortOrder: 'asc' | 'desc'
}

export function normaliseOrderFilters(filters: OrderFilterState): NormalisedOrderQuery {
  const orderFilters: OrderFilters = {}

  if (filters.userId) orderFilters.userId = filters.userId
  if (filters.status) orderFilters.status = filters.status
  if (filters.orderType) orderFilters.orderType = filters.orderType
  if (filters.paymentStatus) orderFilters.paymentStatus = filters.paymentStatus
  if (filters.deliveryStatus) orderFilters.deliveryStatus = filters.deliveryStatus
  if (filters.couponId) orderFilters.couponId = filters.couponId
  if (filters.startDate) orderFilters.startDate = new Date(filters.startDate)
  if (filters.endDate) orderFilters.endDate = new Date(filters.endDate)
  if (filters.minAmount !== undefined) orderFilters.minAmount = filters.minAmount
  if (filters.maxAmount !== undefined) orderFilters.maxAmount = filters.maxAmount

  return {
    filters: orderFilters,
    sortBy: filters.sortBy ?? 'createdAt',
    sortOrder: filters.sortOrder ?? 'desc',
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseOrdersFilterUrlPaginationOptions {
  defaultPageSize?: number
  isAdmin?: boolean
}

export function useOrdersFilterUrlPagination(options: UseOrdersFilterUrlPaginationOptions = {}) {
  const { defaultPageSize = 20, isAdmin = false } = options

  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const mountParamsString = useRef(searchParams.toString())

  const initial = useMemo(
    () => parseSearchParams(new URLSearchParams(mountParamsString.current), defaultPageSize, isAdmin),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )

  const [paginationState, setPaginationStateInternal] = useState<PaginationState>(initial.pagination)
  const [filters, setFiltersState] = useState<OrderFilterState>(initial.filters)

  const lastPushedQs = useRef(
    serialiseToQueryString(initial.filters, initial.pagination, defaultPageSize),
  )

  const routerRef = useRef(router)
  const pathnameRef = useRef(pathname)
  const filtersRef = useRef(filters)
  const paginationRef = useRef(paginationState)

  useEffect(() => {
    routerRef.current = router
  }, [router])
  useEffect(() => {
    pathnameRef.current = pathname
  }, [pathname])
  useEffect(() => {
    filtersRef.current = filters
  }, [filters])
  useEffect(() => {
    paginationRef.current = paginationState
  }, [paginationState])

  // Sync state ← browser back/forward
  useEffect(() => {
    const currentQs = searchParams.toString()
    if (currentQs === lastPushedQs.current) return
    const parsed = parseSearchParams(new URLSearchParams(currentQs), defaultPageSize, isAdmin)
    setPaginationStateInternal(parsed.pagination)
    setFiltersState(parsed.filters)
    lastPushedQs.current = currentQs
  }, [searchParams, defaultPageSize, isAdmin])

  // ── Core URL push ──────────────────────────────────────────────────────────

  const pushToUrl = useCallback(
    (nextFilters: OrderFilterState, nextPagination: PaginationState) => {
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
    (value: OrderFilterState | ((prev: OrderFilterState) => OrderFilterState)) => {
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

  // ── Convenience setters ────────────────────────────────────────────────────

  const setSearch = useCallback(
    (search: string | undefined) => handleSetFilters((prev) => ({ ...prev, search })),
    [handleSetFilters],
  )

  const setUserId = useCallback(
    (userId: string | undefined) => handleSetFilters((prev) => ({ ...prev, userId })),
    [handleSetFilters],
  )

  const setStatus = useCallback(
    (status: OrderStatus | OrderStatus[] | undefined) =>
      handleSetFilters((prev) => ({ ...prev, status })),
    [handleSetFilters],
  )

  const setOrderType = useCallback(
    (orderType: OrderType | undefined) => handleSetFilters((prev) => ({ ...prev, orderType })),
    [handleSetFilters],
  )

  const setPaymentStatus = useCallback(
    (paymentStatus: PaymentStatus | undefined) => {
      if (isAdmin) {
        handleSetFilters((prev) => ({ ...prev, paymentStatus }))
      }
    },
    [handleSetFilters, isAdmin],
  )

  const setDeliveryStatus = useCallback(
    (deliveryStatus: DeliveryStatus | undefined) => {
      if (isAdmin) {
        handleSetFilters((prev) => ({ ...prev, deliveryStatus }))
      }
    },
    [handleSetFilters, isAdmin],
  )

  const setCouponId = useCallback(
    (couponId: string | undefined) => handleSetFilters((prev) => ({ ...prev, couponId })),
    [handleSetFilters],
  )

  const setDateRange = useCallback(
    (startDate: string | undefined, endDate: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, startDate, endDate })),
    [handleSetFilters],
  )

  const setAmountRange = useCallback(
    (minAmount: number | undefined, maxAmount: number | undefined) =>
      handleSetFilters((prev) => ({ ...prev, minAmount, maxAmount })),
    [handleSetFilters],
  )

  const setSortBy = useCallback(
    (sortBy: string, sortOrder: 'asc' | 'desc' = 'desc') =>
      handleSetFilters((prev) => ({ ...prev, sortBy, sortOrder })),
    [handleSetFilters],
  )

  const clearAllFilters = useCallback(
    () =>
      handleSetFilters({
        sortBy: 'createdAt',
        sortOrder: 'desc',
      }),
    [handleSetFilters],
  )

  const getActiveFilterCount = useCallback((): number => {
    const f = filtersRef.current
    let count = 0
    if (f.search) count++
    if (f.userId) count++
    if (f.status) count++
    if (f.orderType) count++
    if (f.paymentStatus) count++
    if (f.deliveryStatus) count++
    if (f.couponId) count++
    if (f.startDate) count++
    if (f.endDate) count++
    if (f.minAmount !== undefined) count++
    if (f.maxAmount !== undefined) count++
    return count
  }, [])

  const hasActiveFilters = useMemo(() => getActiveFilterCount() > 0, [getActiveFilterCount])

  /**
   * orderQuery = stable, API-ready { filters, sortBy, sortOrder }
   */
  const orderQuery = useMemo(
    (): NormalisedOrderQuery => normaliseOrderFilters(filters),
    [filters],
  )

  return {
    // State
    paginationState,
    setPaginationState: handleSetPagination,
    filters,
    setFilters: handleSetFilters,
    activeFilters: orderQuery.filters,
    hasActiveFilters,
    getActiveFilterCount,
    orderQuery,

    // Convenience setters
    setSearch,
    setUserId,
    setStatus,
    setOrderType,
    setPaymentStatus,
    setDeliveryStatus,
    setCouponId,
    setDateRange,
    setAmountRange,
    setSortBy,
    clearAllFilters,
  }
}