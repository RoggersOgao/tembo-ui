// hooks/use-products.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCallback } from 'react'
import { productApiClient } from '@/lib/products/product-api'
import type {
  Product,
  ProductCreateInput,
  ProductUpdateInput,
  VariantInventoryInput,
  ProductFilterInput,
} from '@/types/products/product-types'
import { useProductUIStore } from '../zustand/stores/products/use-product-store'

// ─── Query Keys ───────────────────────────────────────────────────────────────

export const productKeys = {
  all:  ['products'] as const,
  lists: () => [...productKeys.all, 'list'] as const,
  list: (
    filters: ProductFilterInput,
    page: number,
    limit: number,
    sortBy?: string,
    sortOrder?: 'asc' | 'desc',
  ) => {
    const stableFilters = (Object.keys(filters ?? {}) as Array<keyof ProductFilterInput>)
      .sort()
      .reduce((acc, key) => {
        const value = filters[key]
        if (value !== undefined && value !== null) acc[key] = value as never
        return acc
      }, {} as Partial<ProductFilterInput>)

    return [...productKeys.lists(), { filters: stableFilters, page, limit, sortBy, sortOrder }] as const
  },
  details:      () => [...productKeys.all, 'detail'] as const,
  detail:       (id: string) => [...productKeys.details(), id] as const,
  detailBySlug: (slug: string) => [...productKeys.details(), 'slug', slug] as const,
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProductsResponse {
  products:   Product[]
  pagination: { page: number; limit: number; total: number; totalPages: number } | null
}

export interface SkuCheckData {
  exists: boolean
  sku:    string
}

// ─── useProducts ──────────────────────────────────────────────────────────────

export interface UseProductsOptions {
  filters?:   ProductFilterInput
  page?:      number
  limit?:     number
  sortBy?:    string
  sortOrder?: 'asc' | 'desc'
  enabled?:   boolean
  staleTime?: number
}

export const useProducts = (options: UseProductsOptions = {}) => {
  const {
    filters   = {},
    page      = 1,
    limit     = 20,
    sortBy    = 'createdAt',
    sortOrder = 'desc',
    enabled   = true,
    // 0 = always consider stale → always refetch on mount/focus.
    // Stock numbers must be accurate so we never serve cached product lists
    // to the storefront. Admin-heavy pages can pass a higher staleTime if needed.
    staleTime = 0,
  } = options

  return useQuery({
    queryKey: productKeys.list(filters, page, limit, sortBy, sortOrder),
    queryFn:  async () => {
      const response = await productApiClient.getProducts(filters, page, limit, sortBy, sortOrder)
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch products')
      }
      return {
        products:   response.data?.products   ?? [],
        pagination: response.data?.pagination ?? null,
      } satisfies ProductsResponse
    },
    enabled,
    staleTime,
    gcTime:             1000 * 60 * 10,
    placeholderData:    (prev) => prev,
    refetchOnMount:     true,
    refetchOnWindowFocus: true, // re-fetch when user tabs back — catches stock changes
  })
}

// ─── useProduct ───────────────────────────────────────────────────────────────

export const useProduct = (id: string | null) =>
  useQuery({
    queryKey: productKeys.detail(id!),
    queryFn:  async () => {
      const response = await productApiClient.getProductById(id!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch product')
      return response.data
    },
    enabled:              !!id,
    staleTime:            0,    // stock numbers must always be fresh
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
  })

// ─── useProductBySlug ─────────────────────────────────────────────────────────

export const useProductBySlug = (slug: string | null) =>
  useQuery({
    queryKey: productKeys.detailBySlug(slug!),
    queryFn:  async () => {
      const response = await productApiClient.getProductBySlug(slug!)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to fetch product')
      return response.data
    },
    enabled:              !!slug,
    staleTime:            0,
    refetchOnMount:       true,
    refetchOnWindowFocus: true,
  })

// ─── useCreateProduct ─────────────────────────────────────────────────────────

export const useCreateProduct = () => {
  const queryClient = useQueryClient()
  const { setCreateModalOpen } = useProductUIStore()

  return useMutation({
    mutationFn: (data: ProductCreateInput) => productApiClient.createProduct(data),

    onSuccess: (response) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to create product')

      const newProduct = response.data

      if (newProduct?.id) {
        queryClient.setQueryData(productKeys.detail(newProduct.id), newProduct)
      }
      if (newProduct?.slug) {
        queryClient.setQueryData(productKeys.detailBySlug(newProduct.slug), newProduct)
      }

      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      setCreateModalOpen(false)
    },
  })
}

// ─── useUpdateProduct ─────────────────────────────────────────────────────────

export const useUpdateProduct = () => {
  const queryClient = useQueryClient()
  const { setEditModalOpen, setSelectedProduct } = useProductUIStore()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: ProductUpdateInput }) =>
      productApiClient.updateProduct(id, data),

    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: productKeys.lists() })

      const previousProduct = queryClient.getQueryData<Product>(productKeys.detail(id))

      if (previousProduct) {
        const {
          pricingRules, variants, tags, images,
          supplierId, supplierSku, unitCost, categoryId,
          ...scalarPatch
        } = data

        const optimistic: Product = {
          ...previousProduct,
          ...scalarPatch,
          category:         previousProduct.category,
          tags:             previousProduct.tags,
          variants:         previousProduct.variants,
          assets:           previousProduct.assets,
          pricingRules:     previousProduct.pricingRules,
          supplierProducts: previousProduct.supplierProducts,
          updatedAt:        new Date().toISOString(),
        }

        queryClient.setQueryData(productKeys.detail(id), optimistic)

        queryClient.setQueriesData<ProductsResponse>(
          { queryKey: productKeys.lists() },
          (old) => {
            if (!old) return old
            return {
              ...old,
              products: old.products.map((p) => p.id === id ? optimistic : p),
            }
          },
        )

        setSelectedProduct(optimistic)
      }

      return { previousProduct }
    },

    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to update product')

      const updated = response.data
      if (updated) {
        queryClient.setQueryData(productKeys.detail(variables.id), updated)
        if (updated.slug) {
          queryClient.setQueryData(productKeys.detailBySlug(updated.slug), updated)
        }
        setSelectedProduct(updated)
      }

      setEditModalOpen(false)
    },

    onError: (_err, variables, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(productKeys.detail(variables.id), context.previousProduct)
        queryClient.setQueriesData<ProductsResponse>(
          { queryKey: productKeys.lists() },
          (old) => {
            if (!old) return old
            return {
              ...old,
              products: old.products.map((p) =>
                p.id === variables.id ? context.previousProduct! : p
              ),
            }
          },
        )
        setSelectedProduct(context.previousProduct)
      }
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
    },
  })
}

// ─── useDeleteProduct ─────────────────────────────────────────────────────────

export const useDeleteProduct = () => {
  const queryClient = useQueryClient()
  const { setDeleteDialogOpen, clearSelectedProductIds } = useProductUIStore()

  return useMutation({
    mutationFn: ({ id, permanent = false }: { id: string; permanent?: boolean }) =>
      productApiClient.deleteProduct(id, permanent),

    onMutate: async ({ id, permanent }) => {
      await queryClient.cancelQueries({ queryKey: productKeys.detail(id) })
      await queryClient.cancelQueries({ queryKey: productKeys.lists() })

      const previousProduct = queryClient.getQueryData<Product>(productKeys.detail(id))

      if (permanent) {
        queryClient.removeQueries({ queryKey: productKeys.detail(id) })
      } else if (previousProduct) {
        queryClient.setQueryData<Product>(productKeys.detail(id), {
          ...previousProduct,
          deletedAt: new Date().toISOString(),
          isActive:  false,
        })
      }

      queryClient.setQueriesData<ProductsResponse>(
        { queryKey: productKeys.lists() },
        (old) => {
          if (!old) return old
          return {
            ...old,
            products:   old.products.filter((p) => p.id !== id),
            pagination: old.pagination
              ? { ...old.pagination, total: Math.max(0, old.pagination.total - 1) }
              : null,
          }
        },
      )

      return { previousProduct }
    },

    onSuccess: (response) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to delete product')
      setDeleteDialogOpen(false)
      clearSelectedProductIds()
    },

    onError: (_err, variables, context) => {
      if (context?.previousProduct) {
        queryClient.setQueryData(productKeys.detail(variables.id), context.previousProduct)
      }
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
    },

    onSettled: (_data, _err, variables) => {
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      if (!variables.permanent) {
        queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.id) })
      }
    },
  })
}

// ─── useAddProductImages ──────────────────────────────────────────────────────

export const useAddProductImages = () => {
  const queryClient = useQueryClient()
  const { setImageUploadModalOpen, resetLocalImages } = useProductUIStore()

  return useMutation({
    mutationFn: ({ productId, files }: { productId: string; files: File[] }) =>
      productApiClient.addProductImages(productId, files),
    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to add product images')
      queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.productId) })
      resetLocalImages()
      setImageUploadModalOpen(false)
    },
  })
}

// ─── useRemoveProductImage ────────────────────────────────────────────────────

export const useRemoveProductImage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId }: { assetId: string; productId?: string }) =>
      productApiClient.removeProductImage(assetId),
    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to remove product image')
      if (variables.productId) {
        queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.productId) })
      } else {
        queryClient.invalidateQueries({ queryKey: productKeys.details() })
      }
    },
  })
}

// ─── useSetPrimaryImage ───────────────────────────────────────────────────────

export const useSetPrimaryImage = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ assetId }: { assetId: string; productId?: string }) =>
      productApiClient.setPrimaryImage(assetId),
    onSuccess: (response, variables) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to set primary image')
      if (variables.productId) {
        queryClient.invalidateQueries({ queryKey: productKeys.detail(variables.productId) })
      } else {
        queryClient.invalidateQueries({ queryKey: productKeys.details() })
      }
    },
  })
}

// ─── useUpdateInventory ───────────────────────────────────────────────────────

export const useUpdateInventory = () => {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (items: VariantInventoryInput[]) => productApiClient.updateInventory(items),
    onSuccess: (response) => {
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to update inventory')
      queryClient.invalidateQueries({ queryKey: productKeys.lists() })
      queryClient.invalidateQueries({ queryKey: productKeys.details() })
    },
  })
}

// ─── useCheckSku ──────────────────────────────────────────────────────────────

export const useCheckSku = (sku: string, excludeId?: string, enabled = true) =>
  useQuery({
    queryKey: ['sku', sku, excludeId],
    queryFn:  async () => {
      const response = await productApiClient.checkSku(sku, excludeId)
      if (!response.success) throw new Error(response.errors?.[0]?.message ?? 'Failed to check SKU')
      return response.data as SkuCheckData
    },
    enabled: !!sku && enabled,
  })

// ─── useSelectProduct (convenience) ──────────────────────────────────────────

export const useSelectProduct = () => {
  const queryClient = useQueryClient()
  const { setSelectedProduct, setEditModalOpen } = useProductUIStore()

  return useCallback((id: string) => {
    const cached = queryClient.getQueryData<Product>(productKeys.detail(id))
    if (cached) setSelectedProduct(cached)
    setEditModalOpen(true)
  }, [queryClient, setSelectedProduct, setEditModalOpen])
}