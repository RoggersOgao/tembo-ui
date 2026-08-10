// Signup source enum remains the same
export const SignupSourceEnum = {
  WEB: "WEB",
  MOBILE: "MOBILE",
  REFERRAL: "REFERRAL",
  SOCIAL: "SOCIAL"
} as const;

export type SignupSourceType = typeof SignupSourceEnum[keyof typeof SignupSourceEnum];

// Type guard to check if code is running in browser
function isBrowser(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

/**
 * Detects the signup source based on navigator and URL parameters
 * Returns null if not in browser environment
 * @returns {SignupSourceType | null} One of SignupSourceEnum values or null
 */
export function detectSignupSource(): SignupSourceType | null {
  // Check if we're in a browser environment
  if (!isBrowser()) {
    return null;
  }
  
  try {
    // 1. Check URL parameters for referral or social sources
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check for referral parameters
    const referralParams = ['ref', 'referral', 'referrer', 'utm_source'];
    const hasReferral = referralParams.some(param => urlParams.has(param));
    
    if (hasReferral) {
      // Check if it's a social media referral
      const source = urlParams.get('utm_source') || urlParams.get('ref') || '';
      const socialPlatforms = ['facebook', 'twitter', 'instagram', 'linkedin', 
                              'tiktok', 'youtube', 'pinterest', 'snapchat'];
      
      if (socialPlatforms.some(platform => source.toLowerCase().includes(platform))) {
        return SignupSourceEnum.SOCIAL;
      }
      
      return SignupSourceEnum.REFERRAL;
    }
    
    // 2. Check referrer header for social media
    if (document.referrer) {
      const referrer = document.referrer.toLowerCase();
      const socialDomains = [
        'facebook.com', 'fb.com', 'twitter.com', 't.co', 'instagram.com',
        'linkedin.com', 'tiktok.com', 'youtube.com', 'pinterest.com',
        'snapchat.com', 'reddit.com', 'whatsapp.com', 'telegram.org'
      ];
      
      if (socialDomains.some(domain => referrer.includes(domain))) {
        return SignupSourceEnum.SOCIAL;
      }
    }
    
    // 3. Detect mobile vs web based on device characteristics
    const isMobile = detectMobileDevice();
    
    if (isMobile) {
      return SignupSourceEnum.MOBILE;
    }
    
    return SignupSourceEnum.WEB;
  } catch (error) {
    console.error('Error detecting signup source:', error);
    return SignupSourceEnum.WEB; // Default fallback
  }
}

/**
 * Detects if the user is on a mobile device
 * Returns false if not in browser environment
 * @returns {boolean}
 */
export function detectMobileDevice(): boolean {
  // Check if we're in a browser environment
  if (!isBrowser()) {
    return false;
  }
  
  try {
    // Method 1: Check user agent
    const userAgent = navigator.userAgent.toLowerCase();
    const mobileKeywords = ['android', 'iphone', 'ipad', 'ipod', 'blackberry', 
                            'windows phone', 'mobile', 'webos'];
    const isMobileUA = mobileKeywords.some(keyword => userAgent.includes(keyword));
    
    // Method 2: Check max touch points (with fallback)
    const hasTouch = navigator.maxTouchPoints > 0;
    
    // Method 3: Check screen size
    const isSmallScreen = window.screen.width < 768;
    
    // Method 4: Check platform (with null check)
    const mobilePlatforms = ['iphone', 'ipad', 'ipod', 'android'];
    const platform = navigator.platform || '';
    const isMobilePlatform = mobilePlatforms.some(platform => 
      platform.toLowerCase().includes(platform)
    );
    
    // Method 5: Check if it's a standalone app (PWA on mobile)
    const isStandalone = window.matchMedia?.('(display-mode: standalone)').matches ||
                       (window.navigator as any).standalone === true;
    
    // Combine multiple signals for better accuracy
    return isMobileUA || (hasTouch && isSmallScreen) || isMobilePlatform || isStandalone;
  } catch (error) {
    console.error('Error detecting mobile device:', error);
    return false; // Default to non-mobile on error
  }
}

/**
 * Gets detailed signup metadata for analytics
 * Returns null if not in browser environment
 * @returns {object | null}
 */
export function getSignupMetadata(): {
  source: SignupSourceType | null;
  device: {
    type: 'mobile' | 'desktop';
    userAgent: string | null;
    platform: string | null;
    screenSize: string | null;
    touchEnabled: boolean;
  };
  referral: {
    referrer: string | null;
    utmSource: string | null;
    utmMedium: string | null;
    utmCampaign: string | null;
    refCode: string | null;
  };
  location: {
    timezone: string | null;
    language: string | null;
    locale: string | null;
  };
  timestamp: string;
} | null {
  // Check if we're in a browser environment
  if (!isBrowser()) {
    return null;
  }
  
  try {
    const source = detectSignupSource();
    const urlParams = new URLSearchParams(window.location.search);
    
    return {
      source,
      device: {
        type: detectMobileDevice() ? 'mobile' : 'desktop',
        userAgent: navigator.userAgent || null,
        platform: navigator.platform || null,
        screenSize: `${window.screen?.width || 0}x${window.screen?.height || 0}`,
        touchEnabled: navigator.maxTouchPoints > 0,
      },
      referral: {
        referrer: document.referrer || null,
        utmSource: urlParams.get('utm_source') || null,
        utmMedium: urlParams.get('utm_medium') || null,
        utmCampaign: urlParams.get('utm_campaign') || null,
        refCode: urlParams.get('ref') || urlParams.get('referral') || null,
      },
      location: {
        timezone: Intl?.DateTimeFormat?.().resolvedOptions?.().timeZone || null,
        language: navigator.language || null,
        locale: navigator.language || null,
      },
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting signup metadata:', error);
    return null;
  }
}

/**
 * Alternative: Async version that can be used in Next.js app router
 * This can be called from client components or useEffect
 */
export async function getSignupMetadataAsync() {
  // This ensures it only runs on client-side
  if (typeof window === 'undefined') {
    return null;
  }
  
  return getSignupMetadata();
}