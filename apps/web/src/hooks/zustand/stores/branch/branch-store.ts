// stores/branches/use-branch-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { Branch } from '@/types/branch/branch-types';

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface BranchUIState {
  // Selected items
  selectedBranchIds: string[];
  selectedBranch: Branch | null;
  
  // UI states
  isCreateModalOpen: boolean;
  isEditModalOpen: boolean;
  isDeleteDialogOpen: boolean;
  isFilterDrawerOpen: boolean;
  isMapViewOpen: boolean;
  
  // View preferences
  viewMode: 'grid' | 'list' | 'table' | 'map';
  
  // Map state
  mapCenter: { lat: number; lng: number } | null;
  mapZoom: number;
  selectedBranchOnMap: string | null;
  
  // Table state
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;
  
  // Form state
  formDirty: boolean;
  
  // Actions
  setSelectedBranchIds: (ids: string[]) => void;
  addSelectedBranchId: (id: string) => void;
  removeSelectedBranchId: (id: string) => void;
  clearSelectedBranchIds: () => void;
  
  setSelectedBranch: (branch: Branch | null) => void;
  
  // Modal actions
  setCreateModalOpen: (isOpen: boolean) => void;
  setEditModalOpen: (isOpen: boolean) => void;
  setDeleteDialogOpen: (isOpen: boolean) => void;
  setFilterDrawerOpen: (isOpen: boolean) => void;
  setMapViewOpen: (isOpen: boolean) => void;
  
  // View preferences
  setViewMode: (mode: 'grid' | 'list' | 'table' | 'map') => void;
  
  // Map actions
  setMapCenter: (center: { lat: number; lng: number } | null) => void;
  setMapZoom: (zoom: number) => void;
  setSelectedBranchOnMap: (branchId: string | null) => void;
  
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

const initialState: BranchUIState = {
  selectedBranchIds: [],
  selectedBranch: null,
  
  isCreateModalOpen: false,
  isEditModalOpen: false,
  isDeleteDialogOpen: false,
  isFilterDrawerOpen: false,
  isMapViewOpen: false,
  
  viewMode: 'table',
  
  mapCenter: null,
  mapZoom: 12,
  selectedBranchOnMap: null,
  
  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},
  
  formDirty: false,
  
  setSelectedBranchIds: () => {},
  addSelectedBranchId: () => {},
  removeSelectedBranchId: () => {},
  clearSelectedBranchIds: () => {},
  
  setSelectedBranch: () => {},
  
  setCreateModalOpen: () => {},
  setEditModalOpen: () => {},
  setDeleteDialogOpen: () => {},
  setFilterDrawerOpen: () => {},
  setMapViewOpen: () => {},
  
  setViewMode: () => {},
  
  setMapCenter: () => {},
  setMapZoom: () => {},
  setSelectedBranchOnMap: () => {},
  
  setColumnVisibility: () => {},
  setColumnOrder: () => {},
  setColumnSizing: () => {},
  
  setFormDirty: () => {},
  
  resetUIState: () => {},
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useBranchUIStore = create<BranchUIState>()(
  devtools(
    persist(
      (set) => ({
        ...initialState,

        setSelectedBranchIds: (ids) => 
          set({ selectedBranchIds: ids }),

        addSelectedBranchId: (id) => 
          set((state) => ({ 
            selectedBranchIds: [...state.selectedBranchIds, id] 
          })),

        removeSelectedBranchId: (id) => 
          set((state) => ({ 
            selectedBranchIds: state.selectedBranchIds.filter((bid) => bid !== id) 
          })),

        clearSelectedBranchIds: () => 
          set({ selectedBranchIds: [] }),

        setSelectedBranch: (branch) => 
          set({ selectedBranch: branch }),

        setCreateModalOpen: (isOpen) => 
          set({ 
            isCreateModalOpen: isOpen,
            ...(isOpen ? {} : { selectedBranch: null, formDirty: false })
          }),

        setEditModalOpen: (isOpen) => 
          set({ 
            isEditModalOpen: isOpen,
            ...(isOpen ? {} : { selectedBranch: null, formDirty: false })
          }),

        setDeleteDialogOpen: (isOpen) => 
          set({ 
            isDeleteDialogOpen: isOpen,
            ...(isOpen ? {} : { selectedBranchIds: [] })
          }),

        setFilterDrawerOpen: (isOpen) => 
          set({ isFilterDrawerOpen: isOpen }),

        setMapViewOpen: (isOpen) => 
          set({ isMapViewOpen: isOpen }),

        setViewMode: (mode) => 
          set({ viewMode: mode }),

        setMapCenter: (center) => 
          set({ mapCenter: center }),

        setMapZoom: (zoom) => 
          set({ mapZoom: zoom }),

        setSelectedBranchOnMap: (branchId) => 
          set({ selectedBranchOnMap: branchId }),

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
        name: 'branch-ui-storage',
        partialize: (state) => ({
          viewMode: state.viewMode,
          mapCenter: state.mapCenter,
          mapZoom: state.mapZoom,
          columnVisibility: state.columnVisibility,
          columnOrder: state.columnOrder,
          columnSizing: state.columnSizing,
        }),
      }
    ),
    { name: 'BranchUIStore' }
  )
);