import { useState, useEffect } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { PaginationState } from '@tanstack/react-table';

export function useUrlPagination(defaultPageSize = 10) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();

    // Initialize from URL
    const [paginationState, setPaginationState] = useState<PaginationState>({
        pageIndex: Math.max(0, parseInt(searchParams.get('page') || '1') - 1),
        pageSize: parseInt(searchParams.get('limit') || defaultPageSize.toString()),
    });

    // Sync URL with state
    useEffect(() => {
        const params = new URLSearchParams(searchParams.toString());
        const urlPage = (paginationState.pageIndex + 1).toString();
        const urlLimit = paginationState.pageSize.toString();

        // Only update if values actually changed
        if (params.get('page') !== urlPage || params.get('limit') !== urlLimit) {
            params.set('page', urlPage);
            params.set('limit', urlLimit);
            router.push(`${pathname}?${params.toString()}`, { scroll: false });
        }
    }, [paginationState.pageIndex, paginationState.pageSize, pathname, router, searchParams]);

    return { paginationState, setPaginationState };
}