// hooks/use-pricing-filter-url-pagination.ts
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PaginationState } from '@tanstack/react-table';
import { cleanParams } from '@/utils/clean-params';
import { BillingPeriod } from '@/types/products/pricing.types';

/**
 * Pricing Filter State based on Pricing API Query Options
 */
export interface PricingFilterState {
  // Search and basic filters
  search?: string;
  propertyId?: string;
  
  // Pricing-specific filters
  includeInactive?: boolean;
  billingPeriod?: BillingPeriod;
  
  // Price range filters
  minAmount?: number;
  maxAmount?: number;
  
  // Sorting
  sortBy?: 'amount' | 'billingPeriod' | 'createdAt' | 'isDefault';
  sortOrder?: 'asc' | 'desc';
  
  // Other filters
  isDefault?: boolean;
  currency?: string;
}

/**
 * Hook for managing pricing filters and pagination in URL
 * Based on Pricing API QueryOptions
 * 
 * @example
 * ```tsx
 * const { paginationState, setPaginationState, filters, setFilters } = usePricingUrlPaginationWithFilters(10);
 * 
 * // Use filters in your component
 * <PricingTable 
 *   filters={filters} 
 *   setFilters={setFilters}
 *   paginationState={paginationState}
 *   setPaginationState={setPaginationState}
 * />
 * ```
 */
export function usePricingUrlPaginationWithFilters(defaultPageSize = 10) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Helper to safely parse numbers from URL
  const parseNum = (key: string) => {
    const val = searchParams.get(key);
    if (!val) return undefined;
    const parsed = parseInt(val, 10);
    return isNaN(parsed) ? undefined : parsed;
  };

  // Helper to safely parse floats from URL (for price amounts)
  const parseFloat = (key: string) => {
    const val = searchParams.get(key);
    if (!val) return undefined;
    const parsed = Number.parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  };

  // Helper to parse boolean from URL
  const parseBool = (key: string) => {
    const val = searchParams.get(key);
    if (!val) return undefined;
    return val === 'true';
  };

  // Initialize pagination from URL
  const [paginationState, setPaginationState] = useState<PaginationState>({
    pageIndex: Math.max(0, parseNum('page') ? parseNum('page')! - 1 : 0),
    pageSize: parseNum('limit') || defaultPageSize,
  });

  // Initialize filters from URL
  const [filters, setFilters] = useState<PricingFilterState>({
    search: searchParams.get('search') || undefined,
    propertyId: searchParams.get('propertyId') || undefined,
    includeInactive: parseBool('includeInactive'),
    billingPeriod: (searchParams.get('billingPeriod') as BillingPeriod) || undefined,
    minAmount: parseFloat('minAmount'),
    maxAmount: parseFloat('maxAmount'),
    sortBy: (searchParams.get('sortBy') as PricingFilterState['sortBy']) || undefined,
    sortOrder: (searchParams.get('sortOrder') as PricingFilterState['sortOrder']) || 'asc',
    isDefault: parseBool('isDefault'),
    currency: searchParams.get('currency') || undefined,
  });

  // Sync URL with state
  useEffect(() => {
    // 1. Create a raw object of all current state
    const currentParams = {
      page: (paginationState.pageIndex + 1).toString(),
      limit: paginationState.pageSize.toString(),
      search: filters.search,
      propertyId: filters.propertyId,
      includeInactive: filters.includeInactive,
      billingPeriod: filters.billingPeriod,
      minAmount: filters.minAmount?.toString(),
      maxAmount: filters.maxAmount?.toString(),
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
      isDefault: filters.isDefault,
      currency: filters.currency,
    };

    // 2. Clean the object (removes undefined/null/empty strings)
    const cleanedParams = cleanParams(currentParams);

    // 3. Construct Query String
    const queryString = new URLSearchParams(cleanedParams as any).toString();
    const newUrl = `${pathname}?${queryString}`;

    // 4. Compare with current URL to avoid loops
    const currentQueryString = searchParams.toString();

    // Only push if the query string actually differs
    if (queryString !== currentQueryString) {
      router.push(newUrl, { scroll: false });
    }
  }, [
    paginationState.pageIndex,
    paginationState.pageSize,
    filters,
    pathname,
    router,
    searchParams, // included for dependency stability
  ]);

  // Return the raw state, but also a 'activeValues' if you want a clean version immediately
  return {
    paginationState,
    setPaginationState,
    filters,
    setFilters,
    // Optional: Return a cleaner version for the API consumer to use directly
    activeValues: cleanParams({ ...filters, ...paginationState }),
  };
}