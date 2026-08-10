// store/use-order-ui-store.ts
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Order, OrderWithRelations } from '@/types/products/orders.types';

// ─── Supporting Types ─────────────────────────────────────────────────────────

export interface OrderUIState {
  // Selected items
  selectedOrderIds: string[];
  selectedOrder: Order | OrderWithRelations | null;

  // UI states
  isOrderDetailOpen: boolean;
  isCancelDialogOpen: boolean;
  isStatusUpdateOpen: boolean;
  isFilterDrawerOpen: boolean;
  isBulkActionMode: boolean;

  // View preferences
  viewMode: 'list' | 'table';

  // Table state (for tanstack table)
  columnVisibility: Record<string, boolean>;
  columnOrder: string[];
  columnSizing: Record<string, number>;

  // Pending status update (used by status update dialog)
  pendingStatus: string | null;
  pendingStaffNotes: string | null;

  // Actions — selection
  setSelectedOrderIds: (ids: string[]) => void;
  addSelectedOrderId: (id: string) => void;
  removeSelectedOrderId: (id: string) => void;
  clearSelectedOrderIds: () => void;

  setSelectedOrder: (order: Order | OrderWithRelations | null) => void;

  // Actions — modals / drawers
  setOrderDetailOpen: (isOpen: boolean) => void;
  setCancelDialogOpen: (isOpen: boolean) => void;
  setStatusUpdateOpen: (isOpen: boolean) => void;
  setFilterDrawerOpen: (isOpen: boolean) => void;
  setBulkActionMode: (isBulk: boolean) => void;

  // Actions — view preferences
  setViewMode: (mode: 'list' | 'table') => void;

  // Actions — table state
  setColumnVisibility: (visibility: Record<string, boolean>) => void;
  setColumnOrder: (order: string[]) => void;
  setColumnSizing: (sizing: Record<string, number>) => void;

  // Actions — status update dialog
  setPendingStatus: (status: string | null) => void;
  setPendingStaffNotes: (notes: string | null) => void;
  clearPendingStatus: () => void;

  // Actions — sync with socket updates
  syncOrderFromSocket: (orderId: string, updates: Partial<Order>) => void;

  // Actions — reset
  resetUIState: () => void;
}

// ─── Initial State ────────────────────────────────────────────────────────────

const initialState: Omit<
  OrderUIState,
  | 'setSelectedOrderIds'
  | 'addSelectedOrderId'
  | 'removeSelectedOrderId'
  | 'clearSelectedOrderIds'
  | 'setSelectedOrder'
  | 'setOrderDetailOpen'
  | 'setCancelDialogOpen'
  | 'setStatusUpdateOpen'
  | 'setFilterDrawerOpen'
  | 'setBulkActionMode'
  | 'setViewMode'
  | 'setColumnVisibility'
  | 'setColumnOrder'
  | 'setColumnSizing'
  | 'setPendingStatus'
  | 'setPendingStaffNotes'
  | 'clearPendingStatus'
  | 'syncOrderFromSocket'
  | 'resetUIState'
> = {
  selectedOrderIds: [],
  selectedOrder: null,

  isOrderDetailOpen: false,
  isCancelDialogOpen: false,
  isStatusUpdateOpen: false,
  isFilterDrawerOpen: false,
  isBulkActionMode: false,

  viewMode: 'table',

  columnVisibility: {},
  columnOrder: [],
  columnSizing: {},

  pendingStatus: null,
  pendingStaffNotes: null,
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useOrderUIStore = create<OrderUIState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // ── Selection ────────────────────────────────────────────────────────

        setSelectedOrderIds: (ids) =>
          set({ selectedOrderIds: ids }),

        addSelectedOrderId: (id) =>
          set((state) => ({
            selectedOrderIds: [...state.selectedOrderIds, id],
          })),

        removeSelectedOrderId: (id) =>
          set((state) => ({
            selectedOrderIds: state.selectedOrderIds.filter((oid) => oid !== id),
          })),

        clearSelectedOrderIds: () =>
          set({ selectedOrderIds: [] }),

        setSelectedOrder: (order) =>
          set({ selectedOrder: order }),

        // ── Modals / drawers ─────────────────────────────────────────────────

        setOrderDetailOpen: (isOpen) =>
          set({
            isOrderDetailOpen: isOpen,
            ...(!isOpen ? { selectedOrder: null } : {}),
          }),

        setCancelDialogOpen: (isOpen) =>
          set({
            isCancelDialogOpen: isOpen,
            ...(!isOpen ? { selectedOrderIds: [], selectedOrder: null } : {}),
          }),

        setStatusUpdateOpen: (isOpen) =>
          set({
            isStatusUpdateOpen: isOpen,
            ...(!isOpen ? { pendingStatus: null, pendingStaffNotes: null } : {}),
          }),

        setFilterDrawerOpen: (isOpen) =>
          set({ isFilterDrawerOpen: isOpen }),

        setBulkActionMode: (isBulk) =>
          set({
            isBulkActionMode: isBulk,
            ...(!isBulk ? { selectedOrderIds: [] } : {}),
          }),

        // ── View preferences ─────────────────────────────────────────────────

        setViewMode: (mode) =>
          set({ viewMode: mode }),

        // ── Table state ──────────────────────────────────────────────────────

        setColumnVisibility: (visibility) =>
          set({ columnVisibility: visibility }),

        setColumnOrder: (order) =>
          set({ columnOrder: order }),

        setColumnSizing: (sizing) =>
          set({ columnSizing: sizing }),

        // ── Status update dialog ─────────────────────────────────────────────

        setPendingStatus: (status) =>
          set({ pendingStatus: status }),

        setPendingStaffNotes: (notes) =>
          set({ pendingStaffNotes: notes }),

        clearPendingStatus: () =>
          set({ pendingStatus: null, pendingStaffNotes: null }),

        // ── Socket sync ──────────────────────────────────────────────────────
        syncOrderFromSocket: (orderId, updates) =>
          set((state) => {
            // Update selected order if it matches the ID
            if (state.selectedOrder?.id === orderId) {
              return {
                selectedOrder: { ...state.selectedOrder, ...updates },
              };
            }
            return state;
          }),

        // ── Reset ────────────────────────────────────────────────────────────

        resetUIState: () =>
          set({ ...initialState }),
      }),
      {
        name: 'order-ui-storage',
        // Only persist user preferences — not ephemeral UI state
        partialize: (state) => ({
          viewMode: state.viewMode,
          columnVisibility: state.columnVisibility,
          columnOrder: state.columnOrder,
          columnSizing: state.columnSizing,
        }),
      }
    ),
    { name: 'OrderUIStore' }
  )
);