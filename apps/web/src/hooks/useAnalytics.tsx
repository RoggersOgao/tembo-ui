

/*  Utility: Generate session ID */

export function generateSessionId(): string {
    if (typeof window === 'undefined') return '';
    let sessionId = sessionStorage.getItem('analytics_session_id');
    if (!sessionId) {
        sessionId = `session_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        sessionStorage.setItem('analytics_session_id', sessionId);
    }
    return sessionId;
}
/* 
Utility: Device Info */

export function getDeviceInfo() {
    const ua = navigator.userAgent;
    const connection = (navigator as any).connection;

    const deviceType = /Mobile|Android|iPhone/.test(ua)
        ? 'mobile'
        : /Tablet|iPad/.test(ua)
            ? 'tablet'
            : 'desktop';

    const browser =
        ua.includes('Chrome') ? 'Chrome' :
            ua.includes('Firefox') ? 'Firefox' :
                ua.includes('Safari') ? 'Safari' :
                    ua.includes('Edge') ? 'Edge' : 'Unknown';

    const os =
        ua.includes('Windows') ? 'Windows' :
            ua.includes('Mac') ? 'macOS' :
                ua.includes('Linux') ? 'Linux' :
                    ua.includes('Android') ? 'Android' :
                        ua.includes('iPhone') ? 'iOS' : 'Unknown';

    return {
        deviceType,
        browser,
        os,
        networkType: connection?.effectiveType ?? null,
    };
}

/*  Utility: Get IP + Geo */
export async function getIpAndGeo() {
    try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        const { ip } = await ipRes.json();

        const geoRes = await fetch(`https://ipapi.co/${ip}/json/`);
        const geo = await geoRes.json();

        return {
            ip,
            country: geo.country_name ?? null,
            region: geo.region ?? null,
            city: geo.city ?? null,
        };
    } catch {
        return { ip: 'unknown', country: null, region: null, city: null };
    }
}