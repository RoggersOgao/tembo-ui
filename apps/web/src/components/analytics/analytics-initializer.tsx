// 'use client';

// import { useCallback, useEffect, useRef, useState } from 'react';
// import { usePathname, useSearchParams } from 'next/navigation';
// import AnalyticsClient from '@/lib/analytics-client';
// import { generateSessionId, getDeviceInfo, getIpAndGeo } from '@/hooks/useAnalytics';
// import { debounce } from 'lodash';

// const ANALYTICS_SESSION_ID_KEY = "analytics_session_id";
// const ANALYTICS_SESSION_START_KEY = "analytics_session_start";
// const ANALYTICS_INITIALIZED_KEY = "analytics_initialized";

// // Check if element is meaningful for click tracking
// const isElementMeaningful = (el: HTMLElement): boolean => {
//     if (!el) return false;

//     const tagName = el.tagName.toLowerCase();

//     // Always track these interactive elements
//     const interactiveElements = [
//         'a', 'button', 'input', 'select', 'textarea',
//         'option', 'label', 'summary', 'details'
//     ];

//     if (interactiveElements.includes(tagName)) return true;

//     // Track elements with explicit tracking attributes
//     if (el.getAttribute("data-analytics") || el.getAttribute("data-track")) {
//         return true;
//     }

//     // Track elements with click handlers
//     const hasClickHandler = el.onclick !== null ||
//         el.getAttribute('onclick') !== null ||
//         el.hasAttribute('data-clickable');
//     if (hasClickHandler) return true;

//     // Track elements with role="button" or similar interactive roles
//     const role = el.getAttribute('role');
//     const interactiveRoles = ['button', 'link', 'menuitem', 'tab', 'switch', 'checkbox', 'radio'];
//     if (role && interactiveRoles.includes(role)) return true;

//     // Track elements with cursor pointer (usually clickable)
//     const computedStyle = window.getComputedStyle(el);
//     if (computedStyle.cursor === 'pointer') return true;

//     // Check if element or parent has meaningful classes suggesting interactivity
//     const clickableClasses = ['btn', 'button', 'link', 'clickable', 'action', 'menu-item', 'nav-item'];
//     const classList = Array.from(el.classList);
//     if (clickableClasses.some(cls => classList.some(c => c.toLowerCase().includes(cls)))) {
//         return true;
//     }

//     return false;
// };

// // Extract meaningful name function (defined outside to prevent recreations)
// const extractMeaningfulName = (el: HTMLElement): string | null => {
//     if (!el) return null;

//     // 1. Data/Analytics Attributes (Highest Priority)
//     const dataName = el.getAttribute("data-analytics") || el.getAttribute("data-track");
//     if (dataName && dataName.trim()) return dataName.trim();

//     // 2. Accessibility/User-facing Labels
//     const aria = el.getAttribute("aria-label");
//     if (aria && aria.trim()) return aria.trim();

//     // 3. Form Elements
//     if (el instanceof HTMLInputElement) {
//         const name = el.name || el.placeholder || el.id || null;
//         if (name) return `${el.tagName.toLowerCase()}:${name}`;
//     }

//     if (el instanceof HTMLButtonElement) {
//         const name = el.name || el.id || null;
//         if (name) return `${el.tagName.toLowerCase()}:${name}`;
//     }

//     // 4. Links - extract href info
//     if (el instanceof HTMLAnchorElement) {
//         const href = el.getAttribute('href');
//         const text = el.textContent?.trim().slice(0, 40) || '';
//         if (href && href !== '#') {
//             return text ? `link:${text}` : `link:${href}`;
//         }
//         if (text) return `link:${text}`;
//     }

//     // 5. Visible Text Content (but filter out too long or too short)
//     const text = el.textContent?.trim();
//     if (text && text.length > 2 && text.length < 100) {
//         const clean = text.replace(/\s+/g, " ").slice(0, 60);
//         if (clean.length > 0) return clean;
//     }

//     // 6. IDs (Should be unique)
//     if (el.id) return `#${el.id}`;

//     // 7. Class-based identification for common patterns
//     const classList = Array.from(el.classList);
//     if (classList.length > 0) {
//         const meaningfulClass = classList.find(c =>
//             !c.match(/^(container|wrapper|flex|grid|p-|m-|text-|bg-|w-|h-)/)
//         );
//         if (meaningfulClass) return `.${meaningfulClass}`;
//     }

//     // 8. Non-specific but interactive element
//     return `<${el.tagName.toLowerCase()}>`;
// };

// export function AnalyticsInitializer() {
//     const pathname = usePathname();
//     const searchParams = useSearchParams();

//     const analyticsRef = useRef<AnalyticsClient | null>(null);
//     const prevPathRef = useRef<string | null>(null);
//     const [ready, setReady] = useState(false);
//     const initializingRef = useRef(false);
//     const pageChangeInProgressRef = useRef(false);

//     // NEW: Track if navigation is happening (to prevent duration updates during manual URL typing)
//     const isNavigatingRef = useRef(false);

//     // NEW: Track if tab is being closed vs just hidden
//     const isUnloadingRef = useRef(false);

//     /* ------------------------------
//        Initialization with Safety Checks
//     ------------------------------ */
//     useEffect(() => {
//         if (typeof window === "undefined") return;
//         if (initializingRef.current) {
//             return;
//         }

//         initializingRef.current = true;
//         let mounted = true;

//         (async () => {
//             try {
//                 // 1) Get or create sessionId
//                 let sessionId = sessionStorage.getItem(ANALYTICS_SESSION_ID_KEY);

//                 if (!sessionId) {
//                     sessionId = generateSessionId();
//                     sessionStorage.setItem(ANALYTICS_SESSION_ID_KEY, sessionId);
//                     sessionStorage.setItem(ANALYTICS_SESSION_START_KEY, Date.now().toString());
//                     sessionStorage.setItem(ANALYTICS_INITIALIZED_KEY, "true");
//                     console.log("🔹 [Analytics] New session created:", sessionId);
//                 } else {
//                     console.log("🔹 [Analytics] Existing session restored:", sessionId);
//                 }

//                 // 2) Ensure session start exists
//                 if (!sessionStorage.getItem(ANALYTICS_SESSION_START_KEY)) {
//                     sessionStorage.setItem(ANALYTICS_SESSION_START_KEY, Date.now().toString());
//                 }

//                 // 3) Get device info and geo data
//                 const device = getDeviceInfo();
//                 const ipGeo = await getIpAndGeo();

//                 if (!mounted) {
//                     console.log("🔹 [Analytics] Component unmounted during init");
//                     return;
//                 }

//                 // 4) Create analytics client
//                 const analytics = new AnalyticsClient(sessionId);
//                 analyticsRef.current = analytics;
//                 (window as any).analytics = analytics;

//                 // 5) Track initial session (creates or updates session with duration: 0)
//                 analytics.trackSession({
//                     duration: 0,
//                     referrer: document.referrer,
//                     ...device,
//                     ...ipGeo,
//                 });

//                 // 6) Start initial page visit with retry logic
//                 const queryString = searchParams.toString();
//                 const query = queryString ? `?${queryString}` : undefined;

//                 let attempts = 0;
//                 const maxAttempts = 3;

//                 while (attempts < maxAttempts && !analytics.currentPageVisitId) {
//                     attempts++;
//                     console.log(`🔹 [Analytics] Starting page visit attempt ${attempts}/${maxAttempts}`, { pathname, query });

//                     try {
//                         await analytics.trackPageVisitStart(pathname, query);

//                         if (!analytics.currentPageVisitId) {
//                             console.warn(`🔹 [Analytics] Page visit start returned no ID, attempt ${attempts}/${maxAttempts}`);

//                             if (attempts < maxAttempts) {
//                                 await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
//                             }
//                         } else {
//                             console.log(`🔹 [Analytics] Page visit started successfully:`, analytics.currentPageVisitId);
//                         }
//                     } catch (error) {
//                         console.error(`🔹 [Analytics] Page visit start error on attempt ${attempts}:`, error);

//                         if (attempts < maxAttempts) {
//                             await new Promise(resolve => setTimeout(resolve, 1000 * attempts));
//                         }
//                     }
//                 }

//                 if (!analytics.currentPageVisitId) {
//                     console.warn("🔹 [Analytics] Failed to start initial page visit after retries - continuing anyway");
//                     // Don't throw error, just track it
//                     analytics.trackError(
//                         new Error("Failed to start initial page visit"),
//                         { context: 'initialization', pathname, attempts }
//                     );
//                 }

//                 prevPathRef.current = pathname;
//                 setReady(true);

//                 console.log("🔹 [Analytics] Initialization complete");
//             } catch (error) {
//                 console.error("🔹 [Analytics] Initialization error:", error);

//                 if (analyticsRef.current) {
//                     analyticsRef.current.trackError(
//                         error instanceof Error ? error : new Error(String(error)),
//                         { context: 'initialization' }
//                     );
//                 }
//             } finally {
//                 initializingRef.current = false;
//             }
//         })();

//         return () => {
//             mounted = false;
//         };
//     }, []); // Run only once on mount

//     /* ------------------------------
//        Helper: End Page Visit with Safety
//     ------------------------------ */
//     const endPageVisit = useCallback(async () => {
//         const analytics = analyticsRef.current;
//         if (!analytics) {
//             console.log("🔹 endPageVisit: analyticsRef.current is NULL");
//             return;
//         }

//         if (!analytics.currentPageVisitId) {
//             console.log("🔹 endPageVisit: No active page visit to end");
//             return;
//         }

//         const queryString = searchParams.toString();
//         const query = queryString ? `?${queryString}` : undefined;

//         console.log("🔹 Calling trackPageVisitEnd for:", analytics.currentPageVisitId);

//         try {
//             await analytics.trackPageVisitEnd(pathname, query);
//         } catch (error) {
//             console.error("🔹 Error ending page visit:", error);
//             analytics.trackError(
//                 error instanceof Error ? error : new Error(String(error)),
//                 { context: 'endPageVisit', pageVisitId: analytics.currentPageVisitId }
//             );
//         }
//     }, [pathname, searchParams]);

//     /* ------------------------------
//        Track Session End
//     ------------------------------ */
//     const trackSessionEnd = useCallback(async () => {
//         const analytics = analyticsRef.current;
//         if (!analytics) return;

//         console.log("🔹 trackSessionEnd called");

//         try {
//             // End the currently active page visit first
//             if (analytics.currentPageVisitId) {
//                 await endPageVisit();
//             }

//             // Calculate session duration
//             const start = sessionStorage.getItem(ANALYTICS_SESSION_START_KEY);
//             const duration = start ? Date.now() - Number(start) : 0;

//             // Send session end update to backend (NO endTime field in schema)
//             analytics.trackSessionEnd({
//                 duration,
//                 pathname
//             });

//             console.log("🔹 Session end tracked", {
//                 sessionId: analytics.sessionId,
//                 duration,
//             });
//         } catch (error) {
//             console.error("🔹 Error in trackSessionEnd:", error);
//             analytics.trackError(
//                 error instanceof Error ? error : new Error(String(error)),
//                 { context: 'trackSessionEnd' }
//             );
//         }
//     }, [endPageVisit, pathname]);

//     /* ------------------------------
//        FIXED: Track Page Changes - Prevent Updates During Manual URL Typing
//     ------------------------------ */
//     useEffect(() => {
//         if (!ready) return;

//         const analytics = analyticsRef.current;
//         if (!analytics) return;

//         const oldPath = prevPathRef.current;
//         if (oldPath === pathname) return;
//         if (!oldPath) return; // Skip on initial mount

//         // Prevent concurrent page changes
//         if (pageChangeInProgressRef.current) {
//             console.log("🔹 Page change already in progress, ignoring");
//             return;
//         }

//         // NEW: Set navigation flag to prevent duration updates
//         isNavigatingRef.current = true;
//         pageChangeInProgressRef.current = true;

//         (async () => {
//             try {
//                 console.log("🔹 Page change:", { from: oldPath, to: pathname });

//                 // Step 1: End previous page visit
//                 if (analytics.currentPageVisitId) {
//                     console.log("🔹 Ending previous page visit:", analytics.currentPageVisitId);
//                     await endPageVisit();

//                     // Give backend time to process the end request
//                     await new Promise(resolve => setTimeout(resolve, 500));
//                 }

//                 // Step 2: Start new page visit with retry
//                 const queryString = searchParams.toString();
//                 const query = queryString ? `?${queryString}` : undefined;

//                 let attempts = 0;
//                 const maxAttempts = 3;
//                 let success = false;

//                 while (attempts < maxAttempts && !success && !analytics.currentPageVisitId) {
//                     attempts++;
//                     console.log(`🔹 Starting new page visit, attempt ${attempts}/${maxAttempts}`);

//                     try {
//                         await analytics.trackPageVisitStart(pathname, query);

//                         // Check if it was actually created
//                         if (analytics.currentPageVisitId) {
//                             success = true;
//                             console.log(" New page visit started:", analytics.currentPageVisitId);
//                         } else {
//                             console.warn(`[!] Attempt ${attempts}/${maxAttempts} - No page visit ID returned`);

//                             if (attempts < maxAttempts) {
//                                 // Exponential backoff
//                                 const delay = 500 * Math.pow(2, attempts - 1);
//                                 console.log(`⏳ Waiting ${delay}ms before retry...`);
//                                 await new Promise(resolve => setTimeout(resolve, delay));
//                             }
//                         }
//                     } catch (error) {
//                         console.error(`   Attempt ${attempts} error:`, error);

//                         if (attempts < maxAttempts) {
//                             const delay = 500 * Math.pow(2, attempts - 1);
//                             await new Promise(resolve => setTimeout(resolve, delay));
//                         }
//                     }
//                 }

//                 if (!success) {
//                     console.warn("[!] Failed to start page visit after retries - continuing anyway");
//                     analytics.trackError(
//                         new Error("Failed to start page visit"),
//                         { context: 'pageChange', pathname, attempts }
//                     );
//                 }

//                 prevPathRef.current = pathname;

//             } catch (error) {
//                 console.error("🔹 Error in page change:", error);
//                 analytics.trackError(
//                     error instanceof Error ? error : new Error(String(error)),
//                     { context: 'pageChange', pathname }
//                 );
//             } finally {
//                 pageChangeInProgressRef.current = false;
//                 // NEW: Clear navigation flag after a short delay to ensure all updates are blocked
//                 setTimeout(() => {
//                     isNavigatingRef.current = false;
//                 }, 1000);
//             }
//         })();

//     }, [pathname, searchParams, ready, endPageVisit]);

//     /* ------------------------------
//        FIXED: Unload Handlers - Reliably Save Session on Tab Close
//     ------------------------------ */
//     useEffect(() => {
//         if (!ready) return;

//         const base = process.env.NEXT_PUBLIC_API_BASE_URL;
//         if (!base) return;

//         // Track actual unload events (tab close, browser close, navigation away)
//         const onBeforeUnload = (e: BeforeUnloadEvent) => {
//             console.log("🔹 beforeunload - Tab is closing");
//             isUnloadingRef.current = true;

//             const analytics = analyticsRef.current;
//             if (!analytics) return;

//             // Calculate session duration
//             const start = sessionStorage.getItem(ANALYTICS_SESSION_START_KEY);
//             const duration = start ? Date.now() - Number(start) : 0;

//             // 1. End page visit using sendBeacon
//             if (analytics.currentPageVisitId && navigator.sendBeacon) {
//                 const queryString = searchParams.toString();
//                 const query = queryString ? `?${queryString}` : undefined;
//                 const pageVisitDuration = analytics.getCurrentPageDuration() || 0;

//                 const pageVisitPayload = {
//                     id: analytics.currentPageVisitId,
//                     url: pathname,
//                     query,
//                     endTime: new Date().toISOString(),
//                     duration: pageVisitDuration,
//                     scrollDepth: analytics['maxScrollDepth'] || 0,
//                 };

//                 const pageVisitBlob = new Blob([JSON.stringify(pageVisitPayload)], { type: "application/json" });
//                 const pageVisitSent = navigator.sendBeacon(`${base}/api/analytics/page-visit/end`, pageVisitBlob);
//                 console.log("🔹 Page visit ended via beforeunload:", pageVisitSent);
//             }

//             // 2. End session using sendBeacon (CRITICAL FIX)
//             if (duration > 0 && navigator.sendBeacon) {
//                 const sessionPayload = {
//                     sessionId: analytics.sessionId,
//                     duration: duration,
//                 };

//                 const sessionBlob = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
//                 const sessionSent = navigator.sendBeacon(`${base}/api/analytics/session`, sessionBlob);
//                 console.log("🔹 Session ended via beforeunload:", sessionSent, { sessionId: analytics.sessionId, duration });

//                 // Mark session as ended in memory (prevent duplicate sends)
//                 analytics['sessionEnded'] = true;
//             }
//         };

//         // Only track session end on actual page unload (not BF cache)
//         const onPageHide = (e: PageTransitionEvent) => {
//             console.log("🔹 pagehide event", { persisted: e.persisted });

//             const analytics = analyticsRef.current;
//             if (!analytics) return;

//             // Only end session if page is truly unloading (not BF cache) and we haven't already sent it
//             if (!e.persisted && isUnloadingRef.current && !analytics['sessionEnded']) {
//                 const start = sessionStorage.getItem(ANALYTICS_SESSION_START_KEY);
//                 if (start && navigator.sendBeacon) {
//                     const duration = Date.now() - Number(start);

//                     const sessionPayload = {
//                         sessionId: analytics.sessionId,
//                         duration: duration,
//                     };

//                     const sessionBlob = new Blob([JSON.stringify(sessionPayload)], { type: "application/json" });
//                     const sent = navigator.sendBeacon(`${base}/api/analytics/session`, sessionBlob);
//                     console.log("🔹 Session ended via pagehide:", sent, { sessionId: analytics.sessionId, duration });

//                     analytics['sessionEnded'] = true;
//                 }
//             }
//         };

//         // Only flush buffer on visibility change, don't end session
//         const onVisibilityChange = () => {
//             if (document.visibilityState === 'hidden') {
//                 console.log("🔹 Tab hidden (switched), flushing buffer only");
//                 const analytics = analyticsRef.current;
//                 if (analytics && typeof (analytics as any).flushEventBuffer === 'function') {
//                     (analytics as any).flushEventBuffer();
//                 }
//                 // Don't end session here - just switched tabs
//             } else {
//                 console.log("🔹 Tab visible again");
//                 isUnloadingRef.current = false; // Reset unloading flag when tab becomes visible
//             }
//         };

//         window.addEventListener("beforeunload", onBeforeUnload);
//         window.addEventListener("pagehide", onPageHide as any);
//         document.addEventListener("visibilitychange", onVisibilityChange);

//         return () => {
//             window.removeEventListener("beforeunload", onBeforeUnload);
//             window.removeEventListener("pagehide", onPageHide as any);
//             document.removeEventListener("visibilitychange", onVisibilityChange);
//         };
//     }, [ready, pathname, searchParams]);

//     /* ------------------------------
//        FIXED: Click Tracking with Stable Dependencies
//     ------------------------------ */
//     // Create stable tracking function
//     const trackClickEvent = useCallback((e: MouseEvent) => {
//         const analytics = analyticsRef.current;
//         if (!analytics) return;

//         try {
//             let el = e.target as HTMLElement | null;

//             for (let i = 0; i < 3 && el; i++) {
//                 const name = extractMeaningfulName(el);
//                 if (!name) return; // if no usable name, stop

//                 // Skip invalid names (starting with . or <)
//                 if (name.startsWith(".") || name.startsWith("<")) {
//                     el = el.parentElement;
//                     continue; // try parent
//                 }

//                 //  Valid → track
//                 analytics.trackClick(pathname, name);
//                 break;
//             }

//         } catch (error) {
//             console.warn("🔹 Error tracking click:", error);
//         }

//     }, [pathname]);

//     // Debounced handler stored in ref
//     const debouncedHandleClickRef = useRef<((e: MouseEvent) => void) & { cancel: () => void } | null>(null);

//     // Create/update debounced function when trackClickEvent changes
//     useEffect(() => {
//         // Cancel previous debounced function if it exists
//         if (debouncedHandleClickRef.current) {
//             debouncedHandleClickRef.current.cancel();
//         }

//         // Create new debounced function
//         debouncedHandleClickRef.current = debounce(trackClickEvent, 50, {
//             leading: false,
//             trailing: true
//         });
//     }, [trackClickEvent]);

//     // Attach click listener
//     useEffect(() => {
//         if (!ready) {
//             debouncedHandleClickRef.current?.cancel();
//             return;
//         }

//         const handler = (e: MouseEvent) => {
//             if (debouncedHandleClickRef.current) {
//                 debouncedHandleClickRef.current(e);
//             }
//         };

//         document.addEventListener("click", handler);

//         return () => {
//             document.removeEventListener("click", handler);
//             debouncedHandleClickRef.current?.cancel();
//         };
//     }, [ready]);

//     /* ------------------------------
//        Global Error Tracking
//     ------------------------------ */
//     useEffect(() => {
//         if (!ready) return;

//         const analytics = analyticsRef.current;
//         if (!analytics) return;

//         const handleError = (event: ErrorEvent) => {
//             analytics.trackError(event.error || new Error(event.message), {
//                 filename: event.filename,
//                 lineno: event.lineno,
//                 colno: event.colno,
//             });
//         };

//         const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
//             analytics.trackError(
//                 event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
//                 { type: 'unhandledRejection' }
//             );
//         };

//         window.addEventListener('error', handleError);
//         window.addEventListener('unhandledrejection', handleUnhandledRejection);

//         return () => {
//             window.removeEventListener('error', handleError);
//             window.removeEventListener('unhandledrejection', handleUnhandledRejection);
//         };
//     }, [ready]);

//     /* ------------------------------
//        Cleanup on Unmount
//     ------------------------------ */
//     useEffect(() => {
//         return () => {
//             const analytics = analyticsRef.current;
//             if (analytics && typeof analytics.destroy === 'function') {
//                 analytics.destroy();
//             }
//         };
//     }, []);

//     return null;
// }