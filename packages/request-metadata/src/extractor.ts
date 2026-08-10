import { RequestMetadata, RequestWithSocket, ExtractionOptions } from './types';
import { mergeConfig } from './config';
import {
  extractIPInfo,
  extractUserAgentInfo,
  extractSecurityInfo,
  extractPerformanceInfo,
  extractFingerprintData,
  extractAnalyticsData,
  extractHeadersInfo,
} from './extractors';
import { getIPVersion } from './utils/ip-utils';
import { detectProxyType, detectVPN, assessThreatLevel } from './utils/detection-utils';
import { parseCookies } from './utils/cookie-utils';
import { geoipLookup } from './utils/geoip-utils';
import { getCached, createCacheKey } from './cache';

export async function getAdvancedRequestMetadata(
  req: RequestWithSocket,
  options: Partial<ExtractionOptions> = {}
): Promise<RequestMetadata> {
  const config = mergeConfig(options);
  const requestTime = Date.now();

  // Create cache key if caching is enabled
  const cacheKey = config.cache?.enabled ? createCacheKey(req) : null;

  if (cacheKey && config.cache?.enabled) {
    return getCached(cacheKey, () => extractMetadata(req, config, requestTime), config.cache.ttl);
  }

  return extractMetadata(req, config, requestTime);
}

async function extractMetadata(
  req: RequestWithSocket,
  config: ExtractionOptions,
  requestTime: number
): Promise<RequestMetadata> {
  try {
    // Extract all headers
    const headers = extractHeaders(req);

    // Initialize metadata structure
    const metadata: Partial<RequestMetadata> = {
      timing: {
        requestTime,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        localTime: new Date().toLocaleString(),
        utcOffset: new Date().getTimezoneOffset(),
        daylightSavings: isDaylightSavingsTime(),
      },
      custom: {},
    };

    // Extract User Agent information first (needed for threatLevel below)
    if (config.features?.userAgent) {
      metadata.userAgent = extractUserAgentInfo(headers['user-agent'], headers);
    }

    // Extract IP information if enabled
    if (config.features?.ipDetection) {
      const ipInfo = extractIPInfo(
        req,
        headers,
        config.ipDetection?.trustedProxies
      );

      // GeoIP lookup if enabled
      let geoData = null;
      if (config.features.geolocation && config.geoIP?.enabled && ipInfo.ipAddress) {
        geoData = geoipLookup(ipInfo.ipAddress);
      }

      metadata.network = {
        ipAddress: ipInfo.ipAddress,
        ipVersion: getIPVersion(ipInfo.ipAddress),
        isp: ipInfo.isp,
        asn: ipInfo.asn,
        country: geoData?.country || headers['cf-ipcountry'] || undefined,
        city: geoData?.city || undefined,
        latitude: geoData?.ll?.[0] || undefined,
        longitude: geoData?.ll?.[1] || undefined,
        timezone: geoData?.timezone || undefined,
        proxyType: detectProxyType(ipInfo, headers),
        vpnDetection: detectVPN(ipInfo, headers),
        // metadata.userAgent is now populated before this block
        threatLevel: assessThreatLevel(ipInfo, headers, metadata.userAgent),
      };
    }

    // Extract Security information if enabled
    if (config.features?.security) {
      metadata.security = extractSecurityInfo(req, headers);
    }

    // Extract Performance information if enabled
    if (config.features?.performance) {
      metadata.performance = extractPerformanceInfo(headers);
    }

    // Extract Headers information if enabled
    if (config.features?.headers) {
      metadata.headers = extractHeadersInfo(headers);
    }

    // Extract Fingerprint data if enabled
    if (config.features?.fingerprint) {
      metadata.fingerprint = await extractFingerprintData(req, headers);
    }

    // Extract Analytics data if enabled
    if (config.features?.analytics) {
      metadata.analytics = extractAnalyticsData(req, headers);
    }

    // Extract Request Context
    metadata.request = extractRequestContext(req, headers);

    // Extract Browser Features
    metadata.features = extractBrowserFeatures(headers);

    // Extract Geolocation (client-side, placeholder)
    metadata.geolocation = {
      latitude: undefined,
      longitude: undefined,
      accuracy: undefined,
      altitude: undefined,
      heading: undefined,
      speed: undefined,
      timestamp: undefined,
    };

    return metadata as RequestMetadata;

  } catch (error) {
    if (config.logging?.enabled) {
      console.error('Error extracting request metadata:', error);
    }
    return createMinimalMetadata(requestTime);
  }
}

function extractHeaders(req: RequestWithSocket): Record<string, string> {
  const headers: Record<string, string> = {};

  if (req.headers) {
    Object.entries(req.headers).forEach(([key, value]) => {
      if (value !== undefined) {
        if (Array.isArray(value)) {
          headers[key.toLowerCase()] = value.join(', ');
        } else {
          headers[key.toLowerCase()] = String(value);
        }
      }
    });
  }

  return headers;
}

function extractRequestContext(
  req: RequestWithSocket,
  headers: Record<string, string>
): RequestMetadata['request'] {
  const url = req.url || '';
  const host = headers.host || 'localhost';

  let query: Record<string, string> = {};
  let protocol = 'http';
  let hostname = host;
  let path = url;

  try {
    const urlObj = new URL(url, `http://${host}`);
    protocol = urlObj.protocol.replace(':', '');
    hostname = urlObj.hostname;
    path = urlObj.pathname;
    query = Object.fromEntries(urlObj.searchParams.entries());
  } catch {
    // If URL parsing fails, extract basic info
    const queryMatch = url.match(/\?(.*)$/);
    if (queryMatch) {
      const params = new URLSearchParams(queryMatch[1]);
      query = Object.fromEntries(params.entries());
      path = url.split('?')[0];
    }
  }

  const cookies = parseCookies(headers.cookie);

  return {
    method: req.method || 'GET',
    url: url,
    protocol: protocol,
    hostname: hostname,
    path: path,
    query: query,
    cookies: cookies,
    bodySize: parseInt(headers['content-length'] || '0', 10),
    headersSize: JSON.stringify(headers).length,
    isAjax: headers['x-requested-with'] === 'XMLHttpRequest',
    isWebSocket: headers.upgrade === 'websocket',
    isSecure: protocol === 'https',
  };
}

// Removed unused `userAgent` parameter — browser feature detection is header-based only
function extractBrowserFeatures(
  headers: Record<string, string>
): RequestMetadata['features'] {
  const ua = (headers['user-agent'] || '').toLowerCase();
  const isChrome = ua.includes('chrome');
  const isFirefox = ua.includes('firefox');
  const isSafari = ua.includes('safari');
  const isModernBrowser = isChrome || isFirefox || isSafari;

  return {
    webRTC: isModernBrowser,
    webGL: isModernBrowser,
    webAssembly: true,
    serviceWorker: isChrome || isFirefox,
    pushNotifications: isModernBrowser,
    geolocation: true,
    notifications: isModernBrowser,
    camera: isModernBrowser,
    microphone: isModernBrowser,
    bluetooth: isChrome,
    usb: isChrome,
    nfc: isChrome && ua.includes('android'),
  };
}

function isDaylightSavingsTime(): boolean {
  const today = new Date();
  const jan = new Date(today.getFullYear(), 0, 1);
  const jul = new Date(today.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return today.getTimezoneOffset() < stdTimezoneOffset;
}

function createMinimalMetadata(requestTime: number): RequestMetadata {
  return {
    network: {
      ipAddress: undefined,
      ipVersion: 'unknown',
      isp: undefined,
      asn: undefined,
      country: undefined,
      city: undefined,
      latitude: undefined,
      longitude: undefined,
      timezone: undefined,
      proxyType: 'unknown',
      vpnDetection: { isVpn: false, confidence: 0, service: undefined },
      threatLevel: 'unknown',
    },
    userAgent: {
      raw: undefined,
      browser: {
        name: undefined,
        version: undefined,
        engine: undefined,
        majorVersion: undefined,       //  Added missing field
      },
      os: {
        name: undefined,
        version: undefined,
        platform: undefined,
        architecture: undefined,       //  Added missing field
      },
      device: {
        type: 'unknown',
        vendor: undefined,
        model: undefined,
        isTouch: false,
        isBot: false,
        botName: undefined,
        isMobile: false,               //  Added missing field
        isDesktop: false,              //  Added missing field
        isEmulator: false,             //  Added missing field
      },
      capabilities: {
        supportsWebGL: false,
        supportsWebRTC: false,
        supportsWebAssembly: false,
        supportsWebP: false,           //  Added missing field
        supportsAVIF: false,           //  Added missing field
        screenResolution: undefined,
        colorDepth: undefined,
        pixelRatio: undefined,
        connectionType: undefined,     //  Added missing field
        supportsHDR: false,            //  Added missing field
      },
    },
    performance: {
      connectionType: 'unknown',
      effectiveType: undefined,
      downlink: undefined,
      rtt: undefined,
      saveData: false,
    },
    security: {
      tlsVersion: undefined,
      cipherSuite: undefined,
      hsts: false,
      contentTypeOptions: false,
      xssProtection: false,
      frameOptions: false,
      referrerPolicy: undefined,
      permissionsPolicy: undefined,
    },
    geolocation: {
      latitude: undefined,
      longitude: undefined,
      accuracy: undefined,
      altitude: undefined,
      heading: undefined,
      speed: undefined,
      timestamp: undefined,
    },
    timing: {
      requestTime,
      timezone: undefined,
      localTime: new Date().toLocaleString(),
      utcOffset: 0,
      daylightSavings: false,
    },
    fingerprint: {
      canvasHash: undefined,
      webglHash: undefined,
      fontsHash: undefined,
      audioHash: undefined,
      screenHash: undefined,
      pluginsHash: undefined,
    },
    headers: {
      accept: undefined,
      acceptEncoding: undefined,
      acceptLanguage: undefined,
      cacheControl: undefined,
      connection: undefined,
      contentType: undefined,
      dnt: false,
      encoding: undefined,
      host: undefined,
      origin: undefined,
      pragma: undefined,
      referer: undefined,
      upgradeInsecureRequests: false,
      via: undefined,
      xForwardedFor: undefined,        //  Typed as string[] | undefined (matches interface)
      xRealIp: undefined,
      cfConnectingIp: undefined,
      cfIpCountry: undefined,
      cfRay: undefined,
      secChUa: undefined,
      secChUaMobile: undefined,
      secChUaPlatform: undefined,
      secChUaPlatformVersion: undefined,
      secChUaModel: undefined,
      secFetchDest: undefined,
      secFetchMode: undefined,
      secFetchSite: undefined,
      secFetchUser: undefined,
    },
    request: {
      method: 'GET',
      url: '',
      protocol: 'http',
      hostname: '',
      path: '',
      query: {},
      cookies: {},
      bodySize: 0,
      headersSize: 0,
      isAjax: false,
      isWebSocket: false,
      isSecure: false,
    },
    features: {
      webRTC: false,
      webGL: false,
      webAssembly: false,
      serviceWorker: false,
      pushNotifications: false,
      geolocation: false,
      notifications: false,
      camera: false,
      microphone: false,
      bluetooth: false,
      usb: false,
      nfc: false,
    },
    analytics: {
      sessionId: undefined,
      pageViewId: undefined,
      userId: undefined,
      referralSource: undefined,
      campaign: undefined,
      utmSource: undefined,
      utmMedium: undefined,
      utmCampaign: undefined,
      utmTerm: undefined,
      utmContent: undefined,
    },
    custom: {},
  };
}

// Factory function for creating a configured extractor
export function createMetadataExtractor(options: Partial<ExtractionOptions> = {}) {
  const config = mergeConfig(options);

  return {
    extract: (req: RequestWithSocket) => getAdvancedRequestMetadata(req, config),
    config,
  };
}