import { isIP } from 'net';

export interface IPRange {
  start: string;
  end: string;
}

export const PRIVATE_IP_RANGES: IPRange[] = [
  { start: '10.0.0.0', end: '10.255.255.255' },
  { start: '172.16.0.0', end: '172.31.255.255' },
  { start: '192.168.0.0', end: '192.168.255.255' },
  { start: '127.0.0.0', end: '127.255.255.255' },
  { start: '169.254.0.0', end: '169.254.255.255' },
  { start: 'fc00::', end: 'fdff:ffff:ffff:ffff:ffff:ffff:ffff:ffff' },
  { start: 'fe80::', end: 'febf:ffff:ffff:ffff:ffff:ffff:ffff:ffff' },
  { start: '::1', end: '::1' },
];

export function ipToNumber(ip: string): bigint {
  if (ip.includes(':')) {
    // IPv6
    const parts = ip.split(':');
    let fullIp = '';
    
    // Handle compressed IPv6
    const emptyIndex = parts.findIndex(part => part === '');
    if (emptyIndex !== -1) {
      const before = parts.slice(0, emptyIndex).join('');
      const after = parts.slice(emptyIndex + 1).join('');
      const zeroCount = 8 - (parts.length - 1);
      fullIp = before + '0'.repeat(zeroCount * 4) + after;
    } else {
      fullIp = parts.join('');
    }
    
    return BigInt('0x' + fullIp.padEnd(32, '0'));
  }
  
  // IPv4
  const octets = ip.split('.');
  return BigInt(
    octets.reduce((acc, octet, idx) => 
      acc + parseInt(octet) * Math.pow(256, 3 - idx), 0
    )
  );
}

export function ipInRange(ip: string, range: IPRange): boolean {
  try {
    const ipNum = ipToNumber(ip);
    const startNum = ipToNumber(range.start);
    const endNum = ipToNumber(range.end);
    return ipNum >= startNum && ipNum <= endNum;
  } catch {
    return false;
  }
}

export function isPrivateIP(ip: string): boolean {
  if (!ip) return false;
  
  // Quick checks for common cases
  if (ip === '127.0.0.1' || ip === '::1' || ip === 'localhost') return true;
  
  return PRIVATE_IP_RANGES.some(range => ipInRange(ip, range));
}

export function isIPInCIDR(ip: string, cidr: string): boolean {
  try {
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    
    if (ip.includes(':')) {
      // IPv6 CIDR
      const ipNum = ipToNumber(ip);
      const networkNum = ipToNumber(network);
      const mask = (BigInt(1) << BigInt(128 - prefix)) - BigInt(1);
      return (ipNum >> BigInt(128 - prefix)) === (networkNum >> BigInt(128 - prefix));
    } else {
      // IPv4 CIDR
      const ipNum = Number(ipToNumber(ip));
      const networkNum = Number(ipToNumber(network));
      const mask = (-1 << (32 - prefix)) >>> 0;
      return (ipNum & mask) === (networkNum & mask);
    }
  } catch {
    return false;
  }
}

export function cleanIP(ip: string): string {
  if (!ip) return '';
  
  // Remove IPv4-mapped IPv6 prefix
  if (ip.startsWith('::ffff:')) {
    ip = ip.substring(7);
  }
  
  // Remove brackets from IPv6
  ip = ip.replace(/^\[(.*)\]$/, '$1');
  
  // Remove port if present
  const parts = ip.split(':');
  if (parts.length === 2 && !ip.includes('::')) {
    const lastPart = parts[1];
    if (/^\d+$/.test(lastPart) && parseInt(lastPart) <= 65535) {
      ip = parts[0];
    }
  }
  
  return ip.trim();
}

export function isValidIP(ip: string): boolean {
  if (!ip) return false;
  
  // Use Node.js built-in isIP
  return isIP(ip) !== 0;
}

export function getIPVersion(ip: string | undefined): 'IPv4' | 'IPv6' | 'unknown' {
  if (!ip) return 'unknown';
  const version = isIP(ip);
  return version === 4 ? 'IPv4' : version === 6 ? 'IPv6' : 'unknown';
}