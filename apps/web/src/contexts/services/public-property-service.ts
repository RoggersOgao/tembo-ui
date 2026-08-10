// // services/property-service.ts

// import { PropertyFilters, usePublicPropertyStore } from "@/hooks/zustand/stores/public-property-store";
// import { publicPropertyApiClient } from "@/lib/public-property.api";


// export class PropertyService {
//   /**
//    * Fetch featured properties
//    */
//   static async getFeatured(limit: number = 10) {
//     const { setProperties, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getFeatured(limit);
//       setProperties(response.data);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch featured properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Fetch available properties with filters
//    */
//   static async getAvailable(filters: PropertyFilters, page: number = 1, limit: number = 20) {
//     const { setProperties, setPagination, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getAvailable(filters, page, limit);
//       setProperties(response.data);
      
//       if (response.pagination) {
//         setPagination(response.pagination);
//       }
      
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Fetch property by ID
//    */
//   static async getById(id: string) {
//     const { setSelectedProperty, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getById(id);
//       setSelectedProperty(response.data);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch property';
//       setError(message);
//       setSelectedProperty(null);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Search properties
//    */
//   static async search(query: string, page: number = 1, limit: number = 20) {
//     const { setProperties, setPagination, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.search(query, page, limit);
//       setProperties(response.data);
      
//       if (response.pagination) {
//         setPagination(response.pagination);
//       }
      
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to search properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * AI-powered search
//    */
//   static async searchWithAI(query: string, page: number = 1, limit: number = 20) {
//     const { setProperties, setPagination, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.searchWithAI(query, page, limit);
//       setProperties(response.data);
      
//       if (response.pagination) {
//         setPagination(response.pagination);
//       }
      
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to search properties with AI';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get properties by location
//    */
//   static async getByLocation(location: any, page: number = 1, limit: number = 20) {
//     const { setProperties, setPagination, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getByLocation(location, page, limit);
//       setProperties(response.data);
      
//       if (response.pagination) {
//         setPagination(response.pagination);
//       }
      
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch properties by location';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get similar properties
//    */
//   static async getSimilar(id: string, limit: number = 6) {
//     const { setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getSimilar(id, limit);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch similar properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get nearby properties
//    */
//   static async getNearby(lat: number, lng: number, radius: number = 5, limit: number = 20) {
//     const { setProperties, setPagination, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getNearby(lat, lng, radius, limit);
//       setProperties(response.data);
      
//       if (response.pagination) {
//         setPagination(response.pagination);
//       }
      
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch nearby properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get recent properties
//    */
//   static async getRecent(limit: number = 12) {
//     const { setProperties, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getRecent(limit);
//       setProperties(response.data);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch recent properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get top-rated properties
//    */
//   static async getTopRated(limit: number = 10) {
//     const { setProperties, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getTopRated(limit);
//       setProperties(response.data);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch top-rated properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get available filters
//    */
//   static async getFilters() {
//     const { setAvailableFilters, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getFilters();
//       setAvailableFilters(response.data);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch filters';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get price statistics
//    */
//   static async getPriceStats(filters?: PropertyFilters) {
//     const { setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getPriceStats(filters);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch price statistics';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Get overall statistics
//    */
//   static async getStats() {
//     const { setStats, setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.getStats();
//       setStats(response.data);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to fetch statistics';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }

//   /**
//    * Compare properties
//    */
//   static async compareProperties(ids: string[]) {
//     const { setLoading, setError } = usePublicPropertyStore.getState();
    
//     setLoading(true);
//     setError(null);
    
//     try {
//       const response = await publicPropertyApiClient.comparepublicProperties(ids);
//       return response.data;
//     } catch (error: any) {
//       const message = error.message || 'Failed to compare properties';
//       setError(message);
//       throw error;
//     } finally {
//       setLoading(false);
//     }
//   }
// }