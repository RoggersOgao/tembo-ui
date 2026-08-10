import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

import { Product } from '@/types/products/product-types';

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface ImagesDt {
  existing?: string[];
  deleted?:  string[];
  new?:      string[];
}

export interface ProductUIState {
  // Selected items
  selectedProductIds: string[];
  selectedProduct: Product | null;
  
  // UI states
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteDialogOpen: boolean;
  isImageUploadModalOpen: boolean;
  isBulkEditMode: boolean;
  isFilterDrawerOpen: boolean;
  isAdvancedSearchOpen: boolean;
  
  // View preferences (these sync with URL via your hook, but we keep local UI state)
  viewMode: 'grid' | 'list' | 'table';
  
  // Table state (for tanstack table)
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  
  // Temporary/local data
  localImages: ImagesDt;
  formDirty: boolean;
  
  // Bulk edit state
  bulkEditFields: Record<string, any>;
  
  // Actions
  setSelectedProductIds: (ids: string[]) => void;
  addSelectedProductId: (id: string) => void;
  removeSelectedProductId: (id: string) => void;
  clearSelectedProductIds: () => void;
  
  setSelectedProduct: (product: Product | null) => void;
  
  // Modal actions
  setCreateModalOpen: (isOpen: boolean) => void;
  setEditModalOpen: (isOpen: boolean) => void;
  setDeleteDialogOpen: (isOpen: boolean) => void;
  setImageUploadModalOpen: (isOpen: boolean) => void;
  setBulkEditMode: (isBulk: boolean) => void;
  setFilterDrawerOpen: (isOpen: boolean) => void;
  setAdvancedSearchOpen: (isOpen: boolean) => void;
  
  // View preferences
  setViewMode: (mode: 'grid' | 'list' | 'table') => void;
  
  // Table state
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;
  
  // Local image management
  setLocalImages: (images: Partial<ImagesDt>) => void;
  resetLocalImages: () => void;
  
  // Form state
  setFormDirty: (isDirty: boolean) => void;
  
  // Bulk edit
  setBulkEditFields: (fields: Record<string, any>) => void;
  clearBulkEditFields: () => void;
  
  // Reset all UI state
  resetUIState: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialImages: ImagesDt = {
  existing: [],
  deleted: [],
  new: [],
};

const initialState: ProductUIState = {
  selectedProductIds: [],
  selectedProduct: null,
  
  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteDialogOpen: false,
  isImageUploadModalOpen: false,
  isBulkEditMode: false,
  isFilterDrawerOpen: false,
  isAdvancedSearchOpen: false,
  
  viewMode: 'table',
  
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  
  localImages: { ...initialImages },
  formDirty: false,
  
  bulkEditFields: {},
  
  setSelectedProductIds: () => {},
  addSelectedProductId: () => {},
  removeSelectedProductId: () => {},
  clearSelectedProductIds: () => {},
  
  setSelectedProduct: () => {},
  
  setCreateModalOpen: () => {},
  setEditModalOpen: () => {},
  setDeleteDialogOpen: () => {},
  setImageUploadModalOpen: () => {},
  setBulkEditMode: () => {},
  setFilterDrawerOpen: () => {},
  setAdvancedSearchOpen: () => {},
  
  setViewMode: () => {},
  
  setColumnVisibility: () => {},
  setColumnOrder: () => {},
  setColumnSizing: () => {},
  
  setLocalImages: () => {},
  resetLocalImages: () => {},
  
  setFormDirty: () => {},
  
  setBulkEditFields: () => {},
  clearBulkEditFields: () => {},
  
  resetUIState: () => {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProductUIStore = create<ProductUIState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        // Selection actions
        setSelectedProductIds: (ids) => 
          set({ selectedProductIds: ids }),

        addSelectedProductId: (id) => 
          set((state) => ({ 
            selectedProductIds: [...state.selectedProductIds, id] 
          })),

        removeSelectedProductId: (id) => 
          set((state) => ({ 
            selectedProductIds: state.selectedProductIds.filter((pid) => pid !== id) 
          })),

        clearSelectedProductIds: () => 
          set({ selectedProductIds: [] }),

        setSelectedProduct: (product) => 
          set({ selectedProduct: product }),

        // Modal actions
        setCreateModalOpen: (isOpen) => 
          set({ 
            isCreateModalOpen: isOpen,
            ...(isOpen ? {} : { selectedProduct: null, formDirty: false })
          }),

        setEditModalOpen: (isOpen) => 
          set({ 
            isEditModalOpen: isOpen,
            ...(isOpen ? {} : { selectedProduct: null, formDirty: false })
          }),

        setDeleteDialogOpen: (isOpen) => 
          set({ 
            isDeleteDialogOpen: isOpen,
            ...(isOpen ? {} : { selectedProductIds: [] })
          }),

        setImageUploadModalOpen: (isOpen) => 
          set({ 
            isImageUploadModalOpen: isOpen,
            ...(isOpen ? {} : { localImages: { ...initialImages } })
          }),

        setBulkEditMode: (isBulk) => 
          set({ 
            isBulkEditMode: isBulk,
            ...(isBulk ? {} : { selectedProductIds: [], bulkEditFields: {} })
          }),

        setFilterDrawerOpen: (isOpen) => 
          set({ isFilterDrawerOpen: isOpen }),

        setAdvancedSearchOpen: (isOpen) => 
          set({ isAdvancedSearchOpen: isOpen }),

        // View preferences
        setViewMode: (mode) => 
          set({ viewMode: mode }),

        // Table state
        setColumnVisibility: (visibility) => 
          set({ columnVisibility: visibility }),

        setColumnOrder: (order) => 
          set({ columnOrder: order }),

        setColumnSizing: (sizing) => 
          set({ columnSizing: sizing }),

        // Local image management
        setLocalImages: (images) => 
          set((state) => ({ 
            localImages: { ...state.localImages, ...images }
          })),

        resetLocalImages: () => 
          set({ localImages: { ...initialImages } }),

        // Form state
        setFormDirty: (isDirty) => 
          set({ formDirty: isDirty }),

        // Bulk edit
        setBulkEditFields: (fields) => 
          set((state) => ({ 
            bulkEditFields: { ...state.bulkEditFields, ...fields }
          })),

        clearBulkEditFields: () => 
          set({ bulkEditFields: {} }),

        // Reset all UI state
        resetUIState: () => 
          set({ ...initialState }),
      }),
      {
        name: 'product-ui-storage',
        partialize: (state) => ({
          // Only persist user preferences
          viewMode: state.viewMode,
          columnVisibility: state.columnVisibility,
          columnOrder: state.columnOrder,
          columnSizing: state.columnSizing,
        }),
      }
    ),
    { name: 'ProductUIStore' }
  )
);