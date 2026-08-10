// store/mapStore.ts - Updated to use mapApiClient only
import { DirectionRoute, MapLocation, MapPin } from '@/types/map.types';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { mapApiClient } from '@/lib/maps.api';

interface ViewState {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

interface NavigationState {
  isNavigating: boolean;
  followUser: boolean;
  destinationPin: MapPin | null;
}

interface MapStore {
  // Camera state
  viewState: ViewState;
  hasUserInteracted: boolean;
  
  // User location
  userLocation: MapLocation | null;
  
  // Navigation state
  navigation: NavigationState;
  
  // Route state
  activeRoute: DirectionRoute | null;
  lastRouteParams: string;
  routeCalculated: boolean;
  
  // Map instance state
  mapLoaded: boolean;
  
  // Actions - Camera
  setViewState: (state: Partial<ViewState>) => void;
  setUserInteracted: (interacted: boolean) => void;
  
  // Actions - User Location
  setUserLocation: (location: MapLocation | null) => void;
  
  // Actions - Navigation
  setNavigation: (nav: Partial<NavigationState>) => void;
  startNavigation: (destination: MapPin) => void;
  stopNavigation: () => void;
  
  // Actions - Route
  setRoute: (route: DirectionRoute | null, params: string) => void;
  clearRoute: () => void;
  setRouteCalculated: (calculated: boolean) => void;
  fetchRoute: (from: MapLocation, to: MapLocation) => Promise<DirectionRoute | null>;
  
  // Actions - Map
  setMapLoaded: (loaded: boolean) => void;
  
  // Computed
  shouldFollowUser: () => boolean;
}

const DEFAULT_VIEW_STATE: ViewState = {
  lng: 36.8219,
  lat: -1.2921,
  zoom: 12,
  pitch: 45,
  bearing: -25,
};

export const useMapStore = create<MapStore>()(
  persist(
    (set, get) => ({
      // Initial state
      viewState: DEFAULT_VIEW_STATE,
      hasUserInteracted: false,
      userLocation: null,
      navigation: {
        isNavigating: false,
        followUser: false,
        destinationPin: null,
      },
      activeRoute: null,
      lastRouteParams: '',
      routeCalculated: false,
      mapLoaded: false,
      
      // Camera actions
      setViewState: (state) =>
        set((prev) => ({
          viewState: { ...prev.viewState, ...state },
        })),
      
      setUserInteracted: (interacted) =>
        set({ hasUserInteracted: interacted }),
      
      // User location actions
      setUserLocation: (location) =>
        set({ userLocation: location }),
      
      // Navigation actions
      setNavigation: (nav) =>
        set((prev) => ({
          navigation: { ...prev.navigation, ...nav },
        })),
      
      startNavigation: (destination) =>
        set({
          navigation: {
            isNavigating: true,
            followUser: true,
            destinationPin: destination,
          },
          hasUserInteracted: false,
        }),
      
      stopNavigation: () =>
        set({
          navigation: {
            isNavigating: false,
            followUser: false,
            destinationPin: null,
          },
          activeRoute: null,
          lastRouteParams: '',
          routeCalculated: false,
        }),
      
      // Route actions
      setRoute: (route, params) =>
        set({
          activeRoute: route,
          lastRouteParams: params,
        }),
      
      clearRoute: () =>
        set({
          activeRoute: null,
          lastRouteParams: '',
          routeCalculated: false,
        }),
      
      setRouteCalculated: (calculated) =>
        set({ routeCalculated: calculated }),
      
      fetchRoute: async (from: MapLocation, to: MapLocation) => {
        try {
          const routeKey = mapApiClient.generateCacheKey(
            from.lng,
            from.lat,
            to.lng,
            to.lat
          );
          
          // Check if we already have this route
          const state = get();
          if (state.lastRouteParams === routeKey && state.activeRoute) {
            console.log('Route already loaded from store');
            return state.activeRoute;
          }
          
          // Fetch from backend via mapApiClient
          const response = await mapApiClient.getDirections(from, to);
          
          if (!response || !response.route) {
            set({
              activeRoute: null,
              lastRouteParams: '',
              routeCalculated: false,
            });
            return null;
          }
          
          const { route, cached } = response;
          console.log(`Route ${cached ? 'from cache' : 'from Mapbox'}`);
          
          // Update store
          set({
            activeRoute: route,
            lastRouteParams: routeKey,
            routeCalculated: true,
          });
          
          return route;
        } catch (error) {
          console.error('Error fetching route:', error);
          set({
            activeRoute: null,
            lastRouteParams: '',
            routeCalculated: false,
          });
          return null;
        }
      },
      
      // Map actions
      setMapLoaded: (loaded) =>
        set({ mapLoaded: loaded }),
      
      // Computed
      shouldFollowUser: () => {
        const state = get();
        return (
          (state.navigation.followUser || state.navigation.isNavigating) &&
          !state.hasUserInteracted
        );
      },
    }),
    {
      name: 'map-storage',
      partialize: (state) => ({
        viewState: state.viewState,
        hasUserInteracted: state.hasUserInteracted,
        userLocation: state.userLocation,
        navigation: state.navigation,
        activeRoute: state.activeRoute,
        lastRouteParams: state.lastRouteParams,
      }),
    }
  )
);