// lib/device-service.ts
import { DEVICE } from '@/lib/constants';
import { DeviceMetadata } from '@/lib/schemas';

interface StoredDeviceToken {
  deviceId: string;
  challengeId: string;
  method: string;
  expiresAt: string | Date;
}

export class DeviceService {
  private static readonly STORAGE_KEY = 'trusted_device_token';
  private static readonly FINGERPRINT_KEY = 'device_fingerprint';
  private static readonly LAST_DEVICE_CHECK = 'last_device_check';

  /**
   * Get stored device token as JSON string for server
   */
  static getStoredDeviceToken(): string | null {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return null;

      const parsed: StoredDeviceToken = JSON.parse(stored);

      // Check if expired
      if (new Date(parsed.expiresAt) < new Date()) {
        this.clearDeviceToken();
        return null;
      }

      // Return as JSON string
      return JSON.stringify(parsed);
    } catch (e) {
      this.clearDeviceToken();
      return null;
    }
  }

  /**
   * Store device token after successful verification
   */
  static storeDeviceToken(
    deviceId: string,
    challengeId?: string,
    method?: string,
    expiresAt?: string | Date
  ): void {
    if (!challengeId || !method || !expiresAt) {
      console.error('Missing required device token data');
      return;
    }

    // Convert Date to string if needed
    const expiresAtString = typeof expiresAt === 'string'
      ? expiresAt
      : expiresAt.toISOString();

    const data: StoredDeviceToken = {
      deviceId,
      challengeId,
      method,
      expiresAt: expiresAtString,
    };

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
      console.log(' Device token stored:', { deviceId, expiresAt: expiresAtString });
    } catch (e) {
      console.error('Failed to store device token:', e);
    }
  }

  /**
   * Clear device token from storage
   */
  static clearDeviceToken(): void {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem(this.FINGERPRINT_KEY);
      console.log('🧹 Device token cleared');
    } catch (e) {
      // Silent fail
    }
  }

  /**
   * Check if device has a valid token
   */
  static hasValidDeviceToken(): boolean {
    return this.getStoredDeviceToken() !== null;
  }

  /**
   * Collect comprehensive device metadata
   */
  static async collectDeviceMetadata(): Promise<DeviceMetadata> {
    const fingerprint = await this.getDeviceFingerprint();

    return {
      deviceName: fingerprint.deviceName,
      browser: fingerprint.browser.name,
      browserVersion: fingerprint.browser.version,
      os: fingerprint.os.name,
      osVersion: fingerprint.os.version,
      deviceType: fingerprint.deviceType,
      screenResolution: fingerprint.screenResolution,
      timezone: fingerprint.timezone,
      language: fingerprint.language,
      fingerprintHash: fingerprint.hash,
    };
  }

  /**
   * Get or generate device fingerprint
   */
  private static async getDeviceFingerprint(): Promise<{
    deviceName: string;
    browser: { name: string; version?: string };
    os: { name: string; version?: string };
    deviceType: string;
    screenResolution: string;
    timezone: string;
    language: string;
    hash: string;
  }> {
    // Try to get cached fingerprint
    const cached = localStorage.getItem(this.FINGERPRINT_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        const lastCheck = localStorage.getItem(this.LAST_DEVICE_CHECK);

        // Refresh fingerprint every 7 days
        if (lastCheck && (Date.now() - parseInt(lastCheck)) < 7 * 24 * 60 * 60 * 1000) {
          return parsed;
        }
      } catch (e) {
        // Invalid cache, regenerate
      }
    }

    // Generate new fingerprint
    const ua = navigator.userAgent;
    const browser = this.getBrowserInfo(ua);
    const os = this.getOSInfo(ua);
    const deviceType = this.getDeviceType(ua);

    const hash = await this.generateFingerprintHash();

    const fingerprint = {
      deviceName: `${browser.name} on ${os.name}`,
      browser,
      os,
      deviceType,
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      hash,
    };

    // Cache fingerprint
    localStorage.setItem(this.FINGERPRINT_KEY, JSON.stringify(fingerprint));
    localStorage.setItem(this.LAST_DEVICE_CHECK, Date.now().toString());

    return fingerprint;
  }

  private static getBrowserInfo(ua: string): { name: string; version?: string } {
    const browsers = [
      { pattern: /Edg\/(\d+)/, name: 'Edge' },
      { pattern: /Chrome\/(\d+)/, name: 'Chrome' },
      { pattern: /Firefox\/(\d+)/, name: 'Firefox' },
      { pattern: /Safari\/(\d+)/, name: 'Safari' },
      { pattern: /OPR\/(\d+)/, name: 'Opera' },
      { pattern: /Version\/(\d+).*Safari/, name: 'Safari' },
    ];

    for (const browser of browsers) {
      const match = ua.match(browser.pattern);
      if (match) {
        return { name: browser.name, version: match[1] };
      }
    }

    return { name: 'Unknown Browser' };
  }

  private static getOSInfo(ua: string): { name: string; version?: string } {
    const uaLower = ua.toLowerCase();

    // Windows detection
    if (/windows/.test(uaLower)) {
      const winMatch = ua.match(/Windows (?:NT|Phone|Mobile)?[ /]?(\d+\.?\d*)/i);
      return {
        name: winMatch && winMatch[1] ? 'Windows' : 'Windows',
        version: winMatch?.[1]
      };
    }

    // macOS detection
    if (/mac|os x|macintosh/.test(uaLower)) {
      const macMatch = ua.match(/Mac OS X?[ _]?(\d+[._]\d+)/i);
      return {
        name: 'macOS',
        version: macMatch?.[1]?.replace(/_/g, '.')
      };
    }

    // Linux detection
    if (/linux|x11|ubuntu|debian|fedora/.test(uaLower)) {
      return { name: 'Linux' };
    }

    // Android detection
    if (/android/.test(uaLower)) {
      const androidMatch = ua.match(/Android[ /-]?(\d+\.?\d*)/i);
      return { name: 'Android', version: androidMatch?.[1] };
    }

    // iOS detection
    if (/iphone|ipad|ipod/.test(uaLower)) {
      const iosMatch = ua.match(/CPU (?:iPhone )?OS[ _]?(\d+[._]\d+)/i);
      return {
        name: uaLower.includes('ipad') ? 'iPadOS' : 'iOS',
        version: iosMatch?.[1]?.replace(/_/g, '.')
      };
    }

    // Chrome OS detection
    if (/cros|chromeos/.test(uaLower)) {
      return { name: 'Chrome OS' };
    }

    // Default categorizations based on content
    if (/bot|crawler|spider/.test(uaLower)) {
      return { name: 'Bot Platform' };
    }

    if (/curl|wget|python|java|perl/.test(uaLower)) {
      return { name: 'Script/HTTP Client' };
    }

    if (/mozilla|chrome|safari|firefox/.test(uaLower)) {
      return { name: 'Browser Platform' };
    }

    if (/mobile|tablet/.test(uaLower)) {
      return { name: 'Mobile Platform' };
    }

    // Final fallback - analyze string structure
    if (ua.length === 0) return { name: 'Empty' };
    if (ua.length < 10) return { name: 'Minimal Client' };
    if (ua.includes('/')) return { name: 'Software Client' };

    // Absolute last resort
    return { name: 'Client' };
  }
  private static getDeviceType(ua: string): string {
    if (/Mobile|Android|iPhone|iPad|iPod/i.test(ua)) {
      return 'mobile';
    }
    if (/Tablet|iPad/i.test(ua)) {
      return 'tablet';
    }
    return 'desktop';
  }

  private static async generateFingerprintHash(): Promise<string> {
    const components = [
      navigator.userAgent,
      navigator.platform,
      `${window.screen.width}x${window.screen.height}x${window.screen.colorDepth}`,
      navigator.hardwareConcurrency?.toString() || 'unknown',
      (navigator as any).deviceMemory?.toString() || 'unknown',
      Intl.DateTimeFormat().resolvedOptions().timeZone,
      navigator.language,
      (navigator as any).languages?.join(',') || '',
      window.localStorage.length.toString(),
    ];

    const fingerprintString = components.join('|');
    const encoder = new TextEncoder();
    const data = encoder.encode(fingerprintString);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Get device info for logging
   */
  static getDeviceInfo() {
    return {
      userAgent: navigator.userAgent,
      platform: navigator.platform,
      screen: {
        width: window.screen.width,
        height: window.screen.height,
        colorDepth: window.screen.colorDepth,
      },
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      language: navigator.language,
      languages: (navigator as any).languages,
      hardwareConcurrency: navigator.hardwareConcurrency,
      deviceMemory: (navigator as any).deviceMemory,
    };
  }
}

// Convenience exports
export const getDeviceToken = () => DeviceService.getStoredDeviceToken();
export const storeDeviceToken = (
  deviceId: string,
  challengeId?: string,
  method?: string,
  expiresAt?: string | Date
) => {
  const expiresAtString = expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt;
  return DeviceService.storeDeviceToken(deviceId, challengeId, method, expiresAtString);
};
export const clearDeviceToken = () => DeviceService.clearDeviceToken();
export const collectDeviceMetadata = () => DeviceService.collectDeviceMetadata();
export const hasValidDeviceToken = () => DeviceService.hasValidDeviceToken();
export const getDeviceInfo = () => DeviceService.getDeviceInfo();