import { RequestWithSocket } from '../types';
import { createHash } from 'crypto';

export async function extractFingerprintData(
  req: RequestWithSocket,
  headers: Record<string, string>
) {
  // Create a fingerprint from available headers
  const fingerprintComponents = [
    headers['user-agent'],
    headers['accept-language'],
    headers['accept-encoding'],
    headers['sec-ch-ua'],
    headers['sec-ch-ua-mobile'],
    headers['sec-ch-ua-platform'],
    headers['sec-ch-ua-platform-version'],
    headers['sec-ch-ua-model'],
    headers['viewport-width'],
    headers['viewport-height'],
    headers['dpr'],
    headers['device-memory'],
    headers['rtt'],
    headers['downlink'],
    headers['ect'],
  ].filter(Boolean).join('|');

  const hash = createHash('sha256').update(fingerprintComponents).digest('hex');

  // Generate different hash variations for different fingerprint components
  const screenHash = createHash('md5')
    .update([
      headers['viewport-width'] || 'unknown',
      headers['viewport-height'] || 'unknown',
      headers['dpr'] || '1',
    ].join(':'))
    .digest('hex');

  return {
    canvasHash: undefined, // Would require client-side JS
    webglHash: undefined, // Would require client-side JS
    fontsHash: undefined, // Would require client-side JS
    audioHash: undefined, // Would require client-side JS
    screenHash: screenHash.slice(0, 16),
    pluginsHash: hash.slice(0, 16),
  };
}

export function createBrowserFingerprint(headers: Record<string, string>): {
  fingerprint: string;
  components: Record<string, string>;
} {
  const components: Record<string, string> = {
    userAgent: headers['user-agent'] || 'unknown',
    language: headers['accept-language'] || 'unknown',
    encoding: headers['accept-encoding'] || 'unknown',
    platform: headers['sec-ch-ua-platform'] || 'unknown',
    mobile: headers['sec-ch-ua-mobile'] || 'unknown',
    viewport: `${headers['viewport-width'] || 'unknown'}x${headers['viewport-height'] || 'unknown'}`,
    dpr: headers['dpr'] || '1',
  };

  // Create deterministic fingerprint
  const fingerprintString = Object.values(components).join('|');
  const fingerprint = createHash('sha256').update(fingerprintString).digest('hex');

  return {
    fingerprint,
    components,
  };
}

export function estimateDeviceClass(headers: Record<string, string>): {
  class: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'bot' | 'unknown';
  confidence: number;
} {
  const ua = (headers['user-agent'] || '').toLowerCase();
  const secChUaMobile = headers['sec-ch-ua-mobile'];
  
  let deviceClass: 'desktop' | 'mobile' | 'tablet' | 'tv' | 'bot' | 'unknown' = 'unknown';
  let confidence = 0.5;

  // Check for mobile indicator
  if (secChUaMobile === '?1') {
    deviceClass = 'mobile';
    confidence = 0.9;
  }

  // Check user agent patterns
  if (ua.includes('mobile')) {
    deviceClass = 'mobile';
    confidence = Math.max(confidence, 0.8);
  }
  
  if (ua.includes('tablet') || ua.includes('ipad')) {
    deviceClass = 'tablet';
    confidence = Math.max(confidence, 0.85);
  }
  
  if (ua.includes('tv') || ua.includes('smart-tv')) {
    deviceClass = 'tv';
    confidence = Math.max(confidence, 0.9);
  }
  
  if (ua.includes('bot') || ua.includes('crawler')) {
    deviceClass = 'bot';
    confidence = Math.max(confidence, 0.95);
  }
  
  if (ua.includes('windows nt') || ua.includes('mac os') || ua.includes('linux')) {
    if (deviceClass === 'unknown') {
      deviceClass = 'desktop';
      confidence = 0.7;
    }
  }

  return { class: deviceClass, confidence };
}