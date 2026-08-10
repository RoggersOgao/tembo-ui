import { ProductCategory } from '@repo/database';
import cacheService from './cache.service';
import { logger } from '@repo/logger';

interface CategoryCacheItem {
  data: any;
  metadata?: {
    createdAt:     number;
    expiresAt:     number;
    dependencies?: string[];
    categoryId?:   string;
    parentId?:     string | null;
  };
}

interface CacheStats {
  hits:                number;
  misses:              number;
  memoryRatio:         number;
  totalKeys:           number;
  hierarchicalKeys:    number;
  listKeys:            number;
}

interface CategoryHierarchyNode {
  id:       string;
  children: string[];
}

class CategoryCacheService {
  private readonly KEY_PREFIX = 'categories';

  private readonly KEY_PATTERNS = {
    // ── Single category lookups ──────────────────────────────────────────────
    BY_ID:   (id: string)   => `${this.KEY_PREFIX}:id:${id}`,
    BY_SLUG: (slug: string) => `${this.KEY_PREFIX}:slug:${slug}`,

    // ── Lists and collections ────────────────────────────────────────────────
    ALL_FLAT: (
      includeInactive: boolean,
      page:            number,
      limit:           number,
      sort:            string
    ) => `${this.KEY_PREFIX}:list:flat:inc${includeInactive}:p${page}l${limit}:${sort}`,

    // ── Hierarchical data ────────────────────────────────────────────────────
    TREE: (depth: number, includeInactive: boolean) =>
      `${this.KEY_PREFIX}:tree:depth${depth}:inc${includeInactive}`,
    ANCESTORS:      (categoryId: string) => `${this.KEY_PREFIX}:${categoryId}:ancestors`,
    DESCENDANTS:    (categoryId: string, maxDepth: number) =>
      `${this.KEY_PREFIX}:${categoryId}:descendants:depth${maxDepth}`,
    BREADCRUMB:     (categoryId: string) => `${this.KEY_PREFIX}:${categoryId}:breadcrumb`,
    HIERARCHY_NODE: (categoryId: string) => `${this.KEY_PREFIX}:hierarchy:${categoryId}`,

    // ── Products in category  (was "properties" in old schema) ───────────────
    PRODUCTS: (categoryId: string, includeChildren: boolean, filters: string) =>
      `${this.KEY_PREFIX}:${categoryId}:products:inc${includeChildren}:${filters}`,

    // ── Statistics ───────────────────────────────────────────────────────────
    STATS: () => `${this.KEY_PREFIX}:stats`,

    // ── Cache invalidation tracking ──────────────────────────────────────────
    INVALIDATION_VERSION: () => `${this.KEY_PREFIX}:version`,

    // ── Related data ─────────────────────────────────────────────────────────
    CATEGORY_PATH: (categoryId: string) => `${this.KEY_PREFIX}:${categoryId}:path`,
  };

  // TTL configurations (seconds)
  private readonly TTL = {
    CATEGORY_DETAILS: 300,   // 5 min
    CATEGORY_TREE:    600,   // 10 min
    CATEGORY_LIST:    300,   // 5 min
    PRODUCTS:         180,   // 3 min
    STATISTICS:       900,   // 15 min
    HIERARCHY:        1200,  // 20 min
    BREADCRUMB:       300,   // 5 min
    SHORT_LIVED:      60,    // 1 min — for frequently changing data
  };

  private stats = {
    hits:                     0,
    misses:                   0,
    writes:                   0,
    invalidations:            0,
    hierarchicalInvalidations: 0,
  };

  constructor() {
    logger.info('CategoryCacheService initialized');
  }

  // ── Generic helpers ────────────────────────────────────────────────────────

  async get(key: string): Promise<any> {
    try {
      const value = await cacheService.get(key);
      if (value) {
        this.stats.hits++;
        logger.debug('Custom cache hit', { key });
        return value;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting from cache', { key, error });
      return null;
    }
  }

  async set(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await cacheService.set(key, value, ttl ?? this.TTL.SHORT_LIVED);
      this.stats.writes++;
      logger.debug('Custom cache set', { key, ttl });
    } catch (error) {
      logger.error('Error setting cache', { key, error });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await cacheService.delete(key);
      logger.debug('Custom cache deleted', { key });
    } catch (error) {
      logger.error('Error deleting from cache', { key, error });
    }
  }

  async getOrSet<T>(
    key:           string,
    fetchFunction: () => Promise<T>,
    ttl?:          number
  ): Promise<T | null> {
    const cached = await this.get(key);
    if (cached) return cached as T;

    const data = await fetchFunction();
    if (data) await this.set(key, data, ttl);
    return data;
  }

  // ── Single category ────────────────────────────────────────────────────────

  async getCategoryById(id: string): Promise<ProductCategory | null> {
    const cacheKey = this.KEY_PATTERNS.BY_ID(id);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        this.stats.hits++;
        logger.debug('Category cache hit by ID', { categoryId: id });
        return cached as ProductCategory;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting category from cache by ID', { categoryId: id, error });
      return null;
    }
  }

  async getCategoryBySlug(slug: string): Promise<ProductCategory | null> {
    const cacheKey = this.KEY_PATTERNS.BY_SLUG(slug);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) {
        this.stats.hits++;
        logger.debug('Category cache hit by slug', { slug });
        return cached as ProductCategory;
      }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting category from cache by slug', { slug, error });
      return null;
    }
  }

  async getOrSetCategory(
    id:            string,
    fetchFunction: () => Promise<ProductCategory | null>
  ): Promise<ProductCategory | null> {
    const cached = await this.getCategoryById(id);
    if (cached) return cached;

    const category = await fetchFunction();
    if (category) await this.setCategory(category);
    return category;
  }

  async getOrSetCategoryBySlug(
    slug:          string,
    fetchFunction: () => Promise<ProductCategory | null>
  ): Promise<ProductCategory | null> {
    const cached = await this.getCategoryBySlug(slug);
    if (cached) return cached;

    const category = await fetchFunction();
    if (category) await this.setCategory(category);
    return category;
  }

  /**
   * Cache a category under both its ID key and slug key,
   * and update the hierarchy node for smart invalidation.
   */
  async setCategory(category: ProductCategory): Promise<void> {
    try {
      const idKey   = this.KEY_PATTERNS.BY_ID(category.id);
      const slugKey = this.KEY_PATTERNS.BY_SLUG(category.slug);

      const cacheItem: CategoryCacheItem = {
        data: category,
        metadata: {
          createdAt:  Date.now(),
          expiresAt:  Date.now() + this.TTL.CATEGORY_DETAILS * 1000,
          categoryId: category.id,
          parentId:   category.parentId,
        }
      };

      await Promise.all([
        cacheService.set(idKey,   cacheItem, this.TTL.CATEGORY_DETAILS),
        cacheService.set(slugKey, cacheItem, this.TTL.CATEGORY_DETAILS),
      ]);

      await this.updateHierarchyNode(category);

      this.stats.writes += 2;
      logger.debug('Category set in cache', { categoryId: category.id, slug: category.slug });
    } catch (error) {
      logger.error('Error setting category in cache', { categoryId: category.id, error });
    }
  }

  // ── Tree ───────────────────────────────────────────────────────────────────

  async getCategoryTree(depth: number = 3, includeInactive: boolean = false): Promise<any> {
    const cacheKey = this.KEY_PATTERNS.TREE(depth, includeInactive);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) { this.stats.hits++;  return cached; }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting category tree from cache', { depth, includeInactive, error });
      return null;
    }
  }

  async setCategoryTree(
    tree:            any,
    depth:           number  = 3,
    includeInactive: boolean = false
  ): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.TREE(depth, includeInactive);
    try {
      await cacheService.set(cacheKey, tree, this.TTL.CATEGORY_TREE);
      this.stats.writes++;
      logger.debug('Category tree set in cache', { depth, includeInactive });
    } catch (error) {
      logger.error('Error setting category tree in cache', { depth, includeInactive, error });
    }
  }

  // ── Flat list ──────────────────────────────────────────────────────────────

  async getAllCategories(
    includeInactive: boolean = false,
    page:            number  = 1,
    limit:           number  = 100,
    sortBy:          string  = 'displayOrder'
  ): Promise<any> {
    const cacheKey = this.KEY_PATTERNS.ALL_FLAT(includeInactive, page, limit, sortBy);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) { this.stats.hits++;  return cached; }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting categories list from cache', { page, limit, error });
      return null;
    }
  }

  async setAllCategories(
    data:            any,
    includeInactive: boolean = false,
    page:            number  = 1,
    limit:           number  = 100,
    sortBy:          string  = 'displayOrder'
  ): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.ALL_FLAT(includeInactive, page, limit, sortBy);
    try {
      await cacheService.set(cacheKey, data, this.TTL.CATEGORY_LIST);
      this.stats.writes++;
      logger.debug('Categories list set in cache', { page, limit, includeInactive });
    } catch (error) {
      logger.error('Error setting categories list in cache', { page, limit, error });
    }
  }

  // ── Products in category  (replaces old "properties" methods) ─────────────

  /**
   * Get cached product list for a category.
   * `filters` should be a stable serialised string of the active query filters,
   * e.g. JSON.stringify({ status, minPrice, maxPrice, isHalal, ... })
   */
  async getProductsInCategory(
    categoryId:      string,
    includeChildren: boolean = false,
    filters:         string  = ''
  ): Promise<any> {
    const cacheKey = this.KEY_PATTERNS.PRODUCTS(categoryId, includeChildren, filters);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) { this.stats.hits++;  return cached; }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting products from cache', { categoryId, error });
      return null;
    }
  }

  /**
   * Cache product list for a category.
   */
  async setProductsInCategory(
    categoryId:      string,
    data:            any,
    includeChildren: boolean = false,
    filters:         string  = ''
  ): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.PRODUCTS(categoryId, includeChildren, filters);
    try {
      await cacheService.set(cacheKey, data, this.TTL.PRODUCTS);
      this.stats.writes++;
      logger.debug('Category products set in cache', { categoryId, includeChildren });
    } catch (error) {
      logger.error('Error setting products in cache', { categoryId, error });
    }
  }

  // ── Statistics ─────────────────────────────────────────────────────────────

  async getCategoryStats(): Promise<any> {
    const cacheKey = this.KEY_PATTERNS.STATS();
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) { this.stats.hits++;  return cached; }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting category stats from cache', { error });
      return null;
    }
  }

  async setCategoryStats(data: any): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.STATS();
    try {
      await cacheService.set(cacheKey, data, this.TTL.STATISTICS);
      this.stats.writes++;
      logger.debug('Category statistics set in cache');
    } catch (error) {
      logger.error('Error setting category stats in cache', { error });
    }
  }

  // ── Ancestors & breadcrumb ─────────────────────────────────────────────────

  async getCategoryAncestors(categoryId: string): Promise<any> {
    const cacheKey = this.KEY_PATTERNS.ANCESTORS(categoryId);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) { this.stats.hits++;  return cached; }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting ancestors from cache', { categoryId, error });
      return null;
    }
  }

  async setCategoryAncestors(categoryId: string, ancestors: any[]): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.ANCESTORS(categoryId);
    try {
      await cacheService.set(cacheKey, ancestors, this.TTL.HIERARCHY);
      this.stats.writes++;
      logger.debug('Category ancestors set in cache', { categoryId });
    } catch (error) {
      logger.error('Error setting ancestors in cache', { categoryId, error });
    }
  }

  async getCategoryBreadcrumb(categoryId: string): Promise<any> {
    const cacheKey = this.KEY_PATTERNS.BREADCRUMB(categoryId);
    try {
      const cached = await cacheService.get(cacheKey);
      if (cached) { this.stats.hits++;  return cached; }
      this.stats.misses++;
      return null;
    } catch (error) {
      logger.error('Error getting breadcrumb from cache', { categoryId, error });
      return null;
    }
  }

  async setCategoryBreadcrumb(categoryId: string, breadcrumb: any[]): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.BREADCRUMB(categoryId);
    try {
      await cacheService.set(cacheKey, breadcrumb, this.TTL.BREADCRUMB);
      this.stats.writes++;
      logger.debug('Category breadcrumb set in cache', { categoryId });
    } catch (error) {
      logger.error('Error setting breadcrumb in cache', { categoryId, error });
    }
  }

  // ── Hierarchy node (internal — used for smart invalidation) ───────────────

  private async updateHierarchyNode(category: ProductCategory): Promise<void> {
    const nodeKey = this.KEY_PATTERNS.HIERARCHY_NODE(category.id);
    const node: CategoryHierarchyNode = { id: category.id, children: [] };

    try {
      await cacheService.set(nodeKey, node, this.TTL.HIERARCHY);

      if (category.parentId) {
        const parentNodeKey = this.KEY_PATTERNS.HIERARCHY_NODE(category.parentId);
        const parentNode    = await cacheService.get(parentNodeKey) as CategoryHierarchyNode | null;

        if (parentNode && !parentNode.children.includes(category.id)) {
          parentNode.children.push(category.id);
          await cacheService.set(parentNodeKey, parentNode, this.TTL.HIERARCHY);
        }
      }
    } catch (error) {
      logger.error('Error updating hierarchy node', { categoryId: category.id, error });
    }
  }

  // ── Invalidation ───────────────────────────────────────────────────────────

  /**
   * Invalidate all cache entries for a single category.
   */
  async invalidateCategory(categoryId: string): Promise<void> {
    try {
      const category = await this.getCategoryById(categoryId);

      const keysToDelete = [
        this.KEY_PATTERNS.BY_ID(categoryId),
        category ? this.KEY_PATTERNS.BY_SLUG(category.slug) : null,
        this.KEY_PATTERNS.ANCESTORS(categoryId),
        this.KEY_PATTERNS.DESCENDANTS(categoryId, 3),
        this.KEY_PATTERNS.BREADCRUMB(categoryId),
        this.KEY_PATTERNS.CATEGORY_PATH(categoryId),
      ].filter(Boolean) as string[];

      await Promise.all(keysToDelete.map(key => cacheService.delete(key)));
      await this.invalidateCategoryLists();

      this.stats.invalidations++;
      logger.info('Category cache invalidated', { categoryId, keysDeleted: keysToDelete.length });
    } catch (error) {
      logger.error('Error invalidating category cache', { categoryId, error });
    }
  }

  /**
   * Invalidate ALL category-related cache entries (e.g. after bulk operations).
   */
  async invalidateAllCategories(): Promise<void> {
    try {
      const keys = await cacheService.getKeys(`${this.KEY_PREFIX}:*`);

      const batchSize = 100;
      for (let i = 0; i < keys.length; i += batchSize) {
        await Promise.all(keys.slice(i, i + batchSize).map(k => cacheService.delete(k)));
      }

      this.stats.invalidations += keys.length;
      logger.info('All category cache invalidated', { totalKeys: keys.length });
    } catch (error) {
      logger.error('Error invalidating all category cache', { error });
    }
  }

  /**
   * Invalidate tree and flat-list caches only.
   * Called after any write that changes structure or ordering.
   */
  async invalidateCategoryLists(): Promise<void> {
    try {
      const [treeKeys, listKeys] = await Promise.all([
        cacheService.getKeys(`${this.KEY_PREFIX}:tree:*`),
        cacheService.getKeys(`${this.KEY_PREFIX}:list:*`)
      ]);

      const allKeys = [...treeKeys, ...listKeys];
      if (allKeys.length > 0) {
        await Promise.all(allKeys.map(k => cacheService.delete(k)));
      }

      logger.debug('Category tree and list cache invalidated', {
        treeKeys: treeKeys.length,
        listKeys: listKeys.length
      });
    } catch (error) {
      logger.error('Error invalidating category lists', { error });
    }
  }

  /**
   * Invalidate a category AND all its descendants recursively.
   * Used when a category is moved, renamed, or its isActive flag changes.
   */
  async invalidateCategoryHierarchy(categoryId: string): Promise<void> {
    try {
      const descendants      = await this.getCategoryDescendants(categoryId);
      const allCategoryIds   = [categoryId, ...descendants.map((d: any) => d.id)];

      await Promise.all(allCategoryIds.map(id => this.invalidateCategory(id)));
      await this.invalidateCategoryLists();

      this.stats.hierarchicalInvalidations++;
      logger.info('Category hierarchy cache invalidated', {
        rootCategoryId: categoryId,
        totalCategories: allCategoryIds.length
      });
    } catch (error) {
      logger.error('Error invalidating category hierarchy', { categoryId, error });
    }
  }

  // ── Descendants (internal) ────────────────────────────────────────────────

  private async getCategoryDescendants(
    categoryId: string,
    maxDepth:   number = 10
  ): Promise<any[]> {
    const cacheKey = this.KEY_PATTERNS.DESCENDANTS(categoryId, maxDepth);
    try {
      const cached = await cacheService.get(cacheKey);
      return cached ? (cached as any[]) : [];
    } catch (error) {
      logger.error('Error getting descendants from cache', { categoryId, error });
      return [];
    }
  }

  async setCategoryDescendants(
    categoryId:  string,
    descendants: any[],
    maxDepth:    number = 10
  ): Promise<void> {
    const cacheKey = this.KEY_PATTERNS.DESCENDANTS(categoryId, maxDepth);
    try {
      await cacheService.set(cacheKey, descendants, this.TTL.HIERARCHY);
      logger.debug('Category descendants set in cache', { categoryId, count: descendants.length });
    } catch (error) {
      logger.error('Error setting descendants in cache', { categoryId, error });
    }
  }

  // ── Cache-level stats & utility ───────────────────────────────────────────

  async getStats(): Promise<CacheStats> {
    try {
      const allKeys = await cacheService.getKeys(`${this.KEY_PREFIX}:*`);

      const hierarchicalKeys = allKeys.filter(k =>
        k.includes(':ancestors:') || k.includes(':descendants:') || k.includes(':breadcrumb:')
      ).length;
      const listKeys = allKeys.filter(k => k.includes(':list:')).length;
      const total    = this.stats.hits + this.stats.misses;

      return {
        hits:             this.stats.hits,
        misses:           this.stats.misses,
        memoryRatio:      total > 0 ? this.stats.hits / total : 0,
        totalKeys:        allKeys.length,
        hierarchicalKeys,
        listKeys,
      };
    } catch (error) {
      logger.error('Error getting cache stats', { error });
      return {
        hits: this.stats.hits, misses: this.stats.misses,
        memoryRatio: 0, totalKeys: 0, hierarchicalKeys: 0, listKeys: 0,
      };
    }
  }

  async clear(): Promise<void> {
    await this.invalidateAllCategories();
  }

  isReady(): boolean {
    return cacheService.isReady();
  }

  getCacheMode(): 'redis' | 'memory' {
    return cacheService.getCacheMode();
  }
}

// Export singleton instance
export default new CategoryCacheService();