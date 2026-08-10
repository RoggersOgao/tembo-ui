import { RequestWithSocket } from '../types';
import { getCookieValue } from '../utils/cookie-utils';

export function extractAnalyticsData(
  req: RequestWithSocket,
  headers: Record<string, string>
) {
  const url = req.url || '';
  const host = headers.host || 'localhost';
  
  // Parse URL for query parameters
  let queryParams: Record<string, string> = {};
  try {
    const urlObj = new URL(url, `http://${host}`);
    queryParams = Object.fromEntries(urlObj.searchParams.entries());
  } catch {
    // If URL parsing fails, try to extract query params manually
    const queryMatch = url.match(/\?(.*)$/);
    if (queryMatch) {
      const params = new URLSearchParams(queryMatch[1]);
      queryParams = Object.fromEntries(params.entries());
    }
  }

  // Extract UTM parameters
  const utmSource = queryParams.utm_source || queryParams.source;
  const utmMedium = queryParams.utm_medium || queryParams.medium;
  const utmCampaign = queryParams.utm_campaign || queryParams.campaign;
  const utmTerm = queryParams.utm_term || queryParams.term;
  const utmContent = queryParams.utm_content || queryParams.content;

  // Extract session and user info from cookies or headers
  const sessionId = getCookieValue(headers.cookie, 'sessionId') || 
                   getCookieValue(headers.cookie, 'sid') ||
                   headers['x-session-id'];

  const userId = getCookieValue(headers.cookie, 'userId') || 
                getCookieValue(headers.cookie, 'uid') ||
                headers['x-user-id'];

  // Extract referral source
  let referralSource: string | undefined;
  if (headers.referer) {
    try {
      const refererUrl = new URL(headers.referer);
      referralSource = refererUrl.hostname;
    } catch {
      referralSource = headers.referer;
    }
  }

  // Determine campaign from UTM or other parameters
  let campaign: string | undefined;
  if (utmCampaign) {
    campaign = utmCampaign;
  } else if (queryParams.campaign) {
    campaign = queryParams.campaign;
  }

  return {
    sessionId,
    pageViewId: headers['x-pageview-id'] || undefined,
    userId,
    referralSource,
    campaign,
    utmSource,
    utmMedium,
    utmCampaign,
    utmTerm,
    utmContent,
  };
}

export function extractMarketingData(headers: Record<string, string>, queryParams: Record<string, string>) {
  // Extract additional marketing parameters
  const marketingData: Record<string, string> = {};

  // Common marketing parameters
  const marketingParams = [
    'gclid', // Google Click ID
    'fbclid', // Facebook Click ID
    'msclkid', // Microsoft Click ID
    'twclid', // Twitter Click ID
    'li_fat_id', // LinkedIn Click ID
    'ttclid', // TikTok Click ID
    'irclickid', // Impact Radius Click ID
    'wickedid', // Wicked Reports Click ID
    'zanpid', // Zanox Click ID
    'source', // Generic source
    'medium', // Generic medium
    'campaign', // Generic campaign
    'term', // Generic term
    'content', // Generic content
  ];

  for (const param of marketingParams) {
    if (queryParams[param]) {
      marketingData[param] = queryParams[param];
    }
  }

  return marketingData;
}

export function generateSessionId(): string {
  return 'sess_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

export function generatePageViewId(): string {
  return 'pv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}