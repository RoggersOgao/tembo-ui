import { IPInfo } from '../types';

export function detectProxyType(
  ipInfo: IPInfo,
  headers: Record<string, string>
): 'none' | 'vpn' | 'proxy' | 'tor' | 'hosting' | 'unknown' {
  const via = headers.via;
  const xForwardedFor = headers['x-forwarded-for'];
  const xTor = headers['x-tor'];

  if (xTor || headers['x-tor-node']) return 'tor';
  if (via?.toLowerCase().includes('vpn')) return 'vpn';
  if (via?.toLowerCase().includes('proxy')) return 'proxy';

  // Check for multiple X-Forwarded-For entries
  if (xForwardedFor && xForwardedFor.split(',').length > 2) {
    return 'proxy';
  }

  // Check for known hosting/VPN IP ranges
  if (ipInfo.ipAddress) {
    // Known data center ranges
    const dataCenterRanges = [
      '104.', '108.', '172.64.', '185.', '199.',
      '209.95.', '66.249.', // Google crawlers
    ];
    
    if (dataCenterRanges.some(prefix => ipInfo.ipAddress!.startsWith(prefix))) {
      return 'hosting';
    }

    // Check for common VPN services (simplified)
    const vpnKeywords = ['vpn', 'proxy', 'anonymous'];
    const serverHeader = headers.server || '';
    const viaHeader = headers.via || '';
    
    if (vpnKeywords.some(keyword => 
      serverHeader.toLowerCase().includes(keyword) || 
      viaHeader.toLowerCase().includes(keyword)
    )) {
      return 'vpn';
    }
  }

  // Check for common proxy headers
  const proxyHeaders = [
    'x-proxy-id',
    'x-proxy-user',
    'proxy-authorization',
    'x-proxy-location',
  ];
  
  if (proxyHeaders.some(header => headers[header])) {
    return 'proxy';
  }

  return ipInfo.detectedProxies.length > 0 ? 'proxy' : 'none';
}

export function detectVPN(
  ipInfo: IPInfo,
  headers: Record<string, string>
): { isVpn: boolean; confidence: number; service: string | undefined } {
  const proxyType = detectProxyType(ipInfo, headers);
  const isVpn = proxyType === 'vpn';
  
  let confidence = 0.3;
  let service: string | undefined;

  // Check for VPN-specific headers
  if (headers['x-vpn-service']) {
    service = headers['x-vpn-service'];
    confidence = 0.9;
  } else if (headers['x-proxy-user']?.includes('vpn')) {
    confidence = 0.8;
  } else if (isVpn) {
    confidence = 0.7;
  }

  // Check for known VPN hostnames in headers
  const vpnIndicators = ['vpn', 'expressvpn', 'nordvpn', 'surfshark', 'ipvanish', 'vyprvpn'];
  const hostHeader = headers.host || '';
  
  for (const vpn of vpnIndicators) {
    if (hostHeader.toLowerCase().includes(vpn)) {
      service = vpn.charAt(0).toUpperCase() + vpn.slice(1);
      confidence = Math.max(confidence, 0.85);
      break;
    }
  }

  return {
    isVpn,
    confidence,
    service,
  };
}

export function assessThreatLevel(
  ipInfo: IPInfo,
  headers: Record<string, string>,
  userAgent?: any
): 'low' | 'medium' | 'high' | 'unknown' {
  let score = 0;

  // Bot detection
  if (userAgent?.device?.isBot) score += 30;

  // No user agent
  if (!headers['user-agent']) score += 25;

  // No accept-language
  if (!headers['accept-language']) score += 10;

  // VPN/Proxy detection
  const proxyType = detectProxyType(ipInfo, headers);
  if (proxyType !== 'none' && proxyType !== 'unknown') {
    score += proxyType === 'tor' ? 40 : 20;
  }

  // Suspicious headers
  if (headers['x-attack'] || headers['x-malicious']) score += 50;
  if (headers['x-scanner']) score += 30;

  // Rate limiting triggered
  if (headers['x-rate-limit-remaining'] === '0') score += 15;

  // Unusual request size
  const contentLength = parseInt(headers['content-length'] || '0', 10);
  if (contentLength > 10 * 1024 * 1024) score += 20; // >10MB

  // Multiple forward headers (potential spoofing)
  const xffCount = headers['x-forwarded-for']?.split(',').length || 0;
  if (xffCount > 5) score += 25;

  // Determine threat level
  if (score >= 70) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

export function detectBotFromUserAgent(userAgent: string | undefined): boolean {
  if (!userAgent) return true;

  const ua = userAgent.toLowerCase();
  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'fetcher',
    'curl', 'wget', 'python', 'java', 'php',
    'googlebot', 'bingbot', 'slurp', 'duckduckbot',
    'baiduspider', 'yandexbot', 'facebookexternalhit',
    'twitterbot', 'linkedinbot', 'telegrambot',
    'discordbot', 'whatsapp', 'slackbot', 'headless',
    'phantom', 'selenium', 'puppeteer', 'playwright',
  ];

  return botPatterns.some(pattern => ua.includes(pattern));
}

export function isTouchDevice(userAgent: string | undefined, headers: Record<string, string>): boolean {
  if (!userAgent) return false;
  
  const ua = userAgent.toLowerCase();
  const touchIndicators = [
    'mobile', 'android', 'iphone', 'ipad', 'tablet',
    'touch', 'webos', 'blackberry', 'windows phone',
  ];

  // Check user agent
  if (touchIndicators.some(indicator => ua.includes(indicator))) {
    return true;
  }

  // Check headers
  if (headers['sec-ch-ua-mobile'] === '?1') return true;
  if (headers['x-mobile'] === 'true') return true;
  
  return false;
}

export function isDaylightSavingsTime(): boolean {
  const today = new Date();
  const jan = new Date(today.getFullYear(), 0, 1);
  const jul = new Date(today.getFullYear(), 6, 1);
  const stdTimezoneOffset = Math.max(jan.getTimezoneOffset(), jul.getTimezoneOffset());
  return today.getTimezoneOffset() < stdTimezoneOffset;
}