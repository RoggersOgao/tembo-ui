// "use client";

// interface QueuedRequest {
//     url: string;
//     body: Record<string, any>;
//     method: "POST" | "PUT";
//     timestamp: number;
//     retries: number;
//     priority: number;
// }

// interface SessionState {
//     sessionId: string;
//     startTime: number;
//     lastHeartbeat: number;
//     isActive: boolean;
//     pageVisitId: string | null;
// }

// export default class AnalyticsClient {
//     sessionId: string;
//     currentPageVisitId: string | null = null;
//     currentPageVisitStartTime: number | null = null;
//     sessionEnded = false;

//     // Advanced features
//     private requestQueue: QueuedRequest[] = [];
//     private criticalQueue: QueuedRequest[] = [];
//     private isOnline = true;
//     private flushInterval: NodeJS.Timeout | null = null;
//     private heartbeatInterval: NodeJS.Timeout | null = null;
//     private performanceObserver: PerformanceObserver | null = null;
//     private eventBuffer: Array<Record<string, any>> = [];
//     private maxBufferSize = 10;
//     private batchFlushTimeout: NodeJS.Timeout | null = null;
//     private engagementStartTime: number | null = null;
//     private idleTimeout: NodeJS.Timeout | null = null;
//     private scrollDepth = 0;
//     private maxScrollDepth = 0;

//     // Enhanced state management
//     private sessionState: SessionState;
//     private pendingPageVisitEnd: boolean = false;
//     private isDestroying: boolean = false;
//     private maxRetries = 5;
//     private backoffMultiplier = 2;
//     private initialRetryDelay = 1000;
//     private sessionHealthCheckInterval: NodeJS.Timeout | null = null;
//     private lastSuccessfulRequest: number = Date.now();
//     private consecutiveFailures = 0;
//     private pageVisitLock: boolean = false;

//     // Prevent duration tracking during manual navigation
//     private frozenDuration: number | null = null;

//     // NEW: active (foreground/engaged) time, distinct from raw wall-clock duration.
//     // Accrues only while document.visibilityState === "visible".
//     private activeTimeMs = 0;
//     private activeSince: number | null = null;

//     constructor(sessionId: string) {
//         this.sessionId = sessionId;

//         this.sessionState = {
//             sessionId,
//             startTime: Date.now(),
//             lastHeartbeat: Date.now(),
//             isActive: true,
//             pageVisitId: null
//         };

//         console.log("🔹 [Analytics] Client initialized:", sessionId);

//         this.restorePersistedState();
//         this.initializeAdvancedFeatures();

//         // Start counting active time immediately; the page is presumed
//         // visible until told otherwise via onVisibilityHidden().
//         this.resumeActiveTime();
//     }

//     /* ------------------------------
//        State Persistence
//     ------------------------------ */
//     private restorePersistedState() {
//         try {
//             const persistedQueue = localStorage.getItem(`analytics_queue_${this.sessionId}`);
//             if (persistedQueue) {
//                 const parsed = JSON.parse(persistedQueue);
//                 this.requestQueue = Array.isArray(parsed) ? parsed : [];
//                 console.log(`🔹 [Analytics] Restored ${this.requestQueue.length} queued requests`);
//             }

//             const persistedState = sessionStorage.getItem(`analytics_state_${this.sessionId}`);
//             if (persistedState) {
//                 const state = JSON.parse(persistedState);
//                 this.currentPageVisitId = state.pageVisitId || null;
//                 this.currentPageVisitStartTime = state.pageVisitStartTime || null;
//                 console.log("🔹 [Analytics] Restored session state");
//             }
//         } catch (err) {
//             console.warn("🔹 [Analytics] Failed to restore persisted state:", err);
//         }
//     }

//     private persistState() {
//         try {
//             localStorage.setItem(
//                 `analytics_queue_${this.sessionId}`,
//                 JSON.stringify(this.requestQueue.slice(-100))
//             );

//             sessionStorage.setItem(
//                 `analytics_state_${this.sessionId}`,
//                 JSON.stringify({
//                     pageVisitId: this.currentPageVisitId,
//                     pageVisitStartTime: this.currentPageVisitStartTime,
//                     lastUpdate: Date.now()
//                 })
//             );
//         } catch (err) {
//             console.warn("🔹 [Analytics] Failed to persist state:", err);
//         }
//     }

//     /* ------------------------------
//        Initialization
//     ------------------------------ */
//     private initializeAdvancedFeatures() {
//         if (typeof window === "undefined") return;

//         this.isOnline = navigator.onLine;
//         window.addEventListener("online", this.handleOnline);
//         window.addEventListener("offline", this.handleOffline);

//         this.flushInterval = setInterval(() => this.smartFlushQueue(), 30000);
//         this.sessionHealthCheckInterval = setInterval(() => this.checkSessionHealth(), 60000);

//         this.startEngagementTracking();
//         this.initPerformanceMonitoring();
//         this.initScrollTracking();

//         setInterval(() => this.persistState(), 15000);

//         console.log("🔹 [Analytics] Advanced features initialized");
//     }

//     /* ------------------------------
//        Session Health Check
//     ------------------------------ */
//     private checkSessionHealth() {
//         const now = Date.now();
//         const timeSinceLastSuccess = now - this.lastSuccessfulRequest;

//         if (timeSinceLastSuccess > 300000) {
//             console.warn("🔹 [Analytics] No successful requests in 5 minutes");
//             this.trackEvent("system", window.location.pathname, "health_check_warning", {
//                 timeSinceLastSuccess,
//                 queueSize: this.requestQueue.length,
//                 consecutiveFailures: this.consecutiveFailures
//             });
//         }

//         this.sessionState.lastHeartbeat = now;
//         this.sessionState.isActive = document.visibilityState === "visible";
//     }

//     /* ------------------------------
//        Network Status Handlers
//     ------------------------------ */
//     private handleOnline = () => {
//         console.log("🔹 [Analytics] Connection restored");
//         this.isOnline = true;
//         this.consecutiveFailures = 0;
//         this.smartFlushQueue();
//     };

//     private handleOffline = () => {
//         console.log("🔹 [Analytics] Connection lost");
//         this.isOnline = false;
//         this.persistState();
//     };

//     /* ------------------------------
//        Request Queue Management
//     ------------------------------ */
//     private addToQueue(
//         url: string,
//         body: Record<string, any>,
//         method: "POST" | "PUT" = "POST",
//         priority: number = 1
//     ) {
//         const request: QueuedRequest = {
//             url,
//             body,
//             method,
//             timestamp: Date.now(),
//             retries: 0,
//             priority
//         };

//         if (priority >= 3) {
//             this.criticalQueue.push(request);
//         } else {
//             this.requestQueue.push(request);
//         }

//         if (this.requestQueue.length > 200) {
//             this.requestQueue = this.requestQueue
//                 .sort((a, b) => b.priority - a.priority)
//                 .slice(0, 200);
//         }

//         if (this.criticalQueue.length > 50) {
//             this.criticalQueue = this.criticalQueue.slice(-50);
//         }

//         this.persistState();
//     }

//     private async smartFlushQueue() {
//         if (!this.isOnline) return;
//         if (this.isDestroying) return;

//         if (this.criticalQueue.length > 0) {
//             await this.processCriticalQueue();
//         }

//         await this.flushQueue();
//     }

//     private async processCriticalQueue() {
//         const base = process.env.NEXT_PUBLIC_API_BASE_URL;
//         if (!base || this.criticalQueue.length === 0) return;

//         console.log(`🔹 [Analytics] Processing ${this.criticalQueue.length} critical requests`);

//         const queue = [...this.criticalQueue];
//         this.criticalQueue = [];

//         for (const req of queue) {
//             const success = await this.executeRequest(req, base);

//             if (!success && req.retries < this.maxRetries) {
//                 const delay = this.initialRetryDelay * Math.pow(this.backoffMultiplier, req.retries);

//                 setTimeout(() => {
//                     this.criticalQueue.push({ ...req, retries: req.retries + 1 });
//                 }, delay);
//             }
//         }
//     }

//     private async flushQueue() {
//         if (!this.isOnline || this.requestQueue.length === 0) return;

//         const base = process.env.NEXT_PUBLIC_API_BASE_URL;
//         if (!base) return;

//         console.log(`🔹 [Analytics] Flushing ${this.requestQueue.length} queued requests`);

//         const queue = [...this.requestQueue].sort((a, b) => {
//             if (a.priority !== b.priority) return b.priority - a.priority;
//             return a.timestamp - b.timestamp;
//         });

//         this.requestQueue = [];

//         for (const req of queue) {
//             const success = await this.executeRequest(req, base);

//             if (!success && req.retries < this.maxRetries) {
//                 this.requestQueue.push({ ...req, retries: req.retries + 1 });
//             }
//         }
//     }

//     private async executeRequest(req: QueuedRequest, base: string): Promise<boolean> {
//         try {
//             const res = await fetch(`${base}${req.url}`, {
//                 method: req.method,
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify(req.body),
//                 signal: AbortSignal.timeout(10000)
//             });

//             if (res.ok) {
//                 this.lastSuccessfulRequest = Date.now();
//                 this.consecutiveFailures = 0;
//                 return true;
//             } else {
//                 this.consecutiveFailures++;
//                 console.warn(`🔹 [Analytics] Request failed with status ${res.status}`);
//                 return false;
//             }
//         } catch (err) {
//             this.consecutiveFailures++;
//             console.warn("🔹 [Analytics] Request error:", err);
//             return false;
//         }
//     }

//     /* ------------------------------
//        Internal Helpers
//     ------------------------------ */
//     private async fetchWithResponse<T>(
//         url: string,
//         body: Record<string, any>,
//         method: "POST" | "PUT" = "POST",
//         priority: number = 2
//     ): Promise<T | null> {
//         const base = process.env.NEXT_PUBLIC_API_BASE_URL;
//         if (!base) {
//             console.error("🔹 [Analytics] NEXT_PUBLIC_API_BASE_URL is not defined");
//             return null;
//         }

//         const finalUrl = `${base}${url}`;

//         try {
//             const res = await fetch(finalUrl, {
//                 method,
//                 headers: { "Content-Type": "application/json" },
//                 body: JSON.stringify(body),
//                 signal: AbortSignal.timeout(10000)
//             });

//             if (!res.ok) {
//                 const errorText = await res.text().catch(() => "Unable to read error");
//                 console.log("🔹 fetchWithResponse failed:", res.status, errorText);

//                 if (!this.isOnline || res.status >= 500) {
//                     this.addToQueue(url, body, method, priority);
//                 }
//                 return null;
//             }

//             this.lastSuccessfulRequest = Date.now();
//             this.consecutiveFailures = 0;

//             const data = await res.json();
//             return data as T;
//         } catch (err) {
//             console.error("🔹 [Analytics] fetchWithResponse error:", err);
//             this.addToQueue(url, body, method, priority);
//             return null;
//         }
//     }

//     private fireAndForget(
//         url: string,
//         body: Record<string, any>,
//         method: "POST" | "PUT" = "POST",
//         priority: number = 1
//     ) {
//         const base = process.env.NEXT_PUBLIC_API_BASE_URL;
//         if (!base) return;

//         if (!this.isOnline || this.consecutiveFailures > 3) {
//             this.addToQueue(url, body, method, priority);
//             return;
//         }

//         fetch(`${base}${url}`, {
//             method,
//             headers: { "Content-Type": "application/json" },
//             body: JSON.stringify(body),
//             keepalive: true,
//             signal: AbortSignal.timeout(5000)
//         })
//             .then(res => {
//                 if (res.ok) {
//                     this.lastSuccessfulRequest = Date.now();
//                     this.consecutiveFailures = 0;
//                 } else {
//                     this.consecutiveFailures++;
//                     this.addToQueue(url, body, method, priority);
//                 }
//             })
//             .catch((err) => {
//                 console.warn("🔹 [Analytics] fireAndForget failed:", err);
//                 this.consecutiveFailures++;
//                 this.addToQueue(url, body, method, priority);
//             });
//     }

//     /** Beacon send with a fetch fallback for when sendBeacon is unavailable or fails to enqueue. */
//     private sendBeaconOrFetch(url: string, payload: Record<string, any>, fallbackPriority: number) {
//         const base = process.env.NEXT_PUBLIC_API_BASE_URL;
//         if (!base) return;

//         if (typeof navigator !== "undefined" && navigator.sendBeacon) {
//             const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
//             const sent = navigator.sendBeacon(`${base}${url}`, blob);
//             if (sent) return;
//         }

//         // Fallback: fire-and-forget fetch with keepalive so it can survive unload.
//         this.fireAndForget(url, payload, "POST", fallbackPriority);
//     }

//     /* ------------------------------
//        Event Batching
//     ------------------------------ */
//     private bufferEvent(event: Record<string, any>) {
//         this.eventBuffer.push({
//             ...event,
//             timestamp: new Date().toISOString(),
//         });

//         if (this.eventBuffer.length >= this.maxBufferSize) {
//             this.flushEventBuffer();
//         } else {
//             if (this.batchFlushTimeout) {
//                 clearTimeout(this.batchFlushTimeout);
//             }
//             this.batchFlushTimeout = setTimeout(() => this.flushEventBuffer(), 5000);
//         }
//     }

//     flushEventBuffer() {
//         if (this.eventBuffer.length === 0) return;

//         console.log(`🔹 [Analytics] Flushing ${this.eventBuffer.length} buffered events`);

//         this.fireAndForget("/api/analytics/event/batch", {
//             sessionId: this.sessionId,
//             events: [...this.eventBuffer],
//         }, "POST", 1);

//         this.eventBuffer = [];

//         if (this.batchFlushTimeout) {
//             clearTimeout(this.batchFlushTimeout);
//             this.batchFlushTimeout = null;
//         }
//     }

//     /* ------------------------------
//        Engagement Tracking
//     ------------------------------ */
//     private startEngagementTracking() {
//         this.engagementStartTime = Date.now();

//         this.heartbeatInterval = setInterval(() => {
//             if (!this.sessionEnded && document.visibilityState === "visible") {
//                 const engagementTime = this.engagementStartTime
//                     ? Date.now() - this.engagementStartTime
//                     : 0;

//                 this.trackEvent("engagement", window.location.pathname, "heartbeat", {
//                     engagementTime,
//                     activeTime: this.getActiveDuration(),
//                     scrollDepth: this.maxScrollDepth,
//                 });
//             }
//         }, 30000);

//         this.resetIdleTimer();
//         ["mousedown", "keydown", "scroll", "touchstart"].forEach(event => {
//             document.addEventListener(event, this.resetIdleTimer);
//         });
//     }

//     private resetIdleTimer = () => {
//         if (this.idleTimeout) {
//             clearTimeout(this.idleTimeout);
//         }

//         this.idleTimeout = setTimeout(() => {
//             this.trackEvent("engagement", window.location.pathname, "user_idle", {
//                 idleTime: 300000,
//             });
//         }, 300000);
//     };

//     /* ------------------------------
//        Active-time Tracking (NEW)

//        Wall-clock "duration" (currentPageVisitStartTime → now) includes time
//        the tab spent backgrounded. "Active time" only counts time the page
//        was actually visible/foregrounded — a much better engagement signal.
//     ------------------------------ */
//     private pauseActiveTime() {
//         if (this.activeSince !== null) {
//             this.activeTimeMs += Date.now() - this.activeSince;
//             this.activeSince = null;
//         }
//     }

//     private resumeActiveTime() {
//         if (this.activeSince === null) {
//             this.activeSince = Date.now();
//         }
//     }

//     getActiveDuration(): number {
//         const running = this.activeSince !== null ? Date.now() - this.activeSince : 0;
//         return this.activeTimeMs + running;
//     }

//     /* ------------------------------
//        Scroll Depth Tracking
//     ------------------------------ */
//     private initScrollTracking() {
//         let ticking = false;

//         const updateScrollDepth = () => {
//             const windowHeight = window.innerHeight;
//             const documentHeight = document.documentElement.scrollHeight;
//             const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

//             this.scrollDepth = Math.round(
//                 ((scrollTop + windowHeight) / documentHeight) * 100
//             );

//             if (this.scrollDepth > this.maxScrollDepth) {
//                 this.maxScrollDepth = this.scrollDepth;

//                 if ([25, 50, 75, 90, 100].includes(this.maxScrollDepth)) {
//                     this.trackEvent("engagement", window.location.pathname, "scroll_depth", {
//                         depth: this.maxScrollDepth,
//                     });
//                 }
//             }

//             ticking = false;
//         };

//         window.addEventListener("scroll", () => {
//             if (!ticking) {
//                 window.requestAnimationFrame(updateScrollDepth);
//                 ticking = true;
//             }
//         });
//     }

//     /* ------------------------------
//        Performance Monitoring
//     ------------------------------ */
//     private initPerformanceMonitoring() {
//         if (typeof window === "undefined" || !window.PerformanceObserver) return;

//         try {
//             const lcpObserver = new PerformanceObserver((list) => {
//                 const entries = list.getEntries();
//                 const lastEntry = entries[entries.length - 1] as any;

//                 this.trackEvent("performance", window.location.pathname, "lcp", {
//                     value: lastEntry.renderTime || lastEntry.loadTime,
//                 });
//             });
//             lcpObserver.observe({ entryTypes: ["largest-contentful-paint"] });

//             const fidObserver = new PerformanceObserver((list) => {
//                 const entries = list.getEntries();
//                 entries.forEach((entry: any) => {
//                     this.trackEvent("performance", window.location.pathname, "fid", {
//                         value: entry.processingStart - entry.startTime,
//                     });
//                 });
//             });
//             fidObserver.observe({ entryTypes: ["first-input"] });

//             let clsValue = 0;
//             const clsObserver = new PerformanceObserver((list) => {
//                 for (const entry of list.getEntries() as any[]) {
//                     if (!entry.hadRecentInput) {
//                         clsValue += entry.value;
//                     }
//                 }
//             });
//             clsObserver.observe({ entryTypes: ["layout-shift"] });

//             document.addEventListener("visibilitychange", () => {
//                 if (document.visibilityState === "hidden" && clsValue > 0) {
//                     this.trackEvent("performance", window.location.pathname, "cls", {
//                         value: clsValue,
//                     });
//                 }
//             });

//             this.performanceObserver = lcpObserver;
//         } catch (err) {
//             console.warn("🔹 [Analytics] Performance monitoring failed:", err);
//         }
//     }

//     /* ------------------------------
//        Core Tracking Methods
//     ------------------------------ */
//     trackSession(data: any) {
//         if (!this.sessionId) {
//             console.warn("🔹 [Analytics] trackSession: missing sessionId, skipping");
//             return;
//         }

//         this.fireAndForget("/api/analytics/session", {
//             sessionId: this.sessionId,
//             ...data,
//         }, "POST", 2);
//     }

//     startPageVisit() {
//         this.currentPageVisitStartTime = Date.now();
//         this.maxScrollDepth = 0;
//         this.frozenDuration = null;
//         this.persistState();
//     }

//     freezeDuration() {
//         if (this.currentPageVisitStartTime) {
//             this.frozenDuration = Date.now() - this.currentPageVisitStartTime;
//             console.log("🔹 Duration frozen at:", this.frozenDuration);
//         }
//     }

//     unfreezeDuration() {
//         this.frozenDuration = null;
//         console.log("🔹 Duration unfrozen");
//     }

//     getCurrentPageDuration(): number | null {
//         if (this.frozenDuration !== null) {
//             return this.frozenDuration;
//         }

//         if (!this.currentPageVisitStartTime) return null;
//         return Date.now() - this.currentPageVisitStartTime;
//     }

//     async trackPageVisitStart(path: string, query?: string) {
//         if (this.currentPageVisitId) {
//             console.warn("[!] Page visit already active, skipping:", this.currentPageVisitId);
//             return;
//         }

//         let waitCount = 0;
//         while (this.pageVisitLock && waitCount < 10) {
//             await new Promise(resolve => setTimeout(resolve, 100));
//             waitCount++;
//         }

//         if (this.pageVisitLock) {
//             console.error("Page visit lock timeout - operation took too long");
//             return;
//         }

//         if (this.currentPageVisitId) {
//             console.warn("[!] Page visit created while waiting, skipping");
//             return;
//         }

//         this.pageVisitLock = true;

//         try {
//             // Generate the page visit id client-side now, since the server
//             // returns 202-with-queued-job instead of a synchronous DB id.
//             const pageVisitId = crypto.randomUUID();

//             const requestBody = {
//                 id: pageVisitId,
//                 sessionId: this.sessionId,
//                 path,
//                 query,
//                 startTime: new Date().toISOString(),
//             };

//             const response = await this.fetchWithResponse<{
//                 message: string;
//                 data: { id: string };
//             }>("/api/analytics/page-visit", requestBody, "POST", 2);

//             if (!response) {
//                 // Request never reached the server (queued for retry via
//                 // fetchWithResponse's own offline handling) — still adopt the id
//                 // locally so trackPageVisitEnd has something to reference once
//                 // the queued request eventually lands.
//             }

//             this.currentPageVisitId = pageVisitId;
//             this.sessionState.pageVisitId = pageVisitId;
//             this.startPageVisit();
//             console.log("🔹 [Analytics] Page visit started:", this.currentPageVisitId);
//         } catch (error) {
//             console.error("trackPageVisitStart error:", error);
//         } finally {
//             this.pageVisitLock = false;
//         }
//     }

//     /**
//      * Ends the current page visit. This is the DEFINITIVE close (sets
//      * endTime server-side) — call it on real navigation, unmount, or a
//      * genuine unload (pagehide with persisted === false). Not for
//      * visibilitychange; use checkpointPageVisit() for that instead.
//      */
//     async trackPageVisitEnd(url: string, query?: string) {
//         if (!this.currentPageVisitId) {
//             console.warn("[!] No currentPageVisitId, nothing to end");
//             return;
//         }

//         if (this.pendingPageVisitEnd) {
//             console.warn("[!] Page visit end already in progress");
//             return;
//         }

//         this.freezeDuration();

//         let waitCount = 0;
//         while (this.pageVisitLock && waitCount < 10) {
//             await new Promise(resolve => setTimeout(resolve, 100));
//             waitCount++;
//         }

//         this.pageVisitLock = true;
//         this.pendingPageVisitEnd = true;

//         const visitId = this.currentPageVisitId;
//         const duration = this.getCurrentPageDuration() || 0;

//         try {
//             const payload = {
//                 id: visitId,
//                 url,
//                 query: query || undefined,
//                 endTime: new Date().toISOString(),
//                 duration,
//                 scrollDepth: this.maxScrollDepth,
//                 final: true,
//             };

//             const base = process.env.NEXT_PUBLIC_API_BASE_URL;

//             if (typeof navigator !== "undefined" && navigator.sendBeacon && base) {
//                 const blob = new Blob([JSON.stringify(payload)], { type: "application/json" });
//                 const sent = navigator.sendBeacon(`${base}/api/analytics/page-visit/end`, blob);

//                 if (!sent) {
//                     await this.fetchWithResponse("/api/analytics/page-visit/end", payload, "POST", 3);
//                 }
//             } else {
//                 await this.fetchWithResponse("/api/analytics/page-visit/end", payload, "POST", 3);
//             }

//             this.currentPageVisitId = null;
//             this.currentPageVisitStartTime = null;
//             this.sessionState.pageVisitId = null;
//             this.frozenDuration = null;
//             this.persistState();

//             console.log("🔹 Page visit ended:", visitId);
//         } catch (err) {
//             console.error("Error in trackPageVisitEnd:", err);

//             this.currentPageVisitId = null;
//             this.currentPageVisitStartTime = null;
//             this.sessionState.pageVisitId = null;
//             this.frozenDuration = null;
//             this.persistState();
//         } finally {
//             this.pendingPageVisitEnd = false;
//             this.pageVisitLock = false;
//         }
//     }

//     /**
//      * Non-destructive duration/scrollDepth checkpoint for the current page
//      * visit — does NOT set endTime, so it's safe to call every time the tab
//      * is backgrounded. If the tab never comes back, the server already has
//      * a near-accurate duration on record instead of an open-ended visit.
//      */
//     checkpointPageVisit() {
//         if (!this.currentPageVisitId) return;

//         const payload = {
//             id: this.currentPageVisitId,
//             duration: this.getCurrentPageDuration() || 0,
//             scrollDepth: this.maxScrollDepth,
//             final: false,
//         };

//         this.sendBeaconOrFetch("/api/analytics/page-visit/end", payload, 1);
//     }

//     /** Beacon-only session end for contexts where we can't await (pagehide). */
//     private trackSessionEndBeacon(duration: number) {
//         if (this.sessionEnded) return;

//         this.sendBeaconOrFetch("/api/analytics/session", {
//             sessionId: this.sessionId,
//             duration,
//         }, 3);

//         this.sessionEnded = true;
//     }

//     /* ------------------------------
//        Visibility / Lifecycle Hooks (NEW)

//        These replace the old beforeunload-based closing. beforeunload is
//        avoided entirely: it disables bfcache in Chrome/Firefox, and mobile
//        Safari frequently never fires it at all, which left page visits with
//        no endTime. visibilitychange fires reliably everywhere and doesn't
//        touch bfcache, so it's the primary "user might be leaving" signal.
//        pagehide (non-persisted) is the backstop for a genuine close.
//     ------------------------------ */

//     /** Call when document.visibilityState becomes "hidden". */
//     onVisibilityHidden() {
//         this.pauseActiveTime();
//         this.flushEventBuffer();
//         this.checkpointPageVisit();
//         this.sessionState.isActive = false;
//     }

//     /** Call when document.visibilityState becomes "visible" again. */
//     onVisibilityVisible() {
//         this.resumeActiveTime();
//         this.sessionState.isActive = true;
//     }

//     /** Call on the `pagehide` event, passing through event.persisted. */
//     onPageHide(persisted: boolean) {
//         if (persisted) {
//             // Going into bfcache, not actually closing — just pause the clock.
//             this.pauseActiveTime();
//             return;
//         }

//         // Genuine unload. Best-effort, synchronous-as-possible final close.
//         void this.trackPageVisitEnd(window.location.pathname);

//         const start = sessionStorage.getItem("analytics_session_start");
//         const duration = start ? Date.now() - Number(start) : 0;
//         this.trackSessionEndBeacon(duration);
//     }

//     /** Call on the `pageshow` event, passing through event.persisted. */
//     onPageShow(persisted: boolean) {
//         if (persisted) {
//             this.resumeActiveTime();
//             this.trackEvent("engagement", window.location.pathname, "bfcache_restore");
//         }
//     }

//     trackSessionEnd(data: { duration?: number; pathname?: string }) {
//         if (this.sessionEnded) {
//             console.log("🔹 Session already ended, skipping");
//             return;
//         }

//         this.sessionEnded = true;
//         this.flushEventBuffer();

//         this.addToQueue("/api/analytics/session", {
//             sessionId: this.sessionId,
//             duration: data.duration,
//         }, "POST", 3);

//         this.addToQueue("/api/analytics/event", {
//             sessionId: this.sessionId,
//             type: "session_end",
//             url: data.pathname || window.location.pathname,
//             data: {
//                 duration: data.duration,
//                 activeTime: this.getActiveDuration(),
//                 maxScrollDepth: this.maxScrollDepth,
//             },
//             timestamp: new Date().toISOString(),
//         }, "POST", 3);

//         this.sessionState.isActive = false;
//         this.persistState();

//         this.processCriticalQueue();
//     }

//     trackEvent(type: string, url: string, element?: string, data?: any) {
//         if (!this.sessionId) {
//             console.warn("[Analytics] trackEvent: missing sessionId, skipping");
//             return;
//         }

//         if (["engagement", "performance"].includes(type)) {
//             this.bufferEvent({
//                 sessionId: this.sessionId,
//                 type,
//                 url,
//                 element: element ?? null,
//                 data,
//             });
//         } else {
//             this.fireAndForget("/api/analytics/event", {
//                 sessionId: this.sessionId,
//                 type,
//                 url,
//                 element: element ?? null,
//                 data,
//             }, "POST", type === "error" ? 2 : 1);
//         }
//     }

//     trackClick(path: string, element: string) {
//         if (!this.sessionId) {
//             console.warn("[Analytics] trackClick: missing sessionId, skipping");
//             return;
//         }

//         this.fireAndForget("/api/analytics/click", {
//             sessionId: this.sessionId,
//             path,
//             element,
//             timestamp: new Date().toISOString(),
//         }, "POST", 0);
//     }

//     trackError(error: Error | string, context?: Record<string, any>) {
//         const errorData = typeof error === "string"
//             ? { message: error }
//             : {
//                 message: error.message,
//                 stack: error.stack,
//                 name: error.name,
//             };

//         this.trackEvent("error", window.location.pathname, "client_error", {
//             ...errorData,
//             ...context,
//         });
//     }

//     trackConversion(conversionType: string, value?: number, metadata?: Record<string, any>) {
//         this.trackEvent("conversion", window.location.pathname, conversionType, {
//             value,
//             ...metadata,
//         });
//     }

//     trackFormSubmit(formName: string, success: boolean, data?: Record<string, any>) {
//         this.trackEvent("form", window.location.pathname, formName, {
//             success,
//             ...data,
//         });
//     }

//     async destroy() {
//         if (this.isDestroying) {
//             console.log("🔹 [Analytics] Already destroying, skipping");
//             return;
//         }

//         this.isDestroying = true;
//         console.log("🔹 [Analytics] Destroying client");

//         if (this.currentPageVisitId && !this.pendingPageVisitEnd) {
//             await this.trackPageVisitEnd(window.location.pathname);
//         }

//         if (!this.sessionEnded) {
//             const start = sessionStorage.getItem("analytics_session_start");
//             const duration = start ? Date.now() - Number(start) : 0;

//             this.trackSessionEnd({
//                 duration,
//                 pathname: window.location.pathname,
//             });
//         }

//         this.flushEventBuffer();
//         await this.smartFlushQueue();

//         await new Promise(resolve => setTimeout(resolve, 500));

//         if (this.flushInterval) {
//             clearInterval(this.flushInterval);
//             this.flushInterval = null;
//         }

//         if (this.heartbeatInterval) {
//             clearInterval(this.heartbeatInterval);
//             this.heartbeatInterval = null;
//         }

//         if (this.sessionHealthCheckInterval) {
//             clearInterval(this.sessionHealthCheckInterval);
//             this.sessionHealthCheckInterval = null;
//         }

//         if (this.batchFlushTimeout) {
//             clearTimeout(this.batchFlushTimeout);
//             this.batchFlushTimeout = null;
//         }

//         if (this.idleTimeout) {
//             clearTimeout(this.idleTimeout);
//             this.idleTimeout = null;
//         }

//         if (this.performanceObserver) {
//             this.performanceObserver.disconnect();
//             this.performanceObserver = null;
//         }

//         if (typeof window !== "undefined") {
//             window.removeEventListener("online", this.handleOnline);
//             window.removeEventListener("offline", this.handleOffline);

//             ["mousedown", "keydown", "scroll", "touchstart"].forEach(event => {
//                 document.removeEventListener(event, this.resetIdleTimer);
//             });
//         }

//         this.persistState();

//         this.requestQueue = [];
//         this.criticalQueue = [];
//         this.eventBuffer = [];

//         console.log("🔹 [Analytics] Client destroyed successfully");
//     }
// }