// hooks/use-suppliers.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  supplierApiClient,
  type Supplier,
  type SupplierFilter,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type UpdateSupplierStatusInput,
  type VerifySupplierInput,
  type SupplierProductInput,
} from '@/lib/supplier.api';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const supplierKeys = {
  all:      ['suppliers'] as const,
  lists:    () => [...supplierKeys.all, 'list'] as const,
  list:     (filters?: object) => [...supplierKeys.lists(), filters] as const,
  approved: () => [...supplierKeys.all, 'approved'] as const,
  details:  () => [...supplierKeys.all, 'detail'] as const,
  detail:   (id: string) => [...supplierKeys.details(), id] as const,
  byUser:   (userId: string) => [...supplierKeys.all, 'user', userId] as const,
  stats:    () => [...supplierKeys.all, 'stats'] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function throwIfFailed<T>(response: { success: boolean; errors?: { message: string }[] }, fallback: string): void {
  if (!response.success) {
    throw new Error(response.errors?.[0]?.message || fallback);
  }
}

function invalidateSupplierLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: supplierKeys.lists()    });
  queryClient.invalidateQueries({ queryKey: supplierKeys.approved() });
  queryClient.invalidateQueries({ queryKey: supplierKeys.stats()    });
}

// ─── useSuppliers (approved — for product forms) ──────────────────────────────

export const useSuppliers = () => {
  return useQuery({
    queryKey: supplierKeys.approved(),
    queryFn:  async () => {
      const response = await supplierApiClient.getSuppliers(
        { status: 'ACTIVE' },
        1, 100
      );
      throwIfFailed(response, 'Failed to fetch suppliers');
      return response.data?.suppliers ?? [] as Supplier[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ─── useSuppliersList (paginated — for management pages) ──────────────────────

export const useSuppliersList = (
  filters?: SupplierFilter,
  page:     number = 1,
  limit:    number = 20
) => {
  return useQuery({
    queryKey: supplierKeys.list({ ...filters, page, limit }),
    queryFn:  async () => {
      const response = await supplierApiClient.getSuppliers(filters, page, limit);
      throwIfFailed(response, 'Failed to fetch suppliers');
      return response.data;
    },
  });
};

// ─── useSupplier (single by id) ───────────────────────────────────────────────

export const useSupplier = (id: string | null) => {
  return useQuery({
    queryKey: supplierKeys.detail(id!),
    queryFn:  async () => {
      const response = await supplierApiClient.getSupplierById(id!);
      throwIfFailed(response, 'Failed to fetch supplier');
      return response.data as Supplier;
    },
    enabled:   !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// ─── useSupplierByUser ────────────────────────────────────────────────────────

export const useSupplierByUser = (userId: string | null) => {
  return useQuery({
    queryKey: supplierKeys.byUser(userId!),
    queryFn:  async () => {
      const response = await supplierApiClient.getSupplierByUserId(userId!);
      throwIfFailed(response, 'Failed to fetch supplier');
      return response.data as Supplier;
    },
    enabled:   !!userId,
    staleTime: 5 * 60 * 1000,
  });
};

// ─── useSupplierStats ─────────────────────────────────────────────────────────

export const useSupplierStats = () => {
  return useQuery({
    queryKey: supplierKeys.stats(),
    queryFn:  async () => {
      const response = await supplierApiClient.getSupplierStats();
      throwIfFailed(response, 'Failed to fetch supplier stats');
      return response.data;
    },
    staleTime: 60 * 1000,
  });
};

// ─── useCreateSupplier ────────────────────────────────────────────────────────

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSupplierInput) =>
      supplierApiClient.createSupplier(data),
    onSuccess: (response) => {
      throwIfFailed(response, 'Failed to create supplier');
      const newSupplier = response.data as Supplier;
      queryClient.setQueryData(supplierKeys.detail(newSupplier.id), newSupplier);
      invalidateSupplierLists(queryClient);
      toast.success('Supplier created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create supplier');
    },
  });
};

// ─── useUpdateSupplier ────────────────────────────────────────────────────────

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierInput }) =>
      supplierApiClient.updateSupplier(id, data),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to update supplier');
      queryClient.setQueryData(supplierKeys.detail(variables.id), response.data);
      invalidateSupplierLists(queryClient);
      toast.success('Supplier updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update supplier');
    },
  });
};

// ─── useUpdateSupplierStatus ──────────────────────────────────────────────────

export const useUpdateSupplierStatus = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSupplierStatusInput }) =>
      supplierApiClient.updateSupplierStatus(id, data),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to update supplier status');
      queryClient.setQueryData(supplierKeys.detail(variables.id), response.data);
      invalidateSupplierLists(queryClient);
      toast.success(`Supplier ${variables.data.status.toLowerCase()} successfully`);
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update supplier status');
    },
  });
};

// ─── useVerifySupplier ────────────────────────────────────────────────────────

export const useVerifySupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data?: VerifySupplierInput }) =>
      supplierApiClient.verifySupplier(id, data),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to verify supplier');
      queryClient.setQueryData(supplierKeys.detail(variables.id), response.data);
      invalidateSupplierLists(queryClient);
      toast.success('Supplier verified successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to verify supplier');
    },
  });
};

// ─── useApproveSupplier (shortcut for status update) ─────────────────────────

export const useApproveSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      supplierApiClient.updateSupplierStatus(id, { status: 'ACTIVE' }),
    onSuccess: (response, id) => {
      throwIfFailed(response, 'Failed to approve supplier');
      queryClient.setQueryData(supplierKeys.detail(id), response.data);
      invalidateSupplierLists(queryClient);
      toast.success('Supplier approved successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to approve supplier');
    },
  });
};

// ─── useSuspendSupplier (shortcut for status update) ─────────────────────────

export const useSuspendSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      supplierApiClient.updateSupplierStatus(id, { status: 'SUSPENDED', reason }),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to suspend supplier');
      queryClient.setQueryData(supplierKeys.detail(variables.id), response.data);
      invalidateSupplierLists(queryClient);
      toast.success('Supplier suspended successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to suspend supplier');
    },
  });
};

// ─── useDeleteSupplier ────────────────────────────────────────────────────────

export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, permanent = false }: { id: string; permanent?: boolean }) =>
      supplierApiClient.deleteSupplier(id, permanent),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to delete supplier');
      queryClient.removeQueries({ queryKey: supplierKeys.detail(variables.id) });
      invalidateSupplierLists(queryClient);
      toast.success('Supplier deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete supplier');
    },
  });
};

// ─── useAddSupplierProducts ───────────────────────────────────────────────────

export const useAddSupplierProducts = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      supplierId,
      products,
    }: {
      supplierId: string;
      products:   Omit<SupplierProductInput, 'supplierId'>[];
    }) => supplierApiClient.addSupplierProducts(supplierId, products),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to add products to supplier');
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      toast.success('Products added to supplier successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to add products to supplier');
    },
  });
};

// ─── useRemoveSupplierProduct ─────────────────────────────────────────────────

export const useRemoveSupplierProduct = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ supplierId, productId }: { supplierId: string; productId: string }) =>
      supplierApiClient.removeSupplierProduct(supplierId, productId),
    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to remove product from supplier');
      queryClient.invalidateQueries({ queryKey: supplierKeys.detail(variables.supplierId) });
      toast.success('Product removed from supplier successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to remove product from supplier');
    },
  });
};