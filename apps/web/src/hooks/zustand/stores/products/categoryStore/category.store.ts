import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type {
  Category,
  CategoryTreeNode,
  CategoryQueryOptions,
  CategoryStatistics,
  BreadcrumbItem,
  Pagination,
} from '@/lib/products/categories/category.api';

// Add this interface for store hydration
interface StoreHydration {
  hydrated: boolean;
  setHydrated: () => void;
}

interface CategoryState extends StoreHydration {
  // Data state
  categories: Category[];
  categoryTree: CategoryTreeNode[];
  selectedCategory: Category | null;
  breadcrumb: BreadcrumbItem[];
  statistics: CategoryStatistics | null;
  lastFetchTime: number;

  // UI state
  filters: CategoryQueryOptions;
  pagination: Pagination | null;
  loading: boolean;
  error: string | null;
  isInitialized: boolean;

  // Actions - Data setters
  setCategories: (categories: Category[]) => void;
  setCategoryTree: (tree: CategoryTreeNode[]) => void;
  setSelectedCategory: (category: Category | null) => void;
  setBreadcrumb: (breadcrumb: BreadcrumbItem[]) => void;
  setStatistics: (statistics: CategoryStatistics | null) => void;
  setLastFetchTime: (time: number) => void;

  // Actions - UI state
  setFilters: (filters: CategoryQueryOptions) => void;
  setPagination: (pagination: Pagination | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setInitialized: (initialized: boolean) => void;

  // Actions - Operations
  addCategory: (category: Category) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  removeCategory: (id: string) => void;

  // Actions - Utilities
  resetFilters: () => void;
  reset: () => void;
  getCategoryById: (id: string) => Category | undefined;
  getCategoryBySlug: (slug: string) => Category | undefined;
  getChildCategories: (parentId: string | null) => Category[];

  // Cache utilities
  shouldRefetch: (staleTime?: number) => boolean;
  clearData: () => void;
}

const initialFilters: CategoryQueryOptions = {
  includeInactive: false,
  page: 1,
  limit: 100,
  sortBy: 'displayOrder',
  sortOrder: 'asc',
  search: '',
  parentId: undefined,
};

const initialState = {
  hydrated: false,
  categories: [],
  categoryTree: [],
  selectedCategory: null,
  breadcrumb: [],
  statistics: null,
  lastFetchTime: 0,
  filters: initialFilters,
  pagination: null,
  loading: false,
  error: null,
  isInitialized: false,
};

export const useCategoryStore = create<CategoryState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Hydration
        setHydrated: () => set({ hydrated: true }),

        // Data setters
        setCategories: (categories) => set({
          categories,
          lastFetchTime: Date.now()
        }, false, 'setCategories'),

        setCategoryTree: (tree) => set({
          categoryTree: tree
        }, false, 'setCategoryTree'),

        setSelectedCategory: (category) => set({
          selectedCategory: category
        }, false, 'setSelectedCategory'),

        setBreadcrumb: (breadcrumb) => set({
          breadcrumb
        }, false, 'setBreadcrumb'),

        setStatistics: (statistics) => set({
          statistics
        }, false, 'setStatistics'),

        setLastFetchTime: (time) => set({
          lastFetchTime: time
        }, false, 'setLastFetchTime'),

        setInitialized: (initialized) => set({
          isInitialized: initialized
        }, false, 'setInitialized'),

        // UI state setters
        setFilters: (filters) => set({
          filters
        }, false, 'setFilters'),

        setPagination: (pagination) => set({
          pagination
        }, false, 'setPagination'),

        setLoading: (loading) => set({
          loading
        }, false, 'setLoading'),

        setError: (error) => set({
          error
        }, false, 'setError'),

        // Operations
        addCategory: (category) => set(
          (state) => ({
            categories: [category, ...state.categories],
          }),
          false,
          'addCategory'
        ),

        updateCategory: (id, updates) => set(
          (state) => ({
            categories: state.categories.map((cat) =>
              cat.id === id ? { ...cat, ...updates } : cat
            ),
            selectedCategory:
              state.selectedCategory?.id === id
                ? { ...state.selectedCategory, ...updates }
                : state.selectedCategory,
            categoryTree: updateTreeNodes(state.categoryTree, id, updates),
          }),
          false,
          'updateCategory'
        ),

        removeCategory: (id) => set(
          (state) => ({
            categories: state.categories.filter((cat) => cat.id !== id),
            selectedCategory:
              state.selectedCategory?.id === id
                ? null
                : state.selectedCategory,
            categoryTree: removeTreeNode(state.categoryTree, id),
          }),
          false,
          'removeCategory'
        ),

        // Utilities
        resetFilters: () => set({
          filters: initialFilters
        }, false, 'resetFilters'),

        reset: () => set({
          ...initialState,
          hydrated: true
        }, false, 'reset'),

        clearData: () => set({
          categories: [],
          categoryTree: [],
          selectedCategory: null,
          breadcrumb: [],
          statistics: null,
          lastFetchTime: 0,
        }, false, 'clearData'),

        getCategoryById: (id) => {
          const state = get();
          return state.categories.find((cat) => cat.id === id);
        },

        getCategoryBySlug: (slug) => {
          const state = get();
          return state.categories.find((cat) => cat.slug === slug);
        },

        getChildCategories: (parentId) => {
          const state = get();
          return state.categories.filter((cat) => cat.parentId === parentId);
        },

        shouldRefetch: (staleTime = 30000) => {
          const state = get();
          return Date.now() - state.lastFetchTime > staleTime;
        },
      }),
      {
        name: 'category-storage',
        partialize: (state) => ({
          filters: state.filters,
          selectedCategoryId: state.selectedCategory?.id,
          hydrated: state.hydrated,
        }),
        onRehydrateStorage: () => (state) => {
          if (state) {
            state.setHydrated();
          }
        },
      }
    ),
    {
      name: 'CategoryStore',
    }
  )
);

// Helper functions for tree updates
// Helper functions for tree updates
function updateTreeNodes(
  nodes: CategoryTreeNode[],
  id: string,
  updates: Omit<Partial<Category>, 'children'>
): CategoryTreeNode[] {
  return nodes.map(node => {
    if (node.id === id) {
      return { ...node, ...updates };
    }
    if (node.children && node.children.length > 0) {
      return {
        ...node,
        children: updateTreeNodes(node.children, id, updates)
      };
    }
    return node;
  });
}
function removeTreeNode(nodes: CategoryTreeNode[], id: string): CategoryTreeNode[] {
  return nodes
    .filter(node => node.id !== id)
    .map(node => ({
      ...node,
      children: node.children ? removeTreeNode(node.children, id) : []
    }));
}