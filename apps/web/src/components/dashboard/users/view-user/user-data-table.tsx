"use client";

import type { UserData } from "@/loginActions/user-actions";
import { Badge } from "@workspace/ui/components/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table";
import {
    AlertCircle, Calendar, Mail, Phone, Shield, User,
    CheckCircle2, XCircle, Lock, Unlock, Eye, EyeOff,
    Building2, Globe, MapPin, CreditCard, Hash,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { useUser, useUsers } from "@/hooks/user/useUser";
import { useUserStore } from "@/hooks/zustand/stores/user/use-user-store";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const formatDate = (date: string | Date | null | undefined) => {
    if (!date) return "N/A";
    try {
        return new Date(date).toLocaleDateString("en-US", {
            year: "numeric", month: "short", day: "numeric",
            hour: "2-digit", minute: "2-digit",
        });
    } catch {
        return "Invalid Date";
    }
};

const getRoleVariant = (role: string): "default" | "secondary" | "destructive" | "outline" => {
    const variants: Record<string, any> = {
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
    return variants[role] || "outline";
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface UserDataTableProps {
    userId?: string;  // Optional - if provided, shows single user, otherwise shows list
    onUserSelect?: (user: UserData) => void;
    filters?: {
        role?: string;
        isActive?: boolean;
        isVerified?: boolean;
        search?: string;
    };
}

// ─── Loading Component ────────────────────────────────────────────────────────

const UserDataTableSkeleton = () => (
    <div className="space-y-4">
        <div className="animate-pulse">
            <div className="h-10 bg-muted rounded mb-4"></div>
            {[...Array(5)].map((_, i) => (
                <div key={i} className="h-16 bg-muted/50 rounded mb-2"></div>
            ))}
        </div>
    </div>
);

// ─── Single User View ─────────────────────────────────────────────────────────

const SingleUserView = ({ user }: { user: UserData }) => {
    const [showSensitive, setShowSensitive] = useState(false);

    return (
        <div className="space-y-6">
            {/* User Header */}
            <div className="bg-card p-6 border border-border rounded-xl">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-4">
                        <div className="bg-primary/10 p-3 rounded-full">
                            <User className="w-8 h-8 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-2xl font-bold text-foreground">{user.name}</h2>
                            <p className="text-muted-foreground">{user.email}</p>
                        </div>
                    </div>
                    <Badge variant={getRoleVariant(user.role)} className="text-sm">
                        {user.role}
                    </Badge>
                </div>
            </div>

            {/* Status Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-card p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Status</span>
                        {user.isActive ? (
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                        ) : (
                            <XCircle className="w-5 h-5 text-red-500" />
                        )}
                    </div>
                    <p className="text-lg font-semibold mt-2">
                        {user.isActive ? "Active" : "Inactive"}
                    </p>
                </div>

                <div className="bg-card p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Verified</span>
                        {user.isVerified ? (
                            <CheckCircle2 className="w-5 h-5 text-blue-500" />
                        ) : (
                            <XCircle className="w-5 h-5 text-yellow-500" />
                        )}
                    </div>
                    <p className="text-lg font-semibold mt-2">
                        {user.isVerified ? "Email Verified" : "Not Verified"}
                    </p>
                </div>

                <div className="bg-card p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">2FA</span>
                        {user.isTwoFactorEnabled ? (
                            <Shield className="w-5 h-5 text-green-500" />
                        ) : (
                            <Shield className="w-5 h-5 text-gray-400" />
                        )}
                    </div>
                    <p className="text-lg font-semibold mt-2">
                        {user.isTwoFactorEnabled ? "Enabled" : "Disabled"}
                    </p>
                </div>

                <div className="bg-card p-4 border border-border rounded-lg">
                    <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Locked</span>
                        {user.isLocked ? (
                            <Lock className="w-5 h-5 text-red-500" />
                        ) : (
                            <Unlock className="w-5 h-5 text-green-500" />
                        )}
                    </div>
                    <p className="text-lg font-semibold mt-2">
                        {user.isLocked ? "Locked" : "Unlocked"}
                    </p>
                </div>
            </div>

            {/* User Details */}
            <div className="bg-card border border-border rounded-xl overflow-hidden">
                <div className="bg-muted/50 px-6 py-4 border-b">
                    <h3 className="font-semibold text-foreground">User Details</h3>
                </div>
                <dl className="divide-y divide-border">
                    <div className="flex flex-col sm:flex-row px-6 py-4">
                        <dt className="w-full sm:w-1/3 font-medium text-muted-foreground flex items-center gap-2">
                            <Mail className="w-4 h-4" /> Email
                        </dt>
                        <dd className="mt-1 sm:mt-0 sm:w-2/3 font-mono text-sm">{user.email}</dd>
                    </div>
                    
                    {user.phone && (
                        <div className="flex flex-col sm:flex-row px-6 py-4">
                            <dt className="w-full sm:w-1/3 font-medium text-muted-foreground flex items-center gap-2">
                                <Phone className="w-4 h-4" /> Phone
                            </dt>
                            <dd className="mt-1 sm:mt-0 sm:w-2/3">{user.phone}</dd>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row px-6 py-4">
                        <dt className="w-full sm:w-1/3 font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Created
                        </dt>
                        <dd className="mt-1 sm:mt-0 sm:w-2/3">{formatDate(user.createdAt)}</dd>
                    </div>

                    <div className="flex flex-col sm:flex-row px-6 py-4">
                        <dt className="w-full sm:w-1/3 font-medium text-muted-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4" /> Last Updated
                        </dt>
                        <dd className="mt-1 sm:mt-0 sm:w-2/3">{formatDate(user.updatedAt)}</dd>
                    </div>

                    {user.lastLoginAt && (
                        <div className="flex flex-col sm:flex-row px-6 py-4">
                            <dt className="w-full sm:w-1/3 font-medium text-muted-foreground">Last Login</dt>
                            <dd className="mt-1 sm:mt-0 sm:w-2/3">{formatDate(user.lastLoginAt)}</dd>
                        </div>
                    )}

                    {user.emailVerified && (
                        <div className="flex flex-col sm:flex-row px-6 py-4">
                            <dt className="w-full sm:w-1/3 font-medium text-muted-foreground">Email Verified</dt>
                            <dd className="mt-1 sm:mt-0 sm:w-2/3">{formatDate(user.emailVerified)}</dd>
                        </div>
                    )}

                    {user.lockedAt && (
                        <div className="flex flex-col sm:flex-row px-6 py-4">
                            <dt className="w-full sm:w-1/3 font-medium text-muted-foreground text-red-600">Locked At</dt>
                            <dd className="mt-1 sm:mt-0 sm:w-2/3 text-red-600">{formatDate(user.lockedAt)}</dd>
                        </div>
                    )}

                    {user.unlockedAt && (
                        <div className="flex flex-col sm:flex-row px-6 py-4">
                            <dt className="w-full sm:w-1/3 font-medium text-muted-foreground text-green-600">Unlocked At</dt>
                            <dd className="mt-1 sm:mt-0 sm:w-2/3 text-green-600">{formatDate(user.unlockedAt)}</dd>
                        </div>
                    )}

                    {/* Sensitive Info Toggle */}
                    <div className="flex flex-col px-6 py-4">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setShowSensitive(!showSensitive)}
                            className="w-fit mb-4"
                        >
                            {showSensitive ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                            {showSensitive ? "Hide" : "Show"} Sensitive Information
                        </Button>
                        
                        {showSensitive && (
                            <div className="space-y-4 bg-muted/30 p-4 rounded-lg">
                                <div className="flex flex-col sm:flex-row">
                                    <dt className="w-full sm:w-1/3 font-medium text-muted-foreground flex items-center gap-2">
                                        <Hash className="w-4 h-4" /> User ID
                                    </dt>
                                    <dd className="mt-1 sm:mt-0 sm:w-2/3 font-mono text-xs">{user.id}</dd>
                                </div>
                                
                                {user.deletedAt && (
                                    <div className="flex flex-col sm:flex-row">
                                        <dt className="w-full sm:w-1/3 font-medium text-muted-foreground text-red-600">Deleted At</dt>
                                        <dd className="mt-1 sm:mt-0 sm:w-2/3 text-red-600">{formatDate(user.deletedAt)}</dd>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </dl>
            </div>
        </div>
    );
};

// ─── Users List View ─────────────────────────────────────────────────────────

const UsersListView = ({ 
    users, 
    onUserSelect,
    isLoading 
}: { 
    users: UserData[]; 
    onUserSelect?: (user: UserData) => void;
    isLoading: boolean;
}) => {
    if (isLoading) {
        return <UserDataTableSkeleton />;
    }

    if (users.length === 0) {
        return (
            <div className="bg-card p-8 border border-border rounded-xl text-center">
                <User className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">No users found</p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow className="text-xs uppercase">
                            <TableHead>User</TableHead>
                            <TableHead>Role</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Verified</TableHead>
                            <TableHead>2FA</TableHead>
                            <TableHead>Locked</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow 
                                key={user.id} 
                                className="hover:bg-muted/50 cursor-pointer"
                                onClick={() => onUserSelect?.(user)}
                            >
                                <TableCell>
                                    <div>
                                        <p className="font-medium text-foreground">{user.name}</p>
                                        <p className="text-xs text-muted-foreground">{user.email}</p>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <Badge variant={getRoleVariant(user.role)}>
                                        {user.role}
                                    </Badge>
                                </TableCell>
                                <TableCell>
                                    {user.isActive ? (
                                        <Badge variant="default" className="bg-green-500">Active</Badge>
                                    ) : (
                                        <Badge variant="secondary">Inactive</Badge>
                                    )}
                                </TableCell>
                                <TableCell>
                                    {user.isVerified ? (
                                        <CheckCircle2 className="w-5 h-5 text-blue-500" />
                                    ) : (
                                        <XCircle className="w-5 h-5 text-yellow-500" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {user.isTwoFactorEnabled ? (
                                        <Shield className="w-5 h-5 text-green-500" />
                                    ) : (
                                        <Shield className="w-5 h-5 text-gray-400" />
                                    )}
                                </TableCell>
                                <TableCell>
                                    {user.isLocked ? (
                                        <Lock className="w-5 h-5 text-red-500" />
                                    ) : (
                                        <Unlock className="w-5 h-5 text-green-500" />
                                    )}
                                </TableCell>
                                <TableCell className="text-sm">
                                    {formatDate(user.createdAt)}
                                </TableCell>
                                <TableCell className="text-right">
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onUserSelect?.(user);
                                        }}
                                    >
                                        View Details
                                    </Button>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const UserDataTable = ({ userId, onUserSelect, filters }: UserDataTableProps) => {
    // Use the users hook to fetch list or single user
    const { data: usersData, isLoading: isListLoading } = useUsers(filters || {});
    const { data: singleUserData, isLoading: isSingleLoading } = useUser(userId || null);
    
    // Get data from store
    const users = useUserStore((state) => state.users);
    const currentUser = useUserStore((state) => state.currentUser);
    const setUsers = useUserStore((state) => state.setUsers);
    const setCurrentUser = useUserStore((state) => state.setCurrentUser);
    const storeError = useUserStore((state) => state.error);

    // Sync users list to store
    useEffect(() => {
        if (usersData?.users) {
            setUsers(usersData.users, usersData.pagination);
        }
    }, [usersData, setUsers]);

    // Sync single user to store
    useEffect(() => {
        if (singleUserData) {
            setCurrentUser(singleUserData);
        }
    }, [singleUserData, setCurrentUser]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (userId) {
                setCurrentUser(null);
            }
        };
    }, [userId, setCurrentUser]);

    // Show single user view if userId is provided
    if (userId) {
        if (isSingleLoading) {
            return <UserDataTableSkeleton />;
        }
        
        const user = currentUser || singleUserData;
        
        if (!user) {
            return (
                <div className="bg-card p-8 border border-border rounded-xl text-center">
                    <AlertCircle className="w-12 h-12 text-destructive mx-auto mb-4" />
                    <p className="text-destructive font-medium">User not found</p>
                </div>
            );
        }
        
        return <SingleUserView user={user} />;
    }

    // Show list view
    const displayUsers = users.length > 0 ? users : usersData?.users || [];
    
    return (
        <UsersListView 
            users={displayUsers} 
            onUserSelect={onUserSelect}
            isLoading={isListLoading}
        />
    );
};

export default UserDataTable;