"use client";

import { useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { AuthSession, useAuthStore } from '@/hooks/zustand/stores/use-auth-store';
import { Loader2, ShieldAlert, Lock } from "lucide-react";
import { UserRole } from '@/types/auth-types';

// ─── Helper ───────────────────────────────────────────────────────────────────
function buildAuthSession(
    user: NonNullable<ReturnType<typeof useSession>['data']>['user']
): AuthSession {
    return {
        user: {
            id: user.id ?? '',
            email: user.email ?? '',
            name: user.name ?? null,
            image: user.image ?? null,
            role: user.role ?? 'CUSTOMER',
            isTwoFactorEnabled: user.isTwoFactorEnabled ?? false,
            isOAuth: user.isOAuth ?? false,
            emailVerified: user.emailVerified ?? null,
            phoneNumber: user.phoneNumber,
            supplierId: user.supplierId,
            isVerified: user.isVerified ?? false,
            verificationLevel: user.verificationLevel ?? '',
            provider: user.provider,
            isActive: user.isActive ?? true,
            isSuspended: user.isSuspended ?? false,
            isLocked: user.isLocked ?? false,
        },
        token: user.token ?? '',
        expiresAt: Math.floor(Date.now() / 60_000) * 60_000 + 60 * 60 * 1000,
    };
}

// ─── SessionSyncProvider ──────────────────────────────────────────────────────
export function SessionSyncProvider({ children }: { children: React.ReactNode }) {
    const { data: session, status } = useSession();

    const setSession = useAuthStore((s) => s.setSession);
    const clearSession = useAuthStore((s) => s.clearSession);
    const setLoading = useAuthStore((s) => s.setLoading);
    const setInitialized = useAuthStore((s) => s.setInitialized);

    const lastSyncedIdRef = useRef<string | null>(null);
    const lastSyncedTokenRef = useRef<string | null>(null);

    useEffect(() => {
        // ── Still resolving ────────────────────────────────────────────────
        if (status === 'loading') {
            setLoading(true);
            return;
        }

        setInitialized(true);

        // ── Authenticated ──────────────────────────────────────────────────
        if (status === 'authenticated' && session?.user) {
            const authSession = buildAuthSession(session.user);
            const { id, token } = { id: authSession.user.id, token: authSession.token };

            if (
                id !== lastSyncedIdRef.current ||
                token !== lastSyncedTokenRef.current
            ) {
                lastSyncedIdRef.current = id;
                lastSyncedTokenRef.current = token;
                setSession(authSession);
                console.log(' Session synced:', authSession.user.email);
            }

            setLoading(false);
            return;
        }

        // ── Unauthenticated ────────────────────────────────────────────────
        if (status === 'unauthenticated') {
            clearSession();
            lastSyncedIdRef.current = null;
            lastSyncedTokenRef.current = null;
            setLoading(false);
            console.log('🔓 Session cleared');
        }

    }, [session, status, setSession, clearSession, setLoading, setInitialized]);

    return <>{children}</>;
}

// ─── DashboardGuard ───────────────────────────────────────────────────────────

interface DashboardGuardProps {
    children: React.ReactNode;
    fallback?: React.ReactNode;
    requiredRole?: UserRole | UserRole[];
    inline?: boolean;
}

export function DashboardGuard({
    children,
    fallback = null,
    requiredRole,
    inline = false,
}: DashboardGuardProps) {
    const isInitialized = useAuthStore((state) => state.isInitialized);
    const isLoading = useAuthStore((state) => state.isLoading);
    const session = useAuthStore((state) => state.session);

    const isAuthenticated = session !== null && Date.now() < (session?.expiresAt ?? 0);
    const userRole = session?.user.role ?? null;

    const hasRequiredRole = (() => {
        if (!requiredRole || !userRole) return true;
        if (Array.isArray(requiredRole)) return requiredRole.includes(userRole);
        return userRole === requiredRole;
    })();

    const containerClass = inline
        ? "flex items-center justify-center p-4"
        : "flex items-center justify-center min-h-[200px]";

    if (!isInitialized || isLoading) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className={containerClass}>
                <Loader2 className="w-6 h-6 text-gray-400 animate-spin" />
            </div>
        );
    }

    if (!isAuthenticated) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className={containerClass}>
                <Lock className="w-6 h-6 text-gray-400 animate-pulse" />
            </div>
        );
    }

    if (!hasRequiredRole) {
        if (fallback) return <>{fallback}</>;
        return (
            <div className={containerClass}>
                <ShieldAlert className="w-6 h-6 text-gray-400 animate-pulse" />
            </div>
        );
    }

    return <>{children}</>;
}