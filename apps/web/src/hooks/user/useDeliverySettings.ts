// hooks/use-delivery-settings.ts
import { useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  deliverySettingsApiClient,
  type DeliveryAddress,
  type DeliveryMode,
  type DeliveryModeSettings,
  type CreateDeliveryAddressInput,
  type UpdateDeliveryAddressInput,
  type CreateDeliveryModeSettingsInput,
  type AddressValidationResult,
  type GeocodeResult,
  type ExpressEligibilityResult,
  type AddressHistoryEntry,
  type BulkUpdateResult,
  type AddressStats,
} from '@/lib/user/delivery-settings.api';
import { useDeliverySettingsStore } from '../zustand/stores/user/user-delivery-settings-store';


// ─── Query Key Factory ────────────────────────────────────────────────────────

export const deliverySettingsKeys = {
  all: ['delivery-settings'] as const,
  addresses: () => [...deliverySettingsKeys.all, 'addresses'] as const,
  addressesByMode: (mode?: DeliveryMode) =>
    [...deliverySettingsKeys.addresses(), mode ?? 'all'] as const,
  addressDetail: (id: string) =>
    [...deliverySettingsKeys.addresses(), id] as const,
  settings: () => [...deliverySettingsKeys.all, 'settings'] as const,
  settingsWithDetails: () =>
    [...deliverySettingsKeys.settings(), 'details'] as const,
  stats: () => [...deliverySettingsKeys.all, 'stats'] as const,
  history: () => [...deliverySettingsKeys.all, 'history'] as const,
  expressEligibility: (addressId: string) =>
    [...deliverySettingsKeys.all, 'express', addressId] as const,
  admin: () => [...deliverySettingsKeys.all, 'admin'] as const,
  adminSettings: (page?: number, limit?: number) =>
    [...deliverySettingsKeys.admin(), 'settings', { page, limit }] as const,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function throwIfFailed<T>(
  response: { success: boolean; errors?: { message: string }[] },
  fallback: string
): void {
  if (!response.success) {
    throw new Error(response.errors?.[0]?.message || fallback);
  }
}

function invalidateAddressQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  mode?: DeliveryMode
) {
  queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.addresses() });
  if (mode) {
    queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.addressesByMode(mode) });
  }
  queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.addressesByMode('DELIVERY') });
  queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.addressesByMode('PICKUP') });
  queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.stats() });
}

// ─── Delivery Address Hooks ───────────────────────────────────────────────────

export function useDeliveryAddresses(mode?: DeliveryMode) {
  const { setAddresses } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.addressesByMode(mode),
    queryFn: async (): Promise<DeliveryAddress[]> => {
      const response = await deliverySettingsApiClient.getDeliveryAddresses(mode);
      throwIfFailed(response, 'Failed to fetch delivery addresses');
      const addresses = response.data?.deliveryAddresses ?? [];
      setAddresses(mode ?? 'DELIVERY', addresses);
      return addresses;
    },
    placeholderData: keepPreviousData,
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeliveryAddress(addressId: string | null) {
  const { setCurrentAddress } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.addressDetail(addressId!),
    queryFn: async (): Promise<DeliveryAddress> => {
      const response = await deliverySettingsApiClient.getDeliveryAddressById(addressId!);
      throwIfFailed(response, 'Failed to fetch delivery address');
      const address = response.data as DeliveryAddress;
      setCurrentAddress(address);
      return address;
    },
    enabled: !!addressId,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Add a new delivery address.
 *
 * FIX: removed the toast from onSuccess — the form (AddAddressForm) already
 * calls toast.success after onSuccess runs, so having it here too produced a
 * duplicate toast and, because the success handler closed the sheet while the
 * invalidation was still in-flight, a transient duplicate list entry.
 */
export function useAddDeliveryAddress() {
  const queryClient = useQueryClient();
  const { setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: async (data: CreateDeliveryAddressInput): Promise<DeliveryAddress> => {
      const response = await deliverySettingsApiClient.addDeliveryAddress(data);
      throwIfFailed(response, 'Failed to add address');
      if (!response.data) throw new Error('No address returned from server');
      return response.data;
    },

    onMutate: () => setSubmitting(true),

    onSuccess: () => {
      // Invalidate so the list refetches from the server with the new entry.
      // Do NOT also call store.addAddress() here — the refetch via setAddresses
      // in the queryFn is the single source of truth.
      invalidateAddressQueries(queryClient);
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to add address');
    },

    onSettled: () => setSubmitting(false),
  });
}

/**
 * Update a delivery address.
 *
 * FIX: removed the toast from onSuccess for the same reason as above.
 * FIX: use setQueryData to update the cache synchronously, then invalidate
 *      only the specific address detail — NOT the full list — so the list
 *      doesn't re-render mid-flight while the sheet is closing.
 */
export function useUpdateDeliveryAddress() {
  const queryClient = useQueryClient();
  const { updateAddress, setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: async ({ addressId, data }: { addressId: string; data: UpdateDeliveryAddressInput }) => {
      const response = await deliverySettingsApiClient.updateDeliveryAddress(addressId, data);
      if (!response.success) {
        throw new Error(response.errors?.[0]?.message ?? 'Failed to update address');
      }
      if (!response.data) {
        throw new Error('No address returned from server');
      }
      return response;
    },

    onMutate: () => setSubmitting(true),

    onSuccess: (response, variables) => {
      const address = response.data as DeliveryAddress;

      // 1. Update Zustand store in-place (no refetch needed for the store).
      updateAddress(variables.addressId, address);

      // 2. Update the individual address query cache synchronously.
      queryClient.setQueryData(
        deliverySettingsKeys.addressDetail(variables.addressId),
        address
      );

      // 3. Invalidate the list queries so they refetch in the background.
      //    This is deferred — React Query will not re-render until the fetch
      //    completes, so there is no window where the old + new entry coexist.
      invalidateAddressQueries(queryClient);
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update address');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useRemoveDeliveryAddress() {
  const queryClient = useQueryClient();
  const { removeAddress, setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (addressId: string) =>
      deliverySettingsApiClient.removeDeliveryAddress(addressId),

    onMutate: () => setSubmitting(true),

    onSuccess: (_, addressId) => {
      removeAddress(addressId);
      queryClient.removeQueries({ queryKey: deliverySettingsKeys.addressDetail(addressId) });
      invalidateAddressQueries(queryClient);
      toast.success('Address removed successfully');
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to remove address');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useSetDefaultDeliveryAddress() {
  const queryClient = useQueryClient();
  const { setDefaultAddress, setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (addressId: string) =>
      deliverySettingsApiClient.setDefaultDeliveryAddress(addressId),

    onMutate: () => setSubmitting(true),

    onSuccess: (response, addressId) => {
      const address = response.data as DeliveryAddress;
      setDefaultAddress(addressId, address);
      queryClient.setQueryData(deliverySettingsKeys.addressDetail(addressId), address);
      invalidateAddressQueries(queryClient);
      toast.success('Default address set successfully');
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to set default address');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useBatchUpdateDeliveryAddresses() {
  const queryClient = useQueryClient();
  const { batchUpdateAddresses, setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (updates: Array<{ id: string } & UpdateDeliveryAddressInput>) =>
      deliverySettingsApiClient.batchUpdateDeliveryAddresses(updates),

    onMutate: () => setSubmitting(true),

    onSuccess: (response) => {
      const results = response.data?.updatedAddresses ?? [];
      batchUpdateAddresses(results);
      invalidateAddressQueries(queryClient);

      const successCount = results.filter((r: any) => !r.error).length;
      const failureCount = results.filter((r: any) => r.error).length;

      if (failureCount === 0) {
        toast.success(`All ${successCount} addresses updated successfully`);
      } else {
        toast.warning(`${successCount} updated, ${failureCount} failed`);
      }
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to batch update addresses');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useDeliveryAddressStats() {
  const { setAddressStats } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.stats(),
    queryFn: async (): Promise<AddressStats> => {
      const response = await deliverySettingsApiClient.getDeliveryAddressStats();
      throwIfFailed(response, 'Failed to fetch address stats');
      const stats = response.data as AddressStats;
      setAddressStats(stats);
      return stats;
    },
    staleTime: 2 * 60 * 1000,
    retry: false,
  });
}

export function useAddressHistory(limit: number = 10) {
  const { setAddressHistory } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.history(),
    queryFn: async (): Promise<AddressHistoryEntry[]> => {
      const response = await deliverySettingsApiClient.getAddressHistory(limit);
      throwIfFailed(response, 'Failed to fetch address history');
      const history = response.data?.history ?? [];
      setAddressHistory(history);
      return history;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── Delivery Mode Settings Hooks ─────────────────────────────────────────────

export function useDeliveryModeSettings() {
  const { setDeliverySettings } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.settings(),
    queryFn: async (): Promise<DeliveryModeSettings | null> => {
      const response = await deliverySettingsApiClient.getDeliveryModeSettings();
      throwIfFailed(response, 'Failed to fetch delivery mode settings');
      const settings = response.data ?? null;
      setDeliverySettings(settings);
      return settings;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDeliveryModeSettingsWithDetails() {
  const { setSettingsWithDetails } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.settingsWithDetails(),
    queryFn: async () => {
      const response = await deliverySettingsApiClient.getDeliveryModeSettingsWithDetails();
      throwIfFailed(response, 'Failed to fetch delivery mode settings with details');
      const data = response.data;
      setSettingsWithDetails(data);
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useUpsertDeliveryModeSettings() {
  const queryClient = useQueryClient();
  const { setDeliverySettings, setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (data: CreateDeliveryModeSettingsInput) =>
      deliverySettingsApiClient.upsertDeliveryModeSettings(data),

    onMutate: () => setSubmitting(true),

    onSuccess: (response) => {
      const settings = response.data as DeliveryModeSettings;
      setDeliverySettings(settings);
      queryClient.setQueryData(deliverySettingsKeys.settings(), settings);
      queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.settingsWithDetails() });
      toast.success('Delivery settings updated successfully');
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update delivery settings');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useUpdateAddressDeliveryMode() {
  const queryClient = useQueryClient();
  const { updateAddress, setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: ({ addressId, deliveryMode }: { addressId: string; deliveryMode: DeliveryMode }) =>
      deliverySettingsApiClient.updateAddressDeliveryMode(addressId, deliveryMode),

    onMutate: () => setSubmitting(true),

    onSuccess: (response, variables) => {
      const address = response.data as DeliveryAddress;
      updateAddress(variables.addressId, address);
      queryClient.setQueryData(deliverySettingsKeys.addressDetail(variables.addressId), address);
      invalidateAddressQueries(queryClient);
      toast.success('Address delivery mode updated successfully');
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to update address delivery mode');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useAddressesByDeliveryMode(deliveryMode: DeliveryMode) {
  return useDeliveryAddresses(deliveryMode);
}

export function useDefaultAddressByDeliveryMode(deliveryMode: DeliveryMode) {
  const { data: addresses } = useDeliveryAddresses(deliveryMode);
  return addresses?.find((addr) => addr.isDefault) || addresses?.[0] || null;
}

// ─── Validation and Geocoding Hooks ───────────────────────────────────────────

export function useValidateAddress() {
  const { setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (addressData: Partial<CreateDeliveryAddressInput>) =>
      deliverySettingsApiClient.validateAddress(addressData),
    onMutate: () => setSubmitting(true),
    onError: (err: Error) => toast.error(err.message ?? 'Address validation failed'),
    onSettled: () => setSubmitting(false),
  });
}

export function useGeocodeAddress() {
  const { setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (addressData: Partial<CreateDeliveryAddressInput>) =>
      deliverySettingsApiClient.geocodeAddress(addressData),
    onMutate: () => setSubmitting(true),
    onError: (err: Error) => toast.error(err.message ?? 'Failed to geocode address'),
    onSettled: () => setSubmitting(false),
  });
}

// ─── Express Delivery Hooks ───────────────────────────────────────────────────

export function useExpressDeliveryEligibility(addressId: string | null) {
  const { setExpressEligibility } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.expressEligibility(addressId!),
    queryFn: async (): Promise<ExpressEligibilityResult> => {
      const response = await deliverySettingsApiClient.checkExpressDeliveryEligibility(addressId!);
      throwIfFailed(response, 'Failed to check express delivery eligibility');
      const result = response.data as ExpressEligibilityResult;
      setExpressEligibility(addressId!, result);
      return result;
    },
    enabled: !!addressId,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── Admin Hooks ──────────────────────────────────────────────────────────────

export function useBulkUpdateDeliveryModeSettings() {
  const queryClient = useQueryClient();
  const { setSubmitting } = useDeliverySettingsStore();

  return useMutation({
    mutationFn: (
      updates: Array<{
        userId: string;
        defaultDeliveryMode?: DeliveryMode;
        expressDeliveryEnabled?: boolean;
      }>
    ) => deliverySettingsApiClient.bulkUpdateDeliveryModeSettings(updates),

    onMutate: () => setSubmitting(true),

    onSuccess: (response) => {
      const results = response.data as BulkUpdateResult;
      queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.adminSettings() });
      if (results.failureCount === 0) {
        toast.success(`All ${results.successCount} users updated successfully`);
      } else {
        toast.warning(`${results.successCount} updated, ${results.failureCount} failed`);
      }
    },

    onError: (err: Error) => {
      toast.error(err.message ?? 'Failed to bulk update settings');
    },

    onSettled: () => setSubmitting(false),
  });
}

export function useAllDeliveryModeSettings(page: number = 1, limit: number = 20) {
  const { setAdminSettings } = useDeliverySettingsStore();

  return useQuery({
    queryKey: deliverySettingsKeys.adminSettings(page, limit),
    queryFn: async () => {
      const response = await deliverySettingsApiClient.getAllDeliveryModeSettings(page, limit);
      throwIfFailed(response, 'Failed to fetch all delivery mode settings');
      const data = response.data;
      if (!data) throw new Error('No delivery mode settings returned');
      setAdminSettings(data);
      return data;
    },
    staleTime: 2 * 60 * 1000,
    placeholderData: keepPreviousData,
  });
}

// ─── Composite Hook ───────────────────────────────────────────────────────────

export function useDeliverySettingsPage() {
  const addressesQuery = useDeliveryAddresses();
  const settingsQuery = useDeliveryModeSettings();
  const statsQuery = useDeliveryAddressStats();
  const historyQuery = useAddressHistory();
  const settingsWithDetailsQuery = useDeliveryModeSettingsWithDetails();

  const addAddress = useAddDeliveryAddress();
  const updateAddress = useUpdateDeliveryAddress();
  const removeAddress = useRemoveDeliveryAddress();
  const setDefaultAddress = useSetDefaultDeliveryAddress();
  const updateAddressMode = useUpdateAddressDeliveryMode();
  const updateSettings = useUpsertDeliveryModeSettings();
  const batchUpdate = useBatchUpdateDeliveryAddresses();

  const { addresses, deliverySettings, addressStats, addressHistory, isSubmitting, error } =
    useDeliverySettingsStore();

  const isLoading =
    addressesQuery.isLoading ||
    settingsQuery.isLoading ||
    statsQuery.isLoading ||
    historyQuery.isLoading;

  const queryError =
    addressesQuery.error?.message ??
    settingsQuery.error?.message ??
    statsQuery.error?.message ??
    historyQuery.error?.message ??
    null;

  const queryClient = useQueryClient();
  const refetchAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: deliverySettingsKeys.all });
  }, [queryClient]);

  const addressesByMode = {
    all: Object.values(addresses).flat(),
    DELIVERY: addresses.DELIVERY,
    PICKUP: addresses.PICKUP,
  };

  return {
    addresses: addressesByMode,
    deliverySettings,
    addressStats,
    addressHistory,
    settingsWithDetails: settingsWithDetailsQuery.data,
    isLoading,
    isSubmitting,
    error: queryError ?? error,
    addAddress: addAddress.mutateAsync,
    updateAddress: updateAddress.mutateAsync,
    removeAddress: removeAddress.mutateAsync,
    setDefaultAddress: setDefaultAddress.mutateAsync,
    updateAddressMode: updateAddressMode.mutateAsync,
    updateSettings: updateSettings.mutateAsync,
    batchUpdate: batchUpdate.mutateAsync,
    refetch: refetchAll,
    mutations: {
      addAddress: { isLoading: addAddress.isPending, error: addAddress.error },
      updateAddress: { isLoading: updateAddress.isPending, error: updateAddress.error },
      removeAddress: { isLoading: removeAddress.isPending, error: removeAddress.error },
      setDefaultAddress: { isLoading: setDefaultAddress.isPending, error: setDefaultAddress.error },
      updateAddressMode: { isLoading: updateAddressMode.isPending, error: updateAddressMode.error },
      updateSettings: { isLoading: updateSettings.isPending, error: updateSettings.error },
      batchUpdate: { isLoading: batchUpdate.isPending, error: batchUpdate.error },
    },
  };
}

// ─── Individual Action Hooks ──────────────────────────────────────────────────

export function useAddAddressAction() {
  const addAddress = useAddDeliveryAddress();
  const validateAddress = useValidateAddress();
  const geocodeAddress = useGeocodeAddress();

  const addWithValidation = useCallback(
    async (data: CreateDeliveryAddressInput) => {
      const validationRes = await validateAddress.mutateAsync(data);
      const validation = validationRes.data;
      if (!validation?.isValid) {
        throw new Error(validation?.errors?.[0]?.message ?? 'Address validation failed');
      }

      let finalData = { ...data };
      if (data.latitude == null || data.longitude == null) {
        const geocodeResult = await geocodeAddress.mutateAsync(data);
        const geo = geocodeResult.data;
        if (geo?.latitude != null && geo?.longitude != null) {
          finalData = { ...finalData, latitude: geo.latitude, longitude: geo.longitude };
        }
      }

      return addAddress.mutateAsync(finalData);
    },
    [addAddress, validateAddress, geocodeAddress]
  );

  return {
    addAddress: addWithValidation,
    isLoading: addAddress.isPending || validateAddress.isPending || geocodeAddress.isPending,
    error: addAddress.error || validateAddress.error || geocodeAddress.error,
  };
}