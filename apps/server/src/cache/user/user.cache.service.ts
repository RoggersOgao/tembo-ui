// services/cache/user.cache.service.ts
import cacheService from '../cache.service';
import { logger } from '@repo/logger';

export interface UserCacheStats {
  hits: number;
  misses: number;
  userKeys: number;
  profileKeys: number;
  userListKeys: number;
  securityKeys: number;
  verificationKeys: number;
  mode: 'redis' | 'memory';
}

class UserCacheService {
  // Cache TTLs (in seconds)
  private readonly CACHE_TTL = {
    USER: 1800,           // 30 minutes for individual users
    PROFILE: 1800,        // 30 minutes for user profiles
    USER_LIST: 300,       // 5 minutes for user lists (admin queries)
    SECURITY_STATUS: 600, // 10 minutes for security status
    VERIFICATION: 900,    // 15 minutes for verification status
    DEVICE: 3600,         // 1 hour for trusted devices
    PERMISSIONS: 1800,    // 30 minutes for user permissions
    STATS: 3600,          // 1 hour for user statistics
  };

  // Cache key generators
  getUserKey(userId: string): string {
    return `user:${userId}`;
  }

  getUserByEmailKey(email: string): string {
    return `user:email:${email.toLowerCase()}`;
  }

  getUserByPhoneKey(phone: string): string {
    return `user:phone:${phone}`;
  }

  getUserByUUIDKey(uuid: string): string {
    return `user:uuid:${uuid}`;
  }

  getProfileKey(userId: string): string {
    return `user:profile:${userId}`;
  }

  getUserListKey(filters: any, pagination: any): string {
    const filterKey = JSON.stringify({
      filters,
      pagination,
    });
    return `users:list:${Buffer.from(filterKey).toString('base64')}`;
  }

  getSecurityStatusKey(userId: string): string {
    return `user:security:${userId}`;
  }

  getVerificationStatusKey(userId: string): string {
    return `user:verification:${userId}`;
  }

  getUserPermissionsKey(userId: string): string {
    return `user:permissions:${userId}`;
  }

  getTrustedDevicesKey(userId: string): string {
    return `user:devices:${userId}`;
  }

  getUserStatsKey(): string {
    return 'users:stats';
  }

  getLoginLimitKey(userId: string): string {
    return `user:login:limit:${userId}`;
  }

  getSuspiciousActivityKey(userId: string): string {
    return `user:suspicious:${userId}`;
  }

  // =========================================================================
  // GET CACHE METHODS
  // =========================================================================

  /**
   * Get user by ID from cache
   */
  async getUser<T = any>(userId: string, includeSensitive: boolean = false): Promise<T | null> {
    try {
      const cacheKey = this.getUserKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User cache hit', { userId });
        return cached;
      }
      
      logger.debug('User cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting user from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get user by email from cache
   */
  async getUserByEmail<T = any>(email: string): Promise<T | null> {
    try {
      const cacheKey = this.getUserByEmailKey(email);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User by email cache hit', { email });
        return cached;
      }
      
      logger.debug('User by email cache miss', { email });
      return null;
    } catch (error) {
      logger.error('Error getting user by email from cache', { email, error });
      return null;
    }
  }

  /**
   * Get user by phone from cache
   */
  async getUserByPhone<T = any>(phone: string): Promise<T | null> {
    try {
      const cacheKey = this.getUserByPhoneKey(phone);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User by phone cache hit', { phone });
        return cached;
      }
      
      logger.debug('User by phone cache miss', { phone });
      return null;
    } catch (error) {
      logger.error('Error getting user by phone from cache', { phone, error });
      return null;
    }
  }

  /**
   * Get user profile from cache
   */
  async getProfile<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getProfileKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User profile cache hit', { userId });
        return cached;
      }
      
      logger.debug('User profile cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting user profile from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get user list from cache
   */
  async getUserList<T = any>(filters: any, pagination: any): Promise<T | null> {
    try {
      const cacheKey = this.getUserListKey(filters, pagination);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User list cache hit', { filters, pagination });
        return cached;
      }
      
      logger.debug('User list cache miss', { filters, pagination });
      return null;
    } catch (error) {
      logger.error('Error getting user list from cache', { error });
      return null;
    }
  }

  /**
   * Get security status from cache
   */
  async getSecurityStatus<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getSecurityStatusKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Security status cache hit', { userId });
        return cached;
      }
      
      logger.debug('Security status cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting security status from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get verification status from cache
   */
  async getVerificationStatus<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getVerificationStatusKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Verification status cache hit', { userId });
        return cached;
      }
      
      logger.debug('Verification status cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting verification status from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get user permissions from cache
   */
  async getUserPermissions<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getUserPermissionsKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User permissions cache hit', { userId });
        return cached;
      }
      
      logger.debug('User permissions cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting user permissions from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get login limit status from cache
   */
  async getLoginLimitStatus<T = any>(userId: string): Promise<T | null> {
    try {
      const cacheKey = this.getLoginLimitKey(userId);
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('Login limit cache hit', { userId });
        return cached;
      }
      
      logger.debug('Login limit cache miss', { userId });
      return null;
    } catch (error) {
      logger.error('Error getting login limit from cache', { userId, error });
      return null;
    }
  }

  /**
   * Get user statistics from cache
   */
  async getUserStats<T = any>(): Promise<T | null> {
    try {
      const cacheKey = this.getUserStatsKey();
      const cached = await cacheService.get<T>(cacheKey);
      
      if (cached) {
        logger.debug('User stats cache hit');
        return cached;
      }
      
      logger.debug('User stats cache miss');
      return null;
    } catch (error) {
      logger.error('Error getting user stats from cache', { error });
      return null;
    }
  }

  // =========================================================================
  // SET CACHE METHODS
  // =========================================================================

  /**
   * Set user in cache
   */
  async setUser(userId: string, user: any, includeSensitive: boolean = false): Promise<boolean> {
    try {
      const cacheKey = this.getUserKey(userId);
      const result = await cacheService.set(cacheKey, user, this.CACHE_TTL.USER);
      
      if (result) {
        logger.debug('User cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user', { userId, error });
      return false;
    }
  }

  /**
   * Set user by email in cache
   */
  async setUserByEmail(email: string, userId: string): Promise<boolean> {
    try {
      const cacheKey = this.getUserByEmailKey(email);
      const result = await cacheService.set(cacheKey, userId, this.CACHE_TTL.USER);
      
      if (result) {
        logger.debug('User email mapping cached', { email, userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user email mapping', { email, error });
      return false;
    }
  }

  /**
   * Set user by phone in cache
   */
  async setUserByPhone(phone: string, userId: string): Promise<boolean> {
    try {
      const cacheKey = this.getUserByPhoneKey(phone);
      const result = await cacheService.set(cacheKey, userId, this.CACHE_TTL.USER);
      
      if (result) {
        logger.debug('User phone mapping cached', { phone, userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user phone mapping', { phone, error });
      return false;
    }
  }

  /**
   * Set user profile in cache
   */
  async setProfile(userId: string, profile: any): Promise<boolean> {
    try {
      const cacheKey = this.getProfileKey(userId);
      const result = await cacheService.set(cacheKey, profile, this.CACHE_TTL.PROFILE);
      
      if (result) {
        logger.debug('User profile cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user profile', { userId, error });
      return false;
    }
  }

  /**
   * Set user list in cache
   */
  async setUserList(filters: any, pagination: any, data: any): Promise<boolean> {
    try {
      const cacheKey = this.getUserListKey(filters, pagination);
      const result = await cacheService.set(cacheKey, data, this.CACHE_TTL.USER_LIST);
      
      if (result) {
        logger.debug('User list cached', { filters, pagination });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user list', { error });
      return false;
    }
  }

  /**
   * Set security status in cache
   */
  async setSecurityStatus(userId: string, status: any): Promise<boolean> {
    try {
      const cacheKey = this.getSecurityStatusKey(userId);
      const result = await cacheService.set(cacheKey, status, this.CACHE_TTL.SECURITY_STATUS);
      
      if (result) {
        logger.debug('Security status cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching security status', { userId, error });
      return false;
    }
  }

  /**
   * Set verification status in cache
   */
  async setVerificationStatus(userId: string, status: any): Promise<boolean> {
    try {
      const cacheKey = this.getVerificationStatusKey(userId);
      const result = await cacheService.set(cacheKey, status, this.CACHE_TTL.VERIFICATION);
      
      if (result) {
        logger.debug('Verification status cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching verification status', { userId, error });
      return false;
    }
  }

  /**
   * Set user permissions in cache
   */
  async setUserPermissions(userId: string, permissions: any): Promise<boolean> {
    try {
      const cacheKey = this.getUserPermissionsKey(userId);
      const result = await cacheService.set(cacheKey, permissions, this.CACHE_TTL.PERMISSIONS);
      
      if (result) {
        logger.debug('User permissions cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user permissions', { userId, error });
      return false;
    }
  }

  /**
   * Set login limit status in cache
   */
  async setLoginLimitStatus(userId: string, status: any): Promise<boolean> {
    try {
      const cacheKey = this.getLoginLimitKey(userId);
      const result = await cacheService.set(cacheKey, status, this.CACHE_TTL.SECURITY_STATUS);
      
      if (result) {
        logger.debug('Login limit status cached', { userId });
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching login limit status', { userId, error });
      return false;
    }
  }

  /**
   * Set user statistics in cache
   */
  async setUserStats(stats: any): Promise<boolean> {
    try {
      const cacheKey = this.getUserStatsKey();
      const result = await cacheService.set(cacheKey, stats, this.CACHE_TTL.STATS);
      
      if (result) {
        logger.debug('User stats cached');
      }
      
      return result;
    } catch (error) {
      logger.error('Error caching user stats', { error });
      return false;
    }
  }

  // =========================================================================
  // INVALIDATION METHODS
  // =========================================================================

  /**
   * Invalidate all cache entries related to a specific user
   */
  async invalidateUser(userId: string, email?: string, phone?: string, uuid?: string): Promise<void> {
    try {
      // Delete user cache
      await cacheService.delete(this.getUserKey(userId));
      
      // Delete profile cache
      await cacheService.delete(this.getProfileKey(userId));
      
      // Delete security status cache
      await cacheService.delete(this.getSecurityStatusKey(userId));
      
      // Delete verification status cache
      await cacheService.delete(this.getVerificationStatusKey(userId));
      
      // Delete permissions cache
      await cacheService.delete(this.getUserPermissionsKey(userId));
      
      // Delete trusted devices cache
      await cacheService.delete(this.getTrustedDevicesKey(userId));
      
      // Delete login limit cache
      await cacheService.delete(this.getLoginLimitKey(userId));
      
      // Delete suspicious activity cache
      await cacheService.delete(this.getSuspiciousActivityKey(userId));
      
      // Delete email mapping if provided
      if (email) {
        await cacheService.delete(this.getUserByEmailKey(email));
      }
      
      // Delete phone mapping if provided
      if (phone) {
        await cacheService.delete(this.getUserByPhoneKey(phone));
      }
      
      // Delete UUID mapping if provided
      if (uuid) {
        await cacheService.delete(this.getUserByUUIDKey(uuid));
      }
      
      // Invalidate user list caches
      const listKeys = await cacheService.getKeys('users:list:*');
      if (listKeys.length > 0) {
        await Promise.all(listKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${listKeys.length} user list cache entries`, { userId });
      }
      
      // Invalidate user stats cache
      await cacheService.delete(this.getUserStatsKey());
      
      logger.info('User cache invalidated', { userId, email, phone });
    } catch (error) {
      logger.error('Failed to invalidate user cache', { userId, error });
    }
  }

  /**
   * Invalidate user list caches
   */
  async invalidateUserLists(): Promise<void> {
    try {
      const listKeys = await cacheService.getKeys('users:list:*');
      if (listKeys.length > 0) {
        await Promise.all(listKeys.map(key => cacheService.delete(key)));
        logger.debug(`Invalidated ${listKeys.length} user list cache entries`);
      }
      
      // Also invalidate stats
      await cacheService.delete(this.getUserStatsKey());
    } catch (error) {
      logger.error('Failed to invalidate user lists', { error });
    }
  }

  /**
   * Invalidate security-related cache for a user
   */
  async invalidateSecurityCache(userId: string): Promise<void> {
    try {
      await cacheService.delete(this.getSecurityStatusKey(userId));
      await cacheService.delete(this.getLoginLimitKey(userId));
      await cacheService.delete(this.getSuspiciousActivityKey(userId));
      await cacheService.delete(this.getTrustedDevicesKey(userId));
      
      logger.debug('Security cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate security cache', { userId, error });
    }
  }

  /**
   * Invalidate verification cache for a user
   */
  async invalidateVerificationCache(userId: string): Promise<void> {
    try {
      await cacheService.delete(this.getVerificationStatusKey(userId));
      logger.debug('Verification cache invalidated', { userId });
    } catch (error) {
      logger.error('Failed to invalidate verification cache', { userId, error });
    }
  }

  /**
   * Clear all user-related cache
   */
  async clearAll(): Promise<void> {
    try {
      const userKeys = await cacheService.getKeys('user:*');
      const userListKeys = await cacheService.getKeys('users:*');
      const userSecurityKeys = await cacheService.getKeys('user:security:*');
      const userVerificationKeys = await cacheService.getKeys('user:verification:*');
      const userPermissionsKeys = await cacheService.getKeys('user:permissions:*');
      
      const allKeys = [
        ...userKeys,
        ...userListKeys,
        ...userSecurityKeys,
        ...userVerificationKeys,
        ...userPermissionsKeys,
      ];
      
      if (allKeys.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < allKeys.length; i += batchSize) {
          const batch = allKeys.slice(i, i + batchSize);
          await Promise.all(batch.map(key => cacheService.delete(key)));
        }
        logger.info(`Cleared ${allKeys.length} user cache entries`);
      } else {
        logger.info('No user cache entries to clear');
      }
    } catch (error) {
      logger.error('Error clearing user cache', { error });
      throw error;
    }
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get cache statistics for users
   */
  async getStats(): Promise<UserCacheStats> {
    try {
      const stats = await cacheService.getStats();
      const userKeys = await cacheService.getKeys('user:*');
      const profileKeys = await cacheService.getKeys('user:profile:*');
      const userListKeys = await cacheService.getKeys('users:list:*');
      const securityKeys = await cacheService.getKeys('user:security:*');
      const verificationKeys = await cacheService.getKeys('user:verification:*');
      
      return {
        hits: stats.hits,
        misses: stats.misses,
        userKeys: userKeys.length,
        profileKeys: profileKeys.length,
        userListKeys: userListKeys.length,
        securityKeys: securityKeys.length,
        verificationKeys: verificationKeys.length,
        mode: stats.mode,
      };
    } catch (error) {
      logger.error('Error getting user cache stats', { error });
      return {
        hits: 0,
        misses: 0,
        userKeys: 0,
        profileKeys: 0,
        userListKeys: 0,
        securityKeys: 0,
        verificationKeys: 0,
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
export default new UserCacheService();