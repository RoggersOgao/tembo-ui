// hooks/use-branches.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import type {
  Branch,
  BranchCreateInput,
  BranchUpdateInput,
  BranchFilterInput,
} from '@/types/branch/branch-types'
import { branchApiClient } from '@/lib/branch/branch.api'
import { useBranchUIStore } from '../zustand/stores/branch/branch-store'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const branchKeys = {
  all: ['branches'] as const,
  lists: () => [...branchKeys.all, 'list'] as const,
  list: (
    filters: BranchFilterInput,
    page: number,
    limit: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => {
    const stableFilters = (Object.keys(filters ?? {}) as Array<keyof BranchFilterInput>)
      .sort()
      .reduce((acc, key) => {
        const value = filters[key]
        if (value !== undefined && value !== null) acc[key] = value as never
        return acc
      }, {} as Partial<BranchFilterInput>)

    return [...branchKeys.lists(), { filters: stableFilters, page, limit, sortBy, sortOrder }] as const
  },
  details: () => [...branchKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchKeys.details(), id] as const,
  nearby: (lat: number, lng: number, radius?: number) => [...branchKeys.all, 'nearby', lat, lng, radius] as const,
  inventory: (id: string) => [...branchKeys.detail(id), 'inventory'] as const,
  stats: (id: string) => [...branchKeys.detail(id), 'stats'] as const,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BranchesResponse {
  branches: Branch[]
  pagination: { page: number; limit: number; total: number; totalPages: number } | null
}

export interface BranchInventoryItem {
  productId: string
  product: { id: string; name: string; sku: string; category: { id: string; name: string } }
  _sum: { quantityAvailable: number; quantityOnHand: number; quantityReserved: number }
  _count: { variantId: number }
}

export interface BranchStats {
  deliveries: {
    total: number
    byStatus: Record<string, number>
  }
  inventory: {
    totalItems: number
    totalQuantity: number
    reservedQuantity: number
    lowStockItems: number
  }
  orders: {
    total: number
  }
}

// ─── useBranches ──────────────────────────────────────────────────────────────

export interface UseBranchesOptions {
  filters?: BranchFilterInput
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  enabled?: boolean
  staleTime?: number
}

export const useBranches = (options: UseBranchesOptions = {}) => {
  const {
    filters = {},
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    enabled = true,
    staleTime = 1000 * 60 * 5, // 5 minutes
  } = options

  return useQuery({
    queryKey: branchKeys.list(filters, page, limit, sortBy, sortOrder),
    queryFn: async () => {
      const response = await branchApiClient.getBranches(filters, page, limit, sortBy, sortOrder)
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch branches')
      }
      return {
        branches: response.data?.branches ?? [],
        pagination: response.data?.pagination ?? null,
      } satisfies BranchesResponse
    },
    enabled,
    staleTime,
    gcTime: 1000 * 60 * 10,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  })
}

// ─── useBranch ────────────────────────────────────────────────────────────────

export const useBranch = (id: string | null) =>
  useQuery({
    queryKey: branchKeys.detail(id!),
    queryFn: async () => {
      const response = await branchApiClient.getBranchById(id!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch branch')
      return response.data
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  })

// ─── useNearbyBranches ────────────────────────────────────────────────────────

export const useNearbyBranches = (
  latitude: number | null,
  longitude: number | null,
  radiusKm: number = 10,
  enabled: boolean = true
) =>
  useQuery({
    queryKey: branchKeys.nearby(latitude!, longitude!, radiusKm),
    queryFn: async () => {
      const response = await branchApiClient.getNearbyBranches(latitude!, longitude!, radiusKm)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch nearby branches')
      return response.data
    },
    enabled: !!latitude && !!longitude && enabled,
    staleTime: 1000 * 60 * 2, // 2 minutes
  })

// ─── useBranchInventory ───────────────────────────────────────────────────────

export const useBranchInventory = (branchId: string | null, enabled: boolean = true) =>
  useQuery({
    queryKey: branchKeys.inventory(branchId!),
    queryFn: async () => {
      const response = await branchApiClient.getBranchInventory(branchId!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch branch inventory')
      return response.data as BranchInventoryItem[]
    },
    enabled: !!branchId && enabled,
    staleTime: 1000 * 60 * 2,
  })

// ─── useBranchStats ───────────────────────────────────────────────────────────

export const useBranchStats = (branchId: string | null, enabled: boolean = true) =>
  useQuery({
    queryKey: branchKeys.stats(branchId!),
    queryFn: async () => {
      const response = await branchApiClient.getBranchStats(branchId!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch branch stats')
      return response.data as BranchStats
    },
    enabled: !!branchId && enabled,
    staleTime: 1000 * 60 * 1, // 1 minute
    refetchInterval: 30000, // Refetch every 30 seconds for real-time stats
  })

// ─── useCreateBranch ──────────────────────────────────────────────────────────

export const useCreateBranch = () => {
  const queryClient = useQueryClient()
  const { setCreateModalOpen } = useBranchUIStore()

  return useMutation({
    mutationFn: (data: BranchCreateInput) => branchApiClient.createBranch(data),

    onSuccess: (response) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to create branch')

      const newBranch = response.data

      if (newBranch?.id) {
        queryClient.setQueryData(branchKeys.detail(newBranch.id), newBranch)
      }

      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
      setCreateModalOpen(false)
    },
  })
}

// ─── useUpdateBranch ──────────────────────────────────────────────────────────

export const useUpdateBranch = () => {
  const queryClient = useQueryClient()
  const { setEditModalOpen, setSelectedBranch } = useBranchUIStore()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: BranchUpdateInput }) =>
      branchApiClient.updateBranch(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: branchKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: branchKeys.lists() })

      const previousBranch = queryClient.getQueryData<Branch>(branchKeys.detail(id))

      if (previousBranch) {
        const optimistic: Branch = {
          ...previousBranch,
          ...data,
          updatedAt: new Date().toISOString(),
        }

        queryClient.setQueryData(branchKeys.detail(id), optimistic)

        queryClient.setQueriesData<BranchesResponse>(
          { queryKey: branchKeys.lists() },
          (old) => {
            if (!old) return old
            return {
              ...old,
              branches: old.branches.map((b) => b.id === id ? optimistic : b),
            }
          },
        )

        setSelectedBranch(optimistic)
      }

      return { previousBranch }
    },

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to update branch')

      const updated = response.data
      if (updated) {
        queryClient.setQueryData(branchKeys.detail(variables.id), updated)
        setSelectedBranch(updated)
      }

      setEditModalOpen(false)
    },

    onError: (_err, variables, context) => {
      if (context?.previousBranch) {
        queryClient.setQueryData(branchKeys.detail(variables.id), context.previousBranch)
        queryClient.setQueriesData<BranchesResponse>(
          { queryKey: branchKeys.lists() },
          (old) => {
            if (!old) return old
            return {
              ...old,
              branches: old.branches.map((b) =>
                b.id === variables.id ? context.previousBranch! : b
              ),
            }
          },
        )
        setSelectedBranch(context.previousBranch)
      }
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
      queryClient.invalidateQueries({ queryKey: branchKeys.detail(variables.id) })
    },
  })
}

// ─── useDeleteBranch ──────────────────────────────────────────────────────────

export const useDeleteBranch = () => {
  const queryClient = useQueryClient()
  const { setDeleteDialogOpen, clearSelectedBranchIds } = useBranchUIStore()

  return useMutation({
    mutationFn: ({ id, permanent = false }: { id: string; permanent?: boolean }) =>
      branchApiClient.deleteBranch(id, permanent),

    onMutate: async ({ id, permanent }) => {
      await queryClient.cancelQueries({ queryKey: branchKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: branchKeys.lists() })

      const previousBranch = queryClient.getQueryData<Branch>(branchKeys.detail(id))

      if (permanent) {
        queryClient.removeQueries({ queryKey: branchKeys.detail(id) })
      } else if (previousBranch) {
        queryClient.setQueryData<Branch>(branchKeys.detail(id), {
          ...previousBranch,
          isActive: false,
        })
      }

      queryClient.setQueriesData<BranchesResponse>(
        { queryKey: branchKeys.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            branches: old.branches.filter((b) => b.id !== id),
            pagination: old.pagination
              ? { ...old.pagination, total: Math.max(0, old.pagination.total - 1) }
              : null,
          }
        },
      )

      return { previousBranch }
    },

    onSuccess: (response) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to delete branch')
      setDeleteDialogOpen(false)
      clearSelectedBranchIds()
    },

    onError: (_err, variables, context) => {
      if (context?.previousBranch) {
        queryClient.setQueryData(branchKeys.detail(variables.id), context.previousBranch)
      }
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: branchKeys.lists() })
      if (!variables.permanent) {
        queryClient.invalidateQueries({ queryKey: branchKeys.detail(variables.id) })
      }
    },
  })
}

// ─── useSelectBranch ──────────────────────────────────────────────────────────

export const useSelectBranch = () => {
  const queryClient = useQueryClient()
  const { setSelectedBranch, setEditModalOpen } = useBranchUIStore()

  return useCallback((id: string) => {
    const cached = queryClient.getQueryData<Branch>(branchKeys.detail(id))
    if (cached) setSelectedBranch(cached)
    setEditModalOpen(true)
  }, [queryClient, setSelectedBranch, setEditModalOpen])
}