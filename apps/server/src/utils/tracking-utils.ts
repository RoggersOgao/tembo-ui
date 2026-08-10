// utils/tracking.utils.ts
/**
 * Generate a unique tracking code for deliveries
 * Format: DLV-XXXX-XXXX-XXXX
 */
export function generateTrackingCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const segments = 3;
  const segmentLength = 4;
  
  const generateSegment = () => {
    let segment = '';
    for (let i = 0; i < segmentLength; i++) {
      segment += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return segment;
  };
  
  const codeSegments = [];
  for (let i = 0; i < segments; i++) {
    codeSegments.push(generateSegment());
  }
  
  return `DLV-${codeSegments.join('-')}`;
}

/**
 * Validate tracking code format
 */
export function isValidTrackingCode(code: string): boolean {
  const pattern = /^DLV-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/;
  return pattern.test(code);
}

/**
 * Format tracking code for display
 */
export function formatTrackingCode(code: string): string {
  return code.toUpperCase().replace(/-/g, ' ');
}