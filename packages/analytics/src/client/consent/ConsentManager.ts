import { ConsentPreferences, ConsentEvent } from '../../core/types';
import { CONSENT_STORAGE_KEY } from '../../core/constants';

export interface ConsentManagerConfig {
    storageKey?: string;
    defaultPreferences?: Partial<ConsentPreferences>;
    requiredCategories?: ('analytics' | 'marketing' | 'personalization')[];
    onConsentChange?: (preferences: ConsentPreferences) => void;
    // New: Custom consent API endpoint
    consentEndpoint?: string;
    // New: Store consent in backend
    storeRemotely?: boolean;
    // Correlates this consent record with an analytics session server-side.
    // Required by the server's getConsent (sessionId query param) and
    // upsertConsent (sessionId in body) schemas — without it, remote sync
    // is skipped entirely rather than sent as a request that will 400.
    sessionId?: string;
}
export class ConsentManager {
    private storageKey: string;
    private preferences: ConsentPreferences;
    private requiredCategories: Set<string>;
    private listeners: Set<(preferences: ConsentPreferences) => void> = new Set();
    private eventListeners: Set<(event: ConsentEvent) => void> = new Set();
    private initialized = false;
    private consentEndpoint?: string;
    private storeRemotely: boolean;
    private sessionId?: string;

    constructor(config: ConsentManagerConfig = {}) {
        this.storageKey = config.storageKey || CONSENT_STORAGE_KEY;
        this.requiredCategories = new Set(config.requiredCategories || ['essential']);
        this.consentEndpoint = config.consentEndpoint;
        this.storeRemotely = config.storeRemotely || false;
        this.sessionId = config.sessionId;

        const hadStoredValue = typeof localStorage !== 'undefined' && !!localStorage.getItem(this.storageKey);

        this.preferences = this.loadPreferences();

        if (config.defaultPreferences && !hadStoredValue) {
            this.preferences = {
                ...this.preferences,
                ...this.stripUndefined(config.defaultPreferences),
            } as ConsentPreferences;
        }

        // Ensure essential is always true
        this.preferences.essential = true;
        this.savePreferences();
        this.initialized = true;

        if (this.storeRemotely && this.consentEndpoint) {
            if (this.sessionId) {
                this.loadRemoteConsent();
            } else {
                console.warn(
                    '[Analytics Consent] storeRemotely is true but no sessionId was provided — skipping remote load.'
                );
            }
        }
    }

    // ---- Interaction tracking ----------------------------------------
    // Whether the user has ever made an explicit consent decision.
    // Deliberately separate from `hasAnyConsent()`, which reports whether
    // any OPTIONAL category is currently true. A user who clicks "Reject
    // All" has made a real choice — hasAnyConsent() is false in that case,
    // but the banner must NOT reappear. Stored under its own key (rather
    // than folded into the preferences JSON) so loadPreferences()'s shape
    // stays untouched and backward compatible.
    private interactedStorageKey(): string {
        return `${this.storageKey}__interacted`;
    }

    private markInteracted(): void {
        if (typeof localStorage === 'undefined') return;
        try {
            localStorage.setItem(this.interactedStorageKey(), '1');
        } catch (error) {
            console.warn('[Analytics Consent] Failed to persist interaction flag:', error);
        }
    }

    // Use this — not hasAnyConsent() — to decide whether to show the banner.
    hasStoredConsent(): boolean {
        if (typeof localStorage === 'undefined') return false;
        try {
            return localStorage.getItem(this.interactedStorageKey()) === '1';
        } catch {
            return false;
        }
    }
    // --------------------------------------------------------------------

    private stripUndefined(
        preferences: Partial<ConsentPreferences>
    ): Partial<ConsentPreferences> {
        return Object.fromEntries(
            Object.entries(preferences).filter(([, v]) => v !== undefined)
        ) as Partial<ConsentPreferences>;
    }

    private async loadRemoteConsent() {
        if (!this.consentEndpoint || !this.sessionId) return;

        try {
            const url = `${this.consentEndpoint}?sessionId=${encodeURIComponent(this.sessionId)}`;
            const response = await fetch(url, {
                credentials: 'include',
            });

            if (response.status === 304) {
                return;
            }

            if (response.ok) {
                const remotePrefs = await response.json();
                this.preferences = {
                    ...this.preferences,
                    ...this.stripUndefined(remotePrefs),
                    essential: true,
                };
                this.savePreferences();
                // A remote record only exists because the user made a
                // choice somewhere (this device or another) — count it.
                this.markInteracted();
                this.notifyListeners();
            } else {
                console.warn(`[Analytics Consent] Failed to load remote consent: HTTP ${response.status}`);
            }
        } catch (error) {
            console.warn('[Analytics Consent] Failed to load remote consent:', error);
        }
    }

    private async saveRemoteConsent() {
        if (!this.storeRemotely || !this.consentEndpoint) return;

        if (!this.sessionId) {
            console.warn(
                '[Analytics Consent] storeRemotely is true but no sessionId was provided — skipping remote save.'
            );
            return;
        }

        try {
            await fetch(this.consentEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.sessionId,
                    preferences: this.preferences,
                }),
                credentials: 'include',
            });
        } catch (error) {
            console.warn('[Analytics Consent] Failed to save preferences:', error);
        }
    }

    private loadPreferences(): ConsentPreferences {
        if (typeof localStorage === 'undefined') {
            return this.getDefaultPreferences();
        }

        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                return { ...this.getDefaultPreferences(), ...parsed };
            }
        } catch (error) {
            console.warn('[Analytics Consent] Failed to load preferences:', error);
        }

        return this.getDefaultPreferences();
    }

    private getDefaultPreferences(): ConsentPreferences {
        return {
            essential: true,
            analytics: false,
            marketing: false,
            personalization: false,
        };
    }

    private savePreferences(): void {
        if (typeof localStorage === 'undefined') return;

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.preferences));
            if (this.storeRemotely) {
                this.saveRemoteConsent();
            }
        } catch (error) {
            console.warn('[Analytics Consent] Failed to save preferences:', error);
        }
    }

    private notifyListeners(): void {
        this.listeners.forEach(listener => listener(this.preferences));
    }

    getPreferences(): ConsentPreferences {
        return { ...this.preferences };
    }

    hasConsent(category: string): boolean {
        return this.preferences[category] === true;
    }

    // Still means what it always meant: "is at least one OPTIONAL category
    // granted." Kept for callers (e.g. an analytics init gate) that
    // genuinely want that, not "has the user decided."
    hasAnyConsent(): boolean {
        return Object.entries(this.preferences)
            .filter(([key]) => key !== 'essential')
            .some(([, value]) => value === true);
    }

    setPreferences(preferences: Partial<ConsentPreferences>): void {
        const oldPreferences = { ...this.preferences };
        const cleaned = this.stripUndefined(preferences);

        this.preferences = {
            ...this.preferences,
            ...cleaned,
            essential: true,
        };
        this.savePreferences();
        this.markInteracted();

        const wasGranted = Object.keys(cleaned).some(
            key => oldPreferences[key] === false && this.preferences[key] === true
        );
        const wasRevoked = Object.keys(cleaned).some(
            key => oldPreferences[key] === true && this.preferences[key] === false
        );

        let type: ConsentEvent['type'] = 'updated';
        if (wasGranted && !wasRevoked) {
            type = 'granted';
        } else if (wasRevoked && !wasGranted) {
            type = 'denied';
        }

        const event: ConsentEvent = {
            type,
            preferences: { ...this.preferences },
            timestamp: Date.now(),
        };

        this.eventListeners.forEach(listener => listener(event));
        this.listeners.forEach(listener => listener(this.preferences));
    }

    grantAll(): void {
        this.setPreferences({
            analytics: true,
            marketing: true,
            personalization: true,
        });
    }

    denyAll(): void {
        this.setPreferences({
            analytics: false,
            marketing: false,
            personalization: false,
        });
    }

    reset(): void {
        this.setPreferences(this.getDefaultPreferences());
    }

    isRequired(category: string): boolean {
        return this.requiredCategories.has(category);
    }

    isConsentRequired(): boolean {
        return this.requiredCategories.size > 0;
    }

    addListener(listener: (preferences: ConsentPreferences) => void): () => void {
        this.listeners.add(listener);
        listener(this.preferences);
        return () => this.listeners.delete(listener);
    }

    addEventListener(listener: (event: ConsentEvent) => void): () => void {
        this.eventListeners.add(listener);
        return () => this.eventListeners.delete(listener);
    }

    destroy(): void {
        this.listeners.clear();
        this.eventListeners.clear();
    }
}

let consentManagerInstance: ConsentManager | null = null;

export function getConsentManager(config?: ConsentManagerConfig): ConsentManager {
    if (!consentManagerInstance) {
        consentManagerInstance = new ConsentManager(config);
    }
    return consentManagerInstance;
}

export function resetConsentManager(): void {
    if (consentManagerInstance) {
        consentManagerInstance.destroy();
        consentManagerInstance = null;
    }
}