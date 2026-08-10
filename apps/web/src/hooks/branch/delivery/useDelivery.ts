// hooks/use-deliveries.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback, useMemo } from 'react'
import type {
  Delivery,
  DeliveryCreateInput,
  DeliveryUpdateInput,
  DeliveryFilterInput,
  DeliveryStatus,
} from '@/types/branch/delivery/delivery-types'
import { deliveryApiClient } from '@/lib/branch/delivery/delivery.api'
import { useDeliveryUIStore } from '@/hooks/zustand/stores/branch/delivery/delivery-store'
import { toast } from 'sonner'

// ─── Query Keys ───────────────────────────────────────────────────────────────
export const deliveryKeys = {
  all: ['deliveries'] as const,
  lists: () => [...deliveryKeys.all, 'list'] as const,
  list: (
    filters: DeliveryFilterInput,
    page: number,
    limit: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => {
    const stableFilters = (Object.keys(filters ?? {}) as Array<keyof DeliveryFilterInput>)
      .sort()
      .reduce((acc, key) => {
        const value = filters[key]
        if (value !== undefined && value !== null) acc[key] = value as never
        return acc
      }, {} as Partial<DeliveryFilterInput>)

    return [...deliveryKeys.lists(), { filters: stableFilters, page, limit, sortBy, sortOrder }] as const
  },
  details: () => [...deliveryKeys.all, 'detail'] as const,
  detail: (id: string) => [...deliveryKeys.details(), id] as const,
  tracking: (trackingCode: string) => [...deliveryKeys.all, 'tracking', trackingCode] as const,
  stats: (filters?: Record<string, any>) => [...deliveryKeys.all, 'stats', filters] as const,
  driverPerformance: (driverId: string, period?: { from: Date; to: Date }) =>
    [...deliveryKeys.all, 'driver', driverId, 'performance', period] as const,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeliveriesResponse {
  deliveries: Delivery[]
  pagination: { page: number; limit: number; total: number; totalPages: number } | null
}

export interface AssignOrderToDeliveryInput {
  orderId: string;
  branchId: string;
  driverId: string;
  notes?: string;
}
export interface DeliveryStats {
  total: number
  byStatus: Record<string, number>
  successRate: number
  averageRating: number
  averageDeliveryTime: number
  ratingBreakdown: {
    speed: number
    condition: number
    courtesy: number
  }
}

export interface DriverPerformance {
  totalDeliveries: number
  completedDeliveries: number
  completionRate: number
  averageRating: number
  totalRatings: number
  averageDeliveryTime: number
  statusBreakdown: Record<string, number>
}

export interface DeliveryRatingInput {
  overallRating: number
  speedRating?: number
  conditionRating?: number
  courtesyRating?: number
  comment?: string
}

// ─── useDeliveries ────────────────────────────────────────────────────────────

export interface UseDeliveriesOptions {
  filters?: DeliveryFilterInput
  page?: number
  limit?: number
  sortBy?: string
  sortOrder?: 'asc' | 'desc'
  enabled?: boolean
  staleTime?: number
  refetchInterval?: number | false
}


export const useDeliveries = (options: UseDeliveriesOptions = {}) => {
  const {
    filters = {},
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    enabled = true,
    staleTime = 1000 * 60, // ← increased to 60s to reduce fetches
    refetchInterval = false, // ← disabled by default, enable explicitly if needed
  } = options

  //  Stable filter reference — prevents new object identity on every render
  const stableFilters = useMemo(() => {
    return (Object.keys(filters) as Array<keyof DeliveryFilterInput>)
      .sort()
      .reduce((acc, key) => {
        const value = filters[key]
        if (value !== undefined && value !== null) acc[key] = value as never
        return acc
      }, {} as Partial<DeliveryFilterInput>)
  }, [
    //  Explicitly list primitives so memo only breaks when values actually change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters),
  ])

  return useQuery({
    queryKey: deliveryKeys.list(stableFilters, page, limit, sortBy, sortOrder),
    queryFn: async () => {
      const response = await deliveryApiClient.getDeliveries(stableFilters, page, limit, sortBy, sortOrder)
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch deliveries')
      }
      return {
        deliveries: response.data?.deliveries ?? [],
        pagination: response.data?.pagination ?? null,
      } satisfies DeliveriesResponse
    },
    enabled,
    staleTime,
    gcTime: 1000 * 60 * 5,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
    refetchOnWindowFocus: false, // ← prevents refetch on tab switch
    refetchInterval,
  })
}


// ─── useDelivery ──────────────────────────────────────────────────────────────

export const useDelivery = (id: string | null) =>
  useQuery({
    queryKey: deliveryKeys.detail(id!),
    queryFn: async () => {
      const response = await deliveryApiClient.getDeliveryById(id!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch delivery')
      return response.data
    },
    enabled: !!id,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false, // ← prevents refetch on tab switch
    refetchInterval: false, // ← only refetch when status is active (handle at call site)
  })

// ─── useDeliveryByTracking ────────────────────────────────────────────────────

export const useDeliveryByTracking = (trackingCode: string | null, enabled: boolean = true) =>
  useQuery({
    queryKey: deliveryKeys.tracking(trackingCode!),
    queryFn: async () => {
      const response = await deliveryApiClient.getDeliveryByTrackingCode(trackingCode!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch delivery')
      return response.data
    },
    enabled: !!trackingCode && enabled,
    staleTime: 1000 * 60,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })

// ─── useDeliveryStats ─────────────────────────────────────────────────────────

export const useDeliveryStats = (filters?: {
  branchId?: string
  driverId?: string
  dateFrom?: Date | string
  dateTo?: Date | string
}) => {
  //  Stable filter reference for stats too
  const stableFilters = useMemo(() => filters, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    JSON.stringify(filters),
  ])

  return useQuery({
    queryKey: deliveryKeys.stats(stableFilters),
    queryFn: async () => {
      const response = await deliveryApiClient.getDeliveryStats(stableFilters)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch delivery stats')
      return response.data as DeliveryStats
    },
    staleTime: 1000 * 60 * 2, // ← 2 min, stats don't need to be real-time
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
}

// ─── useDriverPerformance ─────────────────────────────────────────────────────

export const useDriverPerformance = (
  driverId: string | null,
  period?: { from: Date; to: Date }
) => {
  //  Stable period reference
  const stablePeriod = useMemo(() => period, [
    // eslint-disable-next-line react-hooks/exhaustive-deps
    period?.from?.toISOString(),
    period?.to?.toISOString(),
  ])

  return useQuery({
    queryKey: deliveryKeys.driverPerformance(driverId!, stablePeriod),
    queryFn: async () => {
      const response = await deliveryApiClient.getDriverPerformance(driverId!, stablePeriod)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch driver performance')
      return response.data as DriverPerformance
    },
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5,
    refetchOnWindowFocus: false,
    refetchInterval: false,
  })
}

// ─── useDeleteDelivery ────────────────────────────────────────────────────────

export const useDeleteDelivery = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, permanent }: { id: string; permanent?: boolean }) =>
      deliveryApiClient.deleteDelivery(id, permanent),

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to delete delivery')
      queryClient.removeQueries({ queryKey: deliveryKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.stats() })
    },
  })
}

// ─── useCreateDelivery ────────────────────────────────────────────────────────

export const useCreateDelivery = () => {
  const queryClient = useQueryClient()
  const { setCreateModalOpen } = useDeliveryUIStore()

  return useMutation({
    mutationFn: (data: DeliveryCreateInput) => deliveryApiClient.createDelivery(data),

    onSuccess: (response) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to create delivery')

      const newDelivery = response.data

      if (newDelivery?.id) {
        queryClient.setQueryData(deliveryKeys.detail(newDelivery.id), newDelivery)
      }
      if (newDelivery?.trackingCode) {
        queryClient.setQueryData(deliveryKeys.tracking(newDelivery.trackingCode), newDelivery)
      }

      queryClient.invalidateQueries({ queryKey: deliveryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.stats() })
      setCreateModalOpen(false)
    },
  })
}

// ─── useUpdateDelivery ────────────────────────────────────────────────────────

export const useUpdateDelivery = () => {
  const queryClient = useQueryClient()
  const { setEditModalOpen, setSelectedDelivery } = useDeliveryUIStore()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeliveryUpdateInput }) =>
      deliveryApiClient.updateDelivery(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: deliveryKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: deliveryKeys.lists() })

      const previousDelivery = queryClient.getQueryData<Delivery>(deliveryKeys.detail(id))

      if (previousDelivery) {
        const optimistic: Delivery = {
          ...previousDelivery,
          ...data,
          updatedAt: new Date().toISOString(),
        }

        queryClient.setQueryData(deliveryKeys.detail(id), optimistic)

        if (previousDelivery.trackingCode) {
          queryClient.setQueryData(deliveryKeys.tracking(previousDelivery.trackingCode), optimistic)
        }

        queryClient.setQueriesData<DeliveriesResponse>(
          { queryKey: deliveryKeys.lists() },
          (old) => {
            if (!old) return old
            return {
              ...old,
              deliveries: old.deliveries.map((d) => d.id === id ? optimistic : d),
            }
          },
        )

        setSelectedDelivery(optimistic)
      }

      return { previousDelivery }
    },

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to update delivery')

      const updated = response.data
      if (updated) {
        queryClient.setQueryData(deliveryKeys.detail(variables.id), updated)
        if (updated.trackingCode) {
          queryClient.setQueryData(deliveryKeys.tracking(updated.trackingCode), updated)
        }
        setSelectedDelivery(updated)
      }

      setEditModalOpen(false)
    },

    onError: (_err, variables, context) => {
      if (context?.previousDelivery) {
        queryClient.setQueryData(deliveryKeys.detail(variables.id), context.previousDelivery)
        queryClient.setQueriesData<DeliveriesResponse>(
          { queryKey: deliveryKeys.lists() },
          (old) => {
            if (!old) return old
            return {
              ...old,
              deliveries: old.deliveries.map((d) =>
                d.id === variables.id ? context.previousDelivery! : d
              ),
            }
          },
        )
        setSelectedDelivery(context.previousDelivery)
      }
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.stats() })
    },
  })
}




// ─── useAssignDriver ──────────────────────────────────────────────────────────

export const useAssignDriver = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ deliveryId, driverId }: { deliveryId: string; driverId: string }) =>
      deliveryApiClient.assignDriver(deliveryId, driverId),

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to assign driver')
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(variables.deliveryId) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.lists() })
    },
  })
}

// ─── useUpdateDeliveryStatus ──────────────────────────────────────────────────

export const useUpdateDeliveryStatus = () => {
  const queryClient = useQueryClient();
  const { setSelectedDelivery } = useDeliveryUIStore();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: DeliveryUpdateInput }) =>
      deliveryApiClient.updateDeliveryStatus(id, data),

    onSuccess: (response, variables) => {
      if (!response.success)
        throw new Error(response.errors?.[0]?.message ?? "Failed to update status");

      const updated = response.data;
      if (updated) {
        queryClient.setQueryData(deliveryKeys.detail(variables.id), updated);
        if (updated.trackingCode) {
          queryClient.setQueryData(
            deliveryKeys.tracking(updated.trackingCode),
            updated
          );
        }
        setSelectedDelivery(updated);
      }
    },

    onError: (err) => {
      toast.error("Failed to update delivery status");
      console.error("Status update error:", err);
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: deliveryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(variables.id) });
      queryClient.invalidateQueries({ queryKey: deliveryKeys.stats() });
      // Also invalidate orders since delivery status syncs order status + payment
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    },
  });
};
// ─── useRateDelivery ──────────────────────────────────────────────────────────

export const useRateDelivery = () => {
  const queryClient = useQueryClient()
  const { setRatingModalOpen } = useDeliveryUIStore()

  return useMutation({
    mutationFn: ({ deliveryId, rating }: { deliveryId: string; rating: DeliveryRatingInput }) =>
      deliveryApiClient.rateDelivery(deliveryId, rating),

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to rate delivery')
      queryClient.invalidateQueries({ queryKey: deliveryKeys.detail(variables.deliveryId) })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.lists() })
      queryClient.invalidateQueries({ queryKey: deliveryKeys.stats() })
      setRatingModalOpen(false)
    },
  })
}

// ─── useSelectDelivery ────────────────────────────────────────────────────────

export const useSelectDelivery = () => {
  const queryClient = useQueryClient()
  const { setSelectedDelivery, setEditModalOpen } = useDeliveryUIStore()

  return useCallback((id: string) => {
    const cached = queryClient.getQueryData<Delivery>(deliveryKeys.detail(id))
    if (cached) setSelectedDelivery(cached)
    setEditModalOpen(true)
  }, [queryClient, setSelectedDelivery, setEditModalOpen])
}



//assign deliveries


