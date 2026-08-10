// services/cache/delivery-settings.cache.service.ts
import cacheService from '../cache.service';
import { logger } from '@repo/logger';

export interface DeliverySettingsCacheStats {
  hits: number;
  misses: number;
  addressKeys: number;
  userAddressesKeys: number;
  settingsKeys: number;
  addressStatsKeys: number;
  mode: 'redis' | 'memory';
}

class DeliverySettingsCacheService {
  // Cache TTLs (in seconds)
  private readonly CACHE_TTL = {
    ADDRESS: 1800,              // 30 minutes for individual addresses
    USER_ADDRESSES: 900,        // 15 minutes for user addresses list
    SETTINGS: 3600,             // 1 hour for delivery mode settings
    ADDRESS_STATS: 1800,        // 30 minutes for address statistics
    ADDRESS_HISTORY: 1800,      // 30 minutes for address history
  };

  // Cache key generators
  getAddressKey(addressId: string): string {
    return `delivery:address:${addressId}`;
  }

  getUserAddressesKey(userId: string, deliveryMode?: string): string {
    if (deliveryMode) {
      return `delivery:addresses:user:${userId}:mode:${deliveryMode}`;
    }
    return `delivery:addresses:user:${userId}:all`;
  }

  getUserAddressesPaginatedKey(userId: string, page: number, limit: number, deliveryMode?: string): string {
    if (deliveryMode) {
      return `delivery:addresses:user:${userId}:mode:${deliveryMode}:page:${page}:limit:${limit}`;
    }
    return `delivery:addresses:user:${userId}:page:${page}:limit:${limit}`;
  }

  getDeliverySettingsKey(userId: string): string {
    return `delivery:settings:${userId}`;
  }

  getDeliverySettingsWithDetailsKey(userId: string): string {
    return `delivery:settings:details:${userId}`;
  }

  getAddressStatsKey(userId: string): string {
    return `delivery:address:stats:${userId}`;
  }

  getDefaultAddressKey(userId: string, deliveryMode?: string): string {
    if (deliveryMode) {
      return `delivery:default:address:${userId}:mode:${deliveryMode}`;
    }
    return `delivery:default:address:${userId}`;
  }

  getAddressHistoryKey(userId: string, limit: number): string {
    return `delivery:address:history:${userId}:limit:${limit}`;
  }

  // =========================================================================
  // GET CACHE METHODS
  // =========================================================================

  /**
   * Get delivery address by ID from cache
   */
  async getAddress<T = any>(addressId: string): Promise<T | null> {
    try {
      const cacheKey = this.getAddressKey(addressId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Delivery address cache hit', { addressId });
        return cached;
      }
      
      logger.debug('Delivery address cache miss', { addressId });
      return null;
    } catch (error) {
      logger.error('Error getting delivery address from cache', { addressId, error });
      return null;
    }
  }

  /**
   * Get user addresses from cache
   */
  async getUserAddresses<T = any>(userId: string, deliveryMode?: string): Promise<T | null> {
    try {
      const cacheKey = this.getUserAddressesKey(userId, deliveryMode);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User addresses cache hit', { userId, deliveryMode });
        return cached;
      }
      
      logger.debug('User addresses cache miss', { userId, deliveryMode });
      return null;
    } catch (error) {
      logger.error('Error getting user addresses from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get paginated user addresses from cache
   */
  async getUserAddressesPaginated<T = any>(userId: string, page: number, limit: number, deliveryMode?: string): Promise<T | null> {
    try {
      const cacheKey = this.getUserAddressesPaginatedKey(userId, page, limit, deliveryMode);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Paginated user addresses cache hit', { userId, page, limit, deliveryMode });
        return cached;
      }
      
      logger.debug('Paginated user addresses cache miss', { userId, page, limit, deliveryMode });
      return null;
    } catch (error) {
      logger.error('Error getting paginated user addresses from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get delivery settings from cache
   */
  async getDeliverySettings<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getDeliverySettingsKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Delivery settings cache hit', { userId });
        return cached;
      }
      
      logger.debug('Delivery settings cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting delivery settings from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get delivery settings with details from cache
   */
  async getDeliverySettingsWithDetails<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getDeliverySettingsWithDetailsKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Delivery settings with details cache hit', { userId });
        return cached;
      }
      
      logger.debug('Delivery settings with details cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting delivery settings with details from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get address statistics from cache
   */
  async getAddressStats<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getAddressStatsKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Address stats cache hit', { userId });
        return cached;
      }
      
      logger.debug('Address stats cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting address stats from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get default address from cache
   */
  async getDefaultAddress<T = any>(userId: string, deliveryMode?: string): Promise<T | null> {
    try {
      const cacheKey = this.getDefaultAddressKey(userId, deliveryMode);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Default address cache hit', { userId, deliveryMode });
        return cached;
      }
      
      logger.debug('Default address cache miss', { userId, deliveryMode });
      return null;
    } catch (error) {
      logger.error('Error getting default address from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get address history from cache
   */
  async getAddressHistory<T = any>(userId: string, limit: number): Promise<T | null> {
    try {
      const cacheKey = this.getAddressHistoryKey(userId, limit);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Address history cache hit', { userId, limit });
        return cached;
      }
      
      logger.debug('Address history cache miss', { userId, limit });
      return null;
    } catch (error) {
      logger.error('Error getting address history from cache', { userId, error });
      return null;
    }
  }

  // =========================================================================
  // SET CACHE METHODS
  // =========================================================================

  /**
   * Set delivery address in cache
   */
  async setAddress(addressId: string, address: any): Promise<boolean> {
    try {
      const cacheKey = this.getAddressKey(addressId);
      const result = await cacheService.set(cacheKey, address, this.CACHE_TTL.ADDRESS);
      
      if (result) {
        logger.debug('Delivery address cached', { addressId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching delivery address', { addressId, error });
      return false;
    }
  }

  /**
   * Set user addresses in cache
   */
  async setUserAddresses(userId: string, addresses: any, deliveryMode?: string): Promise<boolean> {
    try {
      const cacheKey = this.getUserAddressesKey(userId, deliveryMode);
      const result = await cacheService.set(cacheKey, addresses, this.CACHE_TTL.USER_ADDRESSES);
      
      if (result) {
        logger.debug('User addresses cached', { userId, deliveryMode });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user addresses', { userId, error });
      return false;
    }
  }

  /**
   * Set paginated user addresses in cache
   */
  async setUserAddressesPaginated(userId: string, page: number, limit: number, data: any, deliveryMode?: string): Promise<boolean> {
    try {
      const cacheKey = this.getUserAddressesPaginatedKey(userId, page, limit, deliveryMode);
      const result = await cacheService.set(cacheKey, data, this.CACHE_TTL.USER_ADDRESSES);
      
      if (result) {
        logger.debug('Paginated user addresses cached', { userId, page, limit, deliveryMode });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching paginated user addresses', { userId, error });
      return false;
    }
  }

  /**
   * Set delivery settings in cache
   */
  async setDeliverySettings(userId: string, settings: any): Promise<boolean> {
    try {
      const cacheKey = this.getDeliverySettingsKey(userId);
      const result = await cacheService.set(cacheKey, settings, this.CACHE_TTL.SETTINGS);
      
      if (result) {
        logger.debug('Delivery settings cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching delivery settings', { userId, error });
      return false;
    }
  }

  /**
   * Set delivery settings with details in cache
   */
  async setDeliverySettingsWithDetails(userId: string, data: any): Promise<boolean> {
    try {
      const cacheKey = this.getDeliverySettingsWithDetailsKey(userId);
      const result = await cacheService.set(cacheKey, data, this.CACHE_TTL.SETTINGS);
      
      if (result) {
        logger.debug('Delivery settings with details cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching delivery settings with details', { userId, error });
      return false;
    }
  }

  /**
   * Set address statistics in cache
   */
  async setAddressStats(userId: string, stats: any): Promise<boolean> {
    try {
      const cacheKey = this.getAddressStatsKey(userId);
      const result = await cacheService.set(cacheKey, stats, this.CACHE_TTL.ADDRESS_STATS);
      
      if (result) {
        logger.debug('Address stats cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching address stats', { userId, error });
      return false;
    }
  }

  /**
   * Set default address in cache
   */
  async setDefaultAddress(userId: string, address: any, deliveryMode?: string): Promise<boolean> {
    try {
      const cacheKey = this.getDefaultAddressKey(userId, deliveryMode);
      const result = await cacheService.set(cacheKey, address, this.CACHE_TTL.ADDRESS);
      
      if (result) {
        logger.debug('Default address cached', { userId, deliveryMode });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching default address', { userId, error });
      return false;
    }
  }

  /**
   * Set address history in cache
   */
  async setAddressHistory(userId: string, limit: number, history: any): Promise<boolean> {
    try {
      const cacheKey = this.getAddressHistoryKey(userId, limit);
      const result = await cacheService.set(cacheKey, history, this.CACHE_TTL.ADDRESS_HISTORY);
      
      if (result) {
        logger.debug('Address history cached', { userId, limit });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching address history', { userId, error });
      return false;
    }
  }

  // =========================================================================
  // INVALIDATION METHODS
  // =========================================================================

  /**
   * Invalidate all cache entries related to a specific address
   */
  async invalidateAddress(addressId: string, userId: string): Promise<void> {
    try {
      // Delete specific address cache
      await cacheService.delete(this.getAddressKey(addressId));
      
      // Invalidate all user addresses caches
      await this.invalidateUserAddresses(userId);
      
      // Invalidate default address cache
      await cacheService.delete(this.getDefaultAddressKey(userId));
      await cacheService.delete(this.getDefaultAddressKey(userId, 'DELIVERY'));
      await cacheService.delete(this.getDefaultAddressKey(userId, 'PICKUP'));
      
      // Invalidate address stats
      await this.invalidateAddressStats(userId);
      
      logger.info('Delivery address cache invalidated', { addressId, userId });
    } catch (error) {
      logger.error('Failed to invalidate delivery address cache', { addressId, userId, error });
    }
  }

  /**
   * Invalidate all user addresses caches
   */
  async invalidateUserAddresses(userId: string): Promise<void> {
    try {
      // Delete all user addresses list caches
      const userAddressesPattern = `delivery:addresses:user:${userId}:*`;
      const userAddressesKeys = await cacheService.getKeys(userAddressesPattern);
      if (userAddressesKeys.length > 0) {
        await Promise.all(userAddressesKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${userAddressesKeys.length} user addresses list cache entries`, { userId });
      }
      
      // Delete paginated caches
      const paginatedPattern = `delivery:addresses:user:${userId}:page:*`;
      const paginatedKeys = await cacheService.getKeys(paginatedPattern);
      if (paginatedKeys.length > 0) {
        await Promise.all(paginatedKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${paginatedKeys.length} paginated addresses cache entries`, { userId });
      }
      
      // Delete default address caches
      await cacheService.delete(this.getDefaultAddressKey(userId));
      await cacheService.delete(this.getDefaultAddressKey(userId, 'DELIVERY'));
      await cacheService.delete(this.getDefaultAddressKey(userId, 'PICKUP'));
      
      // Delete address history cache
      const historyPattern = `delivery:address:history:${userId}:*`;
      const historyKeys = await cacheService.getKeys(historyPattern);
      if (historyKeys.length > 0) {
        await Promise.all(historyKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${historyKeys.length} address history cache entries`, { userId });
      }
    } catch (error) {
      logger.error('Failed to invalidate user addresses cache', { userId, error });
    }
  }

  /**
   * Invalidate delivery settings cache for a user
   */
  async invalidateDeliverySettings(userId: string): Promise<void> {
    try {
      await cacheService.delete(this.getDeliverySettingsKey(userId));
      await cacheService.delete(this.getDeliverySettingsWithDetailsKey(userId));
      logger.debug('Delivery settings cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate delivery settings cache', { userId, error });
    }
  }

  /**
   * Invalidate address statistics cache for a user
   */
  async invalidateAddressStats(userId: string): Promise<void> {
    try {
      await cacheService.delete(this.getAddressStatsKey(userId));
      logger.debug('Address stats cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate address stats cache', { userId, error });
    }
  }

  /**
   * Clear all delivery settings-related cache
   */
  async clearAll(): Promise<void> {
    try {
      const addressKeys = await cacheService.getKeys('delivery:address:*');
      const userAddressesKeys = await cacheService.getKeys('delivery:addresses:user:*');
      const settingsKeys = await cacheService.getKeys('delivery:settings:*');
      const statsKeys = await cacheService.getKeys('delivery:address:stats:*');
      const historyKeys = await cacheService.getKeys('delivery:address:history:*');
      const defaultKeys = await cacheService.getKeys('delivery:default:address:*');
      
      const allKeys = [...addressKeys, ...userAddressesKeys, ...settingsKeys, ...statsKeys, ...historyKeys, ...defaultKeys];
      
      if (allKeys.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < allKeys.length; i += batchSize) {
          const batch = allKeys.slice(i, i + batchSize);
          await Promise.all(batch.map(key => cacheService.delete(key)));
        }
        logger.info(`Cleared ${allKeys.length} delivery settings cache entries`);
      } else {
        logger.info('No delivery settings cache entries to clear');
      }
    } catch (error) {
      logger.error('Error clearing delivery settings cache', { error });
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get cache statistics for delivery settings
   */
  async getStats(): Promise<DeliverySettingsCacheStats> {
    try {
      const stats = await cacheService.getStats();
      const addressKeys = await cacheService.getKeys('delivery:address:*');
      const userAddressesKeys = await cacheService.getKeys('delivery:addresses:user:*');
      const settingsKeys = await cacheService.getKeys('delivery:settings:*');
      const addressStatsKeys = await cacheService.getKeys('delivery:address:stats:*');
      
      return {
        hits: stats.hits,
        misses: stats.misses,
        addressKeys: addressKeys.length,
        userAddressesKeys: userAddressesKeys.length,
        settingsKeys: settingsKeys.length,
        addressStatsKeys: addressStatsKeys.length,
        mode: stats.mode,
      };
    } catch (error) {
      logger.error('Error getting delivery settings cache stats', { error });
      return {
        hits: 0,
        misses: 0,
        addressKeys: 0,
        userAddressesKeys: 0,
        settingsKeys: 0,
        addressStatsKeys: 0,
        mode: 'memory',
      };
    }
  }

  /**
   * Check if cache service is ready
   */
  isReady(): boolean {
    return cacheService.isReady();
  }

  /**
   * Get cache mode
   */
  getCacheMode(): 'redis' | 'memory' {
    return cacheService.getCacheMode();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; mode: string; memorySize?: number; error?: string }> {
    return cacheService.healthCheck();
  }
}

// Export singleton instance
export default new DeliverySettingsCacheService();