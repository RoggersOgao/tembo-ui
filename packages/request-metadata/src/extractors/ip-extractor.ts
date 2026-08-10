import { RequestWithSocket, IPInfo } from '../types';
import { 
  cleanIP, 
  isValidIP, 
  isPrivateIP, 
  isIPInCIDR,
  ipInRange,
  PRIVATE_IP_RANGES 
} from '../utils/ip-utils';

export function extractIPInfo(
  req: RequestWithSocket,
  headers: Record<string, string>,
  trustedProxies: string[] = []
): IPInfo {
  const ipInfo: IPInfo = {
    ipAddress: undefined,
    source: 'unknown',
    confidence: 'low',
    isPublic: false,
    isTrustedProxy: false,
    detectedProxies: [],
    originalHeaders: headers
  };

  // Helper to check if IP is trusted proxy
  const isTrustedProxy = (ip: string): boolean => {
    if (!ip) return false;
    
    // Exact match check
    if (trustedProxies.some(proxy => ip === proxy)) return true;
    
    // CIDR notation check
    return trustedProxies.some(cidr => {
      if (cidr?.includes('/')) {
        return isIPInCIDR(ip, cidr);
      }
      return false;
    });
  };

  // Extract IP from header with validation
  const extractFromHeader = (headerValue: string, source: string): string | null => {
    if (!headerValue) return null;
    
    // Handle comma-separated lists (most recent proxy first)
    const ips = headerValue.split(',').map(ip => cleanIP(ip.trim()));
    
    // Find first non-trusted, non-private, valid IP
    for (const ip of ips) {
      if (isValidIP(ip) && !isPrivateIP(ip) && !isTrustedProxy(ip)) {
        ipInfo.source = source;
        ipInfo.confidence = 'high';
        return ip;
      }
    }
    
    // If all are trusted/private, return the last one (closest to client)
    const lastIP = ips[ips.length - 1];
    if (lastIP && isValidIP(lastIP)) {
      ipInfo.source = `${source} (trusted proxy chain)`;
      ipInfo.confidence = isTrustedProxy(lastIP) ? 'medium' : 'low';
      ipInfo.isTrustedProxy = isTrustedProxy(lastIP);
      return lastIP;
    }
    
    return null;
  };

  // Collect all possible IPs from different sources
  const candidateIPs: Array<{ip: string, source: string, priority: number}> = [];

  // Define header checking order (customizable via options)
  const headerChecks = [
    { header: 'cf-connecting-ip', source: 'Cloudflare', priority: 1 },
    { header: 'true-client-ip', source: 'Akamai', priority: 2 },
    { header: 'x-client-ip', source: 'X-Client-IP', priority: 3 },
    { header: 'x-cluster-client-ip', source: 'X-Cluster-Client-IP', priority: 4 },
    { header: 'x-real-ip', source: 'X-Real-IP', priority: 5 },
    { header: 'forwarded', source: 'Forwarded', priority: 6 },
    { header: 'x-forwarded-for', source: 'X-Forwarded-For', priority: 7 },
  ];

  // Process standard headers
  for (const { header, source, priority } of headerChecks) {
    const headerValue = headers[header];
    if (headerValue) {
      const ip = extractFromHeader(headerValue, source);
      if (ip) {
        candidateIPs.push({ ip, source, priority });
        ipInfo.detectedProxies.push(`${source}: ${headerValue}`);
      }
    }
  }

  // Process Forwarded header (RFC 7239)
  if (headers['forwarded']) {
    try {
      const forwarded = headers['forwarded'];
      const params = forwarded.split(';').map(p => p.trim());
      
      for (const param of params) {
        if (param.toLowerCase().startsWith('for=')) {
          const forValue = param.substring(4).trim();
          const ip = extractFromHeader(forValue, 'Forwarded');
          if (ip) {
            candidateIPs.push({ ip, source: 'Forwarded', priority: 2 });
          }
        }
      }
    } catch (error) {
      // Silently continue if Forwarded header parsing fails
    }
  }

  // Check direct connection
  if (req.ip) {
    const ip = cleanIP(req.ip);
    if (isValidIP(ip)) {
      const priority = isPrivateIP(ip) ? 20 : 10;
      candidateIPs.push({ 
        ip, 
        source: 'req.ip', 
        priority 
      });
    }
  }

  if (req.socket?.remoteAddress) {
    const ip = cleanIP(req.socket.remoteAddress);
    if (isValidIP(ip)) {
      const priority = isPrivateIP(ip) ? 25 : 15;
      candidateIPs.push({ 
        ip, 
        source: 'socket.remoteAddress', 
        priority 
      });
    }
  }

  // Sort by priority (lower is better) and pick the best candidate
  candidateIPs.sort((a, b) => a.priority - b.priority);
  
  // Filter out invalid, private, or loopback IPs from high priority candidates
  for (const candidate of candidateIPs) {
    if (isValidIP(candidate.ip) && !isPrivateIP(candidate.ip)) {
      ipInfo.ipAddress = candidate.ip;
      ipInfo.source = candidate.source;
      ipInfo.confidence = 'high';
      ipInfo.isPublic = true;
      break;
    }
  }

  // If no public IP found, use the best available (even if private)
  if (!ipInfo.ipAddress && candidateIPs.length > 0) {
    const bestCandidate = candidateIPs[0];
    ipInfo.ipAddress = bestCandidate.ip;
    ipInfo.source = bestCandidate.source;
    ipInfo.confidence = isPrivateIP(bestCandidate.ip) ? 'low' : 'medium';
    ipInfo.isPublic = !isPrivateIP(bestCandidate.ip);
    ipInfo.isTrustedProxy = isTrustedProxy(bestCandidate.ip);
  }

  // Additional info extraction
  if (headers['cf-ray']) {
    ipInfo.asn = headers['cf-ray'].split('-')[1];
  } else if (headers['x-vercel-id']) {
    ipInfo.asn = headers['x-vercel-id'].split('::')[1];
  }

  // Detect ISP from headers
  ipInfo.isp = detectISP(ipInfo.ipAddress, headers);

  return ipInfo;
}

function detectISP(ipAddress: string | undefined, headers: Record<string, string>): string | undefined {
  if (!ipAddress) return undefined;
  
  // Check CDN headers first
  if (headers['server']?.includes('cloudflare')) return 'Cloudflare';
  if (headers['server']?.includes('cloudfront')) return 'Amazon CloudFront';
  if (headers['server']?.includes('akamai')) return 'Akamai';
  if (headers['server']?.includes('fastly')) return 'Fastly';
  
  // Check other headers
  if (headers['via']) {
    if (headers['via'].includes('cloudflare')) return 'Cloudflare';
    if (headers['via'].includes('akamai')) return 'Akamai';
  }
  
  if (headers['x-served-by']) {
    return headers['x-served-by'];
  }
  
  if (headers['x-cache']) {
    const cache = headers['x-cache'];
    if (cache.includes('cloudfront')) return 'Amazon CloudFront';
    if (cache.includes('cloudflare')) return 'Cloudflare';
  }
  
  // For private IPs, return internal network indicator
  if (ipAddress.startsWith('10.') || 
      ipAddress.startsWith('192.168.') || 
      ipAddress.startsWith('172.')) {
    return 'Internal Network';
  }
  
  return undefined;
}