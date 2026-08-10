import { RequestWithSocket } from '../types';

export function extractSecurityInfo(
  req: RequestWithSocket,
  headers: Record<string, string>
) {
  const isSecure = req.connection?.encrypted || req.url?.startsWith('https:');
  let tlsVersion: string | undefined;
  let cipherSuite: string | undefined;

  if (isSecure && req.connection?.getCipher) {
    try {
      const cipher = req.connection.getCipher();
      tlsVersion = cipher.version;
      cipherSuite = cipher.name;
    } catch (error) {
      // Ignore cipher extraction errors
    }
  }

  // Parse Permissions-Policy header
  let permissionsPolicy: Record<string, string[]> | undefined;
  const ppHeader = headers['permissions-policy'] || headers['feature-policy'];
  if (ppHeader) {
    permissionsPolicy = {};
    const policies = ppHeader.split(',');
    for (const policy of policies) {
      const [feature, origins] = policy.split('=');
      if (feature && origins) {
        permissionsPolicy[feature.trim()] = origins
          .split(' ')
          .map(o => o.trim().replace(/['"]/g, ''));
      }
    }
  }

  return {
    tlsVersion,
    cipherSuite,
    hsts: headers['strict-transport-security'] !== undefined,
    contentTypeOptions: headers['x-content-type-options'] === 'nosniff',
    xssProtection: headers['x-xss-protection'] !== undefined,
    frameOptions: headers['x-frame-options'] !== undefined,
    referrerPolicy: headers['referrer-policy'],
    permissionsPolicy,
  };
}

export function checkSecurityHeaders(headers: Record<string, string>): {
  missing: string[];
  weak: string[];
  strong: string[];
} {
  const securityHeaders = {
    'Content-Security-Policy': headers['content-security-policy'],
    'Strict-Transport-Security': headers['strict-transport-security'],
    'X-Content-Type-Options': headers['x-content-type-options'],
    'X-Frame-Options': headers['x-frame-options'],
    'X-XSS-Protection': headers['x-xss-protection'],
    'Referrer-Policy': headers['referrer-policy'],
    'Permissions-Policy': headers['permissions-policy'] || headers['feature-policy'],
  };

  const missing: string[] = [];
  const weak: string[] = [];
  const strong: string[] = [];

  for (const [header, value] of Object.entries(securityHeaders)) {
    if (!value) {
      missing.push(header);
    } else if (isWeakSecurityHeader(header, value)) {
      weak.push(header);
    } else {
      strong.push(header);
    }
  }

  return { missing, weak, strong };
}

function isWeakSecurityHeader(header: string, value: string): boolean {
  switch (header) {
    case 'X-Frame-Options':
      return value.toLowerCase() === 'allow-from *';
    case 'X-XSS-Protection':
      return value === '0';
    case 'Referrer-Policy':
      return ['unsafe-url', ''].includes(value.toLowerCase());
    case 'Strict-Transport-Security':
      return !value.includes('max-age=') || parseInt(value.match(/max-age=(\d+)/)?.[1] || '0') < 31536000;
    default:
      return false;
  }
}