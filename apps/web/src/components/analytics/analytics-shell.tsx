"use client";

import { useMemo } from "react";
import {
    AnalyticsProvider,
    AnalyticsInitializer,
    ConsentBanner,
} from "@repo/analytics/react";
import { generateSessionId } from "@repo/analytics"; // from core/utils/session
import { SESSION_STORAGE_KEYS } from "@repo/analytics"; // from core/constants

const API_BASE_URL =
    process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5001";

function resolveSessionId(): string {
    if (typeof sessionStorage === "undefined") return generateSessionId();
    const existing = sessionStorage.getItem(SESSION_STORAGE_KEYS.SESSION_ID);
    if (existing) return existing;
    const fresh = generateSessionId();
    sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_ID, fresh);
    sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_START, String(Date.now()));
    return fresh;
}

export function AnalyticsShell({ children }: { children: React.ReactNode }) {
    const sessionId = useMemo(resolveSessionId, []);

    const config = useMemo(
        () => ({
            apiBaseUrl: API_BASE_URL,
            debug: process.env.NODE_ENV === "development",
            sessionId,
            consent: {
                required: ["analytics" as const],
                defaults: {
                    analytics: false,
                    marketing: false,
                    personalization: false,
                },
                consentEndpoint: `${API_BASE_URL}/api/consent`,
                storeRemotely: true,
            },
        }),
        [sessionId]
    );

    return (
        <AnalyticsProvider config={config}>
            <AnalyticsInitializer />
            {children}
            <ConsentBanner
                position="bottom"
                sessionId={sessionId}
                consentEndpoint={`${API_BASE_URL}/api/consent`}
                storeRemotely={true}
                onAcceptAll={() => console.log("Consent accepted and synced to server")}
                onRejectAll={() => console.log("Consent rejected and synced to server")}
            />
        </AnalyticsProvider>
    );
}