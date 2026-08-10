// hooks/zustand/stores/use-auth-store.ts
import { create } from 'zustand';
import { useShallow } from 'zustand/react/shallow';

// ============================================
// TYPE DEFINITIONS
// ============================================

export type UserRole =
    | 'SUPER_ADMIN'
    | 'ADMIN'
    | 'MANAGER'
    | 'STAFF'
    | 'DELIVERY'
    | 'SUPPLIER'
    | 'CUSTOMER'
    | 'SUPPORT'
    | 'VIEWER';

export interface User {
    id: string;
    email: string;
    name: string | null;
    image: string | null;
    role: UserRole;
    isTwoFactorEnabled: boolean;
    isOAuth: boolean;
    emailVerified: Date | null;
    phoneNumber?: string;
    supplierId?: string;
    isVerified: boolean;
    verificationLevel: string;
    provider?: string;
    isActive?: boolean;
    isSuspended?: boolean;
    isLocked?: boolean;
}

export interface AuthSession {
    user: User;
    token: string;
    expiresAt: number;
}

interface AuthState {
    // ── State ─────────────────────────────────────────────────────────────
    session: AuthSession | null;
    isLoading: boolean;
    isInitialized: boolean;
    error: string | null;

    // ── Actions ───────────────────────────────────────────────────────────
    setSession: (session: AuthSession | null) => void;
    updateUser: (userData: Partial<User>) => void;
    clearSession: () => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    setInitialized: (initialized: boolean) => void;

    // ── Helpers ───────────────────────────────────────────────────────────
    isAuthenticated: () => boolean;
    isSessionValid: () => boolean;
    hasRole: (role: UserRole | UserRole[]) => boolean;
    getUser: () => User | null;
    getToken: () => string | null;
    refreshSession: (newSession: AuthSession) => void;
}

// ============================================
// HELPERS
// ============================================

const isSameSession = (a: AuthSession | null, b: AuthSession | null): boolean => {
    if (a === b) return true;
    if (!a || !b) return false;
    return (
        a.token                  === b.token                  &&
        a.user.id                === b.user.id                &&
        a.user.email             === b.user.email             &&
        a.user.role              === b.user.role              &&
        a.user.isVerified        === b.user.isVerified        &&
        a.user.verificationLevel === b.user.verificationLevel &&
        a.user.supplierId        === b.user.supplierId        &&
        a.user.name              === b.user.name              &&
        a.user.image             === b.user.image             &&
        a.user.phoneNumber       === b.user.phoneNumber       &&
        a.user.isActive          === b.user.isActive          &&
        a.user.isSuspended       === b.user.isSuspended       &&
        a.user.isLocked          === b.user.isLocked
    );
};

// ============================================
// ZUSTAND STORE — no persist, session lives in memory only
// ============================================

export const useAuthStore = create<AuthState>()(
    (set, get) => ({
        // ── Initial state ──────────────────────────────────────────────────
        session:       null,
        isLoading:     true,
        isInitialized: false,
        error:         null,

        // ── Set complete session ───────────────────────────────────────────
        setSession: (session) => {
            const current = get();
            if (isSameSession(current.session, session) && current.isInitialized) return;
            set({
                session,
                isLoading:     false,
                error:         null,
                isInitialized: true,
            });
        },

        // ── Patch individual user fields ───────────────────────────────────
        updateUser: (userData) => {
            const currentSession = get().session;
            if (!currentSession) return;
            set({
                session: {
                    ...currentSession,
                    user: { ...currentSession.user, ...userData },
                },
            });
        },

        // ── Clear session (logout) ─────────────────────────────────────────
        clearSession: () => {
            if (!get().session && get().isInitialized) return;
            set({
                session:       null,
                isLoading:     false,
                error:         null,
                isInitialized: true,
            });
        },

        setLoading: (loading) => {
            if (get().isLoading === loading) return;
            set({ isLoading: loading });
        },

        setError: (error) => {
            if (get().error === error) return;
            set({ error, isLoading: false });
        },

        setInitialized: (initialized) => {
            if (get().isInitialized === initialized) return;
            set({ isInitialized: initialized });
        },

        // ── isAuthenticated ────────────────────────────────────────────────
        isAuthenticated: () => {
            const { session } = get();
            return session !== null && get().isSessionValid();
        },

        // ── isSessionValid ─────────────────────────────────────────────────
        isSessionValid: () => {
            const { session } = get();
            if (!session) return false;
            return Date.now() < session.expiresAt;
        },

        // ── hasRole ────────────────────────────────────────────────────────
        hasRole: (role) => {
            const user = get().getUser();
            if (!user) return false;
            return Array.isArray(role)
                ? role.includes(user.role)
                : user.role === role;
        },

        // ── getUser ────────────────────────────────────────────────────────
        getUser: () => get().session?.user ?? null,

        // ── getToken ───────────────────────────────────────────────────────
        getToken: () => {
            const { session } = get();
            if (!session || !get().isSessionValid()) return null;
            return session.token;
        },

        // ── refreshSession ─────────────────────────────────────────────────
        refreshSession: (newSession) => {
            get().setSession(newSession);
        },
    })
);

// ============================================
// SELECTOR HOOKS
// ============================================

export const useUser = () =>
    useAuthStore(useShallow((state) => state.session?.user ?? null));

export const useUserId = () =>
    useAuthStore((state) => state.session?.user?.id ?? null);

export const useUserRole = () =>
    useAuthStore((state) => state.session?.user?.role ?? null);

export const useIsAuthenticated = () =>
    useAuthStore((state) =>
        state.session !== null && Date.now() < (state.session?.expiresAt ?? 0)
    );

export const useHasRole = (role: UserRole | UserRole[]) =>
    useAuthStore((state) => state.hasRole(role));

export const useAuthToken = () =>
    useAuthStore((state) => state.getToken());

export const useAuthLoading = () =>
    useAuthStore((state) => state.isLoading);

export const useAuthInitialized = () =>
    useAuthStore((state) => state.isInitialized);

export const useSupplierData = () =>
    useAuthStore(
        useShallow((state) => {
            const user = state.session?.user;
            if (user?.role !== 'SUPPLIER') return null;
            return { supplierId: user.supplierId, phoneNumber: user.phoneNumber };
        })
    );

export const useVerification = () =>
    useAuthStore(
        useShallow((state) => {
            const user = state.session?.user;
            if (!user) return { isVerified: false, verificationLevel: '' };
            return {
                isVerified:        user.isVerified,
                verificationLevel: user.verificationLevel,
            };
        })
    );

export const useAccountStatus = () =>
    useAuthStore(
        useShallow((state) => {
            const user = state.session?.user;
            if (!user) return { isActive: false, isSuspended: false, isLocked: false };
            return {
                isActive:    user.isActive    ?? true,
                isSuspended: user.isSuspended ?? false,
                isLocked:    user.isLocked    ?? false,
            };
        })
    );