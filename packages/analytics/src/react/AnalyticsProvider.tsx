"use client"

import React, { createContext, useContext, useEffect, useRef, ReactNode } from 'react';
import { AnalyticsClient } from '../client/AnalyticsClient';
import { AnalyticsConfig } from '../core/types';
import { getConsentManager } from '../client/consent/ConsentManager';

interface AnalyticsContextValue {
    client: AnalyticsClient | null;
    isReady: boolean;
}

const AnalyticsContext = createContext<AnalyticsContextValue>({
    client: null,
    isReady: false,
});

interface AnalyticsProviderProps {
    children: ReactNode;
    config: AnalyticsConfig;
    autoInit?: boolean;
}

export function AnalyticsProvider({ children, config, autoInit = true }: AnalyticsProviderProps) {
    const [isReady, setIsReady] = React.useState(false);
    const clientRef = useRef<AnalyticsClient | null>(null);

    // IMPORTANT: `config` is an object, and objects are compared by
    // reference in a dependency array. If the caller passes an inline
    // object literal (e.g. `<AnalyticsProvider config={{ sessionId, consent }}>`),
    // `config` is a NEW reference on every render of the parent — even
    // when every field inside it is identical. That would make this
    // effect's cleanup (client.destroy() -> trackSessionEnd()) and
    // re-init (new AnalyticsClient() -> trackSession()) fire on every
    // re-render, not just real mount/unmount, corrupting session
    // start/end semantics.
    //
    // We depend on the individual primitive fields we actually care
    // about instead of the `config` object reference itself, so the
    // client is only torn down and rebuilt when something that matters
    // has actually changed.
    const { sessionId, consent, debug, flushInterval, maxQueueSize } = config;
    const consentEndpoint = consent?.consentEndpoint;
    const storeRemotely = consent?.storeRemotely;
    const storageKey = consent?.storageKey;

    useEffect(() => {
        if (!autoInit) return;

        let client: AnalyticsClient;

        try {
            // AnalyticsClient's own constructor initializes the shared
            // consent singleton (with correct field translation + sessionId)
            // if config.consent is set — so by the time we get here, the
            // singleton already reflects this config. We just fetch the
            // same instance to decide whether to show the consent banner.
            client = new AnalyticsClient(config);
            clientRef.current = client;
            setIsReady(true);

            if (config.consent) {
                const consentManager = getConsentManager();
                // hasAnyConsent() only reports whether an OPTIONAL category
                // is currently true — it's false after "Reject All" even
                // though the user made a real decision. That falsely
                // re-triggers this event (and reopens the banner) on every
                // remount/route change after a full reject. Use
                // hasStoredConsent() instead, which tracks whether any
                // decision was made at all, independent of what it was.
                if (!consentManager.hasStoredConsent()) {
                    document.dispatchEvent(
                        new CustomEvent('analytics:show-consent', { detail: { config } })
                    );
                }
            }

            const handleVisibilityChange = () => {
                if (document.visibilityState === 'hidden') {
                    client.onVisibilityHidden();
                } else {
                    client.onVisibilityVisible();
                }
            };

            const handlePageHide = (e: PageTransitionEvent) => {
                client.onPageHide(e.persisted);
            };

            const handlePageShow = (e: PageTransitionEvent) => {
                client.onPageShow(e.persisted);
            };

            document.addEventListener('visibilitychange', handleVisibilityChange);
            window.addEventListener('pagehide', handlePageHide);
            window.addEventListener('pageshow', handlePageShow);

            return () => {
                document.removeEventListener('visibilitychange', handleVisibilityChange);
                window.removeEventListener('pagehide', handlePageHide);
                window.removeEventListener('pageshow', handlePageShow);
                client.destroy();
                clientRef.current = null;
                setIsReady(false);
            };
        } catch (error) {
            console.error('[AnalyticsProvider] Failed to initialize:', error);
            setIsReady(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        autoInit,
        sessionId,
        consentEndpoint,
        storeRemotely,
        storageKey,
        debug,
        flushInterval,
        maxQueueSize,
    ]);

    return (
        <AnalyticsContext.Provider value={{ client: clientRef.current, isReady }}>
            {children}
        </AnalyticsContext.Provider>
    );
}

export function useAnalyticsClient() {
    const context = useContext(AnalyticsContext);
    if (!context) {
        throw new Error('useAnalyticsClient must be used within an AnalyticsProvider');
    }
    return context;
}