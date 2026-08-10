import { logger } from '@repo/logger';
import { createClient, RedisClientType } from 'redis';
export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  ksize: number;
  vsize: number;
  mode: 'redis' | 'memory';
}

class CacheService {
  private client: RedisClientType;
  private isConnected: boolean = false;
  private useInMemory: boolean = false;
  private stats = {
    hits: 0,
    misses: 0,
  };

  // In-memory fallback cache with expiration support
  private memoryCache: Map<string, {
    data: any;
    expires: number;
    metadata?: any
  }> = new Map();

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    const maxReconnectAttempts = parseInt(process.env.REDIS_MAX_RECONNECT_ATTEMPTS || '10');

    this.client = createClient({
      url: redisUrl,
      socket: {
        reconnectStrategy: (retries) => {
          if (retries > maxReconnectAttempts) {
            logger.warn('Redis: Too many reconnection attempts, switching to in-memory cache');
            this.useInMemory = true;
            return false; // Stop trying to reconnect
          }
          const delay = Math.min(retries * 100, 3000); // Max 3 second delay
          logger.debug(`Redis: Reconnection attempt ${retries}, delaying ${delay}ms`);
          return delay;
        },
        connectTimeout: 10000, // 5 seconds connection timeout
      },
      pingInterval: 30000, // Ping every 30 seconds to keep connection alive
    });

    this.setupEventHandlers();
    this.connect().catch(error => {
      logger.error('Failed to initialize Redis connection:', error);
    });
  }

  /**
   * Setup Redis event handlers
   */
  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('[-] Redis: Connecting...');
    });

    this.client.on('ready', () => {
      logger.info('[-] Redis: Connected and ready');
      this.isConnected = true;
      this.useInMemory = false;
    });

    this.client.on('error', (err) => {
      if (!this.useInMemory) {
        logger.error('[-] Redis error:', err.message);
      }
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      if (!this.useInMemory) {
        logger.info('[-] Redis: Reconnecting...');
      }
    });

    this.client.on('end', () => {
      if (!this.useInMemory) {
        logger.info('[*] Redis: Connection closed');
      }
      this.isConnected = false;
    });
  }

  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    if (this.isConnected || this.useInMemory) {
      return;
    }

    try {
      await this.client.connect();
      // Test the connection
      await this.client.ping();
      logger.info('[-] Redis: Successfully connected and pinged');
    } catch (error) {
      logger.error('[-]  Failed to connect to Redis, using in-memory cache', { error: error });
      this.useInMemory = true;
      this.isConnected = false;
    }
  }

  /**
   * Clean up expired entries from in-memory cache
   */
  private cleanExpiredMemoryCache(): void {
    const now = Date.now();
    let expiredCount = 0;

    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires < now) {
        this.memoryCache.delete(key);
        expiredCount++;
      }
    }

    if (expiredCount > 0) {
      logger.debug(`[!] Cleaned ${expiredCount} expired entries from in-memory cache`);
    }
  }

  /**
   * Get cached data
   */
  async get<T = any>(key: string): Promise<T | null> {
    try {
      if (this.useInMemory || !this.isConnected) {
        this.cleanExpiredMemoryCache();
        const cached = this.memoryCache.get(key);

        if (cached && cached.expires > Date.now()) {
          this.stats.hits++;
          try {
            return JSON.parse(cached.data) as T;
          } catch {
            // value was stored as a raw string (typeof value === 'string' case)
            return cached.data as T;
          }
        }

        this.stats.misses++;
        return null;
      }

      const data = await this.client.get(key);

      if (data) {
        this.stats.hits++;
        try {
          return JSON.parse(data) as T;
        } catch (parseError) {
          logger.warn('[!] Failed to parse cached data, returning raw data', { key });
          return data as T;
        }
      }

      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('[*] Cache get error:', { key, error });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Set data in cache with TTL
   */
  async set<T = any>(key: string, value: T, ttl: number = 3600): Promise<boolean> {
    try {
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      if (this.useInMemory || !this.isConnected) {
        this.memoryCache.set(key, {
          data: stringValue,
          expires: Date.now() + (ttl * 1000),
        });
        logger.debug('Data stored in in-memory cache', { key, ttl });
        return true;
      }

      if (ttl > 0) {
        await this.client.setEx(key, ttl, stringValue);
      } else {
        await this.client.set(key, stringValue);
      }

      logger.debug('Data stored in Redis cache', { key, ttl });
      return true;
    } catch (error) {
      logger.error('Cache set error:', { key, error });

      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);
      this.memoryCache.set(key, {
        data: stringValue,
        expires: Date.now() + (ttl * 1000),
      });
      logger.warn('Fell back to in-memory cache after Redis error', { key });
      return true;
    }
  }

  /**
   * Delete a specific key
   */
  async delete(key: string): Promise<boolean> {
    try {
      if (this.useInMemory || !this.isConnected) {
        return this.memoryCache.delete(key);
      }

      const result = await this.client.del(key);
      return result > 0;
    } catch (error) {
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async flushAll(): Promise<void> {
    try {
      if (this.useInMemory || !this.isConnected) {
        const size = this.memoryCache.size;
        this.memoryCache.clear();
        logger.info(`In-memory cache cleared, removed ${size} entries`);
        return;
      }

      await this.client.flushAll();
      logger.info('Redis cache cleared');
    } catch (error) {
      logger.error('Cache flush error:', { error: error });
      this.memoryCache.clear();
    }
  }

  /**
   * Get all keys matching a pattern
   */
  async getKeys(pattern: string = '*'): Promise<string[]> {
    try {
      if (this.useInMemory || !this.isConnected) {
        this.cleanExpiredMemoryCache();
        const keys: string[] = [];
        const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');

        for (const key of this.memoryCache.keys()) {
          if (regex.test(key)) {
            keys.push(key);
          }
        }
        return keys;
      }

      const keys = await this.client.keys(pattern);
      return keys;
    } catch (error) {
      logger.error('Cache keys error:', { pattern, error });
      return [];
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    try {
      if (this.useInMemory || !this.isConnected) {
        this.cleanExpiredMemoryCache();
        const keys = Array.from(this.memoryCache.keys());

        return {
          hits: this.stats.hits,
          misses: this.stats.misses,
          keys: keys.length,
          ksize: keys.length,
          vsize: 0,
          mode: 'memory',
        };
      }

      const info = await this.client.info('stats');
      const keyspaceHits = this.parseInfoValue(info, 'keyspace_hits');
      const keyspaceMisses = this.parseInfoValue(info, 'keyspace_misses');
      const keys = await this.getKeys('*');

      return {
        hits: keyspaceHits || this.stats.hits,
        misses: keyspaceMisses || this.stats.misses,
        keys: keys.length,
        ksize: keys.length,
        vsize: 0,
        mode: 'redis',
      };
    } catch (error) {
      logger.error('Cache stats error:', { error: error });
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: this.memoryCache.size,
        ksize: this.memoryCache.size,
        vsize: 0,
        mode: this.useInMemory || !this.isConnected ? 'memory' : 'redis',
      };
    }
  }

  /**
   * Parse a value from Redis INFO command output
   */
  private parseInfoValue(info: string, key: string): number | null {
    const regex = new RegExp(`${key}:(\\d+)`);
    const match = info.match(regex);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Check if cache is ready
   */
  isReady(): boolean {
    return this.isConnected || this.useInMemory;
  }

  /**
   * Get cache mode
   */
  getCacheMode(): 'redis' | 'memory' {
    return this.useInMemory || !this.isConnected ? 'memory' : 'redis';
  }

  /**
   * Get memory cache size (for monitoring)
   */
  getMemoryCacheSize(): number {
    return this.memoryCache.size;
  }

  /**
   * Gracefully disconnect from Redis
   */
  async disconnect(): Promise<void> {
    try {
      if (this.isConnected) {
        await this.client.quit();
        logger.info('Redis connection closed gracefully');
      }

      if (this.useInMemory) {
        const size = this.memoryCache.size;
        this.memoryCache.clear();
        logger.info(`In-memory cache cleared (${size} entries)`);
      }
    } catch (error) {
      logger.error('Error disconnecting from cache:', { error: error });
    } finally {
      this.isConnected = false;
    }
  }

  /**
   * Health check for cache service
   */
  async healthCheck(): Promise<{ healthy: boolean; mode: string; memorySize?: number }> {
    if (this.useInMemory || !this.isConnected) {
      return {
        healthy: true,
        mode: 'memory',
        memorySize: this.memoryCache.size,
      };
    }

    try {
      await this.client.ping();
      return {
        healthy: true,
        mode: 'redis',
      };
    } catch (error) {
      return {
        healthy: false,
        mode: 'redis',
      };
    }
  }

  /**
   * Increment a value in cache
   */
  async increment(key: string, by: number = 1): Promise<number | null> {
    try {
      if (this.useInMemory || !this.isConnected) {
        const current = await this.get<number>(key) || 0;
        const newValue = current + by;
        await this.set(key, newValue, 0);
        return newValue;
      }

      return await this.client.incrBy(key, by);
    } catch (error) {
      logger.error('Cache increment error:', { key, by, error });
      return null;
    }
  }

  /**
   * Decrement a value in cache
   */
  async decrement(key: string, by: number = 1): Promise<number | null> {
    try {
      if (this.useInMemory || !this.isConnected) {
        const current = await this.get<number>(key) || 0;
        const newValue = Math.max(0, current - by);
        await this.set(key, newValue, 0);
        return newValue;
      }

      return await this.client.decrBy(key, by);
    } catch (error) {
      logger.error('Cache decrement error:', { key, by, error });
      return null;
    }
  }
}

// Export singleton instance
export default new CacheService();