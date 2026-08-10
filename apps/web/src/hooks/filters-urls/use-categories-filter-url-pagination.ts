// hooks/use-category-filter-url-pagination.ts
import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PaginationState } from '@tanstack/react-table';
import { cleanParams } from '@/utils/clean-params';

/**
 * Category Filter State based on CategoryQueryOptions
 */
export interface CategoryFilterState {
  search?: string;
  parentId?: string | null;
  includeInactive?: boolean;
  sortBy?: 'displayOrder' | 'name' | 'createdAt' | 'propertiesCount';
  sortOrder?: 'asc' | 'desc';
}

/**
 * Hook for managing category filters and pagination in URL
 * Based on CategoryQueryOptions from the API
 */
export function useCategoryUrlPaginationWithFilters(defaultPageSize = 10) {
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
  const [filters, setFilters] = useState<CategoryFilterState>({
    search: searchParams.get('search') || undefined,
    parentId: searchParams.get('parentId') || undefined,
    includeInactive: parseBool('includeInactive'),
    sortBy: (searchParams.get('sortBy') as CategoryFilterState['sortBy']) || 'displayOrder',
    sortOrder: (searchParams.get('sortOrder') as CategoryFilterState['sortOrder']) || 'asc',
  });

  // Sync URL with state
  useEffect(() => {
    // 1. Create a raw object of all current state
    const currentParams = {
      page: (paginationState.pageIndex + 1).toString(),
      limit: paginationState.pageSize.toString(),
      search: filters.search,
      parentId: filters.parentId,
      includeInactive: filters.includeInactive,
      sortBy: filters.sortBy,
      sortOrder: filters.sortOrder,
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

  // Return the raw state, but also a 'activeFilters' if you want a clean version immediately
  return {
    paginationState,
    setPaginationState,
    filters,
    setFilters,
    // Optional: Return a cleaner version for the API consumer to use directly
    activeValues: cleanParams({ ...filters, ...paginationState }),
  };
}