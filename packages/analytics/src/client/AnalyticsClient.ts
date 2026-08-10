import {
    AnalyticsConfig,
    SessionState,
    QueuedRequest,
    EventData,
    SessionData,
    PageVisitData,
    ClickData
} from '../core/types';
import {
    ANALYTICS_CONSTANTS,
    SESSION_STORAGE_KEYS
} from '../core/constants';
import { generateSessionId, getSessionDuration } from '../core/utils/session';
import { getDeviceInfo } from '../core/utils/device';
import { getGeoInfo } from '../core/utils/geo';
import { ConsentManager, getConsentManager } from './consent/ConsentManager';
import { AnalyticsClientInterface, ClientOptions } from './types';

export class AnalyticsClient implements AnalyticsClientInterface {
    sessionId: string;
    currentPageVisitId: string | null = null;
    currentPageVisitStartTime: number | null = null;
    sessionEnded = false;

    private config: AnalyticsConfig;
    private consentManager: ConsentManager | null = null;
    private requestQueue: QueuedRequest[] = [];
    private criticalQueue: QueuedRequest[] = [];
    private isOnline = true;
    private flushInterval: NodeJS.Timeout | null = null;
    private heartbeatInterval: NodeJS.Timeout | null = null;
    private performanceObserver: PerformanceObserver | null = null;
    private eventBuffer: Array<Record<string, any>> = [];
    private maxBufferSize = ANALYTICS_CONSTANTS.MAX_BUFFER_SIZE;
    private batchFlushTimeout: NodeJS.Timeout | null = null;
    private engagementStartTime: number | null = null;
    private idleTimeout: NodeJS.Timeout | null = null;
    private scrollDepth = 0;
    private maxScrollDepth = 0;

    private sessionState: SessionState;
    private pendingPageVisitEnd = false;
    private isDestroying = false;
    private maxRetries = ANALYTICS_CONSTANTS.MAX_RETRY_ATTEMPTS;
    private backoffMultiplier = ANALYTICS_CONSTANTS.RETRY_BACKOFF_MULTIPLIER;
    private initialRetryDelay = ANALYTICS_CONSTANTS.INITIAL_RETRY_DELAY;
    private sessionHealthCheckInterval: NodeJS.Timeout | null = null;
    private lastSuccessfulRequest = Date.now();
    private consecutiveFailures = 0;
    private pageVisitLock = false;
    private frozenDuration: number | null = null;
    private activeTimeMs = 0;
    private activeSince: number | null = null;
    private interactionCount = 0;
    private errorCount = 0;

    constructor(config: AnalyticsConfig) {
        this.config = {
            maxQueueSize: ANALYTICS_CONSTANTS.MAX_QUEUE_SIZE,
            flushInterval: ANALYTICS_CONSTANTS.DEFAULT_FLUSH_INTERVAL,
            debug: false,
            ...config,
        };

        // Generate or use provided session ID
        this.sessionId = config.sessionId || this.getOrCreateSessionId();

        // Initialize consent manager if needed. IMPORTANT: use the shared
        // singleton (getConsentManager) rather than `new ConsentManager(...)`.
        // AnalyticsProvider and the ConsentBanner also read/write consent
        // through this same singleton — a private instance here would never
        // see consent granted via the banner, since nothing keeps two
        // separate ConsentManager objects in sync automatically. We also
        // translate the public ConsentConfig field names (`required`,
        // `defaults`) into ConsentManagerConfig's (`requiredCategories`,
        // `defaultPreferences`), and pass sessionId so any remote consent
        // sync correlates with this analytics session server-side.
        if (config.consent) {
            this.consentManager = getConsentManager({
                storageKey: config.consent.storageKey,
                requiredCategories: config.consent.required,
                defaultPreferences: config.consent.defaults,
                consentEndpoint: config.consent.consentEndpoint,
                storeRemotely: config.consent.storeRemotely,
                sessionId: this.sessionId,
            });
        }

        // Initialize session state
        this.sessionState = {
            sessionId: this.sessionId,
            startTime: Date.now(),
            lastHeartbeat: Date.now(),
            isActive: true,
            pageVisitId: null,
        };

        if (this.config.debug) {
            console.log('[Analytics] Client initialized:', this.sessionId);
        }

        this.restorePersistedState();
        this.initializeAdvancedFeatures();
        this.resumeActiveTime();

        // Fire the session-start event so the backend creates the
        // analyticsSession row that click/event/page-visit jobs depend on.
        this.trackSession({});
    }

    private getOrCreateSessionId(): string {
        if (typeof sessionStorage === 'undefined') {
            return generateSessionId();
        }

        let sessionId = sessionStorage.getItem(SESSION_STORAGE_KEYS.SESSION_ID);
        if (!sessionId) {
            sessionId = generateSessionId();
            sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_ID, sessionId);
            sessionStorage.setItem(SESSION_STORAGE_KEYS.SESSION_START, Date.now().toString());
            sessionStorage.setItem(SESSION_STORAGE_KEYS.INITIALIZED, 'true');
        }
        return sessionId;
    }

    private restorePersistedState(): void {
        if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;

        try {
            const persistedQueue = localStorage.getItem(
                `${SESSION_STORAGE_KEYS.QUEUE}_${this.sessionId}`
            );
            if (persistedQueue) {
                const parsed = JSON.parse(persistedQueue);
                this.requestQueue = Array.isArray(parsed) ? parsed : [];
                if (this.config.debug) {
                    console.log(`[Analytics] Restored ${this.requestQueue.length} queued requests`);
                }
            }

            const persistedState = sessionStorage.getItem(
                `${SESSION_STORAGE_KEYS.STATE}_${this.sessionId}`
            );
            if (persistedState) {
                const state = JSON.parse(persistedState);
                this.currentPageVisitId = state.pageVisitId || null;
                this.currentPageVisitStartTime = state.pageVisitStartTime || null;
                if (this.config.debug) {
                    console.log('[Analytics] Restored session state');
                }
            }
        } catch (err) {
            console.warn('[Analytics] Failed to restore persisted state:', err);
        }
    }

    private persistState(): void {
        if (typeof localStorage === 'undefined' || typeof sessionStorage === 'undefined') return;

        try {
            localStorage.setItem(
                `${SESSION_STORAGE_KEYS.QUEUE}_${this.sessionId}`,
                JSON.stringify(this.requestQueue.slice(-(this.config.maxQueueSize || 200)))
            );

            sessionStorage.setItem(
                `${SESSION_STORAGE_KEYS.STATE}_${this.sessionId}`,
                JSON.stringify({
                    pageVisitId: this.currentPageVisitId,
                    pageVisitStartTime: this.currentPageVisitStartTime,
                    lastUpdate: Date.now(),
                })
            );
        } catch (err) {
            console.warn('[Analytics] Failed to persist state:', err);
        }
    }

    private initializeAdvancedFeatures(): void {
        if (typeof window === 'undefined') return;

        this.isOnline = navigator.onLine;
        window.addEventListener('online', this.handleOnline);
        window.addEventListener('offline', this.handleOffline);

        this.flushInterval = setInterval(
            () => this.smartFlushQueue(),
            this.config.flushInterval || ANALYTICS_CONSTANTS.DEFAULT_FLUSH_INTERVAL
        );
        this.sessionHealthCheckInterval = setInterval(
            () => this.checkSessionHealth(),
            ANALYTICS_CONSTANTS.SESSION_HEALTH_CHECK_INTERVAL
        );

        this.startEngagementTracking();
        this.initPerformanceMonitoring();
        this.initScrollTracking();

        setInterval(() => this.persistState(), 15000);

        if (this.config.debug) {
            console.log('[Analytics] Advanced features initialized');
        }
    }

    private checkSessionHealth(): void {
        const now = Date.now();
        const timeSinceLastSuccess = now - this.lastSuccessfulRequest;

        if (timeSinceLastSuccess > 300000) {
            console.warn('[Analytics] No successful requests in 5 minutes');
            this.trackEvent('system', window.location.pathname, 'health_check_warning', {
                timeSinceLastSuccess,
                queueSize: this.requestQueue.length,
                consecutiveFailures: this.consecutiveFailures,
            });
        }

        this.sessionState.lastHeartbeat = now;
        this.sessionState.isActive = document.visibilityState === 'visible';
    }

    private handleOnline = (): void => {
        if (this.config.debug) {
            console.log('[Analytics] Connection restored');
        }
        this.isOnline = true;
        this.consecutiveFailures = 0;
        this.smartFlushQueue();
    };

    private handleOffline = (): void => {
        if (this.config.debug) {
            console.log('[Analytics] Connection lost');
        }
        this.isOnline = false;
        this.persistState();
    };

    private addToQueue(
        url: string,
        body: Record<string, any>,
        method: 'POST' | 'PUT' = 'POST',
        priority = 1
    ): void {
        const request: QueuedRequest = {
            url,
            body,
            method,
            timestamp: Date.now(),
            retries: 0,
            priority,
        };

        if (priority >= 3) {
            this.criticalQueue.push(request);
            if (this.criticalQueue.length > ANALYTICS_CONSTANTS.CRITICAL_QUEUE_MAX_SIZE) {
                this.criticalQueue = this.criticalQueue.slice(-ANALYTICS_CONSTANTS.CRITICAL_QUEUE_MAX_SIZE);
            }
        } else {
            this.requestQueue.push(request);
            if (this.requestQueue.length > (this.config.maxQueueSize || 200)) {
                this.requestQueue = this.requestQueue
                    .sort((a, b) => b.priority - a.priority)
                    .slice(0, this.config.maxQueueSize || 200);
            }
        }

        this.persistState();
    }

    private async smartFlushQueue(): Promise<void> {
        if (!this.isOnline || this.isDestroying) return;

        if (this.criticalQueue.length > 0) {
            await this.processCriticalQueue();
        }

        await this.flushQueue();
    }

    private async processCriticalQueue(): Promise<void> {
        if (!this.config.apiBaseUrl || this.criticalQueue.length === 0) return;

        if (this.config.debug) {
            console.log(`[Analytics] Processing ${this.criticalQueue.length} critical requests`);
        }

        const queue = [...this.criticalQueue];
        this.criticalQueue = [];

        for (const req of queue) {
            const success = await this.executeRequest(req);

            if (!success && req.retries < this.maxRetries) {
                const delay = this.initialRetryDelay * Math.pow(this.backoffMultiplier, req.retries);
                setTimeout(() => {
                    this.criticalQueue.push({ ...req, retries: req.retries + 1 });
                }, delay);
            }
        }
    }

    private async flushQueue(): Promise<void> {
        if (!this.isOnline || this.requestQueue.length === 0) return;
        if (!this.config.apiBaseUrl) return;

        if (this.config.debug) {
            console.log(`[Analytics] Flushing ${this.requestQueue.length} queued requests`);
        }

        const queue = [...this.requestQueue].sort((a, b) => {
            if (a.priority !== b.priority) return b.priority - a.priority;
            return a.timestamp - b.timestamp;
        });

        this.requestQueue = [];

        for (const req of queue) {
            const success = await this.executeRequest(req);

            if (!success && req.retries < this.maxRetries) {
                this.requestQueue.push({ ...req, retries: req.retries + 1 });
            }
        }
    }

    private async executeRequest(req: QueuedRequest): Promise<boolean> {
        try {
            const res = await fetch(`${this.config.apiBaseUrl}${req.url}`, {
                method: req.method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req.body),
                signal: AbortSignal.timeout(10000),
            });

            if (res.ok) {
                this.lastSuccessfulRequest = Date.now();
                this.consecutiveFailures = 0;
                return true;
            } else {
                this.consecutiveFailures++;
                console.warn(`[Analytics] Request failed with status ${res.status}`);
                return false;
            }
        } catch (err) {
            this.consecutiveFailures++;
            console.warn('[Analytics] Request error:', err);
            return false;
        }
    }

    private async fetchWithResponse<T>(
        url: string,
        body: Record<string, any>,
        method: 'POST' | 'PUT' = 'POST',
        priority = 2
    ): Promise<T | null> {
        if (!this.config.apiBaseUrl) {
            console.error('[Analytics] apiBaseUrl is not defined');
            return null;
        }

        try {
            const res = await fetch(`${this.config.apiBaseUrl}${url}`, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000),
            });

            if (!res.ok) {
                if (!this.isOnline || res.status >= 500) {
                    this.addToQueue(url, body, method, priority);
                }
                return null;
            }

            this.lastSuccessfulRequest = Date.now();
            this.consecutiveFailures = 0;

            const data = await res.json();
            return data as T;
        } catch (err) {
            console.error('[Analytics] fetchWithResponse error:', err);
            this.addToQueue(url, body, method, priority);
            return null;
        }
    }

    private fireAndForget(
        url: string,
        body: Record<string, any>,
        method: 'POST' | 'PUT' = 'POST',
        priority = 1
    ): void {
        if (!this.config.apiBaseUrl) return;

        if (!this.isOnline || this.consecutiveFailures > 3) {
            this.addToQueue(url, body, method, priority);
            return;
        }

        fetch(`${this.config.apiBaseUrl}${url}`, {
            method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
            keepalive: true,
            signal: AbortSignal.timeout(5000),
        })
            .then(res => {
                if (res.ok) {
                    this.lastSuccessfulRequest = Date.now();
                    this.consecutiveFailures = 0;
                } else {
                    this.consecutiveFailures++;
                    this.addToQueue(url, body, method, priority);
                }
            })
            .catch(() => {
                this.consecutiveFailures++;
                this.addToQueue(url, body, method, priority);
            });
    }

    private sendBeaconOrFetch(
        url: string,
        payload: Record<string, any>,
        fallbackPriority = 1
    ): void {
        if (!this.config.apiBaseUrl) return;

        if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
            const blob = new Blob([JSON.stringify(payload)], { type: 'application/json' });
            const sent = navigator.sendBeacon(`${this.config.apiBaseUrl}${url}`, blob);
            if (sent) return;
        }

        this.fireAndForget(url, payload, 'POST', fallbackPriority);
    }

    private bufferEvent(event: Record<string, any>): void {
        this.eventBuffer.push({
            ...event,
            timestamp: new Date().toISOString(),
        });

        if (this.eventBuffer.length >= this.maxBufferSize) {
            this.flushEventBuffer();
        } else {
            if (this.batchFlushTimeout) {
                clearTimeout(this.batchFlushTimeout);
            }
            this.batchFlushTimeout = setTimeout(
                () => this.flushEventBuffer(),
                ANALYTICS_CONSTANTS.BATCH_FLUSH_TIMEOUT
            );
        }
    }

    private flushEventBuffer(): void {
        if (this.eventBuffer.length === 0) return;

        if (this.config.debug) {
            console.log(`[Analytics] Flushing ${this.eventBuffer.length} buffered events`);
        }

        this.fireAndForget(
            '/api/analytics/event/batch',
            {
                sessionId: this.sessionId,
                events: [...this.eventBuffer],
            },
            'POST',
            1
        );

        this.eventBuffer = [];

        if (this.batchFlushTimeout) {
            clearTimeout(this.batchFlushTimeout);
            this.batchFlushTimeout = null;
        }
    }

    private startEngagementTracking(): void {
        this.engagementStartTime = Date.now();

        this.heartbeatInterval = setInterval(() => {
            if (!this.sessionEnded && document.visibilityState === 'visible') {
                const engagementTime = this.engagementStartTime
                    ? Date.now() - this.engagementStartTime
                    : 0;

                this.trackEvent('engagement', window.location.pathname, 'heartbeat', {
                    engagementTime,
                    activeTime: this.getActiveDuration(),
                    scrollDepth: this.maxScrollDepth,
                    interactions: this.interactionCount,
                    errors: this.errorCount,
                });
            }
        }, 30000);

        this.resetIdleTimer();
        ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
            document.addEventListener(event, this.resetIdleTimer);
        });
    }

    private resetIdleTimer = (): void => {
        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
        }

        this.idleTimeout = setTimeout(() => {
            this.trackEvent('engagement', window.location.pathname, 'user_idle', {
                idleTime: 300000,
            });
        }, 300000);
    };

    private pauseActiveTime(): void {
        if (this.activeSince !== null) {
            this.activeTimeMs += Date.now() - this.activeSince;
            this.activeSince = null;
        }
    }

    private resumeActiveTime(): void {
        if (this.activeSince === null) {
            this.activeSince = Date.now();
        }
    }

    getActiveDuration(): number {
        const running = this.activeSince !== null ? Date.now() - this.activeSince : 0;
        return this.activeTimeMs + running;
    }

    private initScrollTracking(): void {
        let ticking = false;

        const updateScrollDepth = () => {
            const windowHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            this.scrollDepth = Math.round(
                ((scrollTop + windowHeight) / documentHeight) * 100
            );

            if (this.scrollDepth > this.maxScrollDepth) {
                this.maxScrollDepth = this.scrollDepth;

                if ([25, 50, 75, 90, 100].includes(this.maxScrollDepth)) {
                    this.trackEvent('engagement', window.location.pathname, 'scroll_depth', {
                        depth: this.maxScrollDepth,
                    });
                }
            }

            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (!ticking) {
                window.requestAnimationFrame(updateScrollDepth);
                ticking = true;
            }
        });
    }

    private initPerformanceMonitoring(): void {
        if (typeof window === 'undefined' || !window.PerformanceObserver) return;

        try {
            const lcpObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                const lastEntry = entries[entries.length - 1] as any;

                this.trackEvent('performance', window.location.pathname, 'lcp', {
                    value: lastEntry.renderTime || lastEntry.loadTime,
                });
            });
            lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });

            const fidObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                entries.forEach((entry: any) => {
                    this.trackEvent('performance', window.location.pathname, 'fid', {
                        value: entry.processingStart - entry.startTime,
                    });
                });
            });
            fidObserver.observe({ entryTypes: ['first-input'] });

            let clsValue = 0;
            const clsObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries() as any[]) {
                    if (!entry.hadRecentInput) {
                        clsValue += entry.value;
                    }
                }
            });
            clsObserver.observe({ entryTypes: ['layout-shift'] });

            document.addEventListener('visibilitychange', () => {
                if (document.visibilityState === 'hidden' && clsValue > 0) {
                    this.trackEvent('performance', window.location.pathname, 'cls', {
                        value: clsValue,
                    });
                }
            });

            this.performanceObserver = lcpObserver;
        } catch (err) {
            console.warn('[Analytics] Performance monitoring failed:', err);
        }
    }

    // Public API Methods

    trackSession(data: any): void {
        if (!this.sessionId) {
            console.warn('[Analytics] trackSession: missing sessionId, skipping');
            return;
        }

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping session tracking due to consent');
            }
            return;
        }

        const sessionData: SessionData = {
            sessionId: this.sessionId,
            duration: data.duration || 0,
            ...data,
        };

        this.fireAndForget(
            '/api/analytics/session',
            sessionData,
            'POST',
            2
        );
    }

    startPageVisit(): void {
        this.currentPageVisitStartTime = Date.now();
        this.maxScrollDepth = 0;
        this.frozenDuration = null;
        this.interactionCount = 0;
        this.errorCount = 0;
        this.persistState();
    }

    freezeDuration(): void {
        if (this.currentPageVisitStartTime) {
            this.frozenDuration = Date.now() - this.currentPageVisitStartTime;
            if (this.config.debug) {
                console.log('[Analytics] Duration frozen at:', this.frozenDuration);
            }
        }
    }

    unfreezeDuration(): void {
        this.frozenDuration = null;
        if (this.config.debug) {
            console.log('[Analytics] Duration unfrozen');
        }
    }

    getCurrentPageDuration(): number | null {
        if (this.frozenDuration !== null) {
            return this.frozenDuration;
        }

        if (!this.currentPageVisitStartTime) return null;
        return Date.now() - this.currentPageVisitStartTime;
    }

    async trackPageVisitStart(path: string, query?: string): Promise<void> {
        if (this.currentPageVisitId) {
            if (this.config.debug) {
                console.warn('[Analytics] Page visit already active, skipping:', this.currentPageVisitId);
            }
            return;
        }

        let waitCount = 0;
        while (this.pageVisitLock && waitCount < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }

        if (this.pageVisitLock) {
            console.error('[Analytics] Page visit lock timeout - operation took too long');
            return;
        }

        if (this.currentPageVisitId) {
            console.warn('[Analytics] Page visit created while waiting, skipping');
            return;
        }

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping page visit tracking due to consent');
            }
            return;
        }

        this.pageVisitLock = true;

        try {
            const pageVisitId = crypto.randomUUID?.() || Date.now().toString(36);

            const requestBody: PageVisitData = {
                id: pageVisitId,
                sessionId: this.sessionId,
                path,
                query,
                startTime: new Date().toISOString(),
            };

            await this.fetchWithResponse(
                '/api/analytics/page-visit',
                requestBody,
                'POST',
                2
            );

            this.currentPageVisitId = pageVisitId;
            this.sessionState.pageVisitId = pageVisitId;
            this.startPageVisit();

            if (this.config.debug) {
                console.log('[Analytics] Page visit started:', this.currentPageVisitId);
            }
        } catch (error) {
            console.error('[Analytics] trackPageVisitStart error:', error);
        } finally {
            this.pageVisitLock = false;
        }
    }

    async trackPageVisitEnd(url: string, query?: string): Promise<void> {
        if (!this.currentPageVisitId) {
            if (this.config.debug) {
                console.warn('[Analytics] No currentPageVisitId, nothing to end');
            }
            return;
        }

        if (this.pendingPageVisitEnd) {
            if (this.config.debug) {
                console.warn('[Analytics] Page visit end already in progress');
            }
            return;
        }

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping page visit end tracking due to consent');
            }
            this.currentPageVisitId = null;
            this.currentPageVisitStartTime = null;
            this.sessionState.pageVisitId = null;
            this.frozenDuration = null;
            this.persistState();
            return;
        }

        this.freezeDuration();

        let waitCount = 0;
        while (this.pageVisitLock && waitCount < 10) {
            await new Promise(resolve => setTimeout(resolve, 100));
            waitCount++;
        }

        this.pageVisitLock = true;
        this.pendingPageVisitEnd = true;

        const visitId = this.currentPageVisitId;
        const duration = this.getCurrentPageDuration() || 0;

        try {
            const payload = {
                id: visitId,
                url,
                query: query || undefined,
                endTime: new Date().toISOString(),
                duration,
                scrollDepth: this.maxScrollDepth,
                final: true,
            };

            this.sendBeaconOrFetch('/api/analytics/page-visit/end', payload, 3);

            this.currentPageVisitId = null;
            this.currentPageVisitStartTime = null;
            this.sessionState.pageVisitId = null;
            this.frozenDuration = null;
            this.persistState();

            if (this.config.debug) {
                console.log('[Analytics] Page visit ended:', visitId);
            }
        } catch (err) {
            console.error('[Analytics] Error in trackPageVisitEnd:', err);

            this.currentPageVisitId = null;
            this.currentPageVisitStartTime = null;
            this.sessionState.pageVisitId = null;
            this.frozenDuration = null;
            this.persistState();
        } finally {
            this.pendingPageVisitEnd = false;
            this.pageVisitLock = false;
        }
    }

    checkpointPageVisit(): void {
        if (!this.currentPageVisitId) return;

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            return;
        }

        const payload = {
            id: this.currentPageVisitId,
            duration: this.getCurrentPageDuration() || 0,
            scrollDepth: this.maxScrollDepth,
            final: false,
        };

        this.sendBeaconOrFetch('/api/analytics/page-visit/end', payload, 1);
    }

    private trackSessionEndBeacon(duration: number): void {
        if (this.sessionEnded) return;

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping session end tracking due to consent');
            }
            this.sessionEnded = true;
            return;
        }

        this.sendBeaconOrFetch('/api/analytics/session', {
            sessionId: this.sessionId,
            duration,
        }, 3);

        this.sessionEnded = true;
    }

    // Visibility / Lifecycle Hooks

    onVisibilityHidden(): void {
        this.pauseActiveTime();
        this.flushEventBuffer();
        this.checkpointPageVisit();
        this.sessionState.isActive = false;
    }

    onVisibilityVisible(): void {
        this.resumeActiveTime();
        this.sessionState.isActive = true;
    }

    onPageHide(persisted: boolean): void {
        if (persisted) {
            this.pauseActiveTime();
            return;
        }

        void this.trackPageVisitEnd(window.location.pathname);

        const start = sessionStorage.getItem(SESSION_STORAGE_KEYS.SESSION_START);
        const duration = start ? getSessionDuration(Number(start)) : 0;
        this.trackSessionEndBeacon(duration);
    }

    onPageShow(persisted: boolean): void {
        if (persisted) {
            this.resumeActiveTime();
            this.trackEvent('engagement', window.location.pathname, 'bfcache_restore');
        }
    }

    trackSessionEnd(data: { duration?: number; pathname?: string }): void {
        if (this.sessionEnded) {
            if (this.config.debug) {
                console.log('[Analytics] Session already ended, skipping');
            }
            return;
        }

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping session end tracking due to consent');
            }
            this.sessionEnded = true;
            return;
        }

        this.sessionEnded = true;
        this.flushEventBuffer();

        this.addToQueue('/api/analytics/session', {
            sessionId: this.sessionId,
            duration: data.duration,
        }, 'POST', 3);

        this.addToQueue('/api/analytics/event', {
            sessionId: this.sessionId,
            type: 'session_end',
            url: data.pathname || window.location.pathname,
            data: {
                duration: data.duration,
                activeTime: this.getActiveDuration(),
                maxScrollDepth: this.maxScrollDepth,
                interactions: this.interactionCount,
                errors: this.errorCount,
            },
            timestamp: new Date().toISOString(),
        }, 'POST', 3);

        this.sessionState.isActive = false;
        this.persistState();

        void this.processCriticalQueue();
    }

    trackEvent(type: string, url: string, element?: string, data?: any): void {
        if (!this.sessionId) {
            console.warn('[Analytics] trackEvent: missing sessionId, skipping');
            return;
        }

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping event tracking due to consent');
            }
            return;
        }

        const eventData: EventData = {
            sessionId: this.sessionId,
            type,
            url,
            element: element ?? null,
            data: data ?? null,
        };

        if (type === 'error') {
            this.errorCount++;
        }

        if (['click', 'form_submit', 'conversion'].includes(type)) {
            this.interactionCount++;
        }

        if (['engagement', 'performance'].includes(type)) {
            this.bufferEvent(eventData);
        } else {
            this.fireAndForget(
                '/api/analytics/event',
                eventData,
                'POST',
                type === 'error' ? 2 : 1
            );
        }
    }

    trackClick(path: string, element: string): void {
        if (!this.sessionId) {
            console.warn('[Analytics] trackClick: missing sessionId, skipping');
            return;
        }

        if (this.consentManager && !this.consentManager.hasConsent('analytics')) {
            if (this.config.debug) {
                console.log('[Analytics] Skipping click tracking due to consent');
            }
            return;
        }

        const clickData: ClickData = {
            sessionId: this.sessionId,
            path,
            element,
            timestamp: new Date().toISOString(),
        };

        this.interactionCount++;
        this.fireAndForget('/api/analytics/click', clickData, 'POST', 0);
    }

    trackError(error: Error | string, context?: Record<string, any>): void {
        const errorData = typeof error === 'string'
            ? { message: error }
            : {
                message: error.message,
                stack: error.stack,
                name: error.name,
            };

        this.trackEvent('error', window.location.pathname, 'client_error', {
            ...errorData,
            ...context,
        });
    }

    trackConversion(conversionType: string, value?: number, metadata?: Record<string, any>): void {
        this.trackEvent('conversion', window.location.pathname, conversionType, {
            value,
            ...metadata,
        });
    }

    trackFormSubmit(formName: string, success: boolean, data?: Record<string, any>): void {
        this.trackEvent('form', window.location.pathname, formName, {
            success,
            ...data,
        });
    }

    async destroy(): Promise<void> {
        if (this.isDestroying) {
            if (this.config.debug) {
                console.log('[Analytics] Already destroying, skipping');
            }
            return;
        }

        this.isDestroying = true;
        if (this.config.debug) {
            console.log('[Analytics] Destroying client');
        }

        if (this.currentPageVisitId && !this.pendingPageVisitEnd) {
            await this.trackPageVisitEnd(window.location.pathname);
        }

        if (!this.sessionEnded) {
            const start = sessionStorage.getItem(SESSION_STORAGE_KEYS.SESSION_START);
            const duration = start ? getSessionDuration(Number(start)) : 0;

            this.trackSessionEnd({
                duration,
                pathname: window.location.pathname,
            });
        }

        this.flushEventBuffer();
        await this.smartFlushQueue();

        await new Promise(resolve => setTimeout(resolve, 500));

        if (this.flushInterval) {
            clearInterval(this.flushInterval);
            this.flushInterval = null;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }

        if (this.sessionHealthCheckInterval) {
            clearInterval(this.sessionHealthCheckInterval);
            this.sessionHealthCheckInterval = null;
        }

        if (this.batchFlushTimeout) {
            clearTimeout(this.batchFlushTimeout);
            this.batchFlushTimeout = null;
        }

        if (this.idleTimeout) {
            clearTimeout(this.idleTimeout);
            this.idleTimeout = null;
        }

        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
            this.performanceObserver = null;
        }

        // Do NOT call this.consentManager.destroy() here — it's the shared
        // singleton (see constructor comment above). Destroying it would
        // clear listeners that AnalyticsProvider and ConsentBanner still
        // depend on, even though only this client instance is going away.
        this.consentManager = null;

        if (typeof window !== 'undefined') {
            window.removeEventListener('online', this.handleOnline);
            window.removeEventListener('offline', this.handleOffline);

            ['mousedown', 'keydown', 'scroll', 'touchstart'].forEach(event => {
                document.removeEventListener(event, this.resetIdleTimer);
            });
        }

        this.persistState();

        this.requestQueue = [];
        this.criticalQueue = [];
        this.eventBuffer = [];

        if (this.config.debug) {
            console.log('[Analytics] Client destroyed successfully');
        }
    }
}