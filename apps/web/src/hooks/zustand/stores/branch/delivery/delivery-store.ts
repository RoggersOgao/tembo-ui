// stores/deliveries/use-delivery-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Delivery, DeliveryStatus } from '@/types/branch/delivery/delivery-types'

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface DeliveryUIState {
  // Selected items
  selectedDeliveryIds: string[];
  selectedDelivery: Delivery | null;
  
  // UI states
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteDialogOpen: boolean;
  isFilterDrawerOpen: boolean;
  isAssignDriverModalOpen: boolean;
  isStatusUpdateModalOpen: boolean;
  isRatingModalOpen: boolean;
  isTrackingViewOpen: boolean;
  
  // View preferences
  viewMode: 'grid' | 'list' | 'table' | 'timeline';
  
  // Filter state
  statusFilter: DeliveryStatus[];
  dateRange: { from: Date | null; to: Date | null };
  
  // Table state
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  
  // Form state
  formDirty: boolean;
  
  // Actions
  setSelectedDeliveryIds: (ids: string[]) => void;
  addSelectedDeliveryId: (id: string) => void;
  removeSelectedDeliveryId: (id: string) => void;
  clearSelectedDeliveryIds: () => void;
  
  setSelectedDelivery: (delivery: Delivery | null) => void;
  
  // Modal actions
  setCreateModalOpen: (isOpen: boolean) => void;
  setEditModalOpen: (isOpen: boolean) => void;
  setDeleteDialogOpen: (isOpen: boolean) => void;
  setFilterDrawerOpen: (isOpen: boolean) => void;
  setAssignDriverModalOpen: (isOpen: boolean) => void;
  setStatusUpdateModalOpen: (isOpen: boolean) => void;
  setRatingModalOpen: (isOpen: boolean) => void;
  setTrackingViewOpen: (isOpen: boolean) => void;
  
  // View preferences
  setViewMode: (mode: 'grid' | 'list' | 'table' | 'timeline') => void;
  
  // Filter actions
  setStatusFilter: (statuses: DeliveryStatus[]) => void;
  setDateRange: (range: { from: Date | null; to: Date | null }) => void;
  clearFilters: () => void;
  
  // Table state
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;
  
  // Form state
  setFormDirty: (isDirty: boolean) => void;
  
  // Reset all UI state
  resetUIState: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: DeliveryUIState = {
  selectedDeliveryIds: [],
  selectedDelivery: null,
  
  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteDialogOpen: false,
  isFilterDrawerOpen: false,
  isAssignDriverModalOpen: false,
  isStatusUpdateModalOpen: false,
  isRatingModalOpen: false,
  isTrackingViewOpen: false,
  
  viewMode: 'table',
  
  statusFilter: [],
  dateRange: { from: null, to: null },
  
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  
  formDirty: false,
  
  setSelectedDeliveryIds: () => {},
  addSelectedDeliveryId: () => {},
  removeSelectedDeliveryId: () => {},
  clearSelectedDeliveryIds: () => {},
  
  setSelectedDelivery: () => {},
  
  setCreateModalOpen: () => {},
  setEditModalOpen: () => {},
  setDeleteDialogOpen: () => {},
  setFilterDrawerOpen: () => {},
  setAssignDriverModalOpen: () => {},
  setStatusUpdateModalOpen: () => {},
  setRatingModalOpen: () => {},
  setTrackingViewOpen: () => {},
  
  setViewMode: () => {},
  
  setStatusFilter: () => {},
  setDateRange: () => {},
  clearFilters: () => {},
  
  setColumnVisibility: () => {},
  setColumnOrder: () => {},
  setColumnSizing: () => {},
  
  setFormDirty: () => {},
  
  resetUIState: () => {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDeliveryUIStore = create<DeliveryUIState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setSelectedDeliveryIds: (ids) => 
          set({ selectedDeliveryIds: ids }),

        addSelectedDeliveryId: (id) => 
          set((state) => ({ 
            selectedDeliveryIds: [...state.selectedDeliveryIds, id] 
          })),

        removeSelectedDeliveryId: (id) => 
          set((state) => ({ 
            selectedDeliveryIds: state.selectedDeliveryIds.filter((did) => did !== id) 
          })),

        clearSelectedDeliveryIds: () => 
          set({ selectedDeliveryIds: [] }),

        setSelectedDelivery: (delivery) => 
          set({ selectedDelivery: delivery }),

        setCreateModalOpen: (isOpen) => 
          set({ 
            isCreateModalOpen: isOpen,
            ...(isOpen ? {} : { selectedDelivery: null, formDirty: false })
          }),

        setEditModalOpen: (isOpen) => 
          set({ 
            isEditModalOpen: isOpen,
            ...(isOpen ? {} : { selectedDelivery: null, formDirty: false })
          }),

        setDeleteDialogOpen: (isOpen) => 
          set({ 
            isDeleteDialogOpen: isOpen,
            ...(isOpen ? {} : { selectedDeliveryIds: [] })
          }),

        setFilterDrawerOpen: (isOpen) => 
          set({ isFilterDrawerOpen: isOpen }),

        setAssignDriverModalOpen: (isOpen) => 
          set({ isAssignDriverModalOpen: isOpen }),

        setStatusUpdateModalOpen: (isOpen) => 
          set({ isStatusUpdateModalOpen: isOpen }),

        setRatingModalOpen: (isOpen) => 
          set({ isRatingModalOpen: isOpen }),

        setTrackingViewOpen: (isOpen) => 
          set({ isTrackingViewOpen: isOpen }),

        setViewMode: (mode) => 
          set({ viewMode: mode }),

        setStatusFilter: (statuses) => 
          set({ statusFilter: statuses }),

        setDateRange: (range) => 
          set({ dateRange: range }),

        clearFilters: () => 
          set({ statusFilter: [], dateRange: { from: null, to: null } }),

        setColumnVisibility: (visibility) => 
          set({ columnVisibility: visibility }),

        setColumnOrder: (order) => 
          set({ columnOrder: order }),

        setColumnSizing: (sizing) => 
          set({ columnSizing: sizing }),

        setFormDirty: (isDirty) => 
          set({ formDirty: isDirty }),

        resetUIState: () => 
          set({ ...initialState }),
      }),
      {
        name: 'delivery-ui-storage',
        partialize: (state) => ({
          viewMode: state.viewMode,
          statusFilter: state.statusFilter,
          columnVisibility: state.columnVisibility,
          columnOrder: state.columnOrder,
          columnSizing: state.columnSizing,
        }),
      }
    ),
    { name: 'DeliveryUIStore' }
  )
);