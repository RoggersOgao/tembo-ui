// types/map.types.ts - Complete type definitions

/**
 * Basic location with coordinates
 */
export interface MapLocation {
  lat: number;
  lng: number;
  heading?: number; // Device compass heading in degrees (0-360)
}

/**
 * Map pin/marker
 */
export interface MapPin extends MapLocation {
  id: string;
  title?: string;
  description?: string;
  avatar?: string;
  name?:string;
  color?: string;
  icon?: string;
}

/**
 * Route geometry from Mapbox
 */
export interface RouteGeometry {
  type: 'LineString';
  coordinates: [number, number][]; // [lng, lat] pairs
}

/**
 * Direction route information
 */
export interface DirectionRoute {
  distance: number; // meters
  duration: number; // seconds
  geometry: RouteGeometry;
}

/**
 * View state for map camera
 */
export interface ViewState {
  lng: number;
  lat: number;
  zoom: number;
  pitch: number;
  bearing: number;
}

/**
 * Navigation state
 */
export interface NavigationState {
  isNavigating: boolean;
  followUser: boolean;
  destinationPin: MapPin | null;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

/**
 * Directions API request body
 */
export interface DirectionsRequest {
  from: {
    lng: number;
    lat: number;
  };
  to: {
    lng: number;
    lat: number;
  };
}

/**
 * Directions API response
 */
export interface DirectionsResponse {
  route: DirectionRoute;
  cached: boolean;
}

/**
 * Cache statistics
 */
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

/**
 * API error response
 */
export interface ApiErrorResponse {
  error: string;
  message?: string;
}

// =============================================================================
// Mapbox API Types (for reference, used in backend)
// =============================================================================

/**
 * Mapbox Directions API response (backend use)
 */
export interface MapboxResponse {
  code: string;
  message?: string;
  routes?: MapboxRoute[];
  waypoints?: MapboxWaypoint[];
}

/**
 * Mapbox route (backend use)
 */
export interface MapboxRoute {
  distance: number;
  duration: number;
  geometry: RouteGeometry;
  legs?: MapboxLeg[];
  weight: number;
  weight_name: string;
}

/**
 * Mapbox route leg (backend use)
 */
export interface MapboxLeg {
  distance: number;
  duration: number;
  steps?: MapboxStep[];
  summary: string;
}

/**
 * Mapbox route step (backend use)
 */
export interface MapboxStep {
  distance: number;
  duration: number;
  geometry: RouteGeometry;
  maneuver: {
    bearing_after: number;
    bearing_before: number;
    location: [number, number];
    type: string;
    instruction: string;
  };
  name: string;
  mode: string;
}

/**
 * Mapbox waypoint (backend use)
 */
export interface MapboxWaypoint {
  distance: number;
  name: string;
  location: [number, number];
}