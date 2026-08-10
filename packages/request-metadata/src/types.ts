import { UAParser } from 'ua-parser-js';

export interface RequestMetadata {
  // Network & IP Information
  network: {
    ipAddress: string | undefined;
    ipVersion: 'IPv4' | 'IPv6' | 'unknown';
    isp: string | undefined;
    asn: string | undefined;
    country: string | undefined;
    city: string | undefined;
    latitude: number | undefined;
    longitude: number | undefined;
    timezone: string | undefined;
    proxyType: 'none' | 'vpn' | 'proxy' | 'tor' | 'hosting' | 'unknown';
    vpnDetection: {
      isVpn: boolean;
      confidence: number;
      service: string | undefined;
    };
    threatLevel: 'low' | 'medium' | 'high' | 'unknown';
  };

  // User Agent Details
  userAgent: {
    raw: string | undefined;
    browser: {
      name: string | undefined;
      version: string | undefined;
      engine: string | undefined;
      majorVersion: number | undefined;  //  Added
    };
    os: {
      name: string | undefined;
      version: string | undefined;
      platform: string | undefined;  //  Changed from string to match implementation
      architecture: string | undefined;  //  Added
    };
    device: {
      type: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'smart-tv' | 'console' | 'wearable' | 'embedded' | 'unknown';  //  Added more types
      vendor: string | undefined;
      model: string | undefined;
      isTouch: boolean;
      isBot: boolean;
      botName: string | undefined;
      isMobile: boolean;  //  Added
      isDesktop: boolean;  //  Added
      isEmulator: boolean;  //  Added
    };
    capabilities: {
      supportsWebGL: boolean;
      supportsWebRTC: boolean;
      supportsWebAssembly: boolean;
      supportsWebP: boolean;  //  Added
      supportsAVIF: boolean;  //  Added
      screenResolution: { width: number; height: number } | undefined;
      colorDepth: number | undefined;  //  Changed to allow undefined
      pixelRatio: number | undefined;  //  Changed to allow undefined
      connectionType: string | undefined;  //  Added
      supportsHDR: boolean;  //  Added
    };
  };

  // Network Performance
  performance: {
    connectionType: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'ethernet' | 'unknown';
    effectiveType: 'slow-2g' | '2g' | '3g' | '4g' | undefined;
    downlink: number | undefined;
    rtt: number | undefined;
    saveData: boolean;
  };

  // Security Headers
  security: {
    tlsVersion: string | undefined;
    cipherSuite: string | undefined;
    hsts: boolean;
    contentTypeOptions: boolean;
    xssProtection: boolean;
    frameOptions: boolean;
    referrerPolicy: string | undefined;
    permissionsPolicy: Record<string, string[]> | undefined;
  };

  // Geolocation (if available)
  geolocation: {
    latitude: number | undefined;
    longitude: number | undefined;
    accuracy: number | undefined;
    altitude: number | undefined;
    heading: number | undefined;
    speed: number | undefined;
    timestamp: number | undefined;
  };

  // Time & Date
  timing: {
    requestTime: number;
    timezone: string | undefined;
    localTime: string;
    utcOffset: number;
    daylightSavings: boolean;
  };

  // Fingerprinting
  fingerprint: {
    canvasHash: string | undefined;
    webglHash: string | undefined;
    fontsHash: string | undefined;
    audioHash: string | undefined;
    screenHash: string | undefined;
    pluginsHash: string | undefined;
  };

  // Headers Analysis
  headers: {
    accept: string | undefined;
    acceptEncoding: string | undefined;
    acceptLanguage: string | undefined;
    cacheControl: string | undefined;
    connection: string | undefined;
    contentType: string | undefined;
    dnt: boolean;
    encoding: string | undefined;
    host: string | undefined;
    origin: string | undefined;
    pragma: string | undefined;
    referer: string | undefined;
    upgradeInsecureRequests: boolean;
    via: string | undefined;
    xForwardedFor: string[] | undefined;
    xRealIp: string | undefined;
    cfConnectingIp: string | undefined;
    cfIpCountry: string | undefined;
    cfRay: string | undefined;
    secChUa: string | undefined;
    secChUaMobile: string | undefined;
    secChUaPlatform: string | undefined;
    secChUaPlatformVersion: string | undefined;
    secChUaModel: string | undefined;
    secFetchDest: string | undefined;
    secFetchMode: string | undefined;
    secFetchSite: string | undefined;
    secFetchUser: string | undefined;
  };

  // Request Context
  request: {
    method: string;
    url: string;
    protocol: string;
    hostname: string;
    path: string;
    query: Record<string, string>;
    cookies: Record<string, string>;
    bodySize: number;
    headersSize: number;
    isAjax: boolean;
    isWebSocket: boolean;
    isSecure: boolean;
  };

  // Device & Browser Features
  features: {
    webRTC: boolean;
    webGL: boolean;
    webAssembly: boolean;
    serviceWorker: boolean;
    pushNotifications: boolean;
    geolocation: boolean;
    notifications: boolean;
    camera: boolean;
    microphone: boolean;
    bluetooth: boolean;
    usb: boolean;
    nfc: boolean;
  };

  // Analytics
  analytics: {
    sessionId: string | undefined;
    pageViewId: string | undefined;
    userId: string | undefined;
    referralSource: string | undefined;
    campaign: string | undefined;
    utmSource: string | undefined;
    utmMedium: string | undefined;
    utmCampaign: string | undefined;
    utmTerm: string | undefined;
    utmContent: string | undefined;
  };

  // Custom Data
  custom: Record<string, any>;
}

export interface IPInfo {
  ipAddress: string | undefined;
  asn?: string;
  isp?: string;
  source: string;
  confidence: 'high' | 'medium' | 'low';
  isPublic: boolean;
  isTrustedProxy: boolean;
  detectedProxies: string[];
  originalHeaders: Record<string, string>;
}

export interface ExtractionOptions {
  features?: {
    ipDetection?: boolean;
    userAgent?: boolean;
    geolocation?: boolean;
    security?: boolean;
    performance?: boolean;
    fingerprint?: boolean;
    analytics?: boolean;
    headers?: boolean;
  };
  ipDetection?: {
    trustedProxies?: string[];
    headers?: string[];
    skipPrivateIPs?: boolean;
  };
  cache?: {
    enabled?: boolean;
    ttl?: number;
    maxSize?: number;
  };
  geoIP?: {
    enabled?: boolean;
    maxmindLicenseKey?: string;
  };
  logging?: {
    enabled?: boolean;
    level?: 'error' | 'warn' | 'info' | 'debug';
  };
}

export interface RequestWithSocket {
  ip?: string;
  socket?: {
    remoteAddress?: string;
    remotePort?: number;
    encrypted?: boolean;
  };
  connection?: {
    encrypted?: boolean;
    getCipher?: () => { name: string; version: string };
    remoteAddress?: string;
  };
  headers?: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
  hostname?: string;
  protocol?: string;
  cookies?: Record<string, string>;
  body?: any;
}

export interface MiddlewareOptions extends ExtractionOptions {
  attachToRequest?: boolean;
  requestPropertyName?: string;
  skipPaths?: string[];
  skipPatterns?: RegExp[];
}