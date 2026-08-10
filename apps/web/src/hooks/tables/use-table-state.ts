import { useState } from "react";
import {
    ColumnFiltersState,
    SortingState,
    VisibilityState,
    PaginationState,
} from "@tanstack/react-table";

export function useTableState() {
    const [rowSelection, setRowSelection] = useState({});
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({});
    const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
    const [sorting, setSorting] = useState<SortingState>([]);
    const [pagination, setPagination] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: 10,
    });

    return {
        rowSelection,
        setRowSelection,
        columnVisibility,
        setColumnVisibility,
        columnFilters,
        setColumnFilters,
        sorting,
        setSorting,
        pagination,
        setPagination,
    };
}