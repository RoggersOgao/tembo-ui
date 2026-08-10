// lib/maps.api.ts - Map API Client (Directions Only)

import { DirectionRoute, MapLocation } from '@/types/map.types';
import { getToken } from './get-token';

interface DirectionsRequest {
  from: {
    lng: number;
    lat: number;
  };
  to: {
    lng: number;
    lat: number;
  };
}

interface DirectionsResponse {
  route: DirectionRoute;
  cached: boolean;
}

interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
}

class MapApiClient {
  private baseURL: string;

  constructor() {
    this.baseURL = process.env.NEXT_PUBLIC_API_BASE_URL as string;
  }

  /**
   * @description Generic request handler with automatic token injection
   * @param endpoint - The API endpoint path
   * @param options - Standard RequestInit options
   * @param requireAuth - If true, requires authentication token
   */
  private async request<T>(
    endpoint: string,
    options: RequestInit = {},
    requireAuth: boolean = true
  ): Promise<T> {
    let token: string | undefined | null;

    if (requireAuth) {
      token = await getToken();

      if (!token) {
        throw new Error("Authorization token is missing. Please log in.");
      }
    }

    const headers: HeadersInit = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    };

    const res = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      credentials: "include",
      headers,
    });

    if (res.status === 401) {
      console.log("Unauthorized map request");
      throw new Error("Unauthorized");
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Request failed: ${res.status} ${text}`);
    }

    return res.json();
  }

  // --- Public API Methods ---

  /**
   * Get authentication token for external services
   */
  async getAuthToken(): Promise<string | null> {
    return  await getToken();
  }

  /**
   * Generate cache key from coordinates
   */
  generateCacheKey(fromLng: number, fromLat: number, toLng: number, toLat: number): string {
    return `${fromLng.toFixed(6)},${fromLat.toFixed(6)}-${toLng.toFixed(6)},${toLat.toFixed(6)}`;
  }

  /**
   * Fetch directions from backend API with caching
   */
  async getDirections(from: MapLocation, to: MapLocation): Promise<DirectionsResponse> {
    try {
      const requestBody: DirectionsRequest = {
        from: {
          lng: from.lng,
          lat: from.lat,
        },
        to: {
          lng: to.lng,
          lat: to.lat,
        },
      };

      return await this.request<DirectionsResponse>("/api/directions", {
        method: "POST",
        body: JSON.stringify(requestBody),
      });
    } catch (error) {
      console.error("Directions API error:", error);
      throw error;
    }
  }

  /**
   * Check if a route is cached
   */
  async getCachedRoute(key: string): Promise<DirectionRoute | null> {
    try {
      const response = await this.request<{ route: DirectionRoute; cached: boolean }>(
        `/api/directions/cache/${key}`,
        { method: "GET" }
      );
      return response.route;
    } catch (error) {
      if (error instanceof Error && error.message.includes("404")) {
        return null;
      }
      console.error("Get cached route error:", error);
      return null;
    }
  }

  /**
   * Clear all cached routes (admin only)
   */
  async clearCache(): Promise<void> {
    try {
      await this.request<{ message: string }>(
        "/api/directions/cache",
        { method: "DELETE" }
      );
      console.log("Cache cleared successfully");
    } catch (error) {
      console.error("Clear cache error:", error);
      throw error;
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<CacheStats> {
    try {
      return await this.request<CacheStats>(
        "/api/directions/stats",
        { method: "GET" }
      );
    } catch (error) {
      console.error("Get cache stats error:", error);
      throw error;
    }
  }
}

export const mapApiClient = new MapApiClient();