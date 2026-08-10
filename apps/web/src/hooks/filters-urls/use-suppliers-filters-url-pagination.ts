// hooks/use-supplier-filter-url-pagination.ts
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PaginationState } from '@tanstack/react-table';
import { cleanParams } from '@/utils/clean-params';
import type { SupplierStatus } from '@/lib/supplier.api';

// ─── Filter State ─────────────────────────────────────────────────────────────

export interface SupplierFilterState {
  search?:          string;
  status?:          SupplierStatus;
  isVerified?:      boolean;
  country?:         string;
  minRating?:       number;
  maxLeadTimeDays?: number;
  sortBy?:          'createdAt' | 'companyName' | 'rating' | 'leadTimeDays';
  sortOrder?:       'asc' | 'desc';
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useSupplierUrlPaginationWithFilters(defaultPageSize = 10) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  // ── Helpers ────────────────────────────────────────────────────────────────

  const parseNum = (key: string): number | undefined => {
    const val    = searchParams.get(key);
    if (!val) return undefined;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  const parseFloat_ = (key: string): number | undefined => {
    const val    = searchParams.get(key);
    if (!val) return undefined;
    const parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  };

  const parseBool = (key: string): boolean | undefined => {
    const val = searchParams.get(key);
    if (val === 'true')  return true;
    if (val === 'false') return false;
    return undefined;
  };

  // ── State init from URL ────────────────────────────────────────────────────

  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: Math.max(0, parseNum('page') ? parseNum('page')! - 1 : 0),
    pageSize:  parseNum('limit') ?? defaultPageSize,
  });

  const [filters, setFilters] = useState<SupplierFilterState>({
    search:          searchParams.get('search')    ?? undefined,
    status:          (searchParams.get('status')   as SupplierStatus) ?? undefined,
    country:         searchParams.get('country')   ?? undefined,
    isVerified:      parseBool('isVerified'),
    minRating:       parseFloat_('minRating'),
    maxLeadTimeDays: parseNum('maxLeadTimeDays'),
    sortBy:          (searchParams.get('sortBy')    as SupplierFilterState['sortBy'])    ?? 'createdAt',
    sortOrder:       (searchParams.get('sortOrder') as SupplierFilterState['sortOrder']) ?? 'desc',
  });

  // ── Sync state → URL ───────────────────────────────────────────────────────

  useEffect(() => {
    const rawParams = {
      page:            (paginationState.pageIndex + 1).toString(),
      limit:           paginationState.pageSize.toString(),
      search:          filters.search,
      status:          filters.status,
      country:         filters.country,
      isVerified:      filters.isVerified  !== undefined ? String(filters.isVerified)  : undefined,
      minRating:       filters.minRating   !== undefined ? String(filters.minRating)   : undefined,
      maxLeadTimeDays: filters.maxLeadTimeDays !== undefined ? String(filters.maxLeadTimeDays) : undefined,
      sortBy:          filters.sortBy,
      sortOrder:       filters.sortOrder,
    };

    const cleaned     = cleanParams(rawParams);
    const queryString = new URLSearchParams(cleaned as Record<string, string>).toString();

    if (queryString !== searchParams.toString()) {
      router.push(`${pathname}?${queryString}`, { scroll: false });
    }
  }, [
    paginationState.pageIndex,
    paginationState.pageSize,
    filters,
    pathname,
    router,
    searchParams,
  ]);

  return {
    paginationState,
    setPaginationState,
    filters,
    setFilters,
    activeValues: cleanParams({ ...filters, ...paginationState }),
  };
}