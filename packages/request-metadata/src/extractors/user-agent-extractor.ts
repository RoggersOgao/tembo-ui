import { IResult, UAParser } from 'ua-parser-js';
import { RequestMetadata } from '../types';

export function extractUserAgentInfo(
  userAgent: string | undefined,
  headers: Record<string, string>
): RequestMetadata['userAgent'] {
  try {
    // Ensure we have a user-agent string to work with
    const uaString = userAgent || headers['user-agent'] || headers['User-Agent'] || '';
    
    // Initialize UA parser with fallback for empty user agent
    const uaParser = new UAParser(uaString);
    const uaResult = uaParser.getResult();
    const ua = uaString.toLowerCase();

    return {
      raw: uaString || undefined,
      browser: extractBrowserInfo(uaResult, ua),
      os: extractOSInfo(uaResult, ua),
      device: extractDeviceInfo(uaResult, ua, headers),
      capabilities: extractDeviceCapabilities(headers, ua, uaResult),
    };
  } catch (error) {
    // Return safe defaults in case of any errors
    return getDefaultUserAgentInfo(userAgent || '');
  }
}

function extractBrowserInfo(uaResult: IResult, ua: string): RequestMetadata['userAgent']['browser'] {
  // Extract browser information with better fallbacks
  let browserName = uaResult.browser.name;
  let browserVersion = uaResult.browser.version;
  
  // Fallback detection for edge cases
  if (!browserName) {
    if (ua.includes('edg/') || ua.includes('edge/')) {
      browserName = 'Edge';
    } else if (ua.includes('chrome/') && !ua.includes('chromium')) {
      browserName = 'Chrome';
    } else if (ua.includes('firefox/')) {
      browserName = 'Firefox';
    } else if (ua.includes('safari/') && !ua.includes('chrome')) {
      browserName = 'Safari';
    } else if (ua.includes('opera/') || ua.includes('opr/')) {
      browserName = 'Opera';
    }
  }

  // Extract version if not found by parser
  if (!browserVersion && browserName) {
    const match = ua.match(/(?:chrome|firefox|safari|opera|edge|edg|msie|trident)[\/\s](\d+\.?\d*)/i);
    if (match && match[1]) {
      browserVersion = match[1];
    }
  }

  return {
    name: browserName,
    version: browserVersion,
    engine: uaResult.engine.name || detectBrowserEngine(ua),
    majorVersion: browserVersion ? parseInt(browserVersion.split('.')[0], 10) : undefined,
  };
}

function detectBrowserEngine(ua: string): string | undefined {
  if (ua.includes('webkit') && !ua.includes('edge')) return 'WebKit';
  if (ua.includes('blink')) return 'Blink';
  if (ua.includes('gecko')) return 'Gecko';
  if (ua.includes('trident') || ua.includes('msie')) return 'Trident';
  if (ua.includes('edgehtml')) return 'EdgeHTML';
  return undefined;
}

function extractOSInfo(uaResult: IResult, ua: string): RequestMetadata['userAgent']['os'] {
  const osName = uaResult.os.name;
  const osVersion = uaResult.os.version;
  
  return {
    name: osName,
    version: osVersion,
    platform: detectPlatform(uaResult, ua),
    architecture: detectArchitecture(ua),
  };
}

function detectPlatform(uaResult: IResult, ua: string): string {
  const osName = uaResult.os.name?.toLowerCase() || '';
  
  // First check using parser result
  if (osName.includes('win')) return 'windows';
  if (osName.includes('mac')) return 'mac';
  if (osName.includes('linux')) return 'linux';
  if (osName.includes('android')) return 'android';
  if (osName.includes('ios') || osName.includes('iphone')) return 'ios';
  
  // Fallback to UA string patterns
  if (ua.includes('windows')) return 'windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'mac';
  if (ua.includes('linux')) return 'linux';
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  
  return 'unknown';
}

function detectArchitecture(ua: string): string | undefined {
  // Detect architecture from UA string
  if (ua.includes('x64') || ua.includes('amd64') || ua.includes('win64')) return 'x64';
  if (ua.includes('x86') || ua.includes('win32')) return 'x86';
  if (ua.includes('arm64') || ua.includes('aarch64')) return 'arm64';
  if (ua.includes('arm')) return 'arm';
  return undefined;
}

function extractDeviceInfo(
  uaResult: IResult,
  ua: string,
  headers: Record<string, string>
): RequestMetadata['userAgent']['device'] {
  const deviceType = detectDeviceType(uaResult, ua, headers);
  const isBot = detectBot(uaResult, ua, headers);
  
  return {
    type: deviceType,
    vendor: uaResult.device.vendor,
    model: uaResult.device.model,
    isTouch: detectTouchDevice(uaResult, ua, headers),
    isBot: isBot,
    botName: isBot ? getBotName(uaResult, ua) : undefined,
    isMobile: ['mobile', 'tablet'].includes(deviceType),
    isDesktop: deviceType === 'desktop',
    isEmulator: detectEmulator(ua),
  };
}

function detectDeviceType(
  uaResult: IResult,
  ua: string,
  headers: Record<string, string>
): RequestMetadata['userAgent']['device']['type'] {
  // Check device type from parser first
  if (uaResult.device.type === 'mobile') return 'mobile';
  if (uaResult.device.type === 'tablet') return 'tablet';
  if (uaResult.device.type === 'smarttv') return 'smart-tv';
  if (uaResult.device.type === 'wearable') return 'wearable';
  if (uaResult.device.type === 'embedded') return 'embedded';

  // Check for bot detection
  if (detectBot(uaResult, ua, headers)) return 'bot';

  // Check UA patterns
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
    // Distinguish between mobile and tablet
    if (ua.includes('tablet') || ua.includes('ipad') || (ua.includes('android') && !ua.includes('mobile'))) {
      return 'tablet';
    }
    return 'mobile';
  }

  // Check for smart TV
  if (ua.includes('smart-tv') || ua.includes('tv') || ua.includes('hbbtv') || ua.includes('netcast')) {
    return 'smart-tv';
  }

  // Check for game consoles
  if (ua.includes('playstation') || ua.includes('xbox') || ua.includes('nintendo')) {
    return 'console';
  }

  // Check headers for mobile hints
  const secCHUA = headers['sec-ch-ua-mobile'];
  if (secCHUA === '?1' || secCHUA === '1') return 'mobile';

  // Default to desktop
  return 'desktop';
}

function detectTouchDevice(
  uaResult: IResult,
  ua: string,
  headers: Record<string, string>
): boolean {
  // Check common touch device patterns
  if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone') || ua.includes('ipad')) {
    return true;
  }
  
  // Check parser result
  if (uaResult.device.type === 'mobile' || uaResult.device.type === 'tablet') {
    return true;
  }
  
  // Check for touch capability headers
  if (headers['touch-support'] === 'true' || headers['touch-enabled'] === 'true') {
    return true;
  }
  
  // Check viewport meta tag hint
  if (headers['viewport'] && headers['viewport'].includes('width=device-width')) {
    return true;
  }
  
  return false;
}

function detectBot(
  uaResult: IResult,
  ua: string,
  headers: Record<string, string>
): boolean {
  // Empty user agent often indicates bots
  if (!ua || ua.trim().length === 0) return true;

  const botPatterns = [
    'bot', 'crawler', 'spider', 'scraper', 'fetcher', 'archiver',
    'curl', 'wget', 'python', 'java', 'php', 'perl', 'ruby',
    'go-http-client', 'node-fetch', 'axios', 'requests',
    'googlebot', 'bingbot', 'slurp', 'duckduckbot', 'discordbot',
    'baiduspider', 'yandexbot', 'facebookexternalhit', 'telegrambot',
    'twitterbot', 'linkedinbot', 'whatsapp', 'slackbot', 'discord',
    'headlesschrome', 'headlessfirefox', 'phantomjs', 'selenium',
    'puppeteer', 'playwright', 'webdriver',
    'monitor', 'checker', 'validator', 'analyzer', 'indexer',
  ];

  // Check patterns in UA string
  const isBot = botPatterns.some(pattern => ua.includes(pattern));
  
  // Check if browser name indicates bot
  const browserName = uaResult.browser.name?.toLowerCase() || '';
  const isBotFromBrowser = browserName.includes('bot') || 
                         browserName.includes('crawler') ||
                         browserName.includes('spider');
  
  // Check for common bot headers
  const hasBotHeaders = !!(headers['x-crawler'] || 
                       headers['x-bot'] || 
                       headers['x-robot'] ||
                       headers['from']?.includes('bot'));
  
  return isBot || isBotFromBrowser || hasBotHeaders || ua.length < 10;
}

function getBotName(uaResult: IResult, ua: string): string {
  const botPatterns = [
    { pattern: 'googlebot', name: 'Google Bot' },
    { pattern: 'bingbot', name: 'Bing Bot' },
    { pattern: 'slurp', name: 'Yahoo Slurp' },
    { pattern: 'duckduckbot', name: 'DuckDuckGo Bot' },
    { pattern: 'baiduspider', name: 'Baidu Spider' },
    { pattern: 'yandexbot', name: 'Yandex Bot' },
    { pattern: 'facebookexternalhit', name: 'Facebook Bot' },
    { pattern: 'twitterbot', name: 'Twitter Bot' },
    { pattern: 'linkedinbot', name: 'LinkedIn Bot' },
    { pattern: 'telegrambot', name: 'Telegram Bot' },
    { pattern: 'discordbot', name: 'Discord Bot' },
    { pattern: 'whatsapp', name: 'WhatsApp Bot' },
    { pattern: 'slackbot', name: 'Slack Bot' },
    { pattern: 'applebot', name: 'Apple Bot' },
    { pattern: 'semrushbot', name: 'SEMrush Bot' },
    { pattern: 'ahrefsbot', name: 'Ahrefs Bot' },
    { pattern: 'mj12bot', name: 'Majestic Bot' },
    { pattern: 'petalbot', name: 'Petal Bot' },
  ];

  for (const { pattern, name } of botPatterns) {
    if (ua.includes(pattern)) return name;
  }

  // Try to extract from browser name
  if (uaResult.browser.name) {
    return `${uaResult.browser.name} Bot`;
  }

  return 'Unknown Bot';
}

function detectEmulator(ua: string): boolean {
  // Common emulator patterns
  const emulatorPatterns = [
    'emulator',
    'x86_64',
    'android sdk',
    'simulator',
    'development',
    'debug',
    'test',
  ];
  
  return emulatorPatterns.some(pattern => ua.includes(pattern));
}

function extractDeviceCapabilities(
  headers: Record<string, string>,
  ua: string,
  uaResult: IResult
): RequestMetadata['userAgent']['capabilities'] {
  // Try to get screen dimensions from various headers
  let screenWidth: number | undefined;
  let screenHeight: number | undefined;
  
  // Check multiple possible header names
  const widthHeaders = ['viewport-width', 'screen-width', 'device-width', 'width'];
  const heightHeaders = ['viewport-height', 'screen-height', 'device-height', 'height'];
  
  for (const header of widthHeaders) {
    if (headers[header]) {
      const parsed = parseInt(headers[header], 10);
      if (!isNaN(parsed)) {
        screenWidth = parsed;
        break;
      }
    }
  }
  
  for (const header of heightHeaders) {
    if (headers[header]) {
      const parsed = parseInt(headers[header], 10);
      if (!isNaN(parsed)) {
        screenHeight = parsed;
        break;
      }
    }
  }
  
  // Get pixel ratio
  let pixelRatio = 1;
  const dprHeaders = ['dpr', 'device-pixel-ratio', 'pixel-ratio'];
  for (const header of dprHeaders) {
    if (headers[header]) {
      const parsed = parseFloat(headers[header]);
      if (!isNaN(parsed)) {
        pixelRatio = parsed;
        break;
      }
    }
  }
  
  // Detect capabilities based on UA
  const browserName = uaResult.browser.name?.toLowerCase() || '';
  const osName = uaResult.os.name?.toLowerCase() || '';
  
  return {
    supportsWebGL: detectWebGLSupport(browserName, osName, ua),
    supportsWebRTC: detectWebRTCSupport(browserName, osName, ua),
    supportsWebAssembly: detectWebAssemblySupport(browserName),
    supportsWebP: detectWebPSupport(browserName, ua),
    supportsAVIF: detectAVIFSupport(browserName, ua),
    screenResolution: screenWidth && screenHeight 
      ? { width: screenWidth, height: screenHeight }
      : undefined,
    colorDepth: getColorDepth(headers),
    pixelRatio: pixelRatio,
    connectionType: headers['save-data'] === 'on' ? 'save-data' : 
                   headers['ect'] || headers['connection-type'],
    supportsHDR: detectHDRSupport(headers),
  };
}

function detectWebGLSupport(browserName: string, osName: string, ua: string): boolean {
  // Most modern browsers support WebGL
  const supportedBrowsers = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
  const unsupportedPatterns = ['bot', 'crawler', 'spider'];
  
  if (unsupportedPatterns.some(pattern => ua.includes(pattern))) return false;
  
  // Older Android browsers might not support WebGL
  if (osName.includes('android') && ua.includes('android 4')) {
    return false;
  }
  
  return supportedBrowsers.some(browser => browserName.includes(browser));
}

function detectWebRTCSupport(browserName: string, osName: string, ua: string): boolean {
  const supportedBrowsers = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
  return supportedBrowsers.some(browser => browserName.includes(browser)) &&
         !ua.includes('android 4');
}

function detectWebAssemblySupport(browserName: string): boolean {
  const supportedBrowsers = ['chrome', 'firefox', 'safari', 'edge', 'opera'];
  return supportedBrowsers.some(browser => browserName.includes(browser));
}

function detectWebPSupport(browserName: string, ua: string): boolean {
  // WebP support detection
  if (browserName.includes('chrome') && !ua.includes('chrome/4')) return true;
  if (browserName.includes('firefox') && ua.includes('firefox/65')) return true;
  if (browserName.includes('edge') && ua.includes('edge/18')) return true;
  if (browserName.includes('opera') && ua.includes('opera/11')) return true;
  if (browserName.includes('safari') && ua.includes('version/14')) return true;
  return false;
}

function detectAVIFSupport(browserName: string, ua: string): boolean {
  // AVIF support is limited to newer browsers
  if (browserName.includes('chrome') && ua.includes('chrome/85')) return true;
  if (browserName.includes('firefox') && ua.includes('firefox/93')) return true;
  return false;
}

function getColorDepth(headers: Record<string, string>): number {
  // Try to get color depth from headers
  const colorDepthHeaders = ['color-depth', 'screen-colordepth', 'depth'];
  for (const header of colorDepthHeaders) {
    if (headers[header]) {
      const depth = parseInt(headers[header], 10);
      if (!isNaN(depth)) return depth;
    }
  }
  
  // Default values based on device type
  return 24; // Most modern devices
}

function detectHDRSupport(headers: Record<string, string>): boolean {
  // Check for HDR support headers
  return headers['hdr'] === 'supported' ||
         headers['sec-ch-hdr'] === 'true' ||
         headers['high-dynamic-range'] === 'supported';
}

function getDefaultUserAgentInfo(userAgent: string): RequestMetadata['userAgent'] {
  return {
    raw: userAgent || undefined,
    browser: {
      name: undefined,
      version: undefined,
      engine: undefined,
      majorVersion: undefined,
    },
    os: {
      name: undefined,
      version: undefined,
      platform: 'unknown',
      architecture: undefined,
    },
    device: {
      type: 'desktop',
      vendor: undefined,
      model: undefined,
      isTouch: false,
      isBot: false,
      botName: undefined,
      isMobile: false,
      isDesktop: true,
      isEmulator: false,
    },
    capabilities: {
      supportsWebGL: false,
      supportsWebRTC: false,
      supportsWebAssembly: false,
      supportsWebP: false,
      supportsAVIF: false,
      screenResolution: undefined,
      colorDepth: 24,
      pixelRatio: 1,
      connectionType: undefined,
      supportsHDR: false,
    },
  };
}