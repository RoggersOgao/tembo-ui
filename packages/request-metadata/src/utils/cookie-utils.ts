export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const cookies: Record<string, string> = {};

  if (!cookieHeader) return cookies;

  cookieHeader.split(';').forEach(cookie => {
    const [name, ...valueParts] = cookie.trim().split('=');
    if (name) {
      cookies[name] = valueParts.join('=');
    }
  });

  return cookies;
}

export function getCookieValue(cookieHeader: string | undefined, cookieName: string): string | undefined {
  if (!cookieHeader) return undefined;

  const cookies = parseCookies(cookieHeader);
  return cookies[cookieName];
}

export function parseSetCookieHeaders(setCookieHeaders: string[] | string | undefined): Array<{
  name: string;
  value: string;
  expires?: Date;
  maxAge?: number;
  domain?: string;
  path?: string;
  secure?: boolean;
  httpOnly?: boolean;
  sameSite?: 'strict' | 'lax' | 'none';
}> {
  const cookies: Array<{
    name: string;
    value: string;
    expires?: Date;
    maxAge?: number;
    domain?: string;
    path?: string;
    secure?: boolean;
    httpOnly?: boolean;
    sameSite?: 'strict' | 'lax' | 'none';
  }> = [];

  if (!setCookieHeaders) return cookies;

  const headers = Array.isArray(setCookieHeaders) ? setCookieHeaders : [setCookieHeaders];

  for (const header of headers) {
    const parts = header.split(';');
    const [nameValue, ...attributes] = parts;
    const [name, ...valueParts] = nameValue.trim().split('=');
    const value = valueParts.join('=');

    const cookie: any = { name, value };

    for (const attr of attributes) {
      const [attrName, attrValue] = attr.trim().split('=');
      const lowerAttrName = attrName.toLowerCase();

      switch (lowerAttrName) {
        case 'expires':
          cookie.expires = new Date(attrValue);
          break;
        case 'max-age':
          cookie.maxAge = parseInt(attrValue, 10);
          break;
        case 'domain':
          cookie.domain = attrValue;
          break;
        case 'path':
          cookie.path = attrValue;
          break;
        case 'secure':
          cookie.secure = true;
          break;
        case 'httponly':
          cookie.httpOnly = true;
          break;
        case 'samesite':
          cookie.sameSite = attrValue.toLowerCase() as 'strict' | 'lax' | 'none';
          break;
      }
    }

    cookies.push(cookie);
  }

  return cookies;
}

export function serializeCookies(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}