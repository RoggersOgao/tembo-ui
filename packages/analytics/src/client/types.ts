import { AnalyticsConfig, SessionState, QueuedRequest } from '../core/types';

export interface AnalyticsClientInterface {
    sessionId: string;
    currentPageVisitId: string | null;

    trackSession(data: any): void;
    trackPageVisitStart(path: string, query?: string): Promise<void>;
    trackPageVisitEnd(url: string, query?: string): Promise<void>;
    trackEvent(type: string, url: string, element?: string, data?: any): void;
    trackClick(path: string, element: string): void;
    trackError(error: Error | string, context?: Record<string, any>): void;
    trackConversion(conversionType: string, value?: number, metadata?: Record<string, any>): void;
    trackFormSubmit(formName: string, success: boolean, data?: Record<string, any>): void;

    getActiveDuration(): number;
    getCurrentPageDuration(): number | null;
    checkpointPageVisit(): void;

    onVisibilityHidden(): void;
    onVisibilityVisible(): void;
    onPageHide(persisted: boolean): void;
    onPageShow(persisted: boolean): void;

    destroy(): Promise<void>;
}

export interface ClientOptions extends AnalyticsConfig {
    autoInit?: boolean;
    enablePerformanceMonitoring?: boolean;
    enableEngagementTracking?: boolean;
    enableErrorTracking?: boolean;
}