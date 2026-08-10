// hooks/zustand/stores/use-shop-filters-store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface DeliveryModeStore {
  deliveryMode: 'delivery' | 'pickup'
  setDeliveryMode: (mode: 'delivery' | 'pickup') => void
}

export const useDeliveryModeStore = create<DeliveryModeStore>()(
  persist(
    (set) => ({
      deliveryMode: 'delivery',
      setDeliveryMode: (mode) => set({ deliveryMode: mode }),
    }),
    {
      name: 'delivery-mode',
      partialize: (state) => ({ deliveryMode: state.deliveryMode }),
    },
  ),
)