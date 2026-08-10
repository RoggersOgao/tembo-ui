import geoip from 'geoip-lite';

export interface GeoIPData {
  range?: [number, number];
  country?: string;
  region?: string;
  eu?: string;
  timezone?: string;
  city?: string;
  ll?: [number, number];
  metro?: number;
  area?: number;
}

let geoipCache = new Map<string, { data: GeoIPData | null; timestamp: number }>();

export function geoipLookup(ip: string, ttl: number = 300000): GeoIPData | null {
  // Check cache first
  const cached = geoipCache.get(ip);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data;
  }

  // Perform lookup
  const data = geoip.lookup(ip);

  // Cache result
  geoipCache.set(ip, { data, timestamp: Date.now() });

  // Clean cache if it gets too large
  if (geoipCache.size > 1000) {
    const now = Date.now();
    for (const [key, value] of geoipCache.entries()) {
      if (now - value.timestamp > ttl) {
        geoipCache.delete(key);
      }
    }
  }

  return data;
}

export function clearGeoIPCache(): void {
  geoipCache.clear();
}

export function getGeoIPCacheSize(): number {
  return geoipCache.size;
}

export function isEUCountry(countryCode: string): boolean {
  const euCountries = [
    'AT', 'BE', 'BG', 'CY', 'CZ', 'DE', 'DK', 'EE', 'ES',
    'FI', 'FR', 'GR', 'HR', 'HU', 'IE', 'IT', 'LT', 'LU',
    'LV', 'MT', 'NL', 'PL', 'PT', 'RO', 'SE', 'SI', 'SK'
  ];
  return euCountries.includes(countryCode.toUpperCase());
}

export function formatLocation(geoData: GeoIPData | null): string {
  if (!geoData) return 'Unknown';
  
  const parts: string[] = [];
  if (geoData.city) parts.push(geoData.city);
  if (geoData.region) parts.push(geoData.region);
  if (geoData.country) parts.push(geoData.country);
  
  return parts.length > 0 ? parts.join(', ') : 'Unknown';
}