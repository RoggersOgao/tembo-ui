// hooks/use-profile.ts
import { useCallback } from 'react';
import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  profileApiClient,
  type Profile,
  type ProfileFilter,
  type PaginatedProfiles,
  type ProfileStats,
  type CreateProfileInput,
  type UpdateProfileInput,
  type CreateDeliveryAddressInput,
  type UpdateDeliveryAddressInput,
  type CreateDeliveryModeSettingsInput,
  type DeliveryAddress,
  type DeliveryModeSettings,
  type DeliveryMode,
} from '@/lib/user/profile.api';
import { useProfileStore } from '../zustand/stores/user/profile-store';


// ─── Query Key Factory ────────────────────────────────────────────────────────

export const profileKeys = {
  all:              ['profiles'] as const,
  lists:            () => [...profileKeys.all, 'list'] as const,
  list:             (filters?: object) => [...profileKeys.lists(), filters] as const,
  details:          () => [...profileKeys.all, 'detail'] as const,
  detail:           (id: string) => [...profileKeys.details(), id] as const,
  me:               () => [...profileKeys.all, 'me'] as const,
  public:           (userId: string) => [...profileKeys.all, 'public', userId] as const,
  stats:            () => [...profileKeys.all, 'stats'] as const,
  deliverySettings: () => [...profileKeys.all, 'delivery-settings'] as const,
  deliveryAddresses:(mode?: DeliveryMode) => [...profileKeys.all, 'delivery-addresses', mode ?? 'all'] as const,
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

function invalidateProfileLists(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: profileKeys.lists() });
  queryClient.invalidateQueries({ queryKey: profileKeys.stats() });
}

// ─── useMyProfile ─────────────────────────────────────────────────────────────

export function useMyProfile() {
  const { setMyProfile } = useProfileStore();

  return useQuery({
    queryKey: profileKeys.me(),
    queryFn:  async (): Promise<Profile> => {
      const response = await profileApiClient.getMyProfile();
      throwIfFailed(response, 'Failed to fetch profile');
      const profile = response.data as Profile;
      setMyProfile(profile);
      return profile;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useProfile (single by id) ────────────────────────────────────────────────

export function useProfile(id: string | null) {
  const { setProfile } = useProfileStore();

  return useQuery({
    queryKey: profileKeys.detail(id!),
    queryFn:  async (): Promise<Profile> => {
      const response = await profileApiClient.getProfileById(id!);
      throwIfFailed(response, 'Failed to fetch profile');
      const profile = response.data as Profile;
      setProfile(profile);
      return profile;
    },
    enabled:   !!id,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useProfiles (paginated) ──────────────────────────────────────────────────

export function useProfiles(filters: ProfileFilter = {}) {
  const { setProfiles } = useProfileStore();

  return useQuery({
    queryKey: profileKeys.list(filters),
    queryFn:  async (): Promise<PaginatedProfiles> => {
      const response = await profileApiClient.getProfiles(filters);
      throwIfFailed(response, 'Failed to fetch profiles');
      const data = response.data as PaginatedProfiles;
      setProfiles(data.profiles, data.pagination);
      return data;
    },
    placeholderData: keepPreviousData,
    staleTime: 2 * 60 * 1000,
  });
}

// ─── usePublicProfile ─────────────────────────────────────────────────────────

export function usePublicProfile(userId: string | null) {
  const { setProfile } = useProfileStore();

  return useQuery({
    queryKey: profileKeys.public(userId!),
    queryFn:  async (): Promise<Profile> => {
      const response = await profileApiClient.getPublicProfile(userId!);
      throwIfFailed(response, 'Failed to fetch public profile');
      const profile = response.data as Profile;
      setProfile(profile);
      return profile;
    },
    enabled:   !!userId,
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useProfileStats ──────────────────────────────────────────────────────────

export function useProfileStats() {
  return useQuery({
    queryKey: profileKeys.stats(),
    queryFn:  async (): Promise<ProfileStats> => {
      const response = await profileApiClient.getProfileStats();
      throwIfFailed(response, 'Failed to fetch profile stats');
      return response.data as ProfileStats;
    },
    staleTime: 60 * 1000,
  });
}

// ─── useCreateProfile ─────────────────────────────────────────────────────────

export function useCreateProfile() {
  const queryClient                   = useQueryClient();
  const { setProfile, setSubmitting } = useProfileStore();

  return useMutation({
    mutationFn: (data: CreateProfileInput) =>
      profileApiClient.createProfile(data),

    onMutate: () => setSubmitting(true),

    onSuccess: (response) => {
      throwIfFailed(response, 'Failed to create profile');
      const profile = response.data as Profile;
      setProfile(profile);
      queryClient.setQueryData(profileKeys.detail(profile.id), profile);
      invalidateProfileLists(queryClient);
      toast.success('Profile created successfully');
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to create profile');
    },

    onSettled: () => setSubmitting(false),
  });
}

// ─── useUpdateMyProfile ───────────────────────────────────────────────────────

export function useUpdateMyProfile() {
  const queryClient                        = useQueryClient();
  const { setMyProfile, setSubmitting }    = useProfileStore();

  return useMutation({
    mutationFn: (data: UpdateProfileInput) =>
      profileApiClient.updateMyProfile(data),

    onMutate: () => setSubmitting(true),

    onSuccess: (response) => {
      throwIfFailed(response, 'Failed to update profile');
      const profile = response.data as Profile;
      setMyProfile(profile);
      queryClient.setQueryData(profileKeys.me(), profile);
      invalidateProfileLists(queryClient);
      toast.success('Profile updated successfully');
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },

    onSettled: () => setSubmitting(false),
  });
}

// ─── useUpdateProfile (by id — admin) ────────────────────────────────────────

export function useUpdateProfile() {
  const queryClient                   = useProfileStore();
  const { setProfile, setSubmitting } = useProfileStore();
  const qc                            = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProfileInput }) =>
      profileApiClient.updateProfileById(id, data),

    onMutate: () => setSubmitting(true),

    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to update profile');
      const profile = response.data as Profile;
      setProfile(profile);
      qc.setQueryData(profileKeys.detail(variables.id), profile);
      invalidateProfileLists(qc);
      toast.success('Profile updated successfully');
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update profile');
    },

    onSettled: () => setSubmitting(false),
  });
}

// ─── useDeleteProfile ─────────────────────────────────────────────────────────

export function useDeleteProfile() {
  const queryClient                      = useQueryClient();
  const { removeProfile, setSubmitting } = useProfileStore();

  return useMutation({
    mutationFn: (id: string) =>
      profileApiClient.deleteProfileById(id),

    onMutate: () => setSubmitting(true),

    onSuccess: (response, id) => {
      throwIfFailed(response, 'Failed to delete profile');
      removeProfile(id);
      queryClient.removeQueries({ queryKey: profileKeys.detail(id) });
      invalidateProfileLists(queryClient);
      toast.success('Profile deleted successfully');
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to delete profile');
    },

    onSettled: () => setSubmitting(false),
  });
}










// ─── useDeliveryModeSettings ──────────────────────────────────────────────────

export function useDeliveryModeSettings() {
  const { setDeliverySettings } = useProfileStore();

  return useQuery({
    queryKey: profileKeys.deliverySettings(),
    queryFn:  async (): Promise<DeliveryModeSettings | null> => {
      const response = await profileApiClient.getDeliveryModeSettings();
      throwIfFailed(response, 'Failed to fetch delivery mode settings');
      setDeliverySettings(response.data ?? null);
      return response.data ?? null;
    },
    staleTime: 5 * 60 * 1000,
  });
}

// ─── useUpdateDeliveryModeSettings ───────────────────────────────────────────

export function useUpdateDeliveryModeSettings() {
  const queryClient                             = useQueryClient();
  const { setDeliverySettings, setSubmitting }  = useProfileStore();

  return useMutation({
    mutationFn: (data: CreateDeliveryModeSettingsInput) =>
      profileApiClient.updateDeliveryModeSettings(data),

    onMutate: () => setSubmitting(true),

    onSuccess: (response) => {
      throwIfFailed(response, 'Failed to update delivery mode settings');
      const settings = response.data as DeliveryModeSettings;
      setDeliverySettings(settings);
      queryClient.setQueryData(profileKeys.deliverySettings(), settings);
      // Also invalidate my profile since it includes deliveryMode relation
      queryClient.invalidateQueries({ queryKey: profileKeys.me() });
      toast.success('Delivery settings updated successfully');
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update delivery settings');
    },

    onSettled: () => setSubmitting(false),
  });
}

// ─── useDeliveryAddresses ─────────────────────────────────────────────────────

export function useDeliveryAddresses(mode: DeliveryMode) {
  const { setDeliveryAddresses } = useProfileStore();

  return useQuery({
    queryKey: profileKeys.deliveryAddresses(mode),
    queryFn:  async (): Promise<DeliveryAddress[]> => {
      const response = await profileApiClient.getAddressesByDeliveryMode(mode);
      throwIfFailed(response, 'Failed to fetch delivery addresses');
      const addresses = response.data?.deliveryAddresses ?? [];
      setDeliveryAddresses(mode, addresses);
      return addresses;
    },
    staleTime: 5 * 60 * 1000,
  });
}



export function useAddDeliveryAddress() {
    const queryClient              = useQueryClient()
    const { setSubmitting }        = useProfileStore()
 
    return useMutation({
        mutationFn: async (data: CreateDeliveryAddressInput): Promise<DeliveryAddress> => {
            const response = await profileApiClient.addDeliveryAddress(data)
            if (!response.success || !response.data) {
                throw new Error(response.errors?.[0]?.message ?? "Failed to save address")
            }
            return response.data
        },
 
        onMutate: () => setSubmitting(true),
 
        onSuccess: (address) => {
            // Invalidate relevant address lists so they refetch
            queryClient.invalidateQueries({ queryKey: profileKeys.deliveryAddresses("DELIVERY") })
            queryClient.invalidateQueries({ queryKey: profileKeys.deliveryAddresses("PICKUP")   })
            queryClient.invalidateQueries({ queryKey: profileKeys.deliveryAddresses()            })
 
            // Also bust the profile — default flag may have changed
            queryClient.invalidateQueries({ queryKey: profileKeys.me() })
 
            toast.success("Address saved successfully")
            return address
        },
 
        onError: (err: Error) => {
            toast.error(err.message ?? "Failed to save address")
        },
 
        onSettled: () => setSubmitting(false),
    })
}

// ─── useUpdateAddressDeliveryMode ─────────────────────────────────────────────

export function useUpdateAddressDeliveryMode() {
  const queryClient                             = useQueryClient();
  const { updateDeliveryAddress, setSubmitting } = useProfileStore();

  return useMutation({
    mutationFn: ({ addressId, deliveryMode }: { addressId: string; deliveryMode: DeliveryMode }) =>
      profileApiClient.updateAddressDeliveryMode(addressId, deliveryMode),

    onMutate: () => setSubmitting(true),

    onSuccess: (response, variables) => {
      throwIfFailed(response, 'Failed to update address delivery mode');
      const address = response.data as DeliveryAddress;
      updateDeliveryAddress(variables.addressId, address);
      // Invalidate both modes — address may have moved between lists
      queryClient.invalidateQueries({ queryKey: profileKeys.deliveryAddresses('DELIVERY') });
      queryClient.invalidateQueries({ queryKey: profileKeys.deliveryAddresses('PICKUP') });
      queryClient.invalidateQueries({ queryKey: profileKeys.deliveryAddresses() });
      toast.success('Address delivery mode updated successfully');
    },

    onError: (error: Error) => {
      toast.error(error.message || 'Failed to update address delivery mode');
    },

    onSettled: () => setSubmitting(false),
  });
}

// ─── useProfile (composite — current user, all data) ─────────────────────────
// Convenience hook that wires together all profile data for a profile page

export function useProfilePage() {
  const myProfileQuery      = useMyProfile();
  const settingsQuery       = useDeliveryModeSettings();
  const deliveryQuery       = useDeliveryAddresses('DELIVERY');
  const pickupQuery         = useDeliveryAddresses('PICKUP');
  const updateProfile       = useUpdateMyProfile();
  const updateSettings      = useUpdateDeliveryModeSettings();
  const updateAddressMode   = useUpdateAddressDeliveryMode();

  const { myProfile, deliverySettings, deliveryAddresses, isSubmitting, error } =
    useProfileStore();

  const isLoading =
    myProfileQuery.isLoading ||
    settingsQuery.isLoading  ||
    deliveryQuery.isLoading  ||
    pickupQuery.isLoading;

  const queryError =
    myProfileQuery.error?.message  ??
    settingsQuery.error?.message   ??
    deliveryQuery.error?.message   ??
    pickupQuery.error?.message     ??
    null;

  const refetchAll = useCallback(() => {
    myProfileQuery.refetch();
    settingsQuery.refetch();
    deliveryQuery.refetch();
    pickupQuery.refetch();
  }, [myProfileQuery, settingsQuery, deliveryQuery, pickupQuery]);

  return {
    // Data
    profile:          myProfile,
    deliverySettings,
    deliveryAddresses: deliveryAddresses.DELIVERY,
    pickupAddresses:   deliveryAddresses.PICKUP,

    // Loading / error
    isLoading,
    isSubmitting,
    error: queryError ?? error,

    // Actions
    updateProfile:     useCallback(
      (data: UpdateProfileInput) => updateProfile.mutateAsync(data),
      [updateProfile]
    ),
    updateSettings:    useCallback(
      (data: CreateDeliveryModeSettingsInput) => updateSettings.mutateAsync(data),
      [updateSettings]
    ),
    updateAddressMode: useCallback(
      (addressId: string, mode: DeliveryMode) =>
        updateAddressMode.mutateAsync({ addressId, deliveryMode: mode }),
      [updateAddressMode]
    ),

    // Manual refetch
    refetch: refetchAll,
  };
}