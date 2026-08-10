import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { BranchDriverAssignmentResponse } from '@/types/branch/branch-driver/branch-driver-types';

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface BranchDriverUIState {
  // Selected items
  selectedAssignmentIds: string[];
  selectedAssignment: BranchDriverAssignmentResponse | null;
  
  // UI states
  isAssignModalOpen: boolean;
  isBulkAssignModalOpen: boolean;
  isEditModalOpen: boolean;
  isRemoveDialogOpen: boolean;
  isTransferModalOpen: boolean;
  isFilterDrawerOpen: boolean;
  
  // View preferences
  viewMode: 'grid' | 'list' | 'table';
  
  // Table state
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  
  // Form state
  formDirty: boolean;
  
  // Filter state
  activeFilters: {
    branchId?: string;
    driverId?: string;
    isActive?: boolean;
    isPrimary?: boolean;
    search?: string;
  };
  
  // Actions
  setSelectedAssignmentIds: (ids: string[]) => void;
  addSelectedAssignmentId: (id: string) => void;
  removeSelectedAssignmentId: (id: string) => void;
  clearSelectedAssignmentIds: () => void;
  
  setSelectedAssignment: (assignment: BranchDriverAssignmentResponse | null) => void;
  
  // Modal actions
  setAssignModalOpen: (isOpen: boolean) => void;
  setBulkAssignModalOpen: (isOpen: boolean) => void;
  setEditModalOpen: (isOpen: boolean) => void;
  setRemoveDialogOpen: (isOpen: boolean) => void;
  setTransferModalOpen: (isOpen: boolean) => void;
  setFilterDrawerOpen: (isOpen: boolean) => void;
  
  // View preferences
  setViewMode: (mode: 'grid' | 'list' | 'table') => void;
  
  // Table state
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;
  
  // Form state
  setFormDirty: (isDirty: boolean) => void;
  
  // Filter actions
  setActiveFilters: (filters: Partial<BranchDriverUIState['activeFilters']>) => void;
  clearActiveFilters: () => void;
  
  // Reset all UI state
  resetUIState: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: BranchDriverUIState = {
  selectedAssignmentIds: [],
  selectedAssignment: null,
  
  isAssignModalOpen: false,
  isBulkAssignModalOpen: false,
  isEditModalOpen: false,
  isRemoveDialogOpen: false,
  isTransferModalOpen: false,
  isFilterDrawerOpen: false,
  
  viewMode: 'table',
  
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  
  formDirty: false,
  
  activeFilters: {},
  
  setSelectedAssignmentIds: () => {},
  addSelectedAssignmentId: () => {},
  removeSelectedAssignmentId: () => {},
  clearSelectedAssignmentIds: () => {},
  
  setSelectedAssignment: () => {},
  
  setAssignModalOpen: () => {},
  setBulkAssignModalOpen: () => {},
  setEditModalOpen: () => {},
  setRemoveDialogOpen: () => {},
  setTransferModalOpen: () => {},
  setFilterDrawerOpen: () => {},
  
  setViewMode: () => {},
  
  setColumnVisibility: () => {},
  setColumnOrder: () => {},
  setColumnSizing: () => {},
  
  setFormDirty: () => {},
  
  setActiveFilters: () => {},
  clearActiveFilters: () => {},
  
  resetUIState: () => {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBranchDriverUIStore = create<BranchDriverUIState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setSelectedAssignmentIds: (ids) => 
          set({ selectedAssignmentIds: ids }),

        addSelectedAssignmentId: (id) => 
          set((state) => ({ 
            selectedAssignmentIds: [...state.selectedAssignmentIds, id] 
          })),

        removeSelectedAssignmentId: (id) => 
          set((state) => ({ 
            selectedAssignmentIds: state.selectedAssignmentIds.filter((aid) => aid !== id) 
          })),

        clearSelectedAssignmentIds: () => 
          set({ selectedAssignmentIds: [] }),

        setSelectedAssignment: (assignment) => 
          set({ selectedAssignment: assignment }),

        setAssignModalOpen: (isOpen) => 
          set({ 
            isAssignModalOpen: isOpen,
            ...(isOpen ? {} : { selectedAssignment: null, formDirty: false })
          }),

        setBulkAssignModalOpen: (isOpen) => 
          set({ 
            isBulkAssignModalOpen: isOpen,
            ...(isOpen ? {} : { formDirty: false })
          }),

        setEditModalOpen: (isOpen) => 
          set({ 
            isEditModalOpen: isOpen,
            ...(isOpen ? {} : { selectedAssignment: null, formDirty: false })
          }),

        setRemoveDialogOpen: (isOpen) => 
          set({ 
            isRemoveDialogOpen: isOpen,
            ...(isOpen ? {} : { selectedAssignmentIds: [] })
          }),

        setTransferModalOpen: (isOpen) => 
          set({ 
            isTransferModalOpen: isOpen,
            ...(isOpen ? {} : { selectedAssignment: null })
          }),

        setFilterDrawerOpen: (isOpen) => 
          set({ isFilterDrawerOpen: isOpen }),

        setViewMode: (mode) => 
          set({ viewMode: mode }),

        setColumnVisibility: (visibility) => 
          set({ columnVisibility: visibility }),

        setColumnOrder: (order) => 
          set({ columnOrder: order }),

        setColumnSizing: (sizing) => 
          set({ columnSizing: sizing }),

        setFormDirty: (isDirty) => 
          set({ formDirty: isDirty }),

        setActiveFilters: (filters) =>
          set((state) => ({
            activeFilters: { ...state.activeFilters, ...filters }
          })),

        clearActiveFilters: () =>
          set({ activeFilters: {} }),

        resetUIState: () => 
          set({ ...initialState }),
      }),
      {
        name: 'branch-driver-ui-storage',
        partialize: (state) => ({
          viewMode: state.viewMode,
          columnVisibility: state.columnVisibility,
          columnOrder: state.columnOrder,
          columnSizing: state.columnSizing,
          activeFilters: state.activeFilters,
        }),
      }
    ),
    { name: 'BranchDriverUIStore' }
  )
);