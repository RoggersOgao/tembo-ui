"use client"

import { useDragAndDrop } from "@/hooks/tables/use-drag-drop";
import { useTableState } from "@/hooks/tables/use-table-state";

import { DndContext } from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import {
    flexRender,
    getCoreRowModel,
    getFacetedRowModel,
    getFacetedUniqueValues,
    getFilteredRowModel,
    getSortedRowModel,
    PaginationState,
    useReactTable,
} from "@tanstack/react-table";
import { Skeleton } from "@workspace/ui/components/skeleton";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@workspace/ui/components/table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@workspace/ui/components/tabs";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DeleteUserWarning } from "./columns/dialog/delete-dialog";
import { DraggableRow } from "./draggable-row";
import { TablePagination } from "./table-pagination";
import { TableToolbar } from "./table-toolbar";

import { UserData } from "@/loginActions/user-actions";
import { UserFilterState } from "@/hooks/filters-urls/users/use-user-filter-url-pagination";
import { useDeleteUserWarning } from "./columns/hooks/delete-user";
import { createUserColumns } from "./columns/user-column";
import { UsersResponse } from "@/hooks/user/useUser";
import { useHasRole } from "@/hooks/zustand/stores/use-auth-store";
import { AddUserForm } from "./forms/add-user-form";

interface UsersDataTableProps {
    data: UserData[];
    pagination: UsersResponse["pagination"];
    paginationState: PaginationState;
    setPaginationState: React.Dispatch<React.SetStateAction<PaginationState>>;
    filters: UserFilterState;
    setFilters: React.Dispatch<React.SetStateAction<UserFilterState>>;
    isLoading?: boolean;
}

// ─── Skeletons ─────────────────────────────────────────────────────────────────

const DataTableSkeleton = () => (
    <div className="space-y-4">
        <div className="flex items-center justify-between">
            <Skeleton className="h-10 w-64" />
            <div className="flex gap-2">
                <Skeleton className="h-10 w-32" />
                <Skeleton className="h-10 w-32" />
            </div>
        </div>
        <div className="rounded-lg border">
            <div className="p-4">
                <Skeleton className="h-10 w-full mb-4" />
                {[...Array(8)].map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full mb-2" />
                ))}
            </div>
        </div>
        <div className="flex items-center justify-between">
            <Skeleton className="h-8 w-48" />
            <div className="flex gap-2">
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-8 w-20" />
            </div>
        </div>
    </div>
);

const CreateUserSkeleton = () => (
    <div className="space-y-6">
        <Skeleton className="h-12 w-64" />
        {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-lg p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        ))}
        <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
        </div>
    </div>
);

// ─── Component ─────────────────────────────────────────────────────────────────

const STORAGE_KEY = "UserTabs";

export function DataTable({
    data: initialData,
    pagination,
    paginationState,
    setPaginationState,
    filters,
    setFilters,
    isLoading = false,
}: UsersDataTableProps) {
    const [data, setData] = useState(initialData);
    const tableState = useTableState();
    const dragDrop = useDragAndDrop(data, setData);
    const router = useRouter();
    const isSuperAdmin = useHasRole("SUPER_ADMIN")
    const [selectedTab, setSelectedTab] = useState<string>("datatable");
    const [mounted, setMounted] = useState(false);

    const {
        showDeleteWarning,
        userToDelete,
        isDeleting,
        handleDeleteClick,
        handleDeleteConfirm,
        handleDeleteCancel,
    } = useDeleteUserWarning();

    useEffect(() => {
        setData(initialData);
    }, [initialData]);

    useEffect(() => {
        const storedTab = localStorage.getItem(STORAGE_KEY);
        if (storedTab) setSelectedTab(storedTab);
        setMounted(true);

        const handleStorageChange = (event: StorageEvent) => {
            if (event.key === STORAGE_KEY && event.newValue) {
                setSelectedTab(event.newValue);
            }
        };
        window.addEventListener("storage", handleStorageChange);
        return () => window.removeEventListener("storage", handleStorageChange);
    }, []);

    const handleTabChange = useCallback((value: string) => {
        setSelectedTab(value);
        localStorage.setItem(STORAGE_KEY, value);
    }, []);

    const handleRowManager = useCallback((userId: string) => {
        router.push(`/users/${userId}`);
    }, [router]);

    const columns = useMemo(
        () => createUserColumns(handleRowManager, handleDeleteClick),
        [handleRowManager, handleDeleteClick]
    );

    const table = useReactTable({
        data,
        columns,
        pageCount: pagination?.totalPages ?? -1,
        state: {
            sorting: tableState.sorting,
            columnVisibility: tableState.columnVisibility,
            rowSelection: tableState.rowSelection,
            columnFilters: tableState.columnFilters,
            pagination: paginationState,
        },
        getRowId: (row) => row.id,
        enableRowSelection: true,
        manualPagination: true,
        manualFiltering: true,
        onRowSelectionChange: tableState.setRowSelection,
        onSortingChange: tableState.setSorting,
        onColumnFiltersChange: tableState.setColumnFilters,
        onColumnVisibilityChange: tableState.setColumnVisibility,
        onPaginationChange: setPaginationState,
        getCoreRowModel: getCoreRowModel(),
        getFilteredRowModel: getFilteredRowModel(),
        getSortedRowModel: getSortedRowModel(),
        getFacetedRowModel: getFacetedRowModel(),
        getFacetedUniqueValues: getFacetedUniqueValues(),
        columnResizeMode: "onChange",
        defaultColumn: {
            minSize: 60,
            maxSize: 800,
        },
    });

    if (!mounted) {
        return (
            <div className="flex w-full flex-col gap-6">
                <div className="space-y-4">
                    <div className="flex gap-2">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-32" />
                    </div>
                    {selectedTab === "createUser"
                        ? <CreateUserSkeleton />
                        : <DataTableSkeleton />
                    }
                </div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex w-full flex-col gap-6">
                <Tabs value={selectedTab} onValueChange={handleTabChange}>
                    <TabsList className="inline-flex h-auto p-1 bg-muted/50 rounded-full">
                        <TabsTrigger
                            value="datatable"
                            className="rounded-full px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                            Users
                        </TabsTrigger>
                        <TabsTrigger
                            value="createUser"
                            className="rounded-full px-6 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm transition-all"
                        >
                            Add User
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="datatable">
                        {isLoading ? (
                            <DataTableSkeleton />
                        ) : (
                            <>
                                <div className="space-y-4">
                                    <TableToolbar
                                        table={table}
                                        filterPlaceholder="Search users..."
                                        filters={filters}
                                        setFilters={setFilters}

                                        filterOptions={{
                                            roles: [
                                                ...(isSuperAdmin ? ['SUPER_ADMIN'] : []),
                                                'ADMIN', 'MANAGER', 'STAFF', 'DELIVERY',
                                                'SUPPLIER', 'CUSTOMER', 'SUPPORT', 'VIEWER',
                                            ],
                                            signupSources: ['WEB', 'MOBILE', 'REFERRAL', 'SOCIAL'],
                                            verificationLevels: ['BASIC', 'VERIFIED', 'PREMIUM'],
                                        }}
                                    />

                                    <div className="rounded-lg border overflow-hidden">
                                        <DndContext
                                            collisionDetection={dragDrop.collisionDetection}
                                            modifiers={[restrictToVerticalAxis]}
                                            onDragEnd={dragDrop.handleDragEnd}
                                            sensors={dragDrop.sensors}
                                            id={dragDrop.sortableId}
                                        >
                                            <Table>
                                                <TableHeader className="bg-muted sticky top-0 z-10">
                                                    {table.getHeaderGroups().map((headerGroup) => (
                                                        <TableRow key={headerGroup.id}>
                                                            {headerGroup.headers.map((header) => (
                                                                <TableHead
                                                                    key={header.id}
                                                                    colSpan={header.colSpan}
                                                                    style={{ width: header.getSize() }}
                                                                >
                                                                    {header.isPlaceholder
                                                                        ? null
                                                                        : flexRender(
                                                                            header.column.columnDef.header,
                                                                            header.getContext()
                                                                        )}
                                                                </TableHead>
                                                            ))}
                                                        </TableRow>
                                                    ))}
                                                </TableHeader>
                                                <TableBody>
                                                    {table.getRowModel().rows?.length ? (
                                                        <SortableContext
                                                            items={dragDrop.dataIds}
                                                            strategy={verticalListSortingStrategy}
                                                        >
                                                            {table.getRowModel().rows.map((row) => (
                                                                <DraggableRow key={row.id} row={row} />
                                                            ))}
                                                        </SortableContext>
                                                    ) : (
                                                        <TableRow>
                                                            <TableCell
                                                                colSpan={columns.length}
                                                                className="h-24 text-center"
                                                            >
                                                                No users found.
                                                            </TableCell>
                                                        </TableRow>
                                                    )}
                                                </TableBody>
                                            </Table>
                                        </DndContext>
                                    </div>

                                    <TablePagination
                                        table={table}
                                        totalItems={pagination?.total}
                                    />
                                </div>

                                <DeleteUserWarning
                                    isOpen={showDeleteWarning}
                                    onConfirm={handleDeleteConfirm}
                                    onCancel={handleDeleteCancel}
                                    userName={userToDelete?.name ?? ''}
                                    isDeleting={isDeleting}
                                />
                            </>
                        )}
                    </TabsContent>

                    <TabsContent value="createUser">
                        <AddUserForm />
                    </TabsContent>
                </Tabs>
            </div>
        </div>
    );
}