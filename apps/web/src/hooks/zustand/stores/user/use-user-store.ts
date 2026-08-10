// stores/use-user-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type { UserData } from '@/loginActions/user-actions';

// ─── Helper: transform date strings → Date objects ────────────────────────────

function transformUserDates(user: any): UserData {
  return {
    ...user,
    createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
    updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date(),
    emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
    lastLoginAt: user.lastLoginAt ? new Date(user.lastLoginAt) : null,
    lockedAt: user.lockedAt ? new Date(user.lockedAt) : null,
    unlockedAt: user.unlockedAt ? new Date(user.unlockedAt) : null,
    deletedAt: user.deletedAt ? new Date(user.deletedAt) : null,
  };
}

// ─── State interface ──────────────────────────────────────────────────────────

export interface PaginationState {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasMore: boolean;
}

export interface UserFiltersState {
  search?: string;
  role?: string;
  isActive?: boolean;
  isVerified?: boolean;
  isTwoFactorEnabled?: boolean;
  isLocked?: boolean;
  isSuspended?: boolean;
  verificationLevel?: string;
  signupSource?: string;
  createdAfter?: string;
  createdBefore?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

interface UserState {
  // Data
  currentUser:          UserData | null;           // Currently viewed/selected user
  users:                UserData[];
  usersById:            Record<string, UserData>;
  
  // Statistics
  stats:                any | null;
  
  // Search
  searchResults:        UserData[];
  searchPagination:     PaginationState | null;
  lastSearchQuery:      string;
  lastSearchFilters:    object | null;
  
  // Filters & Pagination
  filters:              UserFiltersState;
  pagination:           PaginationState | null;
  
  // Bulk operations
  selectedUserIds:      string[];
  bulkActionLoading:    boolean;
  
  // UI State
  isLoading:            boolean;
  isSubmitting:         boolean;
  error:                string | null;
  
  // ── User actions ────────────────────────────────────────────────────────────
  setCurrentUser:       (user: UserData | null) => void;
  updateCurrentUser:    (updates: Partial<UserData>) => void;
  
  setUsers:             (users: UserData[], pagination?: PaginationState | null) => void;
  setUser:              (user: UserData) => void;
  removeUser:           (userId: string) => void;
  
  setUserStats:         (stats: any | null) => void;
  
  // ── Search actions ──────────────────────────────────────────────────────────
  setSearchResults:     (users: UserData[], pagination: PaginationState | null, query: string, filters?: object) => void;
  clearSearchResults:   () => void;
  
  // ── Filter actions ──────────────────────────────────────────────────────────
  setFilters:           (filters: Partial<UserFiltersState>) => void;
  resetFilters:         () => void;
  
  // ── Bulk selection actions ──────────────────────────────────────────────────
  selectUser:           (userId: string) => void;
  unselectUser:         (userId: string) => void;
  selectAllUsers:       () => void;
  clearSelection:       () => void;
  setSelectedUserIds:   (ids: string[]) => void;
  setBulkActionLoading: (loading: boolean) => void;
  
  // ── UI actions ──────────────────────────────────────────────────────────────
  setLoading:           (loading: boolean) => void;
  setSubmitting:        (submitting: boolean) => void;
  setError:             (error: string | null) => void;
  
  // ── Reset ───────────────────────────────────────────────────────────────────
  reset:                () => void;
  resetUser:            (userId: string) => void;
}

// ─── Initial state ────────────────────────────────────────────────────────────

const initialFilters: UserFiltersState = {
  search: '',
  role: undefined,
  isActive: undefined,
  isVerified: undefined,
  isTwoFactorEnabled: undefined,
  isLocked: undefined,
  isSuspended: undefined,
  verificationLevel: undefined,
  signupSource: undefined,
  createdAfter: undefined,
  createdBefore: undefined,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useUserStore = create<UserState>()(
  devtools(
    (set, get) => ({
      // ── Initial State ──────────────────────────────────────────────────────
      currentUser:        null,
      users:              [],
      usersById:          {},
      stats:              null,
      searchResults:      [],
      searchPagination:   null,
      lastSearchQuery:    '',
      lastSearchFilters:  null,
      filters:            { ...initialFilters },
      pagination:         null,
      selectedUserIds:    [],
      bulkActionLoading:  false,
      isLoading:          false,
      isSubmitting:       false,
      error:              null,

      // ── User Actions ───────────────────────────────────────────────────────

      setCurrentUser: (user) =>
        set({ currentUser: user ? transformUserDates(user) : null }),

      updateCurrentUser: (updates) =>
        set((state) => ({
          currentUser: state.currentUser
            ? { ...state.currentUser, ...updates, updatedAt: new Date() }
            : null,
        })),

      setUsers: (users, pagination) =>
        set((state) => {
          const transformed = users.map(transformUserDates);
          const byId = { ...state.usersById };
          transformed.forEach((u) => { byId[u.id] = u; });
          return {
            users: transformed,
            usersById: byId,
            ...(pagination !== undefined ? { pagination } : {}),
          };
        }),

      setUser: (user) =>
        set((state) => {
          const transformed = transformUserDates(user);
          return {
            usersById: { ...state.usersById, [transformed.id]: transformed },
            users: state.users.some((u) => u.id === transformed.id)
              ? state.users.map((u) => (u.id === transformed.id ? transformed : u))
              : [...state.users, transformed],
          };
        }),

      removeUser: (userId) =>
        set((state) => {
          const usersById = { ...state.usersById };
          delete usersById[userId];
          return {
            usersById,
            users: state.users.filter((u) => u.id !== userId),
            selectedUserIds: state.selectedUserIds.filter((id) => id !== userId),
          };
        }),

      setUserStats: (stats) =>
        set({ stats }),

      // ── Search Actions ─────────────────────────────────────────────────────

      setSearchResults: (users, pagination, query, filters) =>
        set({
          searchResults: users.map(transformUserDates),
          searchPagination: pagination,
          lastSearchQuery: query,
          lastSearchFilters: filters || null,
        }),

      clearSearchResults: () =>
        set({
          searchResults: [],
          searchPagination: null,
          lastSearchQuery: '',
          lastSearchFilters: null,
        }),

      // ── Filter Actions ─────────────────────────────────────────────────────

      setFilters: (newFilters) =>
        set((state) => ({
          filters: {
            ...state.filters,
            ...newFilters,
          },
          // Reset to page 1 when filters change
          pagination: state.pagination
            ? { ...state.pagination, page: 1 }
            : state.pagination,
        })),

      resetFilters: () =>
        set({
          filters: { ...initialFilters },
          pagination: null,
        }),

      // ── Bulk Selection Actions ─────────────────────────────────────────────

      selectUser: (userId) =>
        set((state) => ({
          selectedUserIds: state.selectedUserIds.includes(userId)
            ? state.selectedUserIds
            : [...state.selectedUserIds, userId],
        })),

      unselectUser: (userId) =>
        set((state) => ({
          selectedUserIds: state.selectedUserIds.filter((id) => id !== userId),
        })),

      selectAllUsers: () =>
        set((state) => ({
          selectedUserIds: state.users.map((u) => u.id),
        })),

      clearSelection: () =>
        set({ selectedUserIds: [] }),

      setSelectedUserIds: (ids) =>
        set({ selectedUserIds: ids }),

      setBulkActionLoading: (loading) =>
        set({ bulkActionLoading: loading }),

      // ── UI Actions ─────────────────────────────────────────────────────────

      setLoading:    (isLoading)    => set({ isLoading }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      setError:      (error)        => set({ error }),

      // ── Reset Actions ──────────────────────────────────────────────────────

      reset: () =>
        set({
          currentUser:        null,
          users:              [],
          usersById:          {},
          stats:              null,
          searchResults:      [],
          searchPagination:   null,
          lastSearchQuery:    '',
          lastSearchFilters:  null,
          filters:            { ...initialFilters },
          pagination:         null,
          selectedUserIds:    [],
          bulkActionLoading:  false,
          isLoading:          false,
          isSubmitting:       false,
          error:              null,
        }),

      resetUser: (userId) =>
        set((state) => {
          const usersById = { ...state.usersById };
          delete usersById[userId];
          return {
            usersById,
            users: state.users.filter((u) => u.id !== userId),
            selectedUserIds: state.selectedUserIds.filter((id) => id !== userId),
            currentUser: state.currentUser?.id === userId ? null : state.currentUser,
          };
        }),
    }),
    { name: 'UserStore' },
  ),
);