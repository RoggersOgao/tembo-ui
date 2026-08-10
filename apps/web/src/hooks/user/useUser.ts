// hooks/use-users.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo, useEffect } from 'react'
import { toast } from 'sonner'
import { type UserData, type CreateUserInput, type GetUserOptions, userClient } from '@/loginActions/user-actions'
import { useUserStore } from '../zustand/stores/user/use-user-store'


// ─── Query Keys ───────────────────────────────────────────────────────────────

export const userKeys = {
    all: ['users'] as const,
    lists: () => [...userKeys.all, 'list'] as const,
    list: (filters?: object) => [...userKeys.lists(), filters] as const,
    details: () => [...userKeys.all, 'detail'] as const,
    detail: (id: string) => [...userKeys.details(), id] as const,
    byEmail: (email: string) => [...userKeys.all, 'email', email] as const,
    stats: () => [...userKeys.all, 'stats'] as const,
    search: (query: string, filters?: object) => [...userKeys.all, 'search', query, filters] as const,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UsersListFilters {
    // ── Pagination & sort ─────────────────────────────────────────────────────
    search?:    string
    page?:      number
    limit?:     number
    sortBy?:    string
    sortOrder?: 'asc' | 'desc'

    // ── Filters ───────────────────────────────────────────────────────────────
    role?:                 string
    isActive?:             boolean
    isVerified?:           boolean
    isTwoFactorEnabled?:   boolean
    isLocked?:             boolean
    isSuspended?:          boolean
    verificationLevel?:    string
    signupSource?:         string
    createdAfter?:         string
    createdBefore?:        string
}

export interface UsersResponse {
    users: UserData[]
    pagination: {
        total: number
        page: number
        limit: number
        totalPages: number
        hasMore: boolean
    } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function throwIfFailed<T>(
    response: { success: boolean; errors?: { message: string }[] },
    fallback: string
): void {
    if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? fallback)
    }
}

function invalidateUserLists(queryClient: ReturnType<typeof useQueryClient>) {
    queryClient.invalidateQueries({ queryKey: userKeys.lists() })
    queryClient.invalidateQueries({ queryKey: userKeys.stats() })
}

// ─── useUsers (paginated list with store sync) ────────────────────────────────

export interface UsersListResponse {
    users:      UserData[]
    pagination: any | null
}

export const useUsers = (filters: UsersListFilters = {}) => {
    const stableFilters = useMemo(
        () => filters,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(filters)]
    )
    
    // Store actions
    const setUsers = useUserStore((state) => state.setUsers)
    const setLoading = useUserStore((state) => state.setLoading)
    const setError = useUserStore((state) => state.setError)
    const setFilters = useUserStore((state) => state.setFilters)

    const query = useQuery({
        queryKey: userKeys.list(stableFilters),
        queryFn:  async () => {
            const response = await userClient.getUsers(stableFilters)
            throwIfFailed(response, 'Failed to fetch users')

            const users      = response.data?.users      ?? []
            const pagination = response.data?.pagination ?? null

            if (!Array.isArray(users)) {
                throw new Error('Unexpected response shape: users is not an array')
            }

            return { users, pagination } satisfies UsersListResponse
        },
        staleTime:          1000 * 60,
        placeholderData:    (prev) => prev,
        refetchOnWindowFocus: false,
    })

    // Sync to store
    useEffect(() => {
        setLoading(query.isLoading)
        setError(query.error?.message || null)
        
        if (query.data) {
            setUsers(query.data.users, query.data.pagination)
        }
    }, [query.data, query.isLoading, query.error, setUsers, setLoading, setError])

    // Sync filters to store
    useEffect(() => {
        setFilters(stableFilters)
    }, [stableFilters, setFilters])

    return query
}

// ─── useUser (single by id with store sync) ───────────────────────────────────

export const useUser = (id: string | null, options: GetUserOptions = {}) => {
    const stableOptions = useMemo(
        () => options,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(options)]
    )
    
    const setCurrentUser = useUserStore((state) => state.setCurrentUser)
    const setLoading = useUserStore((state) => state.setLoading)
    const setError = useUserStore((state) => state.setError)

    const query = useQuery({
        queryKey: userKeys.detail(id!),
        queryFn: async () => {
            const response = await userClient.getUserById(id!, stableOptions)
            throwIfFailed(response, 'Failed to fetch user')
            return response.data?.user ?? null
        },
        enabled: !!id,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    })

    // Sync to store
    useEffect(() => {
        setLoading(query.isLoading)
        setError(query.error?.message || null)
        
        if (query.data) {
            setCurrentUser(query.data)
        } else if (!query.isLoading && !query.data) {
            setCurrentUser(null)
        }
    }, [query.data, query.isLoading, query.error, setCurrentUser, setLoading, setError])

    return query
}

// ─── useUserByEmail with store sync ───────────────────────────────────────────

export const useUserByEmail = (email: string | null, options: GetUserOptions = {}) => {
    const setCurrentUser = useUserStore((state) => state.setCurrentUser)
    const setLoading = useUserStore((state) => state.setLoading)
    const setError = useUserStore((state) => state.setError)

    const query = useQuery({
        queryKey: userKeys.byEmail(email!),
        queryFn: async () => {
            const response = await userClient.getUserByEmail(email!, options)
            throwIfFailed(response, 'Failed to fetch user')
            return response.data?.user ?? null
        },
        enabled: !!email,
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
    })

    // Sync to store
    useEffect(() => {
        setLoading(query.isLoading)
        setError(query.error?.message || null)
        
        if (query.data) {
            setCurrentUser(query.data)
        }
    }, [query.data, query.isLoading, query.error, setCurrentUser, setLoading, setError])

    return query
}

// ─── useUserStats with store sync ─────────────────────────────────────────────

export const useUserStats = () => {
    const setUserStats = useUserStore((state) => state.setUserStats)
    const setLoading = useUserStore((state) => state.setLoading)
    const setError = useUserStore((state) => state.setError)

    const query = useQuery({
        queryKey: userKeys.stats(),
        queryFn: async () => {
            const response = await userClient.getUserStats()
            throwIfFailed(response, 'Failed to fetch user stats')
            return response.data
        },
        staleTime: 1000 * 60 * 2,
        refetchOnWindowFocus: false,
    })

    // Sync to store
    useEffect(() => {
        setLoading(query.isLoading)
        setError(query.error?.message || null)
        
        if (query.data) {
            setUserStats(query.data)
        }
    }, [query.data, query.isLoading, query.error, setUserStats, setLoading, setError])

    return query
}

// ─── useSearchUsers with store sync ───────────────────────────────────────────

export const useSearchUsers = (
    searchQuery: string,  // Renamed from 'query' to 'searchQuery'
    filters?: {
        role?: string
        isVerified?: boolean
        isTwoFactorEnabled?: boolean
        page?: number
        limit?: number
    }
) => {
    const stableFilters = useMemo(
        () => filters,
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [JSON.stringify(filters)]
    )
    
    const setSearchResults = useUserStore((state) => state.setSearchResults)
    const setLoading = useUserStore((state) => state.setLoading)
    const setError = useUserStore((state) => state.setError)

    const queryResult = useQuery({  // Renamed from 'query' to 'queryResult'
        queryKey: userKeys.search(searchQuery, stableFilters),
        queryFn: async () => {
            const response = await userClient.searchUsers(searchQuery, stableFilters)
            throwIfFailed(response, 'Failed to search users')
            return {
                users: response.data?.users ?? [],
                pagination: response.data?.pagination ?? null,
            } satisfies UsersResponse
        },
        enabled: searchQuery.trim().length >= 2,
        staleTime: 1000 * 30,
        refetchOnWindowFocus: false,
    })

    // Sync to store
    useEffect(() => {
        setLoading(queryResult.isLoading)
        setError(queryResult.error?.message || null)
        
        if (queryResult.data) {
            setSearchResults(
                queryResult.data.users, 
                queryResult.data.pagination, 
                searchQuery, 
                stableFilters
            )
        }
    }, [queryResult.data, queryResult.isLoading, queryResult.error, setSearchResults, setLoading, setError, searchQuery, stableFilters])

    return queryResult
}

// ─── useCreateUser with store update ──────────────────────────────────────────

export const useCreateUser = () => {
    const queryClient = useQueryClient()
    const setUser = useUserStore((state) => state.setUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: (data: CreateUserInput) => userClient.createUser(data),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response) => {
            throwIfFailed(response, 'Failed to create user')

            const newUser = response.data?.user
            if (newUser?.id) {
                setUser(newUser)
                queryClient.setQueryData(userKeys.detail(newUser.id), newUser)
            }

            invalidateUserLists(queryClient)
            toast.success('User created successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to create user')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to create user')
        },
    })
}

export const useCreateUserForAdmin = () => {
    const queryClient = useQueryClient()
    const setUser = useUserStore((state) => state.setUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: (data: CreateUserInput) => userClient.createUserForAdmin(data),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response) => {
            throwIfFailed(response, 'Failed to create user')

            const newUser = response.data?.user
            if (newUser?.id) {
                setUser(newUser)
                queryClient.setQueryData(userKeys.detail(newUser.id), newUser)
            }

            invalidateUserLists(queryClient)
            toast.success('User created successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to create user')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to create user')
        },
    })
}

// ─── useUpdateUser with store update ──────────────────────────────────────────

export const useUpdateUser = () => {
    const queryClient = useQueryClient()
    const setUser = useUserStore((state) => state.setUser)
    const updateCurrentUser = useUserStore((state) => state.updateCurrentUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: ({ id, data }: { id: string; data: Partial<UserData> }) =>
            userClient.updateUser(id, data),

        onMutate: async ({ id, data }) => {
            setSubmitting(true)
            setError(null)
            
            await queryClient.cancelQueries({ queryKey: userKeys.detail(id) })

            const previousUser = queryClient.getQueryData<UserData>(userKeys.detail(id))

            if (previousUser) {
                const updatedUser = { ...previousUser, ...data, updatedAt: new Date() }
                queryClient.setQueryData(userKeys.detail(id), updatedUser)
                setUser(updatedUser)
                updateCurrentUser(data)
            }

            // Optimistically update in lists too
            queryClient.setQueriesData<UsersResponse>(
                { queryKey: userKeys.lists() },
                (old) => {
                    if (!old) return old
                    return {
                        ...old,
                        users: old.users.map((u) =>
                            u.id === id ? { ...u, ...data, updatedAt: new Date() } : u
                        ),
                    }
                }
            )

            return { previousUser }
        },

        onSuccess: (response, variables) => {
            throwIfFailed(response, 'Failed to update user')

            const updated = response.data?.user
            if (updated) {
                setUser(updated)
                queryClient.setQueryData(userKeys.detail(variables.id), updated)
            }

            toast.success('User updated successfully')
            setSubmitting(false)
        },

        onError: (error: Error, variables, context) => {
            // Roll back optimistic update on error
            if (context?.previousUser) {
                queryClient.setQueryData(userKeys.detail(variables.id), context.previousUser)
                setUser(context.previousUser)
                queryClient.setQueriesData<UsersResponse>(
                    { queryKey: userKeys.lists() },
                    (old) => {
                        if (!old) return old
                        return {
                            ...old,
                            users: old.users.map((u) =>
                                u.id === variables.id ? context.previousUser! : u
                            ),
                        }
                    }
                )
            }

            setError(error.message ?? 'Failed to update user')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to update user')
        },

        onSettled: (_data, _err, variables) => {
            queryClient.invalidateQueries({ queryKey: userKeys.detail(variables.id) })
            queryClient.invalidateQueries({ queryKey: userKeys.lists() })
        },
    })
}

// ─── useDeleteUser with store update ──────────────────────────────────────────

export const useDeleteUser = () => {
    const queryClient = useQueryClient()
    const removeUser = useUserStore((state) => state.removeUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: (id: string) => userClient.deleteUser(id),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response, id) => {
            throwIfFailed(response, 'Failed to delete user')
            removeUser(id)
            queryClient.removeQueries({ queryKey: userKeys.detail(id) })
            invalidateUserLists(queryClient)
            toast.success('User deleted successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to delete user')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to delete user')
        },
    })
}

// ─── useUpdateUserPassword ────────────────────────────────────────────────────

export const useUpdateUserPassword = () => {
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: ({ userId, password }: { userId: string; password: string }) =>
            userClient.updateUserPassword(userId, { password }),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response) => {
            throwIfFailed(response, 'Failed to update password')
            toast.success('Password updated successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to update password')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to update password')
        },
    })
}

// ─── useLockUser with store update ────────────────────────────────────────────

export const useLockUser = () => {
    const queryClient = useQueryClient()
    const setUser = useUserStore((state) => state.setUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: ({ userId, reason }: { userId: string; reason: string }) =>
            userClient.lockAccount(userId, { reason }),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response, variables) => {
            throwIfFailed(response, 'Failed to lock account')

            // Update in store
            const lockedUser = {
                ...queryClient.getQueryData<UserData>(userKeys.detail(variables.userId)),
                isLocked: true,
                lockedAt: response.data?.lockedAt ?? new Date()
            } as UserData
            
            if (lockedUser) {
                setUser(lockedUser)
            }

            queryClient.setQueryData<UserData>(userKeys.detail(variables.userId), (old) => {
                if (!old) return old
                return { ...old, isLocked: true, lockedAt: response.data?.lockedAt ?? new Date() }
            })

            invalidateUserLists(queryClient)
            toast.success('Account locked successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to lock account')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to lock account')
        },
    })
}

// ─── useUnlockUser with store update ──────────────────────────────────────────

export const useUnlockUser = () => {
    const queryClient = useQueryClient()
    const setUser = useUserStore((state) => state.setUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: (userId: string) => userClient.unlockAccount(userId),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response, userId) => {
            throwIfFailed(response, 'Failed to unlock account')

            // Update in store
            const unlockedUser = {
                ...queryClient.getQueryData<UserData>(userKeys.detail(userId)),
                isLocked: false,
                lockedAt: undefined,
                unlockedAt: new Date()
            } as UserData
            
            if (unlockedUser) {
                setUser(unlockedUser)
            }

            queryClient.setQueryData<UserData>(userKeys.detail(userId), (old) => {
                if (!old) return old
                return {
                    ...old,
                    isLocked: false,
                    lockedAt: undefined,
                    unlockedAt: new Date(),
                }
            })

            invalidateUserLists(queryClient)
            toast.success('Account unlocked successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to unlock account')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to unlock account')
        },
    })
}

// ─── useVerifyUserEmail with store update ─────────────────────────────────────

export const useVerifyUserEmail = () => {
    const queryClient = useQueryClient()
    const setUser = useUserStore((state) => state.setUser)
    const setSubmitting = useUserStore((state) => state.setSubmitting)
    const setError = useUserStore((state) => state.setError)

    return useMutation({
        mutationFn: (userId: string) => userClient.verifyUserEmail(userId),

        onMutate: () => {
            setSubmitting(true)
            setError(null)
        },

        onSuccess: (response, userId) => {
            throwIfFailed(response, 'Failed to verify email')

            // Update in store
            const verifiedUser = {
                ...queryClient.getQueryData<UserData>(userKeys.detail(userId)),
                isVerified: true,
                emailVerified: new Date()
            } as UserData
            
            if (verifiedUser) {
                setUser(verifiedUser)
            }

            queryClient.setQueryData<UserData>(userKeys.detail(userId), (old) => {
                if (!old) return old
                return { ...old, isVerified: true, emailVerified: new Date() }
            })

            invalidateUserLists(queryClient)
            toast.success('Email verified successfully')
            setSubmitting(false)
        },

        onError: (error: Error) => {
            setError(error.message ?? 'Failed to verify email')
            setSubmitting(false)
            toast.error(error.message ?? 'Failed to verify email')
        },
    })
}

// ─── useSelectUser (open detail view from cached data) ───────────────────────

export const useSelectUser = (
    onSelect: (user: UserData) => void
) => {
    const queryClient = useQueryClient()
    const setCurrentUser = useUserStore((state) => state.setCurrentUser)

    return useCallback(
        (id: string) => {
            const cached = queryClient.getQueryData<UserData>(userKeys.detail(id))
            if (cached) {
                setCurrentUser(cached)
                onSelect(cached)
            } else {
                // Prefetch if not in cache yet
                queryClient.prefetchQuery({
                    queryKey: userKeys.detail(id),
                    queryFn: async () => {
                        const response = await userClient.getUserById(id)
                        throwIfFailed(response, 'Failed to fetch user')
                        return response.data?.user ?? null
                    },
                    staleTime: 1000 * 60 * 5,
                }).then(() => {
                    const fetched = queryClient.getQueryData<UserData>(userKeys.detail(id))
                    if (fetched) {
                        setCurrentUser(fetched)
                        onSelect(fetched)
                    }
                })
            }
        },
        [queryClient, onSelect, setCurrentUser]
    )
}

// ─── Convenience hook to access store and mutations together ─────────────────

export const useUserManagement = () => {
    // Store state
    const users = useUserStore((state) => state.users)
    const currentUser = useUserStore((state) => state.currentUser)
    const isLoading = useUserStore((state) => state.isLoading)
    const isSubmitting = useUserStore((state) => state.isSubmitting)
    const error = useUserStore((state) => state.error)
    const pagination = useUserStore((state) => state.pagination)
    const filters = useUserStore((state) => state.filters)
    const selectedUserIds = useUserStore((state) => state.selectedUserIds)
    const searchResults = useUserStore((state) => state.searchResults)
    const stats = useUserStore((state) => state.stats)
    
    // Store actions
    const setFilters = useUserStore((state) => state.setFilters)
    const resetFilters = useUserStore((state) => state.resetFilters)
    const selectUser = useUserStore((state) => state.selectUser)
    const unselectUser = useUserStore((state) => state.unselectUser)
    const selectAllUsers = useUserStore((state) => state.selectAllUsers)
    const clearSelection = useUserStore((state) => state.clearSelection)
    const setCurrentUser = useUserStore((state) => state.setCurrentUser)
    const clearSearchResults = useUserStore((state) => state.clearSearchResults)
    
    // Mutations
    const createUser = useCreateUser()
    const updateUser = useUpdateUser()
    const deleteUser = useDeleteUser()
    const lockUser = useLockUser()
    const unlockUser = useUnlockUser()
    const verifyEmail = useVerifyUserEmail()
    const updatePassword = useUpdateUserPassword()
    
    return {
        // State
        users,
        currentUser,
        isLoading,
        isSubmitting,
        error,
        pagination,
        filters,
        selectedUserIds,
        searchResults,
        stats,
        
        // Actions
        setFilters,
        resetFilters,
        selectUser,
        unselectUser,
        selectAllUsers,
        clearSelection,
        setCurrentUser,
        clearSearchResults,
        
        // Mutations
        createUser: createUser.mutate,
        isCreating: createUser.isPending,
        updateUser: updateUser.mutate,
        isUpdating: updateUser.isPending,
        deleteUser: deleteUser.mutate,
        isDeleting: deleteUser.isPending,
        lockUser: lockUser.mutate,
        isLocking: lockUser.isPending,
        unlockUser: unlockUser.mutate,
        isUnlocking: unlockUser.isPending,
        verifyEmail: verifyEmail.mutate,
        isVerifying: verifyEmail.isPending,
        updatePassword: updatePassword.mutate,
        isUpdatingPassword: updatePassword.isPending,
    }
}