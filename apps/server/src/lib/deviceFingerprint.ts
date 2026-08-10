import crypto from 'crypto';



export interface DeviceFingerprintData {
  userAgent: string;
  browser: string;
  os: string;
  device: string;
  screen?: string;
  timezone: string;
  language: string;
  country?: string;
  city?: string;
  ipVersion?: string;
  connectionType?: string;
}

/**
 * Standardized device fingerprint generation used by BOTH frontend and backend
 */
export function generateDeviceIdFromMetadata(deviceMetadata: any): string {
  const components = [
    deviceMetadata.browser,
    deviceMetadata.browserVersion,
    deviceMetadata.os,
    deviceMetadata.osVersion,
    deviceMetadata.timezone,
    deviceMetadata.language,
    deviceMetadata.screenResolution,
  ].filter(Boolean).join('|');

  const hash = crypto.createHash('sha256').update(components).digest('hex');
  return hash.substring(0, 32);
}

export function extractDeviceFingerprint(
  deviceMetadata: any,
  networkMetadata: any,
  userAgentMetadata: any
) {
  return {
    browser: {
      name: deviceMetadata?.browser || userAgentMetadata?.browser?.name,
      version: deviceMetadata?.browserVersion || userAgentMetadata?.browser?.version,
    },
    os: {
      name: deviceMetadata?.os || userAgentMetadata?.os?.name,
      version: deviceMetadata?.osVersion || userAgentMetadata?.os?.version,
    },
    deviceType: deviceMetadata?.deviceType || userAgentMetadata?.device?.type || 'unknown',
    isBot: userAgentMetadata?.device?.isBot || false,
    screenResolution: deviceMetadata?.screenResolution,
    timezone: deviceMetadata?.timezone,
    language: deviceMetadata?.language,
    userAgent: userAgentMetadata?.raw,
    networkFingerprint: {
      ipVersion: networkMetadata?.ipVersion,
      proxyType: networkMetadata?.proxyType,
    },
    fingerprintHash: deviceMetadata?.fingerprintHash,
  };
}

