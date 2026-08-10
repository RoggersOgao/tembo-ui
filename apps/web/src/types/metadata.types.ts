// types/request-metadata.ts

export interface RequestMetadata {
  // Top-level location fields (from your API response)
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
  timezone?: string;
  isp?: string;
  proxy?: boolean;
  vpn?: boolean;
  tor?: boolean;
  ipAddress?: string;

  // Network & IP Information (nested in metadata)
  network?: {
    ipAddress?: string;
    ipVersion?: 'IPv4' | 'IPv6' | 'unknown';
    isp?: string;
    asn?: string;
    country?: string;
    city?: string;
    latitude?: number;
    longitude?: number;
    timezone?: string;
    proxyType?: 'none' | 'vpn' | 'proxy' | 'tor' | 'hosting' | 'unknown';
    vpnDetection?: {
      isVpn?: boolean;
      confidence?: number;
      service?: string;
    };
    threatLevel?: 'low' | 'medium' | 'high' | 'unknown';
  };

  // User Agent Details
  userAgent?: {
    raw?: string;
    browser?: {
      name?: string;
      version?: string;
      engine?: string;
    };
    os?: {
      name?: string;
      version?: string;
      platform?: string;
    };
    device?: {
      type?: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'smart-tv' | 'unknown';
      vendor?: string;
      model?: string;
      isTouch?: boolean;
      isBot?: boolean;
      botName?: string;
    };
    capabilities?: {
      supportsWebGL?: boolean;
      supportsWebRTC?: boolean;
      supportsWebAssembly?: boolean;
      screenResolution?: { width: number; height: number };
      colorDepth?: number;
      pixelRatio?: number;
    };
  };

  // Network Performance
  performance?: {
    connectionType?: 'slow-2g' | '2g' | '3g' | '4g' | 'wifi' | 'ethernet' | 'unknown';
    effectiveType?: 'slow-2g' | '2g' | '3g' | '4g';
    downlink?: number;
    rtt?: number;
    saveData?: boolean;
  };

  // Security Headers
  security?: {
    tlsVersion?: string;
    cipherSuite?: string;
    hsts?: boolean;
    contentTypeOptions?: boolean;
    xssProtection?: boolean;
    frameOptions?: boolean;
    referrerPolicy?: string;
    permissionsPolicy?: Record<string, string[]>;
  };

  // Geolocation (if available)
  geolocation?: {
    latitude?: number;
    longitude?: number;
    accuracy?: number;
    altitude?: number;
    heading?: number;
    speed?: number;
    timestamp?: number;
  };

  // Time & Date
  timing?: {
    requestTime?: number;
    timezone?: string;
    localTime?: string;
    utcOffset?: number;
    daylightSavings?: boolean;
  };

  // Fingerprinting
  fingerprint?: {
    canvasHash?: string;
    webglHash?: string;
    fontsHash?: string;
    audioHash?: string;
    screenHash?: string;
    pluginsHash?: string;
  };

  // Headers Analysis
  headers?: {
    accept?: string;
    acceptEncoding?: string;
    acceptLanguage?: string;
    cacheControl?: string;
    connection?: string;
    contentType?: string;
    dnt?: boolean;
    encoding?: string;
    host?: string;
    origin?: string;
    pragma?: string;
    referer?: string;
    upgradeInsecureRequests?: boolean;
    via?: string;
    xForwardedFor?: string[];
    xRealIp?: string;
    cfConnectingIp?: string;
    cfIpCountry?: string;
    cfRay?: string;
    secChUa?: string;
    secChUaMobile?: string;
    secChUaPlatform?: string;
    secChUaPlatformVersion?: string;
    secChUaModel?: string;
    secFetchDest?: string;
    secFetchMode?: string;
    secFetchSite?: string;
    secFetchUser?: string;
  };

  // Request Context
  request?: {
    method?: string;
    url?: string;
    protocol?: string;
    hostname?: string;
    path?: string;
    query?: Record<string, string>;
    cookies?: Record<string, string>;
    bodySize?: number;
    headersSize?: number;
    isAjax?: boolean;
    isWebSocket?: boolean;
    isSecure?: boolean;
  };

  // Device & Browser Features
  features?: {
    webRTC?: boolean;
    webGL?: boolean;
    webAssembly?: boolean;
    serviceWorker?: boolean;
    pushNotifications?: boolean;
    geolocation?: boolean;
    notifications?: boolean;
    camera?: boolean;
    microphone?: boolean;
    bluetooth?: boolean;
    usb?: boolean;
    nfc?: boolean;
  };

  // Analytics
  analytics?: {
    sessionId?: string;
    pageViewId?: string;
    userId?: string;
    referralSource?: string;
    campaign?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmTerm?: string;
    utmContent?: string;
  };

  // Additional fields from your API response
  threatLevel?: 'low' | 'medium' | 'high' | 'unknown';
  confidence?: number;
  
  // Nested metadata object (if your API returns this structure)
  metadata?: {
    network?: RequestMetadata['network'];
    userAgent?: RequestMetadata['userAgent'];
    threatLevel?: 'low' | 'medium' | 'high' | 'unknown';
    confidence?: number;
    [key: string]: any;
  };

  // Custom Data
  custom?: Record<string, any>;
}

// Export helper types for common use cases
export type NetworkInfo = RequestMetadata['network'];
export type UserAgentInfo = RequestMetadata['userAgent'];
export type SecurityInfo = RequestMetadata['security'];
export type PerformanceInfo = RequestMetadata['performance'];
export type GeolocationInfo = RequestMetadata['geolocation'];
export type FingerprintInfo = RequestMetadata['fingerprint'];
export type HeadersInfo = RequestMetadata['headers'];
export type RequestInfo = RequestMetadata['request'];
export type FeaturesInfo = RequestMetadata['features'];
export type AnalyticsInfo = RequestMetadata['analytics'];

// Partial metadata for lightweight responses
export type LightweightMetadata = Pick<RequestMetadata, 'network' | 'userAgent' | 'country' | 'city' | 'ipAddress'>;

// Metadata for security analysis
export type SecurityMetadata = Pick<RequestMetadata, 'network' | 'security' | 'fingerprint' | 'headers' | 'threatLevel' | 'vpn' | 'proxy' | 'tor'>;

// Metadata for analytics
export type AnalyticsMetadata = Pick<RequestMetadata, 'network' | 'userAgent' | 'analytics' | 'request' | 'country' | 'city'>;