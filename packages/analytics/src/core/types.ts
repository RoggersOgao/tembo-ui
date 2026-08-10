import { DeviceType } from "./constants";

export interface ConsentConfig {
    required?: ('analytics' | 'marketing' | 'personalization')[];
    defaults?: Record<string, boolean>;
    storageKey?: string;
    /** API endpoint for server-side consent storage */
    consentEndpoint?: string;
    /** Whether to persist consent decisions to the server */
    storeRemotely?: boolean;
}

export interface AnalyticsConfig {
    sessionId?: string;
    apiBaseUrl: string;
    debug?: boolean;
    maxQueueSize?: number;
    flushInterval?: number;
    consent?: ConsentConfig;
    transformers?: {
        session?: (data: any) => any;
        event?: (data: any) => any;
        pageVisit?: (data: any) => any;
    };
}

export interface SessionData {
    sessionId: string;
    duration: number;
    ip?: string;
    country?: string;
    region?: string;
    city?: string;
    deviceType?: string;
    browser?: string;
    os?: string;
    referrer?: string;
}

export interface EventData {
    sessionId: string;
    type: string;
    url: string;
    element?: string | null;
    data?: Record<string, any> | null;
    timestamp?: string;
}

export interface PageVisitData {
    id: string;
    sessionId: string;
    path: string;
    query?: string;
    startTime?: string;
    endTime?: string;
    duration?: number;
}

export interface ClickData {
    sessionId: string;
    path: string;
    element: string;
    timestamp?: string;
}

export interface ConsentPreferences {
    essential: boolean;
    analytics: boolean;
    marketing: boolean;
    personalization: boolean;
    [key: string]: boolean;
}

export interface ConsentEvent {
    type: 'granted' | 'denied' | 'updated';
    preferences: ConsentPreferences;
    timestamp: number;
}

export interface QueuedRequest {
    url: string;
    body: Record<string, any>;
    method: 'POST' | 'PUT';
    timestamp: number;
    retries: number;
    priority: number;
}

export interface SessionState {
    sessionId: string;
    startTime: number;
    lastHeartbeat: number;
    isActive: boolean;
    pageVisitId: string | null;
}

export interface DeviceInfo {
    deviceType: DeviceType;
    browser: string;
    os: string;
    screenWidth?: number;
    screenHeight?: number;
    viewportWidth?: number;
    viewportHeight?: number;
}

export interface GeoInfo {
    ip?: string;
    country?: string;
    region?: string;
    city?: string;
}

export interface PageVisitMetrics {
    duration: number;
    activeTime: number;
    scrollDepth: number;
    interactions: number;
    errors: number;
}