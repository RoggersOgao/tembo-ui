export interface CacheOptions {
  ttl: number;
  maxSize: number;
}

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  expiresAt: number;
}

export class MemoryCache<T = any> {
  private cache = new Map<string, CacheEntry<T>>();
  private options: CacheOptions;

  constructor(options: CacheOptions = { ttl: 300000, maxSize: 1000 }) {
    this.options = options;
  }

  set(key: string, value: T, ttl?: number): void {
    const now = Date.now();
    const expiresAt = now + (ttl || this.options.ttl);

    this.cache.set(key, {
      value,
      timestamp: now,
      expiresAt,
    });

    // Clean up if cache is too large
    if (this.cache.size > this.options.maxSize) {
      this.cleanup();
    }
  }

  get(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    return entry.value;
  }

  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }

  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }

    // If still too large, remove oldest entries
    if (this.cache.size > this.options.maxSize) {
      const entries = Array.from(this.cache.entries())
        .sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const entriesToRemove = entries.slice(0, this.cache.size - this.options.maxSize);
      for (const [key] of entriesToRemove) {
        this.cache.delete(key);
      }
    }
  }

  get size(): number {
    this.cleanup(); // Clean up before returning size
    return this.cache.size;
  }

  stats(): {
    size: number;
    hitRate?: number;
    misses?: number;
    hits?: number;
  } {
    this.cleanup();
    return { size: this.cache.size };
  }
}

// Global cache instance for request metadata
export const requestCache = new MemoryCache<any>();

export function getCached<T>(key: string, generator: () => Promise<T>, ttl?: number): Promise<T> {
  const cached = requestCache.get(key);
  if (cached) {
    return Promise.resolve(cached);
  }

  return generator().then(result => {
    requestCache.set(key, result, ttl);
    return result;
  });
}

export function createCacheKey(req: any, prefix: string = 'metadata'): string {
  const ip = req.ip || req.socket?.remoteAddress || 'unknown';
  const ua = req.headers?.['user-agent'] || 'unknown';
  const hash = `${ip}:${ua}`;
  return `${prefix}:${Buffer.from(hash).toString('base64').slice(0, 32)}`;
}