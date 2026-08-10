import { RequestMetadata } from '../types';

export function extractHeadersInfo(
  headers: Record<string, string>
): RequestMetadata['headers'] {
  return {
    accept: headers.accept,
    acceptEncoding: headers['accept-encoding'],
    acceptLanguage: headers['accept-language'],
    cacheControl: headers['cache-control'],
    connection: headers.connection,
    contentType: headers['content-type'],
    dnt: headers.dnt === '1',
    encoding: headers['accept-encoding'],
    host: headers.host,
    origin: headers.origin,
    pragma: headers.pragma,
    referer: headers.referer,
    upgradeInsecureRequests: headers['upgrade-insecure-requests'] === '1',
    via: headers.via,
    xForwardedFor: headers['x-forwarded-for']?.split(',').map(ip => ip.trim()),
    xRealIp: headers['x-real-ip'],
    cfConnectingIp: headers['cf-connecting-ip'],
    cfIpCountry: headers['cf-ipcountry'],
    cfRay: headers['cf-ray'],
    secChUa: headers['sec-ch-ua'],
    secChUaMobile: headers['sec-ch-ua-mobile'],
    secChUaPlatform: headers['sec-ch-ua-platform'],
    secChUaPlatformVersion: headers['sec-ch-ua-platform-version'],
    secChUaModel: headers['sec-ch-ua-model'],
    secFetchDest: headers['sec-fetch-dest'],
    secFetchMode: headers['sec-fetch-mode'],
    secFetchSite: headers['sec-fetch-site'],
    secFetchUser: headers['sec-fetch-user'],
  };
}

export function analyzeHeaders(headers: Record<string, string>): {
  hasModernHeaders: boolean;
  hasPrivacyHeaders: boolean;
  hasSecurityHeaders: boolean;
  headerCount: number;
} {
  const modernHeaders = [
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
    'sec-fetch-dest',
    'sec-fetch-mode',
    'sec-fetch-site',
    'sec-fetch-user',
  ];

  const privacyHeaders = [
    'dnt',
    'sec-gpc',
    'x-do-not-track',
  ];

  const securityHeaders = [
    'x-frame-options',
    'x-content-type-options',
    'x-xss-protection',
    'strict-transport-security',
    'content-security-policy',
    'permissions-policy',
    'referrer-policy',
  ];

  return {
    hasModernHeaders: modernHeaders.some(h => headers[h]),
    hasPrivacyHeaders: privacyHeaders.some(h => headers[h]),
    hasSecurityHeaders: securityHeaders.some(h => headers[h]),
    headerCount: Object.keys(headers).length,
  };
}

export function getHeaderCategories(headers: Record<string, string>): Record<string, string[]> {
  const categories: Record<string, string[]> = {
    accept: [],
    caching: [],
    connection: [],
    content: [],
    security: [],
    clientHints: [],
    custom: [],
  };

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    if (lowerKey.startsWith('accept')) {
      categories.accept.push(`${key}: ${value}`);
    } else if (lowerKey.includes('cache') || lowerKey.includes('expires')) {
      categories.caching.push(`${key}: ${value}`);
    } else if (lowerKey.includes('connection') || lowerKey.includes('keep-alive') || lowerKey === 'via') {
      categories.connection.push(`${key}: ${value}`);
    } else if (lowerKey.includes('content') || lowerKey.includes('length') || lowerKey.includes('type')) {
      categories.content.push(`${key}: ${value}`);
    } else if (lowerKey.includes('sec-') || lowerKey.includes('x-frame') || lowerKey.includes('x-content')) {
      categories.security.push(`${key}: ${value}`);
    } else if (lowerKey.startsWith('sec-ch-') || lowerKey.includes('viewport') || lowerKey.includes('dpr')) {
      categories.clientHints.push(`${key}: ${value}`);
    } else {
      categories.custom.push(`${key}: ${value}`);
    }
  }

  return categories;
}