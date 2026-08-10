// stores/use-profile-store.ts
import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import type {
  Profile,
  DeliveryAddress,
  DeliveryModeSettings,
  DeliveryMode,
} from '@/lib/user/profile.api';

// ─── Helper: transform date strings → Date objects ────────────────────────────

function transformProfileDates(profile: any): Profile {
  return {
    ...profile,
    dateOfBirth:     profile.dateOfBirth     ? new Date(profile.dateOfBirth)     : null,
    idVerifiedAt:    profile.idVerifiedAt    ? new Date(profile.idVerifiedAt)    : null,
    idDocumentExpiry:profile.idDocumentExpiry? new Date(profile.idDocumentExpiry): null,
    createdAt:       new Date(profile.createdAt),
    updatedAt:       new Date(profile.updatedAt),
    deletedAt:       profile.deletedAt       ? new Date(profile.deletedAt)       : null,
    user: {
      ...profile.user,
      createdAt: new Date(profile.user.createdAt),
    },
    deliveryMode: profile.deliveryMode
      ? transformDeliveryModeSettingsDates(profile.deliveryMode)
      : null,
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

function transformDeliveryAddressDates(a: any): DeliveryAddress {
  return {
    ...a,
    createdAt: new Date(a.createdAt),
    updatedAt: new Date(a.updatedAt),
  };
}

// ─── State interface ──────────────────────────────────────────────────────────

interface ProfileState {
  // Data
  myProfile:            Profile | null;
  profiles:             Profile[];
  profilesById:         Record<string, Profile>;          // key: profileId
  deliveryAddresses:    Record<DeliveryMode | 'all', DeliveryAddress[]>;
  deliverySettings:     DeliveryModeSettings | null;

  // Pagination
  pagination: {
    total:      number;
    page:       number;
    limit:      number;
    totalPages: number;
    hasMore:    boolean;
  } | null;

  // UI State
  isLoading:    boolean;
  isSubmitting: boolean;
  error:        string | null;

  // ── Profile actions ────────────────────────────────────────────────────────
  setMyProfile:    (profile: Profile | null) => void;
  updateMyProfile: (updates: Partial<Profile>) => void;

  setProfiles:   (profiles: Profile[], pagination?: ProfileState['pagination']) => void;
  setProfile:    (profile: Profile) => void;
  removeProfile: (profileId: string) => void;

  // ── Delivery address actions ───────────────────────────────────────────────
  setDeliveryAddresses: (mode: DeliveryMode | 'all', addresses: DeliveryAddress[]) => void;
  addDeliveryAddress:   (address: DeliveryAddress) => void;
  updateDeliveryAddress:(addressId: string, updates: Partial<DeliveryAddress>) => void;
  removeDeliveryAddress:(addressId: string) => void;
  setDefaultAddress:    (addressId: string) => void;

  // ── Delivery settings actions ──────────────────────────────────────────────
  setDeliverySettings:    (settings: DeliveryModeSettings | null) => void;
  updateDeliverySettings: (updates: Partial<DeliveryModeSettings>) => void;

  // ── UI actions ─────────────────────────────────────────────────────────────
  setLoading:    (loading: boolean)    => void;
  setSubmitting: (submitting: boolean) => void;
  setError:      (error: string | null) => void;

  // ── Reset ──────────────────────────────────────────────────────────────────
  reset:        () => void;
  resetProfile: (profileId: string) => void;
}

// ─── Initial delivery addresses map ──────────────────────────────────────────

const emptyAddresses: Record<DeliveryMode | 'all', DeliveryAddress[]> = {
  DELIVERY: [],
  PICKUP:   [],
  all:      [],
};

// ─── Store ────────────────────────────────────────────────────────────────────

export const useProfileStore = create<ProfileState>()(
  devtools(
    (set, get) => ({
      // ── Initial State ──────────────────────────────────────────────────────
      myProfile:         null,
      profiles:          [],
      profilesById:      {},
      deliveryAddresses: { ...emptyAddresses },
      deliverySettings:  null,
      pagination:        null,
      isLoading:         false,
      isSubmitting:      false,
      error:             null,

      // ── Profile ────────────────────────────────────────────────────────────

      setMyProfile: (profile) =>
        set({ myProfile: profile ? transformProfileDates(profile) : null }),

      updateMyProfile: (updates) =>
        set((state) => ({
          myProfile: state.myProfile
            ? { ...state.myProfile, ...updates, updatedAt: new Date() }
            : null,
        })),

      setProfiles: (profiles, pagination) =>
        set((state) => {
          const transformed = profiles.map(transformProfileDates);
          const byId = { ...state.profilesById };
          transformed.forEach((p) => { byId[p.id] = p; });
          return {
            profiles: transformed,
            profilesById: byId,
            ...(pagination ? { pagination } : {}),
          };
        }),

      setProfile: (profile) =>
        set((state) => {
          const transformed = transformProfileDates(profile);
          return {
            profilesById: { ...state.profilesById, [transformed.id]: transformed },
            profiles: state.profiles.some((p) => p.id === transformed.id)
              ? state.profiles.map((p) => (p.id === transformed.id ? transformed : p))
              : [...state.profiles, transformed],
          };
        }),

      removeProfile: (profileId) =>
        set((state) => {
          const profilesById = { ...state.profilesById };
          delete profilesById[profileId];
          return {
            profilesById,
            profiles: state.profiles.filter((p) => p.id !== profileId),
          };
        }),

      // ── Delivery Addresses ─────────────────────────────────────────────────

      setDeliveryAddresses: (mode, addresses) =>
        set((state) => ({
          deliveryAddresses: {
            ...state.deliveryAddresses,
            [mode]: addresses.map(transformDeliveryAddressDates),
          },
        })),

      addDeliveryAddress: (address) =>
        set((state) => {
          const transformed = transformDeliveryAddressDates(address);
          const mode        = transformed.deliveryMode;

          // If new address is default, unset existing defaults in same mode
          const updateList = (list: DeliveryAddress[]) =>
            transformed.isDefault
              ? [transformed, ...list.map((a) => ({ ...a, isDefault: false }))]
              : [transformed, ...list];

          return {
            deliveryAddresses: {
              ...state.deliveryAddresses,
              all:  updateList(state.deliveryAddresses.all),
              [mode]: updateList(state.deliveryAddresses[mode]),
            },
          };
        }),

      updateDeliveryAddress: (addressId, updates) =>
        set((state) => {
          const applyUpdate = (list: DeliveryAddress[]) =>
            list.map((a) => (a.id === addressId ? { ...a, ...updates, updatedAt: new Date() } : a));

          return {
            deliveryAddresses: {
              DELIVERY: applyUpdate(state.deliveryAddresses.DELIVERY),
              PICKUP:   applyUpdate(state.deliveryAddresses.PICKUP),
              all:      applyUpdate(state.deliveryAddresses.all),
            },
          };
        }),

      removeDeliveryAddress: (addressId) =>
        set((state) => {
          const filterOut = (list: DeliveryAddress[]) => list.filter((a) => a.id !== addressId);
          return {
            deliveryAddresses: {
              DELIVERY: filterOut(state.deliveryAddresses.DELIVERY),
              PICKUP:   filterOut(state.deliveryAddresses.PICKUP),
              all:      filterOut(state.deliveryAddresses.all),
            },
          };
        }),

      setDefaultAddress: (addressId) =>
        set((state) => {
          const markDefault = (list: DeliveryAddress[]) =>
            list.map((a) => ({ ...a, isDefault: a.id === addressId }));

          return {
            deliveryAddresses: {
              DELIVERY: markDefault(state.deliveryAddresses.DELIVERY),
              PICKUP:   markDefault(state.deliveryAddresses.PICKUP),
              all:      markDefault(state.deliveryAddresses.all),
            },
          };
        }),

      // ── Delivery Settings ──────────────────────────────────────────────────

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

      // ── UI ─────────────────────────────────────────────────────────────────

      setLoading:    (isLoading)    => set({ isLoading }),
      setSubmitting: (isSubmitting) => set({ isSubmitting }),
      setError:      (error)        => set({ error }),

      // ── Reset ──────────────────────────────────────────────────────────────

      reset: () =>
        set({
          myProfile:         null,
          profiles:          [],
          profilesById:      {},
          deliveryAddresses: { ...emptyAddresses },
          deliverySettings:  null,
          pagination:        null,
          isLoading:         false,
          isSubmitting:      false,
          error:             null,
        }),

      resetProfile: (profileId) =>
        set((state) => {
          const profilesById = { ...state.profilesById };
          delete profilesById[profileId];
          return {
            profilesById,
            profiles: state.profiles.filter((p) => p.id !== profileId),
          };
        }),
    }),
    { name: 'ProfileStore' },
  ),
);