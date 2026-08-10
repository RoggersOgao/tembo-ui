"use client";

import type { UserData } from "@/loginActions/user-actions";
import { Badge } from "@workspace/ui/components/badge";
import { Button } from "@workspace/ui/components/button";
import { Skeleton } from "@workspace/ui/components/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs";
import {
    AlertCircle, ArrowLeft, Clock, Database, Edit, Users,
    ShieldCheck, ShieldOff, CheckCircle2, XCircle,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useUser, useUserManagement } from "@/hooks/user/useUser";
import { useUserStore } from "@/hooks/zustand/stores/user/use-user-store";
import { UserDataTable } from "./user-data-table";
import { EditUserForm } from "./forms/edit-user-form";
import { EditUserFormValues } from "../new-user/tables/forms/userForm";

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserManagerDashboardProps {
    userId: string;
    onUpdate?: (updatedUser: UserData) => void;
}

// ─── Skeletons ────────────────────────────────────────────────────────────────

const HeaderSkeleton = () => (
    <div className="bg-muted/30 border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-3 flex-1">
                    <Skeleton className="h-7 w-64" />
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-5 w-20" />
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-24" />
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-24" />
                </div>
            </div>
        </div>
    </div>
);

const FormSkeleton = () => (
    <div className="space-y-8">
        <Skeleton className="h-12 w-full" />
        {[...Array(3)].map((_, i) => (
            <div key={i} className="border rounded-xl p-6 space-y-4">
                <Skeleton className="h-6 w-48" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </div>
        ))}
    </div>
);

const DataTableSkeleton = () => (
    <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
        ))}
    </div>
);

// ─── Loading View ─────────────────────────────────────────────────────────────

const LoadingView = ({ activeTab }: { activeTab: string }) => (
    <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-40 bg-sidebar backdrop-blur-sm border-b border-border">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    <div className="flex items-center gap-4">
                        <Skeleton className="h-6 w-6 rounded" />
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-5 w-20 rounded-full" />
                    </div>
                    <Skeleton className="h-9 w-24" />
                </div>
            </div>
        </header>
        <HeaderSkeleton />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            <div className="flex items-center gap-4 max-w-lg">
                <Skeleton className="h-10 w-24" />
                <Skeleton className="h-10 w-32" />
            </div>
            {activeTab === "edit" ? <FormSkeleton /> : <DataTableSkeleton />}
        </main>
    </div>
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
    SUPER_ADMIN: "destructive",
    ADMIN: "destructive",
    MANAGER: "default",
    STAFF: "default",
    DELIVERY: "secondary",
    SUPPLIER: "secondary",
    CUSTOMER: "outline",
    SUPPORT: "secondary",
    VIEWER: "outline",
};

const formatDate = (date: string | Date | undefined) => {
    if (!date) return "N/A";
    return new Date(date).toLocaleDateString("en-US", {
        year: "numeric", month: "short", day: "numeric",
    });
};

// ─── Dashboard ────────────────────────────────────────────────────────────────

const STORAGE_KEY = "user-manager-active-tab";

export const UserManagerDashboard = ({
    userId,
    onUpdate,
}: UserManagerDashboardProps) => {
    // Use the user hook to fetch and sync data
    const { data: userData, isLoading: isUserLoading, error: userError } = useUser(userId);

    // Get data from store
    const currentUser = useUserStore((state) => state.currentUser);
    const setCurrentUser = useUserStore((state) => state.setCurrentUser);
    const isLoading = useUserStore((state) => state.isLoading);
    const storeError = useUserStore((state) => state.error);

    // Get user management mutations
    const { updateUser, isUpdating, deleteUser, isDeleting } = useUserManagement();

    const [activeTab, setActiveTab] = useState<string | null>(null);
    const [isHydrated, setIsHydrated] = useState(false);
    const [minLoadComplete, setMinLoadComplete] = useState(false);

    // ── Step 1: Hydration ─────────────────────────────────────────────────
    useEffect(() => {
        const stored = localStorage.getItem(STORAGE_KEY);
        setActiveTab(stored || "data");
        setIsHydrated(true);

        const timer = setTimeout(() => setMinLoadComplete(true), 400);

        const handleStorage = (e: StorageEvent) => {
            if (e.key === STORAGE_KEY && e.newValue) setActiveTab(e.newValue);
        };
        window.addEventListener("storage", handleStorage);

        return () => {
            clearTimeout(timer);
            window.removeEventListener("storage", handleStorage);
        };
    }, []);

    // ── Step 2: Sync user to store when data loads ─────────────────────────
    useEffect(() => {
        if (userData) {
            setCurrentUser(userData);
        }
    }, [userData, setCurrentUser]);

    // ── Cleanup ───────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            setCurrentUser(null);
        };
    }, [setCurrentUser]);

    // ── Handlers ──────────────────────────────────────────────────────────
    const handleTabChange = (value: string) => {
        setActiveTab(value);
        localStorage.setItem(STORAGE_KEY, value);
    };

    const handleUpdateUser = async (updates: Partial<UserData>) => {
        if (!currentUser) return;

        await updateUser({ id: currentUser.id, data: updates });

        if (onUpdate && currentUser) {
            onUpdate(currentUser);
        }
    };

    const handleDeleteUser = async () => {
        if (!currentUser) return;

        if (confirm(`Are you sure you want to delete user ${currentUser.email}?`)) {
            await deleteUser(currentUser.id);
            // Redirect to users list after deletion
            window.location.href = "/users";
        }
    };

    // ── Guards ────────────────────────────────────────────────────────────
    const isInitializing = !isHydrated || isLoading || isUserLoading || activeTab === null || !minLoadComplete;
    const displayError = userError?.message || storeError;

    if (displayError && !isInitializing) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <div className="text-center space-y-4 max-w-md">
                    <div className="bg-destructive/10 rounded-full p-4 w-16 h-16 flex items-center justify-center mx-auto">
                        <AlertCircle className="h-8 w-8 text-destructive" />
                    </div>
                    <p className="text-lg font-medium">Failed to Load User</p>
                    <p className="text-sm text-muted-foreground">{displayError}</p>
                    <Button variant="outline" onClick={() => window.location.reload()}>
                        Try Again
                    </Button>
                </div>
            </div>
        );
    }

    if (isInitializing) {
        return <LoadingView activeTab={activeTab || "data"} />;
    }

    // ── Render ────────────────────────────────────────────────────────────
    return (
        <div className="min-h-screen bg-background @container/main overflow-hidden">

            {/* ── Top Nav ─────────────────────────────────────────────── */}
            <header className="sticky top-0 z-40 bg-sidebar backdrop-blur-sm border-b border-border">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <Users className="h-6 w-6 text-primary" />
                                <span className="font-semibold text-lg text-foreground">
                                    User Manager
                                </span>
                            </div>
                            <Badge variant="outline" className="hidden sm:inline-flex">
                                Dashboard
                            </Badge>
                        </div>
                        <div className="flex items-center gap-2">
                            {currentUser && (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={handleDeleteUser}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? "Deleting..." : "Delete User"}
                                </Button>
                            )}
                            <Button variant="outline" size="sm" asChild>
                                <a href="/users">
                                    <ArrowLeft className="h-4 w-4 mr-2" />
                                    Back to Users
                                </a>
                            </Button>
                        </div>
                    </div>
                </div>
            </header>

            {/* ── User Summary Bar ─────────────────────────────────────── */}
            {currentUser && (
                <div className="bg-muted/30 border-b border-border">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">

                            {/* Left — identity */}
                            <div>
                                <h1 className="text-xl font-semibold text-foreground">
                                    {currentUser.name}
                                </h1>
                                <p className="text-sm text-muted-foreground mt-1 flex flex-wrap items-center gap-2">
                                    {/* Role */}
                                    <Badge
                                        variant={ROLE_VARIANT[currentUser.role] ?? "outline"}
                                        className="text-xs"
                                    >
                                        {currentUser.role}
                                    </Badge>

                                    <span className="hidden sm:inline">•</span>

                                    {/* Email */}
                                    <span className="text-xs font-mono">{currentUser.email}</span>

                                    <span className="hidden sm:inline">•</span>

                                    {/* Active / Suspended */}
                                    {currentUser.isSuspended ? (
                                        <span className="flex items-center gap-1 text-xs text-destructive">
                                            <ShieldOff className="h-3 w-3" />
                                            Suspended
                                        </span>
                                    ) : currentUser.isActive ? (
                                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                            <ShieldCheck className="h-3 w-3" />
                                            Active
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <XCircle className="h-3 w-3" />
                                            Inactive
                                        </span>
                                    )}

                                    <span className="hidden sm:inline">•</span>

                                    {/* Verified */}
                                    {currentUser.isVerified ? (
                                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                                            <CheckCircle2 className="h-3 w-3" />
                                            Verified
                                        </span>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                            <XCircle className="h-3 w-3" />
                                            Unverified
                                        </span>
                                    )}
                                </p>
                            </div>

                            {/* Right — meta */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                <div className="flex items-center gap-1">
                                    <Clock className="h-4 w-4" />
                                    <span>Updated {formatDate(currentUser.updatedAt?.toString())}</span>
                                </div>
                                <div className="font-mono text-xs bg-muted px-2 py-1 rounded">
                                    ID: {currentUser.id.slice(0, 8)}…
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Main Content ─────────────────────────────────────────── */}
            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                <Tabs
                    value={activeTab ?? "data"}
                    onValueChange={handleTabChange}
                    className="space-y-6"
                >
                    <TabsList className="bg-muted/50">
                        <TabsTrigger value="data" className="flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Data View
                        </TabsTrigger>
                        <TabsTrigger value="edit" className="flex items-center gap-2">
                            <Edit className="h-4 w-4" />
                            Edit User
                        </TabsTrigger>
                    </TabsList>

                    <TabsContent value="data" className="animate-fade-in">
                        {currentUser && (
                            <UserDataTable userId={currentUser.id} />
                        )}
                    </TabsContent>

                    <TabsContent value="edit" className="animate-fade-in">
                        {currentUser && (
                            <EditUserForm
                                user={currentUser}
                                isUpdating={isUpdating}
                                onUpdate={async (data) => {
                                    await handleUpdateUser(normalizeFormData(data))
                                }}
                            />
                        )}
                    </TabsContent>
                </Tabs>
            </main>
        </div>
    );
};


function normalizeFormData(data: EditUserFormValues): Partial<UserData> {
    return {
        ...data,

        profile: {
            ...data.profile,

            gender: data.profile.gender || undefined,
            middleName: data.profile.middleName || undefined,
            displayName: data.profile.displayName || undefined,
            dateOfBirth: data.profile.dateOfBirth || undefined,
            bio: data.profile.bio || undefined,
            secondaryEmail: data.profile.secondaryEmail || undefined,
            secondaryPhone: data.profile.secondaryPhone || undefined,
            addressLine1: data.profile.addressLine1 || undefined,
            addressLine2: data.profile.addressLine2 || undefined,
            city: data.profile.city || undefined,
            county: data.profile.county || undefined,
            postalCode: data.profile.postalCode || undefined,
            idDocumentType: data.profile.idDocumentType || undefined,
            idDocumentNumber: data.profile.idDocumentNumber || undefined,
            idDocumentExpiry: data.profile.idDocumentExpiry || undefined,
            occupation: data.profile.occupation || undefined,
            company: data.profile.company || undefined,
            jobTitle: data.profile.jobTitle || undefined,

            yearsOfExperience:
                data.profile.yearsOfExperience === ""
                    ? undefined
                    : data.profile.yearsOfExperience,
        },

        referrerId: data.referrerId || undefined,
    }
}