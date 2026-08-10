import { GeoInfo } from '../types';

export async function getGeoInfo(): Promise<GeoInfo> {
    try {
        const response = await fetch('https://ipapi.co/json/');
        if (!response.ok) {
            return {};
        }
        const data = await response.json();
        return {
            ip: data.ip,
            country: data.country_name,
            region: data.region,
            city: data.city,
        };
    } catch (error) {
        console.warn('[Analytics] Failed to get geo info:', error);
        return {};
    }
}

export function getClientIp(headers: Headers): string | undefined {
    const forwarded = headers.get('x-forwarded-for');
    if (forwarded) {
        const firstIp = forwarded.split(',')[0];
        return firstIp?.trim();
    }
    return headers.get('x-real-ip') || undefined;
}