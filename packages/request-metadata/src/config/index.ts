import { ExtractionOptions } from '../types';

export const DEFAULT_CONFIG: ExtractionOptions = {
  features: {
    ipDetection: true,
    userAgent: true,
    geolocation: true,
    security: true,
    performance: true,
    fingerprint: true,
    analytics: true,
    headers: true,
  },
  ipDetection: {
    trustedProxies: [
      '127.0.0.1',
      '::1',
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16',
    ],
    headers: [
      'cf-connecting-ip',
      'true-client-ip',
      'x-client-ip',
      'x-real-ip',
      'x-forwarded-for',
      'forwarded',
    ],
    skipPrivateIPs: true,
  },
  cache: {
    enabled: true,
    ttl: 300, // 5 minutes
    maxSize: 1000,
  },
  geoIP: {
    enabled: true,
  },
  logging: {
    enabled: false,
    level: 'error',
  },
};

export function mergeConfig(
  userConfig: Partial<ExtractionOptions> = {}
): ExtractionOptions {
  const merged: ExtractionOptions = {
    ...DEFAULT_CONFIG,
    ...userConfig,
    features: {
      ...DEFAULT_CONFIG.features,
      ...userConfig.features,
    },
    ipDetection: {
      ...DEFAULT_CONFIG.ipDetection,
      ...userConfig.ipDetection,
    },
    cache: {
      ...DEFAULT_CONFIG.cache,
      ...userConfig.cache,
    },
    geoIP: {
      ...DEFAULT_CONFIG.geoIP,
      ...userConfig.geoIP,
    },
    logging: {
      ...DEFAULT_CONFIG.logging,
      ...userConfig.logging,
    },
  };

  return merged;
}