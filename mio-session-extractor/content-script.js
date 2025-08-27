// Multi-Platform Session Extractor - Content Script (Performance Optimized)
// This script runs on marketinout.com and tradingview.com pages and extracts session cookies

(function () {
    'use strict';

    console.log('[MULTI-EXTRACTOR] Content script loaded on:', window.location.href);

    // Polyfill for requestIdleCallback
    function requestIdleCallbackPolyfill(callback, options = {}) {
        if (typeof requestIdleCallback !== 'undefined') {
            return requestIdleCallback(callback, options);
        } else {
            // Fallback using setTimeout
            const timeout = options.timeout || 0;
            return setTimeout(callback, timeout);
        }
    }

    // Platform Detection
    const PLATFORMS = {
        MARKETINOUT: 'marketinout',
        TRADINGVIEW: 'tradingview',
    };

    const currentPlatform = window.location.hostname.includes('marketinout.com')
        ? PLATFORMS.MARKETINOUT
        : window.location.hostname.includes('.tradingview.com') || window.location.hostname === 'tradingview.com'
        ? PLATFORMS.TRADINGVIEW
        : null;

    console.log('[MULTI-EXTRACTOR] Detected platform:', currentPlatform);

    // Exit early if platform is not supported
    if (!currentPlatform) {
        console.log('[MULTI-EXTRACTOR] Unsupported platform, exiting');
        return;
    }

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

        // Platform-specific session configurations
        PLATFORMS: {
            [PLATFORMS.MARKETINOUT]: {
                sessionCookieName: 'ASPSESSIONID',
                loginIndicators: {
                    cookiePresent: 'ASPSESSIONID',
                    urlExcludes: ['login', 'signin'],
                    elementSelectors: ['[class*="watch"]', '[id*="watch"]'],
                    loginFormSelector: 'input[type="password"]',
                },
            },
            [PLATFORMS.TRADINGVIEW]: {
                sessionCookieName: 'sessionid',
                loginIndicators: {
                    cookiePresent: 'sessionid',
                    urlExcludes: ['signin', 'accounts'],
                    elementSelectors: ['.tv-header__user-menu', '[data-name="header-user-menu"]'],
                    loginFormSelector: 'input[name="password"]',
                },
            },
        },
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
     * Multi-platform login detection
     */
    async function isLoggedIn() {
        const platformConfig = CONFIG.PLATFORMS[currentPlatform];

        // For TradingView, check session cookie using background script
        let hasSessionCookie = false;
        if (currentPlatform === PLATFORMS.TRADINGVIEW) {
            try {
                const cookie = await new Promise((resolve, reject) => {
                    chrome.runtime.sendMessage(
                        {
                            action: 'getCookie',
                            url: 'https://www.tradingview.com',
                            name: 'sessionid',
                        },
                        (response) => {
                            if (chrome.runtime.lastError) {
                                reject(chrome.runtime.lastError);
                            } else {
                                resolve(response.cookie);
                            }
                        }
                    );
                });
                hasSessionCookie = !!(cookie && cookie.value);
            } catch (error) {
                console.error('[MULTI-EXTRACTOR] Error checking TradingView session cookie:', error);
                hasSessionCookie = false;
            }
        } else {
            // For MarketInOut, use document.cookie
            hasSessionCookie = document.cookie.includes(platformConfig.loginIndicators.cookiePresent);
        }

        // Check URL is not a login page
        const isNotLoginPage = !platformConfig.loginIndicators.urlExcludes.some((exclude) =>
            window.location.href.includes(exclude)
        );

        // Check for login form absence and platform-specific elements
        const hasNoLoginForm = !document.querySelector(platformConfig.loginIndicators.loginFormSelector);
        const hasLoggedInElements = platformConfig.loginIndicators.elementSelectors.some((selector) =>
            document.querySelector(selector)
        );

        const loggedIn = hasSessionCookie && isNotLoginPage && (hasNoLoginForm || hasLoggedInElements);

        console.log(`[MULTI-EXTRACTOR] ${currentPlatform.toUpperCase()} login status check:`, {
            platform: currentPlatform,
            hasSessionCookie,
            isNotLoginPage,
            hasNoLoginForm,
            hasLoggedInElements,
            loggedIn,
            url: window.location.href,
        });

        return loggedIn;
    }

    /**
     * Multi-platform session extraction using Chrome Cookies API
     */
    async function extractSessionData() {
        try {
            const platformConfig = CONFIG.PLATFORMS[currentPlatform];

            // For TradingView, we need to use chrome.cookies API to access .tradingview.com domain cookies
            if (currentPlatform === PLATFORMS.TRADINGVIEW) {
                return await extractTradingViewSession(platformConfig);
            } else {
                // For MarketInOut, use document.cookie as it works fine
                return extractMarketInOutSession(platformConfig);
            }
        } catch (error) {
            console.error(`[MULTI-EXTRACTOR] Error extracting ${currentPlatform} session:`, error);
            return null;
        }
    }

    /**
     * Extract TradingView session using background script message passing
     */
    async function extractTradingViewSession(platformConfig) {
        try {
            // Use background script to get sessionid from .tradingview.com domain
            const cookie = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        action: 'getCookie',
                        url: 'https://www.tradingview.com',
                        name: 'sessionid',
                    },
                    (response) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(response.cookie);
                        }
                    }
                );
            });

            if (cookie && cookie.value) {
                const sessionData = {
                    platform: currentPlatform,
                    sessionKey: cookie.name,
                    sessionValue: cookie.value,
                    extractedAt: new Date().toISOString(),
                    url: window.location.href,
                    source: 'browser-extension',
                    domain: cookie.domain,
                };

                console.log(
                    `[MULTI-EXTRACTOR] ${currentPlatform.toUpperCase()} session extracted via background script:`,
                    {
                        platform: sessionData.platform,
                        sessionKey: sessionData.sessionKey,
                        sessionValueLength: sessionData.sessionValue.length,
                        domain: sessionData.domain,
                        extractedAt: sessionData.extractedAt,
                    }
                );

                return sessionData;
            } else {
                console.log(
                    `[MULTI-EXTRACTOR] No ${platformConfig.sessionCookieName} cookie found for ${currentPlatform} via background script`
                );
                return null;
            }
        } catch (error) {
            console.error(`[MULTI-EXTRACTOR] Error extracting TradingView session via background script:`, error);
            return null;
        }
    }

    /**
     * Extract MarketInOut session using document.cookie
     */
    function extractMarketInOutSession(platformConfig) {
        try {
            const cookies = document.cookie.split(';');

            console.log(
                `[MULTI-EXTRACTOR] ${currentPlatform.toUpperCase()} cookies:`,
                cookies.map((c) => c.trim().split('=')[0])
            );

            // Find platform-specific session cookie
            const sessionCookie = cookies.find((cookie) => {
                const cookieName = cookie.trim().split('=')[0];
                return (
                    cookieName === platformConfig.sessionCookieName ||
                    cookieName.startsWith(platformConfig.sessionCookieName)
                );
            });

            if (sessionCookie) {
                const [key, value] = sessionCookie.trim().split('=');
                const sessionData = {
                    platform: currentPlatform,
                    sessionKey: key.trim(),
                    sessionValue: value ? value.trim() : '',
                    extractedAt: new Date().toISOString(),
                    url: window.location.href,
                    source: 'browser-extension',
                };

                console.log(`[MULTI-EXTRACTOR] ${currentPlatform.toUpperCase()} session extracted:`, {
                    platform: sessionData.platform,
                    sessionKey: sessionData.sessionKey,
                    sessionValueLength: sessionData.sessionValue.length,
                    extractedAt: sessionData.extractedAt,
                });

                return sessionData;
            } else {
                console.log(
                    `[MULTI-EXTRACTOR] No ${platformConfig.sessionCookieName} cookie found for ${currentPlatform}`
                );
                return null;
            }
        } catch (error) {
            console.error(`[MULTI-EXTRACTOR] Error extracting MarketInOut session:`, error);
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
     * Get user email from extension settings
     */
    async function getUserEmail() {
        try {
            const result = await chrome.storage.sync.get(['general.userEmail']);
            return result['general.userEmail'] || '';
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error getting user email from settings:', error);
            return '';
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

        // Get user email from settings
        const userEmail = await getUserEmail();
        if (userEmail) {
            sessionData.userEmail = userEmail;
            console.log('[MIO-EXTRACTOR] Added user email to session data:', userEmail);
        }

        // Cancel any previous request
        if (abortController) {
            abortController.abort();
        }
        abortController = new AbortController();

        // Method 1: Store in Chrome extension storage with platform-specific keys
        try {
            const storageKey = currentPlatform === PLATFORMS.TRADINGVIEW ? 'tvSession' : 'mioSession';
            const storageData = {
                [storageKey]: sessionData,
                lastUpdated: Date.now(),
            };

            await chrome.storage.local.set(storageData);
            console.log(
                `[MULTI-EXTRACTOR] ${currentPlatform.toUpperCase()} session stored in Chrome storage under key:`,
                storageKey
            );
        } catch (error) {
            console.error(`[MULTI-EXTRACTOR] Error storing ${currentPlatform} session in Chrome storage:`, error);
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

        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
            console.log('[MIO-EXTRACTOR] User not logged in, skipping extraction');
            return;
        }

        const sessionData = await extractSessionData();
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

        // Note: We can't await isLoggedIn() here since this is used synchronously
        // The login state will be checked in processSession anyway
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
                                setTimeout(async () => {
                                    const loggedIn = await isLoggedIn();
                                    if (loggedIn) {
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
            // Check if Web Workers are supported
            if (typeof Worker === 'undefined') {
                console.warn('[MIO-EXTRACTOR] Web Workers not supported in this environment');
                return;
            }

            // Check if chrome.runtime is available
            if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.getURL) {
                console.warn('[MIO-EXTRACTOR] Chrome runtime not available for Web Worker');
                return;
            }

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
                // Fallback: disable worker on error
                if (performanceWorker) {
                    performanceWorker.terminate();
                    performanceWorker = null;
                }
            };

            console.log('[MIO-EXTRACTOR] Performance worker initialized');
        } catch (error) {
            console.warn('[MIO-EXTRACTOR] Web Worker not supported:', error.message);
            performanceWorker = null;
        }
    }

    /**
     * Phase 3: Idle callback optimization
     */
    function scheduleIdleTask(task, timeout = 5000) {
        requestIdleCallbackPolyfill(task, { timeout });
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
