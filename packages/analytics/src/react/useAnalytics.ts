import { useEffect, useRef, useCallback } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { AnalyticsClient } from '../client/AnalyticsClient';
import { AnalyticsConfig } from '../core/types';
import { useAnalyticsClient } from './AnalyticsProvider';

export function useAnalytics() {
    const { client, isReady } = useAnalyticsClient();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const previousPathRef = useRef<string | null>(null);
    const isNavigatingRef = useRef(false);
    const pageChangeInProgressRef = useRef(false);

    const endPageVisit = useCallback(async () => {
        if (!client || !client.currentPageVisitId) return;

        const query = searchParams.toString() ? `?${searchParams.toString()}` : undefined;

        try {
            await client.trackPageVisitEnd(pathname, query);
        } catch (error) {
            console.error('[useAnalytics] Error ending page visit:', error);
        }
    }, [client, pathname, searchParams]);

    // Track page changes
    useEffect(() => {
        if (!isReady || !client) return;

        const oldPath = previousPathRef.current;
        if (oldPath === pathname) return;   
        if (pageChangeInProgressRef.current) return;

        isNavigatingRef.current = true;
        pageChangeInProgressRef.current = true;

        (async () => {
            try {
                if (client.currentPageVisitId) {
                    await endPageVisit();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }

                const query = searchParams.toString() ? `?${searchParams.toString()}` : undefined;

                let attempts = 0;
                const maxAttempts = 3;
                let success = false;

                while (attempts < maxAttempts && !success && !client.currentPageVisitId) {
                    attempts++;
                    try {
                        await client.trackPageVisitStart(pathname, query);
                        if (client.currentPageVisitId) {
                            success = true;
                        } else if (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempts - 1)));
                        }
                    } catch (error) {
                        if (attempts < maxAttempts) {
                            await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempts - 1)));
                        }
                    }
                }

                previousPathRef.current = pathname;
            } catch (error) {
                console.error('[useAnalytics] Page change error:', error);
                if (client) {
                    client.trackError(error instanceof Error ? error : new Error(String(error)), {
                        context: 'pageChange',
                        pathname,
                    });
                }
            } finally {
                pageChangeInProgressRef.current = false;
                setTimeout(() => {
                    isNavigatingRef.current = false;
                }, 1000);
            }
        })();
    }, [pathname, searchParams, client, isReady, endPageVisit]);

    // Return public API
    return {
        client,
        isReady,

        trackEvent: useCallback((type: string, element?: string, data?: any) => {
            if (!client || !pathname) return;
            client.trackEvent(type, pathname, element, data);
        }, [client, pathname]),

        trackClick: useCallback((element: string) => {
            if (!client || !pathname) return;
            client.trackClick(pathname, element);
        }, [client, pathname]),

        trackError: useCallback((error: Error | string, context?: Record<string, any>) => {
            if (!client) return;
            client.trackError(error, context);
        }, [client]),

        trackConversion: useCallback(
            (conversionType: string, value?: number, metadata?: Record<string, any>) => {
                if (!client || !pathname) return;
                client.trackConversion(conversionType, value, metadata);
            },
            [client, pathname]
        ),

        trackFormSubmit: useCallback(
            (formName: string, success: boolean, data?: Record<string, any>) => {
                if (!client || !pathname) return;
                client.trackFormSubmit(formName, success, data);
            },
            [client, pathname]
        ),

        getPageDuration: useCallback(() => {
            if (!client) return null;
            return client.getCurrentPageDuration();
        }, [client]),
    };
}