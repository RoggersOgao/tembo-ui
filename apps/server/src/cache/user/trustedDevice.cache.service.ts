// services/cache/trusted-device.cache.service.ts
import cacheService from '../cache.service';
import { logger } from '@repo/logger';

export interface TrustedDeviceCacheStats {
  hits: number;
  misses: number;
  deviceKeys: number;
  userDevicesKeys: number;
  deviceStatsKeys: number;
  mode: 'redis' | 'memory';
}

class TrustedDeviceCacheService {
  // Cache TTLs (in seconds)
  private readonly CACHE_TTL = {
    DEVICE: 3600,           // 1 hour for individual devices
    USER_DEVICES: 1800,     // 30 minutes for user devices list
    DEVICE_STATS: 1800,     // 30 minutes for device statistics
  };

  // Cache key generators
  getDeviceKey(deviceId: string): string {
    return `trusted_device:${deviceId}`;
  }

  getDeviceByFingerprintKey(userId: string, deviceFingerprint: string): string {
    return `trusted_device:user:${userId}:fingerprint:${deviceFingerprint}`;
  }

  getUserDevicesKey(userId: string, options?: any): string {
    if (!options) {
      return `trusted_devices:user:${userId}:all`;
    }
    const optionsKey = JSON.stringify({
      page: options.page,
      limit: options.limit,
      filters: options.filters,
      sortBy: options.sortBy,
      sortOrder: options.sortOrder
    });
    return `trusted_devices:user:${userId}:${Buffer.from(optionsKey).toString('base64')}`;
  }

  getDeviceStatsKey(userId: string): string {
    return `trusted_devices:stats:${userId}`;
  }

  // =========================================================================
  // GET CACHE METHODS
  // =========================================================================

  /**
   * Get trusted device by ID from cache
   */
  async getDevice<T = any>(deviceId: string): Promise<T | null> {
    try {
      const cacheKey = this.getDeviceKey(deviceId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Trusted device cache hit', { deviceId });
        return cached;
      }
      
      logger.debug('Trusted device cache miss', { deviceId });
      return null;
    } catch (error) {
      logger.error('Error getting trusted device from cache', { deviceId, error });
      return null;
    }
  }

  /**
   * Get device by fingerprint from cache
   */
  async getDeviceByFingerprint<T = any>(userId: string, deviceFingerprint: string): Promise<T | null> {
    try {
      const cacheKey = this.getDeviceByFingerprintKey(userId, deviceFingerprint);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Device by fingerprint cache hit', { userId, deviceFingerprint });
        return cached;
      }
      
      logger.debug('Device by fingerprint cache miss', { userId, deviceFingerprint });
      return null;
    } catch (error) {
      logger.error('Error getting device by fingerprint from cache', { userId, deviceFingerprint, error });
      return null;
    }
  }

  /**
   * Get user devices list from cache
   */
  async getUserDevices<T = any>(userId: string, options?: any): Promise<T | null> {
    try {
      const cacheKey = this.getUserDevicesKey(userId, options);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User devices list cache hit', { userId, options });
        return cached;
      }
      
      logger.debug('User devices list cache miss', { userId, options });
      return null;
    } catch (error) {
      logger.error('Error getting user devices from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get device statistics from cache
   */
  async getDeviceStats<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getDeviceStatsKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Device stats cache hit', { userId });
        return cached;
      }
      
      logger.debug('Device stats cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting device stats from cache', { userId, error });
      return null;
    }
  }

  // =========================================================================
  // SET CACHE METHODS
  // =========================================================================

  /**
   * Set trusted device in cache
   */
  async setDevice(deviceId: string, device: any): Promise<boolean> {
    try {
      const cacheKey = this.getDeviceKey(deviceId);
      const result = await cacheService.set(cacheKey, device, this.CACHE_TTL.DEVICE);
      
      if (result) {
        logger.debug('Trusted device cached', { deviceId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching trusted device', { deviceId, error });
      return false;
    }
  }

  /**
   * Set device by fingerprint in cache
   */
  async setDeviceByFingerprint(userId: string, deviceFingerprint: string, device: any): Promise<boolean> {
    try {
      const cacheKey = this.getDeviceByFingerprintKey(userId, deviceFingerprint);
      const result = await cacheService.set(cacheKey, device, this.CACHE_TTL.DEVICE);
      
      if (result) {
        logger.debug('Device by fingerprint cached', { userId, deviceFingerprint });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching device by fingerprint', { userId, deviceFingerprint, error });
      return false;
    }
  }

  /**
   * Set user devices list in cache
   */
  async setUserDevices(userId: string, devices: any, options?: any): Promise<boolean> {
    try {
      const cacheKey = this.getUserDevicesKey(userId, options);
      const result = await cacheService.set(cacheKey, devices, this.CACHE_TTL.USER_DEVICES);
      
      if (result) {
        logger.debug('User devices list cached', { userId, options });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user devices list', { userId, error });
      return false;
    }
  }

  /**
   * Set device statistics in cache
   */
  async setDeviceStats(userId: string, stats: any): Promise<boolean> {
    try {
      const cacheKey = this.getDeviceStatsKey(userId);
      const result = await cacheService.set(cacheKey, stats, this.CACHE_TTL.DEVICE_STATS);
      
      if (result) {
        logger.debug('Device stats cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching device stats', { userId, error });
      return false;
    }
  }

  // =========================================================================
  // INVALIDATION METHODS
  // =========================================================================

  /**
   * Invalidate all cache entries related to a specific device
   */
  async invalidateDevice(deviceId: string, userId: string, deviceFingerprint?: string): Promise<void> {
    try {
      // Delete specific device cache
      await cacheService.delete(this.getDeviceKey(deviceId));
      
      // Delete device by fingerprint cache if provided
      if (deviceFingerprint) {
        await cacheService.delete(this.getDeviceByFingerprintKey(userId, deviceFingerprint));
      }
      
      // Invalidate user devices list caches
      const userDevicesPattern = `trusted_devices:user:${userId}:*`;
      const userDevicesKeys = await cacheService.getKeys(userDevicesPattern);
      if (userDevicesKeys.length > 0) {
        await Promise.all(userDevicesKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${userDevicesKeys.length} user devices list cache entries`, { userId });
      }
      
      // Invalidate device stats cache
      await cacheService.delete(this.getDeviceStatsKey(userId));
      
      logger.info('Trusted device cache invalidated', { deviceId, userId });
    } catch (error) {
      logger.error('Failed to invalidate trusted device cache', { deviceId, userId, error });
    }
  }

  /**
   * Invalidate all devices for a specific user
   */
  async invalidateUserDevices(userId: string): Promise<void> {
    try {
      // Delete all user devices list caches
      const userDevicesPattern = `trusted_devices:user:${userId}:*`;
      const userDevicesKeys = await cacheService.getKeys(userDevicesPattern);
      if (userDevicesKeys.length > 0) {
        await Promise.all(userDevicesKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${userDevicesKeys.length} user devices list cache entries`, { userId });
      }
      
      // Delete device stats cache
      await cacheService.delete(this.getDeviceStatsKey(userId));
      
      // Delete all device caches for this user
      const devicePattern = `trusted_device:user:${userId}:*`;
      const deviceKeys = await cacheService.getKeys(devicePattern);
      if (deviceKeys.length > 0) {
        await Promise.all(deviceKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${deviceKeys.length} device cache entries`, { userId });
      }
      
      logger.info('User devices cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate user devices cache', { userId, error });
    }
  }

  /**
   * Invalidate device statistics cache for a user
   */
  async invalidateDeviceStats(userId: string): Promise<void> {
    try {
      await cacheService.delete(this.getDeviceStatsKey(userId));
      logger.debug('Device stats cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate device stats cache', { userId, error });
    }
  }

  /**
   * Clear all trusted device-related cache
   */
  async clearAll(): Promise<void> {
    try {
      const deviceKeys = await cacheService.getKeys('trusted_device:*');
      const userDevicesKeys = await cacheService.getKeys('trusted_devices:user:*');
      
      const allKeys = [...deviceKeys, ...userDevicesKeys];
      
      if (allKeys.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < allKeys.length; i += batchSize) {
          const batch = allKeys.slice(i, i + batchSize);
          await Promise.all(batch.map(key => cacheService.delete(key)));
        }
        logger.info(`Cleared ${allKeys.length} trusted device cache entries`);
      } else {
        logger.info('No trusted device cache entries to clear');
      }
    } catch (error) {
      logger.error('Error clearing trusted device cache', { error });
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get cache statistics for trusted devices
   */
  async getStats(): Promise<TrustedDeviceCacheStats> {
    try {
      const stats = await cacheService.getStats();
      const deviceKeys = await cacheService.getKeys('trusted_device:*');
      const userDevicesKeys = await cacheService.getKeys('trusted_devices:user:*');
      const deviceStatsKeys = await cacheService.getKeys('trusted_devices:stats:*');
      
      return {
        hits: stats.hits,
        misses: stats.misses,
        deviceKeys: deviceKeys.length,
        userDevicesKeys: userDevicesKeys.length,
        deviceStatsKeys: deviceStatsKeys.length,
        mode: stats.mode,
      };
    } catch (error) {
      logger.error('Error getting trusted device cache stats', { error });
      return {
        hits: 0,
        misses: 0,
        deviceKeys: 0,
        userDevicesKeys: 0,
        deviceStatsKeys: 0,
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
export default new TrustedDeviceCacheService();