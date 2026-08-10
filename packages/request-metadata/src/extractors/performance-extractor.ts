import { RequestMetadata } from '../types';

export function extractPerformanceInfo(
  headers: Record<string, string>
): RequestMetadata['performance'] {
  const saveData = headers['save-data'] === 'on';
  const deviceMemory = headers['device-memory'];
  const downlink = headers['downlink'];
  const rtt = headers['rtt'];
  const ect = headers['ect'];

  // Determine connection type from ECT header
  let connectionType: RequestMetadata['performance']['connectionType'] = 'unknown';
  if (ect) {
    switch (ect) {
      case 'slow-2g':
        connectionType = 'slow-2g';
        break;
      case '2g':
        connectionType = '2g';
        break;
      case '3g':
        connectionType = '3g';
        break;
      case '4g':
        connectionType = '4g';
        break;
    }
  } else {
    // Fallback detection based on other headers
    if (headers['sec-ch-ua-mobile'] === '?1') {
      connectionType = '4g'; // Default for mobile
    } else if (headers['via']?.includes('wifi')) {
      connectionType = 'wifi';
    } else if (headers['x-network-type'] === 'ethernet') {
      connectionType = 'ethernet';
    }
  }

  return {
    connectionType,
    effectiveType: ect as RequestMetadata['performance']['effectiveType'],
    downlink: downlink ? parseFloat(downlink) : undefined,
    rtt: rtt ? parseInt(rtt, 10) : undefined,
    saveData,
  };
}

export function estimateConnectionSpeed(headers: Record<string, string>): {
  speed: 'slow' | 'medium' | 'fast' | 'unknown';
  estimatedMbps: number;
} {
  const ect = headers['ect'];
  const downlink = headers['downlink'];
  
  if (downlink) {
    const mbps = parseFloat(downlink);
    let speed: 'slow' | 'medium' | 'fast' = 'medium';
    
    if (mbps < 1) speed = 'slow';
    else if (mbps > 10) speed = 'fast';
    
    return { speed, estimatedMbps: mbps };
  }
  
  // Estimate based on ECT
  if (ect) {
    switch (ect) {
      case 'slow-2g':
        return { speed: 'slow', estimatedMbps: 0.05 };
      case '2g':
        return { speed: 'slow', estimatedMbps: 0.3 };
      case '3g':
        return { speed: 'medium', estimatedMbps: 1.5 };
      case '4g':
        return { speed: 'fast', estimatedMbps: 10 };
    }
  }
  
  return { speed: 'unknown', estimatedMbps: 0 };
}