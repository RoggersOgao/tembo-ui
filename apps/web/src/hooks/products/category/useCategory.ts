// hooks/use-categories.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  categoryApiClient,
  type Category,
  type CategoryTreeNode,
  type CreateCategoryInput,
  type UpdateCategoryInput,
  type CategoryQueryOptions,
  type CategoryTreeOptions,
  type CategoryDetailOptions,
  type PropertiesInCategoryOptions,
  type ReorderItem,
  type BreadcrumbItem,
  type CategoryStatistics,
  CategoryWithProductsOptions,
  CategoryWithProductsNode,
} from '@/lib/products/categories/category.api';

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const categoryKeys = {
  all:         ['categories'] as const,
  lists:       () => [...categoryKeys.all, 'list'] as const,
  list:        (options?: CategoryQueryOptions) => [...categoryKeys.lists(), options] as const,
  tree:        (options?: CategoryTreeOptions) => [...categoryKeys.all, 'tree', options] as const,
  details:     () => [...categoryKeys.all, 'detail'] as const,
  detail:      (id: string) => [...categoryKeys.details(), id] as const,
  breadcrumb:  (id: string) => [...categoryKeys.all, 'breadcrumb', id] as const,
  statistics:  () => [...categoryKeys.all, 'statistics'] as const,
  properties:  (id: string, options?: PropertiesInCategoryOptions) =>
    [...categoryKeys.all, 'properties', id, options] as const,
  withProducts: (options?: CategoryWithProductsOptions) =>
    ['categories', 'with-products', options] as const,
};

// ─── useCategories (list) ─────────────────────────────────────────────────────

export const useCategories = (options?: CategoryQueryOptions) => {
  return useQuery({
    queryKey: categoryKeys.list(options),
    queryFn:  async () => {
      const result = await categoryApiClient.getAll(options);
      if (!result?.data) throw new Error('Invalid response from API');
      return result.data as Category[];
    },
    staleTime: 5 * 60 * 1000, // 5 min — categories rarely change
  });
};

// ─── useCategoryTree ──────────────────────────────────────────────────────────

export const useCategoryTree = (options?: CategoryTreeOptions) => {
  return useQuery({
    queryKey: categoryKeys.tree(options),
    queryFn:  async () => {
      const result = await categoryApiClient.getTree(options);
      if (!result?.data) throw new Error('Invalid response from API');
      return result.data as CategoryTreeNode[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// useCategory.ts
export const useCategoriesWithProducts = (options?: CategoryWithProductsOptions) => {
  return useQuery({
    queryKey: categoryKeys.withProducts(options),
    queryFn: async () => {
      const result = await categoryApiClient.getCategoriesWithProducts(options);
      if (!result?.data) throw new Error('Invalid response from API');
      return result.data as CategoryWithProductsNode[];
    },
    staleTime: 5 * 60 * 1000,
  });
};

// ─── useCategory (single) ─────────────────────────────────────────────────────

export const useCategory = (id: string | null, options?: CategoryDetailOptions) => {
  return useQuery({
    queryKey: categoryKeys.detail(id!),
    queryFn:  async () => {
      const result = await categoryApiClient.getById(id!, options);
      if (!result?.data) throw new Error('Category not found');
      return result.data as Category;
    },
    enabled:   !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// ─── useCategoryBreadcrumb ────────────────────────────────────────────────────

export const useCategoryBreadcrumb = (id: string | null) => {
  return useQuery({
    queryKey: categoryKeys.breadcrumb(id!),
    queryFn:  async () => {
      const result = await categoryApiClient.getBreadcrumb(id!);
      if (!result?.data) throw new Error('Invalid response from API');
      return result.data as BreadcrumbItem[];
    },
    enabled:   !!id,
    staleTime: 5 * 60 * 1000,
  });
};

// ─── useCategoryStatistics ────────────────────────────────────────────────────

export const useCategoryStatistics = () => {
  return useQuery({
    queryKey: categoryKeys.statistics(),
    queryFn:  async () => {
      const result = await categoryApiClient.getStatistics();
      if (!result?.data) throw new Error('Invalid response from API');
      return result.data as CategoryStatistics;
    },
    staleTime: 60 * 1000, // 1 min
  });
};

// ─── usePropertiesInCategory ──────────────────────────────────────────────────

export const usePropertiesInCategory = (
  id:       string | null,
  options?: PropertiesInCategoryOptions
) => {
  return useQuery({
    queryKey: categoryKeys.properties(id!, options),
    queryFn:  async () => {
      const result = await categoryApiClient.getPropertiesInCategory(id!, options);
      if (!result?.data) throw new Error('Invalid response from API');
      return {
        properties: result.data,
        pagination: result.pagination ?? null,
      };
    },
    enabled: !!id,
  });
};

// ─── useCreateCategory ────────────────────────────────────────────────────────

export const useCreateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: CreateCategoryInput) => categoryApiClient.create(input),
    onSuccess: (result) => {
      if (!result?.data) throw new Error('Invalid response from API');

      // Invalidate all lists and trees so they refetch with the new category
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree() });

      // Seed the detail cache immediately
      queryClient.setQueryData(categoryKeys.detail(result.data.id), result.data);

      toast.success('Category created successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create category');
    },
  });
};

// ─── useUpdateCategory ────────────────────────────────────────────────────────

export const useUpdateCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: UpdateCategoryInput }) =>
      categoryApiClient.update(id, input),
    onSuccess: (result, variables) => {
      if (!result?.data) throw new Error('Invalid response from API');

      // Update the detail cache immediately
      queryClient.setQueryData(categoryKeys.detail(variables.id), result.data);

      // Invalidate lists/trees so they reflect the updated name/slug/order
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree()  });

      toast.success('Category updated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update category');
    },
  });
};

// ─── useDeleteCategory ────────────────────────────────────────────────────────

export const useDeleteCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => categoryApiClient.delete(id),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: categoryKeys.detail(id) });
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree()  });

      toast.success('Category deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete category');
    },
  });
};

// ─── useRestoreCategory ───────────────────────────────────────────────────────

export const useRestoreCategory = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => categoryApiClient.restore(id),
    onSuccess: (result, id) => {
      if (!result?.data) throw new Error('Invalid response from API');

      queryClient.setQueryData(categoryKeys.detail(id), result.data);
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree()  });

      toast.success('Category restored successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to restore category');
    },
  });
};

// ─── useReorderCategories ─────────────────────────────────────────────────────

export const useReorderCategories = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (items: ReorderItem[]) => categoryApiClient.reorder(items),
    onSuccess: () => {
      // Reorder affects the full list and tree ordering
      queryClient.invalidateQueries({ queryKey: categoryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: categoryKeys.tree()  });

      toast.success('Categories reordered successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to reorder categories');
    },
  });
};