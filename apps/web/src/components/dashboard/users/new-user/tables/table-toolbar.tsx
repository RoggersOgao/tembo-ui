"use client";

import { IconChevronDown, IconLayoutColumns } from "@tabler/icons-react";
import { Table } from "@tanstack/react-table";
import { Button } from "@workspace/ui/components/button";
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu";
import { Input } from "@workspace/ui/components/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@workspace/ui/components/select";
import { Filter, X, Search, Loader2, SlidersHorizontal } from "lucide-react";
import { useState, useTransition, useEffect, useRef } from "react";
import { ExportDropdown } from "@/lib/export-datatable";
import { UserFilterState } from "@/hooks/filters-urls/users/use-user-filter-url-pagination";

// ─── Types ────────────────────────────────────────────────────────────────────

interface FilterOptions {
    roles?:               string[];
    signupSources?:       string[];
    verificationLevels?:  string[];
}

interface TableToolbarProps<TData> {
    table:                 Table<TData>;
    filterPlaceholder:     string;
    filters:               UserFilterState;
    setFilters:            React.Dispatch<React.SetStateAction<UserFilterState>>;
    filterOptions?:        FilterOptions;
    exportFilename?:       string;
    excludeExportColumns?: string[];
}

// ─── Static options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
    { value: 'all',      label: 'All Statuses' },
    { value: 'active',   label: 'Active'       },
    { value: 'inactive', label: 'Inactive'     },
];

const VERIFIED_OPTIONS = [
    { value: 'all',        label: 'All'        },
    { value: 'verified',   label: 'Verified'   },
    { value: 'unverified', label: 'Unverified' },
];

const LOCKED_OPTIONS = [
    { value: 'all',      label: 'All'      },
    { value: 'locked',   label: 'Locked'   },
    { value: 'unlocked', label: 'Unlocked' },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function TableToolbar<TData>({
    table,
    filterPlaceholder,
    filters,
    setFilters,
    filterOptions        = {},
    exportFilename       = "users-report",
    excludeExportColumns = ["select", "drag", "actions"],
}: TableToolbarProps<TData>) {

    const { roles = [], signupSources = [], verificationLevels = [] } = filterOptions;

    // ── Transitions & refs ────────────────────────────────────────────────────
    const [isPending, startTransition] = useTransition();
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    // ── Local state ───────────────────────────────────────────────────────────
    const [localSearch,             setLocalSearch]            = useState(filters.search            || '');
    const [localRole,               setLocalRole]              = useState(filters.role              || 'all');
    const [localSignupSource,       setLocalSignupSource]      = useState(filters.signupSource      || 'all');
    const [localVerificationLevel,  setLocalVerificationLevel] = useState(filters.verificationLevel || 'all');
    const [localStatus,             setLocalStatus]            = useState(
        filters.isActive === true  ? 'active'   :
        filters.isActive === false ? 'inactive' : 'all'
    );
    const [localVerified, setLocalVerified] = useState(
        filters.isVerified === true  ? 'verified'   :
        filters.isVerified === false ? 'unverified' : 'all'
    );
    const [localLocked, setLocalLocked] = useState(
        filters.isLocked === true  ? 'locked'   :
        filters.isLocked === false ? 'unlocked' : 'all'
    );

    // ── Sync on URL filter change (back/forward nav) ──────────────────────────
    useEffect(() => {
        setLocalSearch(filters.search            || '');
        setLocalRole(filters.role                || 'all');
        setLocalSignupSource(filters.signupSource      || 'all');
        setLocalVerificationLevel(filters.verificationLevel || 'all');
        setLocalStatus(
            filters.isActive === true  ? 'active'   :
            filters.isActive === false ? 'inactive' : 'all'
        );
        setLocalVerified(
            filters.isVerified === true  ? 'verified'   :
            filters.isVerified === false ? 'unverified' : 'all'
        );
        setLocalLocked(
            filters.isLocked === true  ? 'locked'   :
            filters.isLocked === false ? 'unlocked' : 'all'
        );
    }, [filters]);

    // ── Derived state ─────────────────────────────────────────────────────────
    const hasLocalFilters =
        localSearch            !== ''    ||
        localRole              !== 'all' ||
        localSignupSource      !== 'all' ||
        localVerificationLevel !== 'all' ||
        localStatus            !== 'all' ||
        localVerified          !== 'all' ||
        localLocked            !== 'all';

    const hasAppliedFilters = Object.values(filters).some(
        v => v !== undefined && v !== ''
    );

    const hasChanges =
        localSearch            !== (filters.search            || '')    ||
        localRole              !== (filters.role              || 'all') ||
        localSignupSource      !== (filters.signupSource      || 'all') ||
        localVerificationLevel !== (filters.verificationLevel || 'all') ||
        localStatus !== (
            filters.isActive === true  ? 'active'   :
            filters.isActive === false ? 'inactive' : 'all'
        ) ||
        localVerified !== (
            filters.isVerified === true  ? 'verified'   :
            filters.isVerified === false ? 'unverified' : 'all'
        ) ||
        localLocked !== (
            filters.isLocked === true  ? 'locked'   :
            filters.isLocked === false ? 'unlocked' : 'all'
        );

    // Count active filters in "More Filters" dropdown (excluding Role and Status)
    const moreFiltersActiveCount = [
        localSignupSource !== 'all' ? 'signupSource' : null,
        localVerificationLevel !== 'all' ? 'verificationLevel' : null,
        localVerified !== 'all' ? 'verified' : null,
        localLocked !== 'all' ? 'locked' : null,
    ].filter(Boolean).length;

    // ── Helpers ───────────────────────────────────────────────────────────────
    const boolFrom = (val: string, trueVal: string, falseVal: string): boolean | undefined =>
        val === trueVal ? true : val === falseVal ? false : undefined;

    // ── Handlers ──────────────────────────────────────────────────────────────
    const handleSearchChange = (value: string) => {
        setLocalSearch(value);
        clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => {
            startTransition(() => {
                setFilters(prev => ({ ...prev, search: value || undefined }));
            });
        }, 800);
    };

    const handleSubmit = () => {
        clearTimeout(searchDebounceRef.current);
        startTransition(() => {
            setFilters({
                search:            localSearch            !== '' ? localSearch            : undefined,
                role:              localRole              !== 'all' ? localRole              : undefined,
                signupSource:      localSignupSource      !== 'all' ? localSignupSource      : undefined,
                verificationLevel: localVerificationLevel !== 'all' ? localVerificationLevel : undefined,
                isActive:          boolFrom(localStatus,   'active',   'inactive'),
                isVerified:        boolFrom(localVerified, 'verified', 'unverified'),
                isLocked:          boolFrom(localLocked,   'locked',   'unlocked'),
            });
        });
    };

    const resetFilters = () => {
        clearTimeout(searchDebounceRef.current);
        setLocalSearch('');
        setLocalRole('all');
        setLocalSignupSource('all');
        setLocalVerificationLevel('all');
        setLocalStatus('all');
        setLocalVerified('all');
        setLocalLocked('all');
        startTransition(() => setFilters({}));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && hasChanges && !isPending) handleSubmit();
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex items-center justify-between gap-2">

            {/* ── DESKTOP ── */}
            <div className="hidden lg:flex flex-1 items-start space-x-2">

                {/* Search */}
                <div className="relative">
                    <Input
                        placeholder={filterPlaceholder}
                        value={localSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-9 w-[220px] pr-8"
                    />
                    {isPending && (
                        <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                {/* Role - Top Bar */}
                {roles.length > 0 && (
                    <Select value={localRole} onValueChange={setLocalRole}>
                        <SelectTrigger className="h-9 w-[140px]">
                            <SelectValue placeholder="All Roles" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Roles</SelectItem>
                            {roles.map(r => (
                                <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                )}

                {/* Status - Top Bar */}
                <Select value={localStatus} onValueChange={setLocalStatus}>
                    <SelectTrigger className="h-9 w-[140px]">
                        <SelectValue placeholder="All Statuses" />
                    </SelectTrigger>
                    <SelectContent>
                        {STATUS_OPTIONS.map(s => (
                            <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                {/* More Filters Dropdown */}
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button 
                            variant="outline" 
                            size="sm" 
                            className="h-9 relative"
                        >
                            <SlidersHorizontal className="h-4 w-4 mr-2" />
                            More Filters
                            {moreFiltersActiveCount > 0 && (
                                <span className="ml-1 rounded-full bg-primary text-primary-foreground text-xs px-1.5 py-0.5">
                                    {moreFiltersActiveCount}
                                </span>
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-[280px] p-4 space-y-4">
                        <DropdownMenuLabel>More Filters</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {/* Verified */}
                        <div className="space-y-2">
                            <span className="text-xs font-medium">Verified</span>
                            <Select value={localVerified} onValueChange={setLocalVerified}>
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    {VERIFIED_OPTIONS.map(v => (
                                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Locked */}
                        <div className="space-y-2">
                            <span className="text-xs font-medium">Lock Status</span>
                            <Select value={localLocked} onValueChange={setLocalLocked}>
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LOCKED_OPTIONS.map(l => (
                                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Signup Source */}
                        {signupSources.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-xs font-medium">Signup Source</span>
                                <Select value={localSignupSource} onValueChange={setLocalSignupSource}>
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue placeholder="All Sources" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sources</SelectItem>
                                        {signupSources.map(s => (
                                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Verification Level */}
                        {verificationLevels.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-xs font-medium">Verification Level</span>
                                <Select value={localVerificationLevel} onValueChange={setLocalVerificationLevel}>
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue placeholder="All Levels" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Levels</SelectItem>
                                        {verificationLevels.map(v => (
                                            <SelectItem key={v} value={v} className="capitalize">{v}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>

                {/* Apply Filters Button */}
                <Button
                    onClick={handleSubmit}
                    disabled={!hasChanges || isPending}
                    size="sm"
                    className="h-9"
                >
                    {isPending
                        ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        : <Search className="h-4 w-4 mr-2" />
                    }
                    {isPending ? "Applying…" : "Apply Filters"}
                </Button>

                {/* Reset button - only shows when filters are active */}
                {(hasLocalFilters || hasAppliedFilters) && (
                    <Button
                        variant="ghost"
                        onClick={resetFilters}
                        disabled={isPending}
                        className="h-9 px-2 lg:px-3"
                    >
                        Reset All <X className="ml-2 h-4 w-4" />
                    </Button>
                )}
            </div>

            {/* ── MOBILE (unchanged) ── */}
            <div className="flex lg:hidden flex-1 items-center gap-2">
                <div className="relative flex-1">
                    <Input
                        placeholder={filterPlaceholder}
                        value={localSearch}
                        onChange={(e) => handleSearchChange(e.target.value)}
                        onKeyDown={handleKeyDown}
                        className="h-9 w-full pr-8"
                    />
                    {isPending && (
                        <Loader2 className="absolute right-2 top-2.5 h-4 w-4 animate-spin text-muted-foreground" />
                    )}
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button
                            variant="outline"
                            size="icon"
                            className={`relative h-8 w-8 shrink-0 ${hasAppliedFilters ? 'border-primary text-primary' : ''}`}
                        >
                            <Filter className="h-4 w-4" />
                            {hasAppliedFilters && (
                                <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                            )}
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-[280px] p-4 space-y-4">
                        <DropdownMenuLabel>Filters</DropdownMenuLabel>
                        <DropdownMenuSeparator />

                        {/* Role */}
                        {roles.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-xs font-medium">Role</span>
                                <Select value={localRole} onValueChange={setLocalRole}>
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue placeholder="All Roles" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Roles</SelectItem>
                                        {roles.map(r => (
                                            <SelectItem key={r} value={r} className="capitalize">{r}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Status */}
                        <div className="space-y-2">
                            <span className="text-xs font-medium">Status</span>
                            <Select value={localStatus} onValueChange={setLocalStatus}>
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="All Statuses" />
                                </SelectTrigger>
                                <SelectContent>
                                    {STATUS_OPTIONS.map(s => (
                                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Verified */}
                        <div className="space-y-2">
                            <span className="text-xs font-medium">Verified</span>
                            <Select value={localVerified} onValueChange={setLocalVerified}>
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    {VERIFIED_OPTIONS.map(v => (
                                        <SelectItem key={v.value} value={v.value}>{v.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Locked */}
                        <div className="space-y-2">
                            <span className="text-xs font-medium">Lock Status</span>
                            <Select value={localLocked} onValueChange={setLocalLocked}>
                                <SelectTrigger className="h-9 w-full">
                                    <SelectValue placeholder="All" />
                                </SelectTrigger>
                                <SelectContent>
                                    {LOCKED_OPTIONS.map(l => (
                                        <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Signup Source */}
                        {signupSources.length > 0 && (
                            <div className="space-y-2">
                                <span className="text-xs font-medium">Signup Source</span>
                                <Select value={localSignupSource} onValueChange={setLocalSignupSource}>
                                    <SelectTrigger className="h-9 w-full">
                                        <SelectValue placeholder="All Sources" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">All Sources</SelectItem>
                                        {signupSources.map(s => (
                                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2 pt-2">
                            <Button
                                onClick={handleSubmit}
                                disabled={!hasChanges || isPending}
                                className="flex-1"
                                size="sm"
                            >
                                {isPending
                                    ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    : <Search className="h-4 w-4 mr-2" />
                                }
                                {isPending ? "Applying…" : "Apply"}
                            </Button>

                            {(hasLocalFilters || hasAppliedFilters) && (
                                <Button
                                    variant="outline"
                                    onClick={resetFilters}
                                    disabled={isPending}
                                    className="flex-1"
                                    size="sm"
                                >
                                    Reset <X className="ml-2 h-4 w-4" />
                                </Button>
                            )}
                        </div>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* ── Export & Column Visibility ── */}
            <div className="flex items-center gap-2">
                <ExportDropdown
                    table={table}
                    filename={exportFilename}
                    excludeColumns={excludeExportColumns}
                />

                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9">
                            <IconLayoutColumns className="h-4 w-4 lg:mr-2" />
                            <span className="hidden lg:inline">Columns</span>
                            <IconChevronDown className="hidden lg:inline h-4 w-4 ml-1" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        {table
                            .getAllColumns()
                            .filter(col => col.getCanHide())
                            .map(col => (
                                <DropdownMenuCheckboxItem
                                    key={col.id}
                                    className="capitalize"
                                    checked={col.getIsVisible()}
                                    onCheckedChange={v => col.toggleVisibility(!!v)}
                                >
                                    {col.id}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </div>
    );
}