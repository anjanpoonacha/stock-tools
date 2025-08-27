// MIO Session Extractor - Content Script (Performance Optimized)
// This script runs on marketinout.com pages and extracts ASPSESSIONID cookies

(function () {
    'use strict';

    console.log('[MIO-EXTRACTOR] Content script loaded on:', window.location.href);

    // Configuration - Performance Optimized
    const CONFIG = {
        APP_URLS: [
            'http://localhost:3001',
            'http://localhost:3000',
            // 'https://your-app-domain.com', // Replace with your actual domain
        ],
        INITIAL_CHECK_DELAY: 2000, // Initial check after 2 seconds
        ADAPTIVE_INTERVALS: {
            ACTIVE: 30000, // 30s when session is active and stable
            INACTIVE: 60000, // 60s when no session or logged out
            BACKGROUND: 120000, // 2min when tab is hidden
            ERROR: 45000, // 45s after errors
        },
        RETRY_DELAY: 8000, // Wait 8 seconds between retries
        MIN_REQUEST_INTERVAL: 10000, // Minimum 10 seconds between API requests
        MAX_RETRIES: 2, // Reduced retries
        SESSION_CACHE_TTL: 300000, // 5 minutes cache TTL
        VISIBILITY_CHECK_INTERVAL: 5000, // Check visibility every 5s
    };

    // State tracking - Memory optimized
    let lastExtractedSession = null;
    let extractionAttempts = 0;
    let lastRequestTime = 0;
    let isProcessing = false;
    let currentInterval = null;
    let visibilityTimer = null;
    let mutationObserver = null;
    let isTabVisible = true;
    let sessionCache = new Map();
    let abortController = null;

    /**
     * Check if user is logged into MarketInOut
     */
    function isLoggedIn() {
        // Check for ASPSESSIONID cookie presence
        const hasSessionCookie = document.cookie.includes('ASPSESSIONID');

        // Check URL is not a login page
        const isNotLoginPage = !window.location.href.includes('login') && !window.location.href.includes('signin');

        // Check for login form absence (additional validation)
        const hasNoLoginForm =
            !document.querySelector('input[type="password"]') ||
            document.querySelector('[class*="watch"]') ||
            document.querySelector('[id*="watch"]');

        const loggedIn = hasSessionCookie && isNotLoginPage && hasNoLoginForm;

        console.log('[MIO-EXTRACTOR] Login status check:', {
            hasSessionCookie,
            isNotLoginPage,
            hasNoLoginForm,
            loggedIn,
            url: window.location.href,
        });

        return loggedIn;
    }

    /**
     * Extract ASPSESSIONID cookie from document.cookie
     */
    function extractASPSESSION() {
        try {
            const cookies = document.cookie.split(';');
            console.log(
                '[MIO-EXTRACTOR] All cookies:',
                cookies.map((c) => c.trim().split('=')[0])
            );

            // Find cookie that starts with ASPSESSIONID
            const aspSessionCookie = cookies.find((cookie) => cookie.trim().startsWith('ASPSESSIONID'));

            if (aspSessionCookie) {
                const [key, value] = aspSessionCookie.trim().split('=');
                const sessionData = {
                    sessionKey: key.trim(),
                    sessionValue: value ? value.trim() : '',
                    extractedAt: new Date().toISOString(),
                    url: window.location.href,
                };

                console.log('[MIO-EXTRACTOR] Session extracted:', {
                    sessionKey: sessionData.sessionKey,
                    sessionValueLength: sessionData.sessionValue.length,
                    extractedAt: sessionData.extractedAt,
                });

                return sessionData;
            } else {
                console.log('[MIO-EXTRACTOR] No ASPSESSIONID cookie found');
                return null;
            }
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error extracting session:', error);
            return null;
        }
    }

    /**
     * Check if session is cached and still valid
     */
    function getCachedSession(sessionKey) {
        const cached = sessionCache.get(sessionKey);
        if (cached && Date.now() - cached.timestamp < CONFIG.SESSION_CACHE_TTL) {
            return cached.data;
        }
        return null;
    }

    /**
     * Cache session data
     */
    function setCachedSession(sessionKey, data) {
        sessionCache.set(sessionKey, {
            data: data,
            timestamp: Date.now(),
        });

        // Cleanup old cache entries
        if (sessionCache.size > 10) {
            const oldestKey = sessionCache.keys().next().value;
            sessionCache.delete(oldestKey);
        }
    }

    /**
     * Send session data to the trading app - Performance Optimized
     */
    async function sendSessionToApp(sessionData) {
        console.log('[MIO-EXTRACTOR] Sending session to app:', sessionData.sessionKey);

        // Check cache first
        const cached = getCachedSession(sessionData.sessionKey);
        if (cached) {
            console.log('[MIO-EXTRACTOR] Using cached session data');
            return true;
        }

        // Cancel any previous request
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();

        // Method 1: Store in Chrome extension storage
        try {
            await chrome.storage.local.set({
                mioSession: sessionData,
                lastUpdated: Date.now(),
            });
            console.log('[MIO-EXTRACTOR] Session stored in Chrome storage');
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error storing in Chrome storage:', error);
        }

        // Method 2: Optimized API calls with timeout and abort
        const promises = CONFIG.APP_URLS.map(async (appUrl) => {
            try {
                const response = await fetch(`${appUrl}/api/extension/session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(sessionData),
                    signal: abortController.signal,
                    timeout: 5000, // 5 second timeout
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('[MIO-EXTRACTOR] Successfully sent to app:', appUrl, result);
                    return { success: true, url: appUrl, result };
                } else {
                    console.warn('[MIO-EXTRACTOR] App responded with error:', response.status);
                    return { success: false, url: appUrl, error: response.status };
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                    console.log('[MIO-EXTRACTOR] Request aborted for:', appUrl);
                } else {
                    console.log('[MIO-EXTRACTOR] Could not reach app at:', appUrl, error.message);
                }
                return { success: false, url: appUrl, error: error.message };
            }
        });

        // Wait for first successful response or all to fail
        try {
            const results = await Promise.allSettled(promises);
            const successful = results.find((result) => result.status === 'fulfilled' && result.value.success);

            if (successful) {
                // Cache successful session
                setCachedSession(sessionData.sessionKey, sessionData);

                // Update extension badge to show success
                chrome.runtime.sendMessage({
                    action: 'updateBadge',
                    text: '✓',
                    color: '#4CAF50',
                });

                return true;
            }
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error in batch API calls:', error);
        }

        // Method 3: PostMessage to any open app windows (lightweight fallback)
        try {
            window.postMessage(
                {
                    type: 'MIO_SESSION_EXTRACTED',
                    sessionData: sessionData,
                    source: 'mio-session-extractor',
                },
                '*'
            );
            console.log('[MIO-EXTRACTOR] Posted message to window');
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error posting message:', error);
        }

        return false;
    }

    /**
     * Main session extraction and sending logic
     */
    async function processSession() {
        // Prevent concurrent processing
        if (isProcessing) {
            console.log('[MIO-EXTRACTOR] Already processing, skipping');
            return;
        }

        // Throttle API requests
        const now = Date.now();
        if (now - lastRequestTime < CONFIG.MIN_REQUEST_INTERVAL) {
            console.log('[MIO-EXTRACTOR] Request throttled, waiting...');
            return;
        }

        if (!isLoggedIn()) {
            console.log('[MIO-EXTRACTOR] User not logged in, skipping extraction');
            return;
        }

        const sessionData = extractASPSESSION();
        if (!sessionData) {
            console.log('[MIO-EXTRACTOR] No session data found');
            return;
        }

        // Check if this is the same session we already extracted
        if (
            lastExtractedSession &&
            lastExtractedSession.sessionKey === sessionData.sessionKey &&
            lastExtractedSession.sessionValue === sessionData.sessionValue
        ) {
            console.log('[MIO-EXTRACTOR] Session unchanged, skipping send');
            return;
        }

        // Set processing flag and update request time
        isProcessing = true;
        lastRequestTime = now;

        try {
            // Send session to app
            const success = await sendSessionToApp(sessionData);
            if (success) {
                lastExtractedSession = sessionData;
                extractionAttempts = 0;
                console.log('[MIO-EXTRACTOR] Session successfully processed and sent');
            } else {
                extractionAttempts++;
                console.log('[MIO-EXTRACTOR] Send failed, attempt:', extractionAttempts);

                // If max retries reached, wait longer before next attempt
                if (extractionAttempts >= CONFIG.MAX_RETRIES) {
                    console.log('[MIO-EXTRACTOR] Max retries reached, backing off');
                    lastRequestTime = now + CONFIG.RETRY_DELAY; // Add extra delay
                }
            }
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error in processSession:', error);
        } finally {
            isProcessing = false;
        }
    }

    /**
     * Get current polling interval based on state
     */
    function getCurrentInterval() {
        if (!isTabVisible) {
            return CONFIG.ADAPTIVE_INTERVALS.BACKGROUND;
        }

        if (extractionAttempts > 0) {
            return CONFIG.ADAPTIVE_INTERVALS.ERROR;
        }

        if (!isLoggedIn()) {
            return CONFIG.ADAPTIVE_INTERVALS.INACTIVE;
        }

        return CONFIG.ADAPTIVE_INTERVALS.ACTIVE;
    }

    /**
     * Start adaptive polling with dynamic intervals
     */
    function startAdaptivePolling() {
        // Clear any existing interval
        if (currentInterval) {
            clearInterval(currentInterval);
        }

        function scheduleNext() {
            const interval = getCurrentInterval();
            console.log('[MIO-EXTRACTOR] Next check in:', interval / 1000, 'seconds');

            currentInterval = setTimeout(() => {
                processSession().finally(() => {
                    scheduleNext(); // Schedule next check
                });
            }, interval);
        }

        // Start the polling cycle
        scheduleNext();
    }

    /**
     * Handle visibility changes for performance optimization
     */
    function handleVisibilityChange() {
        const wasVisible = isTabVisible;
        isTabVisible = !document.hidden;

        console.log('[MIO-EXTRACTOR] Tab visibility changed:', isTabVisible ? 'visible' : 'hidden');

        // If tab became visible after being hidden, restart polling immediately
        if (!wasVisible && isTabVisible) {
            console.log('[MIO-EXTRACTOR] Tab became visible, restarting active polling');
            startAdaptivePolling();
            // Run immediate check when tab becomes visible
            setTimeout(processSession, 1000);
        } else if (wasVisible && !isTabVisible) {
            console.log('[MIO-EXTRACTOR] Tab became hidden, switching to background polling');
            startAdaptivePolling();
        }
    }

    /**
     * Set up optimized DOM monitoring for navigation changes
     */
    function setupNavigationMonitoring() {
        let lastUrl = window.location.href;

        // Use targeted observer instead of broad subtree monitoring
        mutationObserver = new MutationObserver((mutations) => {
            // Only check URL if there were significant DOM changes
            let significantChange = false;
            for (const mutation of mutations) {
                if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                    // Check if any added nodes contain navigation elements
                    for (const node of mutation.addedNodes) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node;
                            if (
                                element.tagName === 'MAIN' ||
                                element.tagName === 'SECTION' ||
                                (element.className && element.className.includes('content')) ||
                                (element.id && element.id.includes('content'))
                            ) {
                                significantChange = true;
                                break;
                            }
                        }
                    }
                }
                if (significantChange) break;
            }

            if (significantChange && window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('[MIO-EXTRACTOR] Page navigation detected:', lastUrl);
                // Reset extraction attempts on navigation
                extractionAttempts = 0;
                // Wait for page to stabilize before checking
                setTimeout(processSession, 2000);
            }
        });

        // Monitor only the main content area, not the entire body
        const contentArea = document.querySelector('main') || document.querySelector('#content') || document.body;
        mutationObserver.observe(contentArea, {
            childList: true,
            subtree: false, // Don't monitor deep subtree changes
        });
    }

    /**
     * Cleanup function for proper resource management
     */
    function cleanup() {
        console.log('[MIO-EXTRACTOR] Cleaning up resources');

        if (currentInterval) {
            clearInterval(currentInterval);
            currentInterval = null;
        }

        if (visibilityTimer) {
            clearInterval(visibilityTimer);
            visibilityTimer = null;
        }

        if (mutationObserver) {
            mutationObserver.disconnect();
            mutationObserver = null;
        }

        if (abortController) {
            abortController.abort();
            abortController = null;
        }

        // Clear cache
        sessionCache.clear();
    }

    /**
     * Initialize the extension with performance optimizations
     */
    function initialize() {
        console.log('[MIO-EXTRACTOR] Initializing performance-optimized extension on:', window.location.href);

        // Set up visibility change monitoring
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Set up navigation monitoring with optimized observer
        setupNavigationMonitoring();

        // Run initial check after page stabilizes
        setTimeout(() => {
            processSession().then(() => {
                // Start adaptive polling after initial check
                startAdaptivePolling();
            });
        }, CONFIG.INITIAL_CHECK_DELAY);

        // Listen for messages from extension popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('[MIO-EXTRACTOR] Received message:', request);

            if (request.action === 'extractSession') {
                processSession().then(() => {
                    sendResponse({
                        success: true,
                        sessionData: lastExtractedSession,
                        isLoggedIn: isLoggedIn(),
                        currentInterval: getCurrentInterval(),
                        isTabVisible: isTabVisible,
                    });
                });
                return true; // Keep message channel open for async response
            }

            if (request.action === 'getStatus') {
                sendResponse({
                    isLoggedIn: isLoggedIn(),
                    lastSession: lastExtractedSession,
                    url: window.location.href,
                    currentInterval: getCurrentInterval(),
                    isTabVisible: isTabVisible,
                    extractionAttempts: extractionAttempts,
                    cacheSize: sessionCache.size,
                });
            }

            if (request.action === 'forceRefresh') {
                // Clear cache and force immediate extraction
                sessionCache.clear();
                lastExtractedSession = null;
                extractionAttempts = 0;
                processSession().then(() => {
                    sendResponse({ success: true });
                });
                return true;
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);

        console.log('[MIO-EXTRACTOR] Performance-optimized extension initialized successfully');
        console.log('[MIO-EXTRACTOR] Configuration:', {
            intervals: CONFIG.ADAPTIVE_INTERVALS,
            cacheTTL: CONFIG.SESSION_CACHE_TTL / 1000 + 's',
            minRequestInterval: CONFIG.MIN_REQUEST_INTERVAL / 1000 + 's',
        });
    }

    /**
     * Phase 3: Performance Observer for monitoring
     */
    function initializePerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            try {
                // Monitor navigation and resource timing
                const perfObserver = new PerformanceObserver((list) => {
                    const entries = list.getEntries();
                    entries.forEach((entry) => {
                        if (entry.entryType === 'navigation') {
                            console.log('[MIO-EXTRACTOR] Navigation timing:', {
                                domContentLoaded: entry.domContentLoadedEventEnd - entry.domContentLoadedEventStart,
                                loadComplete: entry.loadEventEnd - entry.loadEventStart,
                                totalTime: entry.loadEventEnd - entry.fetchStart,
                            });
                        }

                        if (entry.entryType === 'measure' && entry.name.startsWith('mio-')) {
                            console.log('[MIO-EXTRACTOR] Performance measure:', {
                                name: entry.name,
                                duration: entry.duration,
                                startTime: entry.startTime,
                            });
                        }
                    });
                });

                perfObserver.observe({ entryTypes: ['navigation', 'measure'] });

                // Custom performance marks
                performance.mark('mio-extension-start');
            } catch (error) {
                console.warn('[MIO-EXTRACTOR] Performance Observer not supported:', error);
            }
        }
    }

    /**
     * Phase 3: Intersection Observer for login state detection
     */
    function initializeIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            try {
                const loginObserver = new IntersectionObserver(
                    (entries) => {
                        entries.forEach((entry) => {
                            if (entry.isIntersecting) {
                                // Login form is visible - user might be logging in
                                console.log('[MIO-EXTRACTOR] Login form detected, adjusting polling');
                                extractionAttempts = 0; // Reset attempts

                                // Check for session after a delay
                                setTimeout(() => {
                                    if (isLoggedIn()) {
                                        processSession();
                                    }
                                }, 3000);
                            }
                        });
                    },
                    {
                        threshold: 0.5,
                        rootMargin: '50px',
                    }
                );

                // Observe login forms
                const loginForms = document.querySelectorAll(
                    'form[action*="login"], form[action*="signin"], input[type="password"]'
                );
                loginForms.forEach((form) => {
                    loginObserver.observe(form.closest('form') || form);
                });

                // Store observer for cleanup
                mutationObserver = loginObserver;
            } catch (error) {
                console.warn('[MIO-EXTRACTOR] Intersection Observer not supported:', error);
            }
        }
    }

    /**
     * Phase 3: Web Worker integration for heavy computations
     */
    let performanceWorker = null;

    function initializeWebWorker() {
        try {
            performanceWorker = new Worker(chrome.runtime.getURL('performance-worker.js'));

            performanceWorker.onmessage = function (e) {
                const { type, results, error } = e.data;

                if (type === 'batchComplete') {
                    console.log('[MIO-EXTRACTOR] Worker completed batch:', results.length, 'tasks');
                } else if (type === 'error') {
                    console.error('[MIO-EXTRACTOR] Worker error:', error);
                }
            };

            performanceWorker.onerror = function (error) {
                console.error('[MIO-EXTRACTOR] Worker error:', error);
            };

            console.log('[MIO-EXTRACTOR] Performance worker initialized');
        } catch (error) {
            console.warn('[MIO-EXTRACTOR] Web Worker not supported:', error);
        }
    }

    /**
     * Phase 3: Idle callback optimization
     */
    function scheduleIdleTask(task, timeout = 5000) {
        if ('requestIdleCallback' in window) {
            requestIdleCallback(task, { timeout });
        } else {
            // Fallback for browsers without requestIdleCallback
            setTimeout(task, 0);
        }
    }

    /**
     * Enhanced initialization with Phase 3 optimizations
     */
    function initializeWithPhase3() {
        console.log('[MIO-EXTRACTOR] Initializing with Phase 3 optimizations');

        // Phase 3: Performance monitoring
        initializePerformanceMonitoring();

        // Phase 3: Intersection Observer for smart login detection
        scheduleIdleTask(() => {
            initializeIntersectionObserver();
        });

        // Phase 3: Web Worker for heavy computations
        scheduleIdleTask(() => {
            initializeWebWorker();
        });

        // Original initialization
        initialize();

        // Phase 3: Performance mark
        performance.mark('mio-extension-ready');
        performance.measure('mio-initialization', 'mio-extension-start', 'mio-extension-ready');
    }

    /**
     * Enhanced cleanup with Phase 3 resources
     */
    function cleanupPhase3() {
        console.log('[MIO-EXTRACTOR] Cleaning up Phase 3 resources');

        if (performanceWorker) {
            performanceWorker.terminate();
            performanceWorker = null;
        }

        // Call original cleanup
        cleanup();
    }

    // Start the extension when DOM is ready with Phase 3 optimizations
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeWithPhase3);
    } else {
        initializeWithPhase3();
    }

    // Enhanced cleanup on page unload
    window.addEventListener('beforeunload', cleanupPhase3);
    window.addEventListener('unload', cleanupPhase3);
})();
