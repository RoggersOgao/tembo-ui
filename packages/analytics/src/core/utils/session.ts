export function generateSessionId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 10);
    const counter = (Math.floor(Math.random() * 1000)).toString(36);
    return `${timestamp}-${random}-${counter}`;
}

export function getSessionDuration(startTime: number): number {
    return Math.floor((Date.now() - startTime) / 1000);
}

export function isValidSessionId(sessionId: string): boolean {
    return /^[a-z0-9]+-[a-z0-9]+-[a-z0-9]+$/.test(sessionId);
}