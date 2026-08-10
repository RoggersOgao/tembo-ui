/**
 * Canonical URL parameter order for property filtering.
 *
 * Every component that reads or writes property search params must use this
 * file so that:
 *  - React Query cache keys are stable (same filters = same URL = same cache hit)
 *  - Browser history entries don't duplicate due to param ordering differences
 *  - `pushParams` in any component produces identical URLs for identical state
 *
 * PARAM CATEGORIES
 * ─────────────────────────────────────────────────────────────────────────────
 * Frontend-only  │ filter, aiQuery, nearby
 *                │  → control which query hook is active; never sent to backend
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared         │ search, city, state, country, zipCode, propertyType,
 *                │ categoryId, categorySlug, tagIds, beds, baths,
 *                │ amenities, highlights, minPrice, maxPrice,
 *                │ minLotSize, maxLotSize, minRating, billingPeriod,
 *                │ sortBy, sortOrder, page, limit
 *                │  → parsed by both frontend (parsePropertyParams) and the
 *                │    backend Zod schema (PropertyQuery)
 */

// ─── Canonical key order ──────────────────────────────────────────────────────

export const PROPERTY_PARAM_ORDER = [
  // ── Frontend routing ───────────────────────────────────────────────────────
  'filter',         // which quick-filter tab is active (featured | recent | toprated)
  'aiQuery',        // AI search query string
  'nearby',         // "lat,lng" string for geolocation search

  // ── Text search ────────────────────────────────────────────────────────────
  'search',

  // ── Location ───────────────────────────────────────────────────────────────
  'city',
  'state',
  'country',        // ISO 3166-1 alpha-2 (validated server-side to length 2)
  'zipCode',

  // ── Classification ─────────────────────────────────────────────────────────
  'propertyType',
  'categoryId',
  'categorySlug',
  'tagIds',         // comma-separated cuid list

  // ── Property features ──────────────────────────────────────────────────────
  'beds',
  'baths',
  'amenities',      // comma-separated list
  'highlights',     // comma-separated list (frontend only; server ignores if absent)
  'minLotSize',
  'maxLotSize',

  // ── Pricing ────────────────────────────────────────────────────────────────
  'minPrice',
  'maxPrice',
  'billingPeriod',  // BillingPeriod enum — default MONTHLY

  // ── Rating ─────────────────────────────────────────────────────────────────
  'minRating',

  // ── Sorting ────────────────────────────────────────────────────────────────
  'sortBy',
  'sortOrder',

  // ── Pagination ─────────────────────────────────────────────────────────────
  'page',
  'limit',
] as const;

export type PropertyParam = (typeof PROPERTY_PARAM_ORDER)[number];

// ─── Defaults ─────────────────────────────────────────────────────────────────

export const PROPERTY_PARAM_DEFAULTS = {
  filter:        'featured',
  billingPeriod: 'MONTHLY',
  sortBy:        'createdAt',
  sortOrder:     'desc',
  minPrice:      5000,
  maxPrice:      50000,
  page:          1,
  limit:         20,
} as const satisfies Partial<Record<PropertyParam, string | number>>;

// ─── Parsed shape ─────────────────────────────────────────────────────────────

export interface ParsedPropertyParams {
  // Frontend-only
  quickFilter:   string;
  aiQuery:       string;
  nearby:        string;

  // Shared with backend
  search:        string;
  city:          string;
  state:         string;
  country:       string;
  zipCode:       string;
  propertyType:  string;
  categoryId:    string;
  categorySlug:  string;
  tagIds:        string[];
  beds:          number;
  baths:         number;
  amenities:     string[];
  highlights:    string[];
  minLotSize:    number | undefined;
  maxLotSize:    number | undefined;
  minPrice:      number;
  maxPrice:      number;
  billingPeriod: string;
  minRating:     number | undefined;
  sortBy:        string;
  sortOrder:     'asc' | 'desc';
  page:          number;
  limit:         number;
}

// ─── Parser ───────────────────────────────────────────────────────────────────

export function parsePropertyParams(searchParams: URLSearchParams): ParsedPropertyParams {
  const get  = (key: string)                  => searchParams.get(key);
  const num  = (key: string, fallback: number) => parseInt(get(key) ?? String(fallback)) || fallback;
  const opt  = (key: string)                  => { const v = get(key); return v ? parseFloat(v) : undefined; };
  const csv  = (key: string)                  => get(key) ? get(key)!.split(',').filter(Boolean) : [];
  const dec  = (key: string)                  => get(key) ? decodeURIComponent(get(key)!) : '';

  return {
    // Frontend-only
    quickFilter:   get('filter')        ?? PROPERTY_PARAM_DEFAULTS.filter,
    aiQuery:       dec('aiQuery'),
    nearby:        get('nearby')        ?? '',

    // Shared
    search:        dec('search'),
    city:          get('city')          ?? '',
    state:         get('state')         ?? '',
    country:       get('country')       ?? '',
    zipCode:       get('zipCode')       ?? '',
    propertyType:  get('propertyType')  ?? '',
    categoryId:    get('categoryId')    ?? '',
    categorySlug:  get('categorySlug')  ?? '',
    tagIds:        csv('tagIds'),
    beds:          num('beds',   0),
    baths:         num('baths',  0),
    amenities:     csv('amenities'),
    highlights:    csv('highlights'),
    minLotSize:    opt('minLotSize'),
    maxLotSize:    opt('maxLotSize'),
    minPrice:      num('minPrice', PROPERTY_PARAM_DEFAULTS.minPrice),
    maxPrice:      num('maxPrice', PROPERTY_PARAM_DEFAULTS.maxPrice),
    billingPeriod: get('billingPeriod') ?? PROPERTY_PARAM_DEFAULTS.billingPeriod,
    minRating:     opt('minRating'),
    sortBy:        get('sortBy')        ?? PROPERTY_PARAM_DEFAULTS.sortBy,
    sortOrder:     (get('sortOrder')    ?? PROPERTY_PARAM_DEFAULTS.sortOrder) as 'asc' | 'desc',
    page:          num('page',  PROPERTY_PARAM_DEFAULTS.page),
    limit:         num('limit', PROPERTY_PARAM_DEFAULTS.limit),
  };
}

// ─── Canonical URL builder ────────────────────────────────────────────────────

/**
 * Applies `updater` to a copy of `current` then rebuilds URLSearchParams
 * in canonical order. Keys absent from PROPERTY_PARAM_ORDER are appended last.
 */
export function buildCanonicalParams(
  current: URLSearchParams,
  updater: (p: URLSearchParams) => void,
): URLSearchParams {
  const working = new URLSearchParams(current.toString());
  updater(working);

  const ordered   = new URLSearchParams();
  const remaining = new URLSearchParams(working.toString());

  for (const key of PROPERTY_PARAM_ORDER) {
    const value = working.get(key);
    if (value !== null) {
      ordered.set(key, value);
      remaining.delete(key);
    }
  }

  // Append unknown keys at the end (future-proofing)
  remaining.forEach((value, key) => ordered.set(key, value));

  return ordered;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Removes all mutually exclusive quick-filter params from `p`.
 * Call this before setting a new filter/search/nearby/aiQuery.
 */
export function clearQuickFilterParams(p: URLSearchParams): void {
  (['filter', 'search', 'nearby', 'aiQuery'] as const).forEach(k => p.delete(k));
}

/**
 * Returns true if any non-default filter is currently active.
 */
export function hasActiveFilters(params: URLSearchParams): boolean {
  const p = parsePropertyParams(params);
  return (
    Boolean(p.search)       ||
    Boolean(p.aiQuery)      ||
    Boolean(p.nearby)       ||
    Boolean(p.city)         ||
    Boolean(p.state)        ||
    Boolean(p.country)      ||
    Boolean(p.zipCode)      ||
    Boolean(p.propertyType) ||
    Boolean(p.categoryId)   ||
    Boolean(p.categorySlug) ||
    p.tagIds.length > 0     ||
    p.beds > 0              ||
    p.baths > 0             ||
    p.amenities.length > 0  ||
    p.highlights.length > 0 ||
    p.minLotSize !== undefined ||
    p.maxLotSize !== undefined ||
    p.minRating  !== undefined ||
    p.minPrice !== PROPERTY_PARAM_DEFAULTS.minPrice ||
    p.maxPrice !== PROPERTY_PARAM_DEFAULTS.maxPrice ||
    p.billingPeriod !== PROPERTY_PARAM_DEFAULTS.billingPeriod ||
    p.sortBy    !== PROPERTY_PARAM_DEFAULTS.sortBy  ||
    p.sortOrder !== PROPERTY_PARAM_DEFAULTS.sortOrder ||
    p.quickFilter !== PROPERTY_PARAM_DEFAULTS.filter
  );
}