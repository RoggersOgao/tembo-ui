// stores/use-delivery-settings-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
    DeliveryAddress,
    DeliveryMode,
    DeliveryModeSettings,
    AddressStats,
    AddressHistoryEntry,
    SettingsWithDetails,
    ExpressEligibilityResult,
    PaginatedAdminSettings,
} from '@/lib/user/delivery-settings.api';

// ─── Helper: transform date strings → Date objects ────────────────────────────

function transformDeliveryAddressDates(a: any): DeliveryAddress {
    return {
        ...a,
        createdAt: new Date(a.createdAt),
        updatedAt: new Date(a.updatedAt),
    };
}

function transformDeliveryModeSettingsDates(s: any): DeliveryModeSettings {
    return {
        ...s,
        preferredDeliveryDate: s.preferredDeliveryDate ? new Date(s.preferredDeliveryDate) : null,
        createdAt: new Date(s.createdAt),
        updatedAt: new Date(s.updatedAt),
    };
}

function transformAddressHistoryEntry(entry: any): AddressHistoryEntry {
    return {
        ...transformDeliveryAddressDates(entry),
        lastUsedAt: new Date(entry.lastUsedAt),
        usageCount: entry.usageCount,
    };
}

// ─── State interface ──────────────────────────────────────────────────────────

interface DeliverySettingsState {
    // Data
    addresses: Record<DeliveryMode, DeliveryAddress[]>;
    currentAddress: DeliveryAddress | null;
    deliverySettings: DeliveryModeSettings | null;
    settingsWithDetails: SettingsWithDetails | null;

    // Statistics and History
    addressStats: AddressStats | null;
    addressHistory: AddressHistoryEntry[];

    // Express Delivery
    expressEligibility: Record<string, ExpressEligibilityResult>;

    // Admin
    adminSettings: PaginatedAdminSettings | null;

    // UI State
    isLoading: boolean;
    isSubmitting: boolean;
    error: string | null;

    // Selected address for editing
    selectedAddressId: string | null;

    // ─── Address actions ────────────────────────────────────────────────────────
    setAddresses: (mode: DeliveryMode, addresses: DeliveryAddress[]) => void;
    setCurrentAddress: (address: DeliveryAddress | null) => void;
    addAddress: (address: DeliveryAddress) => void;
    updateAddress: (addressId: string, updates: Partial<DeliveryAddress>) => void;
    removeAddress: (addressId: string) => void;
    setDefaultAddress: (addressId: string, address: DeliveryAddress) => void;
    batchUpdateAddresses: (addresses: DeliveryAddress[]) => void;
    selectAddress: (addressId: string | null) => void;

    // ─── Settings actions ───────────────────────────────────────────────────────
    setDeliverySettings: (settings: DeliveryModeSettings | null) => void;
    updateDeliverySettings: (updates: Partial<DeliveryModeSettings>) => void;
    setSettingsWithDetails: (settings: SettingsWithDetails | null) => void;

    // ─── Statistics and History actions ─────────────────────────────────────────
    setAddressStats: (stats: AddressStats) => void;
    setAddressHistory: (history: AddressHistoryEntry[]) => void;
    addToHistory: (address: DeliveryAddress) => void;

    // ─── Express Delivery actions ───────────────────────────────────────────────
    setExpressEligibility: (addressId: string, eligibility: ExpressEligibilityResult) => void;
    clearExpressEligibility: (addressId?: string) => void;

    // ─── Admin actions ──────────────────────────────────────────────────────────
    setAdminSettings: (settings: PaginatedAdminSettings) => void;
    updateAdminSettings: (settings: Partial<PaginatedAdminSettings>) => void;

    // ─── UI actions ─────────────────────────────────────────────────────────────
    setLoading: (loading: boolean) => void;
    setSubmitting: (submitting: boolean) => void;
    setError: (error: string | null) => void;
    clearError: () => void;

    // ─── Reset ──────────────────────────────────────────────────────────────────
    reset: () => void;
    resetAddresses: () => void;
    resetSettings: () => void;
}

// ─── Initial addresses map ────────────────────────────────────────────────────

const emptyAddresses: Record<DeliveryMode, DeliveryAddress[]> = {
    DELIVERY: [],
    PICKUP: [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useDeliverySettingsStore = create<DeliverySettingsState>()(
    devtools(
        (set, get) => ({
            // ── Initial State ──────────────────────────────────────────────────────
            addresses: { ...emptyAddresses },
            currentAddress: null,
            deliverySettings: null,
            settingsWithDetails: null,
            addressStats: null,
            addressHistory: [],
            expressEligibility: {},
            adminSettings: null,
            isLoading: false,
            isSubmitting: false,
            error: null,
            selectedAddressId: null,

            // ─── Address Actions ───────────────────────────────────────────────────

            setAddresses: (mode, addresses) =>
                set((state) => ({
                    addresses: {
                        ...state.addresses,
                        [mode]: addresses.map(transformDeliveryAddressDates),
                    },
                })),

            setCurrentAddress: (address) =>
                set({
                    currentAddress: address ? transformDeliveryAddressDates(address) : null,
                }),

            addAddress: (address) =>
                set((state) => {
                    const transformed = transformDeliveryAddressDates(address);
                    const mode = transformed.deliveryMode;

                    const updateList = (list: DeliveryAddress[]) =>
                        transformed.isDefault
                            ? [transformed, ...list.map((a) => ({ ...a, isDefault: false }))]
                            : [transformed, ...list];

                    return {
                        addresses: {
                            ...state.addresses,
                            [mode]: updateList(state.addresses[mode]),
                        },
                        currentAddress: transformed,
                    };
                }),

            updateAddress: (addressId, updates) =>
                set((state) => {
                    const applyUpdate = (list: DeliveryAddress[]) =>
                        list.map((a) =>
                            a.id === addressId
                                ? { ...a, ...updates, updatedAt: new Date() }
                                : a
                        );

                    const updatedAddresses = {
                        DELIVERY: applyUpdate(state.addresses.DELIVERY),
                        PICKUP: applyUpdate(state.addresses.PICKUP),
                    };

                    const updatedCurrentAddress =
                        state.currentAddress?.id === addressId
                            ? { ...state.currentAddress, ...updates, updatedAt: new Date() }
                            : state.currentAddress;

                    return {
                        addresses: updatedAddresses,
                        currentAddress: updatedCurrentAddress,
                    };
                }),

            removeAddress: (addressId) =>
                set((state) => {
                    const filterOut = (list: DeliveryAddress[]) =>
                        list.filter((a) => a.id !== addressId);

                    return {
                        addresses: {
                            DELIVERY: filterOut(state.addresses.DELIVERY),
                            PICKUP: filterOut(state.addresses.PICKUP)
                        },
                        currentAddress:
                            state.currentAddress?.id === addressId ? null : state.currentAddress,
                        expressEligibility: (() => {
                            const { [addressId]: _, ...rest } = state.expressEligibility;
                            return rest;
                        })(),
                    };
                }),

            setDefaultAddress: (addressId, address) =>
                set((state) => {
                    const transformed = transformDeliveryAddressDates(address);

                    // Guard: list may be undefined if that mode was never fetched
                    const markDefault = (list: DeliveryAddress[] | undefined) =>
                        (list ?? []).map((a) => ({ ...a, isDefault: a.id === addressId }));

                    return {
                        addresses: {
                            // FIX 1: iterate BOTH modes so isDefault is cleared everywhere
                            DELIVERY: markDefault(state.addresses.DELIVERY),
                            PICKUP: markDefault(state.addresses.PICKUP),
                        },
                        currentAddress:
                            state.currentAddress?.id === addressId
                                ? transformed
                                : state.currentAddress,
                    };
                }),

            batchUpdateAddresses: (addresses) =>
                set((state) => {
                    const transformedAddresses = addresses.map(transformDeliveryAddressDates);
                    const addressMap = new Map(transformedAddresses.map((a) => [a.id, a]));

                    const updateList = (list: DeliveryAddress[]) =>
                        list.map((a) => addressMap.get(a.id) || a);

                    return {
                        addresses: {
                            DELIVERY: updateList(state.addresses.DELIVERY),
                            PICKUP: updateList(state.addresses.PICKUP)
                        },
                        currentAddress:
                            state.currentAddress && addressMap.has(state.currentAddress.id)
                                ? addressMap.get(state.currentAddress.id)!
                                : state.currentAddress,
                    };
                }),

            selectAddress: (addressId) =>
                set((state) => {
                    if (!addressId) {
                        return { selectedAddressId: null, currentAddress: null };
                    }

                    const allAddresses = [
                        ...state.addresses.DELIVERY,
                        ...state.addresses.PICKUP
                    ];
                    const address = allAddresses.find((a) => a.id === addressId);

                    return {
                        selectedAddressId: addressId,
                        currentAddress: address || null,
                    };
                }),

            // ─── Settings Actions ───────────────────────────────────────────────────

            setDeliverySettings: (settings) =>
                set({
                    deliverySettings: settings
                        ? transformDeliveryModeSettingsDates(settings)
                        : null,
                }),

            updateDeliverySettings: (updates) =>
                set((state) => ({
                    deliverySettings: state.deliverySettings
                        ? { ...state.deliverySettings, ...updates, updatedAt: new Date() }
                        : null,
                })),

            setSettingsWithDetails: (settings) =>
                set({
                    settingsWithDetails: settings
                        ? {
                            ...settings,
                            settings: settings.settings
                                ? transformDeliveryModeSettingsDates(settings.settings)
                                : null,
                        }
                        : null,
                }),

            // ─── Statistics and History Actions ─────────────────────────────────────

            setAddressStats: (stats) =>
                set({
                    addressStats: {
                        ...stats,
                        defaultAddress: stats.defaultAddress
                            ? transformDeliveryAddressDates(stats.defaultAddress)
                            : null,
                        recentAddresses: stats.recentAddresses.map(transformDeliveryAddressDates),
                    },
                }),

            setAddressHistory: (history) =>
                set({
                    addressHistory: history.map(transformAddressHistoryEntry),
                }),

            addToHistory: (address) =>
                set((state) => {
                    const transformed = transformDeliveryAddressDates(address);

                    // Guard: must have a valid id
                    if (!transformed?.id) return state;

                    const existingIndex = state.addressHistory.findIndex((h) => h.id === transformed.id);

                    let updatedHistory: AddressHistoryEntry[];

                    if (existingIndex !== -1) {
                        const existingEntry = state.addressHistory[existingIndex];
                        if (!existingEntry) return state; // Type guard for safety

                        const updatedEntry: AddressHistoryEntry = {
                            ...existingEntry,
                            lastUsedAt: new Date(),
                            usageCount: (existingEntry.usageCount || 0) + 1,
                            id: existingEntry.id, // ensure id is string
                        };

                        const filteredHistory = state.addressHistory.filter((_, idx) => idx !== existingIndex);
                        updatedHistory = [updatedEntry, ...filteredHistory];
                    } else {
                        const newEntry: AddressHistoryEntry = {
                            ...transformed,
                            lastUsedAt: new Date(),
                            usageCount: 1,
                            id: transformed.id, // ensure id is string
                        };

                        updatedHistory = [newEntry, ...state.addressHistory].slice(0, 50);
                    }

                    return { addressHistory: updatedHistory };
                }),

            // ─── Express Delivery Actions ───────────────────────────────────────────

            setExpressEligibility: (addressId, eligibility) =>
                set((state) => ({
                    expressEligibility: {
                        ...state.expressEligibility,
                        [addressId]: eligibility,
                    },
                })),

            clearExpressEligibility: (addressId) =>
                set((state) => {
                    if (addressId) {
                        const { [addressId]: _, ...rest } = state.expressEligibility;
                        return { expressEligibility: rest };
                    }
                    return { expressEligibility: {} };
                }),

            // ─── Admin Actions ──────────────────────────────────────────────────────

            setAdminSettings: (settings) =>
                set({
                    adminSettings: {
                        ...settings,
                        settings: settings.settings.map((s) => ({
                            ...transformDeliveryModeSettingsDates(s),
                            profile: s.profile,
                        })),
                    },
                }),

            updateAdminSettings: (updates) =>
                set((state) => ({
                    adminSettings: state.adminSettings
                        ? { ...state.adminSettings, ...updates }
                        : null,
                })),

            // ─── UI Actions ─────────────────────────────────────────────────────────

            setLoading: (isLoading) => set({ isLoading }),
            setSubmitting: (isSubmitting) => set({ isSubmitting }),
            setError: (error) => set({ error }),
            clearError: () => set({ error: null }),

            // ─── Reset Actions ──────────────────────────────────────────────────────

            reset: () =>
                set({
                    addresses: { ...emptyAddresses },
                    currentAddress: null,
                    deliverySettings: null,
                    settingsWithDetails: null,
                    addressStats: null,
                    addressHistory: [],
                    expressEligibility: {},
                    adminSettings: null,
                    isLoading: false,
                    isSubmitting: false,
                    error: null,
                    selectedAddressId: null,
                }),

            resetAddresses: () =>
                set({
                    addresses: { ...emptyAddresses },
                    currentAddress: null,
                    addressStats: null,
                    addressHistory: [],
                    selectedAddressId: null,
                }),

            resetSettings: () =>
                set({
                    deliverySettings: null,
                    settingsWithDetails: null,
                    adminSettings: null,
                }),
        }),
        { name: 'DeliverySettingsStore' }
    )
);

// ─── Selectors for optimized re-renders ───────────────────────────────────────

export const useAddressByMode = (mode: DeliveryMode) => {
    return useDeliverySettingsStore((state) => state.addresses[mode]);
};

export const useAllAddresses = () => {
    return useDeliverySettingsStore((state) => [
        ...state.addresses.DELIVERY,
        ...state.addresses.PICKUP
    ]);
};

export const useDefaultAddress = (mode?: DeliveryMode) => {
    return useDeliverySettingsStore((state) => {
        const allAddresses = [
            ...state.addresses.DELIVERY,
            ...state.addresses.PICKUP
        ];

        if (mode) return state.addresses[mode]?.find((a) => a.isDefault) || null;

        return allAddresses.find((a) => a.isDefault) || null;
    });
};

export const useAddressCount = (mode?: DeliveryMode) => {
    return useDeliverySettingsStore((state) => {
        if (mode) return state.addresses[mode]?.length || 0;

        return {
            total: state.addresses.DELIVERY.length + state.addresses.PICKUP.length,
            DELIVERY: state.addresses.DELIVERY.length,
            PICKUP: state.addresses.PICKUP.length
        };
    });
};

export const useAddressStats = () => {
    return useDeliverySettingsStore((state) => state.addressStats);
};

export const useIsDefaultAddress = (addressId: string) => {
    return useDeliverySettingsStore((state) => {
        const allAddresses = [
            ...state.addresses.DELIVERY,
            ...state.addresses.PICKUP
        ];
        const address = allAddresses.find((a) => a.id === addressId);
        return address?.isDefault || false;
    });
};

export const useExpressEligibilityForAddress = (addressId: string) => {
    return useDeliverySettingsStore((state) => state.expressEligibility[addressId]);
};

export const useDeliverySettingsLoading = () => {
    return useDeliverySettingsStore((state) => ({
        isLoading: state.isLoading,
        isSubmitting: state.isSubmitting,
        error: state.error,
    }));
};

// ─── Combined selectors for complex data ──────────────────────────────────────

export const useAddressSummary = () => {
    return useDeliverySettingsStore((state) => {
        const allAddresses = [
            ...state.addresses.DELIVERY,
            ...state.addresses.PICKUP
        ];

        const byMode = {
            DELIVERY: state.addresses.DELIVERY.length,
            PICKUP: state.addresses.PICKUP.length
        };

        const hasDefault = allAddresses.some((a) => a.isDefault);
        const defaultAddress = allAddresses.find((a) => a.isDefault) || null;

        return {
            total: allAddresses.length,
            byMode,
            hasDefault,
            defaultAddress,
        };
    });
};

export const useRecentAddresses = (limit: number = 5) => {
    return useDeliverySettingsStore((state) => {
        return state.addressHistory.slice(0, limit);
    });
};

// ─── Admin selectors ──────────────────────────────────────────────────────────

export const useAdminSettings = () => {
    return useDeliverySettingsStore((state) => state.adminSettings);
};

export const useAdminSettingsPagination = () => {
    return useDeliverySettingsStore((state) => state.adminSettings?.pagination);
};