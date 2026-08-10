// hooks/filters-urls/user/use-user-filter-url-pagination.ts
import { useState, useCallback, useRef, useEffect, useMemo } from 'react'
import { useSearchParams, useRouter, usePathname } from 'next/navigation'
import { PaginationState } from '@tanstack/react-table'
import { cleanParams } from '@/utils/clean-params'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserFilterState {
  search?:               string
  role?:                 string
  isActive?:             boolean
  isVerified?:           boolean
  isTwoFactorEnabled?:   boolean
  isLocked?:             boolean
  isSuspended?:          boolean
  verificationLevel?:    string
  signupSource?:         string
  createdAfter?:         string
  createdBefore?:        string
  sortBy?:               string
  sortOrder?:            'asc' | 'desc'
}

export interface NormalisedUserQuery {
  filters:   UserFilterState
  sortBy:    string
  sortOrder: 'asc' | 'desc'
}

// ─── Normalise filters → API-ready query ──────────────────────────────────────

export function normaliseUserFilters(
  f: UserFilterState,
  defaultSortBy:    string = 'createdAt',
  defaultSortOrder: 'asc' | 'desc' = 'desc',
): NormalisedUserQuery {
  const filters: UserFilterState = {}

  if (f.search)                              filters.search             = f.search
  if (f.role)                                filters.role               = f.role
  if (f.isActive             !== undefined)  filters.isActive           = f.isActive
  if (f.isVerified           !== undefined)  filters.isVerified         = f.isVerified
  if (f.isTwoFactorEnabled   !== undefined)  filters.isTwoFactorEnabled = f.isTwoFactorEnabled
  if (f.isLocked             !== undefined)  filters.isLocked           = f.isLocked
  if (f.isSuspended          !== undefined)  filters.isSuspended        = f.isSuspended
  if (f.verificationLevel)                   filters.verificationLevel  = f.verificationLevel
  if (f.signupSource)                        filters.signupSource       = f.signupSource
  if (f.createdAfter)                        filters.createdAfter       = f.createdAfter
  if (f.createdBefore)                       filters.createdBefore      = f.createdBefore

  return {
    filters,
    sortBy:    f.sortBy    ?? defaultSortBy,
    sortOrder: f.sortOrder ?? defaultSortOrder,
  }
}

// ─── Parse URL → State ────────────────────────────────────────────────────────

function parseSearchParams(
  searchParams:    URLSearchParams,
  defaultPageSize: number,
): { pagination: PaginationState; filters: UserFilterState } {
  const parseNum = (key: string): number | undefined => {
    const val = searchParams.get(key)
    if (!val) return undefined
    const n = parseInt(val, 10)
    return isNaN(n) ? undefined : n
  }

  const parseBool = (key: string): boolean | undefined => {
    const val = searchParams.get(key)
    if (val === 'true')  return true
    if (val === 'false') return false
    return undefined
  }

  return {
    pagination: {
      pageIndex: Math.max(0, (parseNum('page') ?? 1) - 1),
      pageSize:  parseNum('limit') ?? defaultPageSize,
    },
    filters: {
      search:             searchParams.get('search')             || undefined,
      role:               searchParams.get('role')               || undefined,
      isActive:           parseBool('isActive'),
      isVerified:         parseBool('isVerified'),
      isTwoFactorEnabled: parseBool('isTwoFactorEnabled'),
      isLocked:           parseBool('isLocked'),
      isSuspended:        parseBool('isSuspended'),
      verificationLevel:  searchParams.get('verificationLevel')  || undefined,
      signupSource:       searchParams.get('signupSource')       || undefined,
      createdAfter:       searchParams.get('createdAfter')       || undefined,
      createdBefore:      searchParams.get('createdBefore')      || undefined,
      sortBy:             searchParams.get('sortBy')             || undefined,
      sortOrder:         (searchParams.get('sortOrder') as 'asc' | 'desc') || undefined,
    },
  }
}

// ─── State → URL ──────────────────────────────────────────────────────────────

function serialiseToQueryString(
  filters:         UserFilterState,
  pagination:      PaginationState,
  defaultPageSize: number,
): string {
  const raw: Record<string, string | undefined> = {
    page:               pagination.pageIndex > 0 ? String(pagination.pageIndex + 1) : undefined,
    limit:              pagination.pageSize !== defaultPageSize ? String(pagination.pageSize) : undefined,
    search:             filters.search,
    role:               filters.role,
    isActive:           filters.isActive            !== undefined ? String(filters.isActive)           : undefined,
    isVerified:         filters.isVerified          !== undefined ? String(filters.isVerified)         : undefined,
    isTwoFactorEnabled: filters.isTwoFactorEnabled  !== undefined ? String(filters.isTwoFactorEnabled) : undefined,
    isLocked:           filters.isLocked            !== undefined ? String(filters.isLocked)           : undefined,
    isSuspended:        filters.isSuspended         !== undefined ? String(filters.isSuspended)        : undefined,
    verificationLevel:  filters.verificationLevel,
    signupSource:       filters.signupSource,
    createdAfter:       filters.createdAfter,
    createdBefore:      filters.createdBefore,
    sortBy:             filters.sortBy,
    sortOrder:          filters.sortOrder,
  }

  const params = new URLSearchParams(cleanParams(raw) as Record<string, string>)
  return params.toString()
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useUserFilterUrlPagination(defaultPageSize = 10) {
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
  const [filters, setFiltersState]                    = useState<UserFilterState>(initial.filters)

  const lastPushedQs = useRef(
    serialiseToQueryString(initial.filters, initial.pagination, defaultPageSize),
  )

  const routerRef     = useRef(router)
  const pathnameRef   = useRef(pathname)
  const filtersRef    = useRef(filters)
  const paginationRef = useRef(paginationState)

  useEffect(() => { routerRef.current     = router          }, [router])
  useEffect(() => { pathnameRef.current   = pathname        }, [pathname])
  useEffect(() => { filtersRef.current    = filters         }, [filters])
  useEffect(() => { paginationRef.current = paginationState }, [paginationState])

  // ── Sync state ← browser back/forward ─────────────────────────────────────

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
    (nextFilters: UserFilterState, nextPagination: PaginationState) => {
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
    (value: UserFilterState | ((prev: UserFilterState) => UserFilterState)) => {
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

  // ── Convenience setters ────────────────────────────────────────────────────

  const setSearch = useCallback(
    (search: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, search })),
    [handleSetFilters],
  )

  const setRole = useCallback(
    (role: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, role })),
    [handleSetFilters],
  )

  const setVerificationLevel = useCallback(
    (verificationLevel: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, verificationLevel })),
    [handleSetFilters],
  )

  const setSignupSource = useCallback(
    (signupSource: string | undefined) =>
      handleSetFilters((prev) => ({ ...prev, signupSource })),
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
    if (f.search)                          count++
    if (f.role)                            count++
    if (f.isActive           !== undefined) count++
    if (f.isVerified         !== undefined) count++
    if (f.isTwoFactorEnabled !== undefined) count++
    if (f.isLocked           !== undefined) count++
    if (f.isSuspended        !== undefined) count++
    if (f.verificationLevel)               count++
    if (f.signupSource)                    count++
    if (f.createdAfter)                    count++
    if (f.createdBefore)                   count++
    return count
  }, [])

  // ── Stable API-ready query ─────────────────────────────────────────────────

  const userQuery = useMemo(
    (): NormalisedUserQuery => normaliseUserFilters(filters),
    [filters],
  )

  return {
    paginationState,
    setPaginationState:   handleSetPagination,
    filters,
    setFilters:           handleSetFilters,
    setSearch,
    setRole,
    setVerificationLevel,
    setSignupSource,
    setDateRange,
    setSortBy,
    clearAllFilters,
    getActiveFilterCount,
    userQuery,
  }
}