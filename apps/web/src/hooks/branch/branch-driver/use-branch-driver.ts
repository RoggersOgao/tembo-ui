import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type {
  BranchDriverAssignmentResponse,
  BranchDriverFilterInput,
  AssignDriverInput,
  BulkAssignInput,
  UpdateDriverAssignmentInput,
  BranchDriverStats,
  AvailableDriver,
  DriverBranch,
} from '@/types/branch/branch-driver/branch-driver-types';
import { branchDriverApiClient } from '@/lib/branch/branch-driver/branch-driver.api';
import { useBranchDriverUIStore } from '@/hooks/zustand/stores/branch/branch-driver/branch-driver.store';


// ─── Query Keys ───────────────────────────────────────────────────────────────

export const branchDriverKeys = {
  all: ['branch-drivers'] as const,
  lists: () => [...branchDriverKeys.all, 'list'] as const,
  list: (
    filters: BranchDriverFilterInput,
    page: number,
    limit: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => {
    const stableFilters = (Object.keys(filters ?? {}) as Array<keyof BranchDriverFilterInput>)
      .sort()
      .reduce((acc, key) => {
        const value = filters[key];
        if (value !== undefined && value !== null) acc[key] = value as never;
        return acc;
      }, {} as Partial<BranchDriverFilterInput>);

    return [...branchDriverKeys.lists(), { filters: stableFilters, page, limit, sortBy, sortOrder }] as const;
  },
  details: () => [...branchDriverKeys.all, 'detail'] as const,
  detail: (id: string) => [...branchDriverKeys.details(), id] as const,
  driverBranches: (driverId: string, includeInactive?: boolean) => 
    [...branchDriverKeys.all, 'driver', driverId, 'branches', { includeInactive }] as const,
  driverPrimary: (driverId: string) => 
    [...branchDriverKeys.all, 'driver', driverId, 'primary'] as const,
  branchStats: (branchId: string) => 
    [...branchDriverKeys.all, 'branch', branchId, 'stats'] as const,
  availableDrivers: (branchId: string, search?: string) => 
    [...branchDriverKeys.all, 'available', branchId, { search }] as const,
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AssignmentsListResponse {
  assignments: BranchDriverAssignmentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  filters: BranchDriverFilterInput;
}

// ─── useBranchDrivers ─────────────────────────────────────────────────────────

export interface UseBranchDriversOptions {
  filters?: BranchDriverFilterInput;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  enabled?: boolean;
  staleTime?: number;
}

export const useBranchDrivers = (options: UseBranchDriversOptions = {}) => {
  const {
    filters = {},
    page = 1,
    limit = 20,
    sortBy = 'createdAt',
    sortOrder = 'desc',
    enabled = true,
    staleTime = 1000 * 60 * 5, // 5 minutes
  } = options;

  return useQuery({
    queryKey: branchDriverKeys.list(filters, page, limit, sortBy, sortOrder),
    queryFn: async () => {
      const response = await branchDriverApiClient.getAssignments(filters, page, limit, sortBy, sortOrder);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch assignments');
      }
      return {
        assignments: response.data?.assignments ?? [],
        total: response.data?.total ?? 0,
        page: response.data?.page ?? page,
        limit: response.data?.limit ?? limit,
        totalPages: response.data?.totalPages ?? 0,
        filters: response.data?.filters ?? filters,
      } satisfies AssignmentsListResponse;
    },
    enabled,
    staleTime,
    gcTime: 1000 * 60 * 10,
    placeholderData: (prev) => prev,
    refetchOnMount: true,
  });
};

// ─── useAssignment ────────────────────────────────────────────────────────────

export const useAssignment = (id: string | null) =>
  useQuery({
    queryKey: branchDriverKeys.detail(id!),
    queryFn: async () => {
      const response = await branchDriverApiClient.getAssignmentById(id!);
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch assignment');
      return response.data;
    },
    enabled: !!id,
    staleTime: 1000 * 60 * 5,
  });

// ─── useDriverBranches ────────────────────────────────────────────────────────

export const useDriverBranches = (driverId: string | null, includeInactive: boolean = false) =>
  useQuery({
    queryKey: branchDriverKeys.driverBranches(driverId!, includeInactive),
    queryFn: async () => {
      const response = await branchDriverApiClient.getDriverBranches(driverId!, includeInactive);
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch driver branches');
      return response.data;
    },
    enabled: !!driverId,
    staleTime: 1000 * 60 * 2,
  });

// ─── useDriverPrimaryBranch ───────────────────────────────────────────────────

export const useDriverPrimaryBranch = (driverId: string | null) =>
  useQuery({
    queryKey: branchDriverKeys.driverPrimary(driverId!),
    queryFn: async () => {
      const response = await branchDriverApiClient.getDriverPrimaryBranch(driverId!);
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch primary branch');
      return response.data;
    },
    enabled: !!driverId,
    staleTime: 1000 * 60 * 5,
  });

// ─── useBranchDriverStats ─────────────────────────────────────────────────────

export const useBranchDriverStats = (branchId: string | null, enabled: boolean = true) =>
  useQuery({
    queryKey: branchDriverKeys.branchStats(branchId!),
    queryFn: async () => {
      const response = await branchDriverApiClient.getBranchDriverStats(branchId!);
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch branch stats');
      return response.data;
    },
    enabled: !!branchId && enabled,
    staleTime: 1000 * 60 * 1,
    refetchInterval: 30000, // Refetch every 30 seconds
  });

// ─── useAvailableDrivers ──────────────────────────────────────────────────────

export const useAvailableDrivers = (branchId: string | null, search?: string, enabled: boolean = true) =>
  useQuery({
    queryKey: branchDriverKeys.availableDrivers(branchId!, search),
    queryFn: async () => {
      const response = await branchDriverApiClient.getAvailableDrivers(branchId!, search);
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch available drivers');
      return response.data;
    },
    enabled: !!branchId && enabled,
    staleTime: 1000 * 60 * 1,
  });

// ─── useAssignDriver ──────────────────────────────────────────────────────────

export const useAssignDriver = () => {
  const queryClient = useQueryClient();
  const { setAssignModalOpen } = useBranchDriverUIStore();

  return useMutation({
    mutationFn: (data: AssignDriverInput) => branchDriverApiClient.assignDriver(data),

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to assign driver');

      // Invalidate relevant queries
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverBranches(variables.driverId, false) });
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverPrimary(variables.driverId) });
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.branchStats(variables.branchId) });
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.availableDrivers(variables.branchId, undefined) });
      
      setAssignModalOpen(false);
    },
  });
};

// ─── useBulkAssignDrivers ─────────────────────────────────────────────────────

// In your hooks/branch-driver/use-branch-driver.ts
export const useBulkAssignDrivers = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({ driverIds, branchId, isPrimary }: BulkAssignInput) => {
            const response = await branchDriverApiClient.bulkAssignDrivers({
                driverIds,
                branchId,
                isPrimary,
            });
            
            if (!response.success) {
                throw new Error(response.errors?.[0]?.message ?? 'Failed to bulk assign drivers');
            }
            
            return response.data;
        },

        onSuccess: (data, variables) => {
            // Invalidate all relevant queries
            queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
            queryClient.invalidateQueries({ queryKey: branchDriverKeys.branchStats(variables.branchId) });
            queryClient.invalidateQueries({ queryKey: branchDriverKeys.availableDrivers(variables.branchId, undefined) });
            
            // Invalidate each driver's branches
            variables.driverIds.forEach(driverId => {
                queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverBranches(driverId, false) });
                queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverPrimary(driverId) });
            });
        },
    });
};

// ─── useUpdateAssignment ──────────────────────────────────────────────────────

export const useUpdateAssignment = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateDriverAssignmentInput }) =>
      branchDriverApiClient.updateAssignment(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: branchDriverKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: branchDriverKeys.lists() });

      const previousAssignment = queryClient.getQueryData<BranchDriverAssignmentResponse>(
        branchDriverKeys.detail(id)
      );

      if (previousAssignment) {
        const optimistic = {
          ...previousAssignment,
          ...data,
          updatedAt: new Date().toISOString(),
        };
        queryClient.setQueryData(branchDriverKeys.detail(id), optimistic);
      }

      return { previousAssignment };
    },

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to update assignment');

      const updated = response.data;
      if (updated) {
        queryClient.setQueryData(branchDriverKeys.detail(variables.id), updated);
        
        // Invalidate related queries
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverBranches(updated.driverId, false) });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverPrimary(updated.driverId) });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.branchStats(updated.branchId) });
      }
      
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
    },

    onError: (_err, variables, context) => {
      if (context?.previousAssignment) {
        queryClient.setQueryData(branchDriverKeys.detail(variables.id), context.previousAssignment);
      }
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.detail(variables.id) });
    },
  });
};

// ─── useRemoveAssignment ──────────────────────────────────────────────────────

export const useRemoveAssignment = () => {
  const queryClient = useQueryClient();
  const { setRemoveDialogOpen, clearSelectedAssignmentIds } = useBranchDriverUIStore();

  return useMutation({
    mutationFn: ({ id, permanent = false }: { id: string; permanent?: boolean }) =>
      branchDriverApiClient.removeAssignment(id, permanent),

    onMutate: async ({ id, permanent }) => {
      await queryClient.cancelQueries({ queryKey: branchDriverKeys.detail(id) });
      await queryClient.cancelQueries({ queryKey: branchDriverKeys.lists() });

      const previousAssignment = queryClient.getQueryData<BranchDriverAssignmentResponse>(
        branchDriverKeys.detail(id)
      );

      if (previousAssignment && !permanent) {
        // Optimistic update for soft delete
        queryClient.setQueryData<BranchDriverAssignmentResponse>(branchDriverKeys.detail(id), {
          ...previousAssignment,
          isActive: false,
        });
      } else if (permanent) {
        queryClient.removeQueries({ queryKey: branchDriverKeys.detail(id) });
      }

      return { previousAssignment };
    },

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to remove assignment');

      // Invalidate all caches
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
      
      if (response.data) {
        queryClient.invalidateQueries({ 
          queryKey: branchDriverKeys.driverBranches(response.data.id, false) 
        });
      }
      
      setRemoveDialogOpen(false);
      clearSelectedAssignmentIds();
    },

    onError: (_err, variables, context) => {
      if (context?.previousAssignment) {
        queryClient.setQueryData(branchDriverKeys.detail(variables.id), context.previousAssignment);
      }
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
      if (!variables.permanent) {
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.detail(variables.id) });
      }
    },
  });
};

// ─── useTransferDriver ────────────────────────────────────────────────────────

export const useTransferDriver = () => {
  const queryClient = useQueryClient();
  const { setTransferModalOpen } = useBranchDriverUIStore();

  return useMutation({
    mutationFn: ({ assignmentId, newBranchId }: { assignmentId: string; newBranchId: string }) =>
      branchDriverApiClient.transferDriver(assignmentId, newBranchId),

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to transfer driver');

      const assignment = response.data;
      if (assignment) {
        // Invalidate all related caches
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.lists() });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverBranches(assignment.driverId, false) });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.driverPrimary(assignment.driverId) });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.branchStats(assignment.branchId) });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.branchStats(variables.newBranchId) });
        queryClient.invalidateQueries({ queryKey: branchDriverKeys.availableDrivers(variables.newBranchId, undefined) });
      }
      
      setTransferModalOpen(false);
    },
  });
};

// ─── useSelectAssignment ──────────────────────────────────────────────────────

export const useSelectAssignment = () => {
  const queryClient = useQueryClient();
  const { setSelectedAssignment, setEditModalOpen } = useBranchDriverUIStore();

  return useCallback((id: string) => {
    const cached = queryClient.getQueryData<BranchDriverAssignmentResponse>(
      branchDriverKeys.detail(id)
    );
    if (cached) setSelectedAssignment(cached);
    setEditModalOpen(true);
  }, [queryClient, setSelectedAssignment, setEditModalOpen]);
};