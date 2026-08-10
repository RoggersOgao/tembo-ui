export function isValidUrl(url: string): boolean {
    try {
        new URL(url);
        return true;
    } catch {
        return false;
    }
}

export function isValidPath(path: string): boolean {
    return path.startsWith('/') && path.length > 0;
}

export function isValidTimestamp(timestamp: string): boolean {
    const date = new Date(timestamp);
    return !isNaN(date.getTime());
}

export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}