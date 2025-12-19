// Multi-Platform Session Extractor - Content Script (Performance Optimized)
// This script runs on marketinout.com and tradingview.com pages and extracts session cookies

(function () {
    'use strict';


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


    // Exit early if platform is not supported
    if (!currentPlatform) {
        return;
    }

    // Configuration - Performance Optimized (Will be loaded from settings)
    let CONFIG = {
        APP_URLS: [], // Will be loaded from settings
        INITIAL_CHECK_DELAY: 2000, // Initial check after 2 seconds
        ADAPTIVE_INTERVALS: {
            ACTIVE: 30000, // Default: 30s when session is active and stable
            INACTIVE: 60000, // Default: 60s when no session or logged out
            BACKGROUND: 120000, // Default: 2min when tab is hidden
            ERROR: 45000, // Default: 45s after errors
            POPUP: 15000, // Default: 15s popup refresh
        },
        RETRY_DELAY: 8000, // Default: Wait 8 seconds between retries
        MIN_REQUEST_INTERVAL: 10000, // Default: Minimum 10 seconds between API requests
        MAX_RETRIES: 2, // Default: Reduced retries
        SESSION_CACHE_TTL: 300000, // Default: 5 minutes cache TTL
        VISIBILITY_CHECK_INTERVAL: 5000, // Check visibility every 5s
        REQUEST_TIMEOUT: 5000, // Default: 5s request timeout
        DEBUG_MODE: false, // Will be loaded from settings
        PERFORMANCE_MONITORING: true, // Will be loaded from settings

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
            return null;
        }
    }

    /**
     * Extract TradingView session using background script message passing
     * CRITICAL: TradingView requires BOTH sessionid and sessionid_sign cookies for data access
     */
    async function extractTradingViewSession(platformConfig) {
        try {
            // Get sessionid cookie
            const sessionIdCookie = await new Promise((resolve, reject) => {
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

            // Get sessionid_sign cookie (CRITICAL for JWT data access token)
            const sessionIdSignCookie = await new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(
                    {
                        action: 'getCookie',
                        url: 'https://www.tradingview.com',
                        name: 'sessionid_sign',
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

            if (sessionIdCookie && sessionIdCookie.value) {
                const sessionData = {
                    platform: currentPlatform,
                    sessionKey: sessionIdCookie.name,
                    sessionValue: sessionIdCookie.value,
                    extractedAt: new Date().toISOString(),
                    url: window.location.href,
                    source: 'browser-extension',
                    domain: sessionIdCookie.domain,
                    // Store sessionid_sign as a separate field (CRITICAL for data access)
                    sessionid_sign: sessionIdSignCookie && sessionIdSignCookie.value ? sessionIdSignCookie.value : null,
                };


                // Warn if sessionid_sign is missing
                if (!sessionData.sessionid_sign) {
                }

                return sessionData;
            } else {
                return null;
            }
        } catch (error) {
            return null;
        }
    }

    /**
     * Extract MarketInOut session using document.cookie
     */
    function extractMarketInOutSession(platformConfig) {
        try {
            const cookies = document.cookie.split(';');


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


                return sessionData;
            } else {
                return null;
            }
        } catch (error) {
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
     * Load settings from extension storage and update CONFIG with all settings
     */
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['extensionSettings']);
            const settings = result.extensionSettings || {};

            const quickUrls = settings.quickSettings?.appUrls || [];

            CONFIG.APP_URLS = quickUrls
                .filter((item) => item.enabled === true)
                .map((item) => item.url.trim())
                .filter((url) => url.length > 0);

            // If no URLs configured, show warning but don't use defaults
            if (CONFIG.APP_URLS.length === 0) {
                CONFIG.APP_URLS = []; // Keep empty to prevent sending to unconfigured endpoints
            }

            // Load performance settings and apply them to CONFIG
            const performance = settings.performance || {};
            const pollingIntervals = performance.pollingIntervals || {};

            // Update adaptive intervals from settings
            if (pollingIntervals.active) {
                CONFIG.ADAPTIVE_INTERVALS.ACTIVE = pollingIntervals.active;
            }
            if (pollingIntervals.inactive) {
                CONFIG.ADAPTIVE_INTERVALS.INACTIVE = pollingIntervals.inactive;
            }
            if (pollingIntervals.background) {
                CONFIG.ADAPTIVE_INTERVALS.BACKGROUND = pollingIntervals.background;
            }
            if (pollingIntervals.error) {
                CONFIG.ADAPTIVE_INTERVALS.ERROR = pollingIntervals.error;
            }
            if (pollingIntervals.popup) {
                CONFIG.ADAPTIVE_INTERVALS.POPUP = pollingIntervals.popup;
            }

            // Load request settings
            const requestSettings = performance.requestSettings || {};
            if (requestSettings.timeout) {
                CONFIG.REQUEST_TIMEOUT = requestSettings.timeout;
            }
            if (requestSettings.maxRetries !== undefined) {
                CONFIG.MAX_RETRIES = requestSettings.maxRetries;
            }
            if (requestSettings.minInterval) {
                CONFIG.MIN_REQUEST_INTERVAL = requestSettings.minInterval;
            }
            if (requestSettings.retryDelay) {
                CONFIG.RETRY_DELAY = requestSettings.retryDelay;
            }

            // Load cache settings
            const cacheDurations = performance.cacheDurations || {};
            if (cacheDurations.session) {
                CONFIG.SESSION_CACHE_TTL = cacheDurations.session;
            }

            // Load general settings
            const general = settings.general || {};
            if (general.debugMode !== undefined) {
                CONFIG.DEBUG_MODE = general.debugMode;
            }
            if (general.performanceMonitoring !== undefined) {
                CONFIG.PERFORMANCE_MONITORING = general.performanceMonitoring;
            }

            // Apply platform-specific multipliers if configured
            const platforms = settings.platforms || {};
            const currentPlatformSettings = currentPlatform ? platforms[currentPlatform] || {} : {};
            if (currentPlatformSettings.pollingMultiplier && currentPlatformSettings.pollingMultiplier !== 1.0) {
                const multiplier = currentPlatformSettings.pollingMultiplier;
                CONFIG.ADAPTIVE_INTERVALS.ACTIVE = Math.round(CONFIG.ADAPTIVE_INTERVALS.ACTIVE * multiplier);
                CONFIG.ADAPTIVE_INTERVALS.INACTIVE = Math.round(CONFIG.ADAPTIVE_INTERVALS.INACTIVE * multiplier);
                CONFIG.ADAPTIVE_INTERVALS.BACKGROUND = Math.round(CONFIG.ADAPTIVE_INTERVALS.BACKGROUND * multiplier);
                CONFIG.ADAPTIVE_INTERVALS.ERROR = Math.round(CONFIG.ADAPTIVE_INTERVALS.ERROR * multiplier);

            }


            return settings;
        } catch (error) {
            CONFIG.APP_URLS = []; // Ensure no hardcoded URLs are used
            return {};
        }
    }

    /**
     * Get user credentials from extension settings
     */
    async function getUserCredentials() {
        try {
            const result = await chrome.storage.sync.get(['extensionSettings']);
            const settings = result.extensionSettings || {};

            // Use quickSettings for user credentials (new structure)
            const userEmail = settings.quickSettings?.userEmail || settings.general?.userEmail || '';
            const userPassword = settings.quickSettings?.userPassword || settings.general?.userPassword || '';

            return { userEmail, userPassword };
        } catch (error) {
            return { userEmail: '', userPassword: '' };
        }
    }

    /**
     * Check if user has provided both email and password
     */
    async function hasValidCredentials() {
        const { userEmail, userPassword } = await getUserCredentials();
        const hasEmail = userEmail && userEmail.trim().length > 0;
        const hasPassword = userPassword && userPassword.trim().length > 0;


        return hasEmail && hasPassword;
    }

    /**
     * Get user credentials from extension settings (using sync storage for multi-window support)
     */
    async function getUserCredentialsFromStorage() {
        try {
            const result = await chrome.storage.sync.get(['extensionSettings']);
            const settings = result.extensionSettings || {};

            // Use quickSettings for user credentials (new structure)
            const userEmail = settings.quickSettings?.userEmail || settings.general?.userEmail || '';
            const userPassword = settings.quickSettings?.userPassword || settings.general?.userPassword || '';

            return { userEmail, userPassword };
        } catch (error) {
            return { userEmail: '', userPassword: '' };
        }
    }

    /**
     * Send session data to the trading app - Performance Optimized with Authentication
     */
    async function sendSessionToApp(sessionData) {

        // Check cache first
        const cached = getCachedSession(sessionData.sessionKey);
        if (cached) {
            return true;
        }

        // Get user credentials from extension settings
        const { userEmail, userPassword } = await getUserCredentialsFromStorage();
        if (!userEmail || !userPassword) {
            return false;
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
        } catch (error) {
        }

        // Method 2: Optimized API calls with authentication token
        const promises = CONFIG.APP_URLS.map(async (appUrl) => {
            try {
                const cleanUrl = appUrl.endsWith('/') ? appUrl.slice(0, -1) : appUrl;
                const response = await fetch(`${cleanUrl}/api/extension/session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        ...sessionData,
                        userEmail,
                        userPassword,
                    }),
                    signal: abortController.signal,
                });

                if (response.ok) {
                    const result = await response.json();
                    return { success: true, url: appUrl, result };
                } else {
                    return { success: false, url: appUrl, error: response.status };
                }
            } catch (error) {
                if (error.name === 'AbortError') {
                } else {
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
        } catch (error) {
        }

        return false;
    }

    /**
     * Main session extraction and sending logic
     */
    async function processSession() {
        // Prevent concurrent processing
        if (isProcessing) {
            return;
        }

        // Throttle API requests
        const now = Date.now();
        if (now - lastRequestTime < CONFIG.MIN_REQUEST_INTERVAL) {
            return;
        }

        // Check if user has provided both email and password
        const hasCredentials = await hasValidCredentials();
        if (!hasCredentials) {
            return;
        }

        const loggedIn = await isLoggedIn();
        if (!loggedIn) {
            return;
        }

        const sessionData = await extractSessionData();
        if (!sessionData) {
            return;
        }

        // Check if this is the same session we already extracted
        if (
            lastExtractedSession &&
            lastExtractedSession.sessionKey === sessionData.sessionKey &&
            lastExtractedSession.sessionValue === sessionData.sessionValue
        ) {
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
            } else {
                extractionAttempts++;

                // If max retries reached, wait longer before next attempt
                if (extractionAttempts >= CONFIG.MAX_RETRIES) {
                    lastRequestTime = now + CONFIG.RETRY_DELAY; // Add extra delay
                }
            }
        } catch (error) {
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


        // If tab became visible after being hidden, restart polling immediately
        if (!wasVisible && isTabVisible) {
            startAdaptivePolling();
            // Run immediate check when tab becomes visible
            setTimeout(processSession, 1000);
        } else if (wasVisible && !isTabVisible) {
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
                        if (node.nodeType === Node.ELEMENT_NODE && node.tagName) {
                            if (
                                node.tagName === 'MAIN' ||
                                node.tagName === 'SECTION' ||
                                (node.className && node.className.includes('content')) ||
                                (node.id && node.id.includes('content'))
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
     * Listen for settings changes and reload configuration
     */
    function setupSettingsListener() {
        // Listen for storage changes
        chrome.storage.onChanged.addListener(async (changes, namespace) => {
            if (namespace === 'sync' && changes.extensionSettings) {

                // Reload settings
                await loadSettings();

                // Restart polling with new intervals
                startAdaptivePolling();

            }
        });
    }

    /**
     * Initialize the extension with performance optimizations
     */
    async function initialize() {

        // Load settings first
        await loadSettings();

        // Set up settings change listener
        setupSettingsListener();

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

            if (request.action === 'reloadSettings') {
                // Reload settings when requested
                loadSettings().then(() => {
                    startAdaptivePolling();
                    sendResponse({
                        success: true,
                        config: {
                            intervals: CONFIG.ADAPTIVE_INTERVALS,
                            debugMode: CONFIG.DEBUG_MODE,
                            appUrls: CONFIG.APP_URLS.length,
                        },
                    });
                });
                return true;
            }
        });

        // Cleanup on page unload
        window.addEventListener('beforeunload', cleanup);
        window.addEventListener('unload', cleanup);

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
                        if (entry.entryType === 'navigation' && entry.domContentLoadedEventEnd) {
                        }

                        if (entry.entryType === 'measure' && entry.name.startsWith('mio-')) {
                        }
                    });
                });

                perfObserver.observe({ entryTypes: ['navigation', 'measure'] });

                // Custom performance marks
                performance.mark('mio-extension-start');
            } catch (error) {
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
            }
        }
    }

    /**
     * Phase 3: Web Worker integration for heavy computations
     * Note: Content scripts cannot directly access chrome-extension:// URLs for Workers
     * This functionality is disabled to prevent security errors
     */
    let performanceWorker = null;

    function initializeWebWorker() {
        // Web Workers are not supported in content scripts due to security restrictions
        // Content scripts running on external domains cannot access chrome-extension:// URLs
        performanceWorker = null;
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
