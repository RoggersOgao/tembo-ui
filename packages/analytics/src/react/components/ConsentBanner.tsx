"use client"

import React, { useState, useEffect } from 'react';
import { getConsentManager } from '../../client/consent/ConsentManager';
import { ConsentBanner as BaseConsentBanner } from '../../client/consent/ConsentBanner';
import { ConsentBannerProps } from '../../client/consent/types';

export function ConsentBanner(props: ConsentBannerProps) {
    const [show, setShow] = useState(false);

    useEffect(() => {
        const manager = getConsentManager({
            storageKey: props.storageKey,
            requiredCategories: props.requiredCategories,
            defaultPreferences: props.defaultPreferences,
            consentEndpoint: props.consentEndpoint,
            storeRemotely: props.storeRemotely,
            sessionId: props.sessionId,
        });

        // hasAnyConsent() is false after "Reject All" even though the user
        // made a real decision — use hasStoredConsent() so any decision
        // (accept, reject, or partial) keeps the banner hidden on remount.
        if (!manager.hasStoredConsent()) {
            setShow(true);
        }

        // Auto-show trigger, fired by AnalyticsProvider when a fresh
        // AnalyticsClient finds no stored decision. Defensive check here
        // too — should rarely matter since the dispatcher already gates
        // this, but this component shouldn't blindly trust every dispatch.
        const handleAutoShow = () => {
            if (!manager.hasStoredConsent()) {
                setShow(true);
            }
        };

        // Deliberate re-open trigger — e.g. a "Manage cookie preferences"
        // link elsewhere in the app. Always shows, no consent check,
        // since letting the user revisit a prior decision is the point.
        const handleOpenPreferences = () => {
            setShow(true);
        };

        document.addEventListener('analytics:show-consent', handleAutoShow as EventListener);
        document.addEventListener('analytics:open-consent-preferences', handleOpenPreferences as EventListener);
        return () => {
            document.removeEventListener('analytics:show-consent', handleAutoShow as EventListener);
            document.removeEventListener('analytics:open-consent-preferences', handleOpenPreferences as EventListener);
        };
    }, [props.storageKey, props.requiredCategories, props.defaultPreferences, props.consentEndpoint, props.storeRemotely, props.sessionId]);

    return <BaseConsentBanner {...props} show={show} />;
}