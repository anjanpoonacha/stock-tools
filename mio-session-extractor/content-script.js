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
     * Load settings from extension storage and update CONFIG with all settings
     */
    async function loadSettings() {
        try {
            const result = await chrome.storage.sync.get(['extensionSettings']);
            const settings = result.extensionSettings || {};

            // Update APP_URLS from settings - check both quickSettings and connection
            const quickUrls = settings.quickSettings?.appUrls || [];
            const connectionUrls = settings.connection?.appUrls || [];
            const customUrls = settings.connection?.customUrls || [];

            // Combine all URL sources, prioritizing quickSettings
            // Handle both string URLs and URL objects with enabled/disabled state
            CONFIG.APP_URLS = [...quickUrls, ...connectionUrls, ...customUrls]
                .filter(Boolean)
                .map((item) => {
                    // Handle URL objects with enabled/disabled state
                    if (typeof item === 'object' && item !== null && item.url) {
                        // Only return URL if explicitly enabled (enabled: true) or not disabled (enabled !== false)
                        return item.enabled === true ? item.url : null;
                    }
                    // Handle simple string URLs - only if they're not localhost
                    if (typeof item === 'string') {
                        return item.includes('localhost') ? null : item;
                    }
                    return null;
                })
                .filter(Boolean)
                .map((url) => String(url).trim())
                .filter((url) => url.length > 0 && !url.includes('localhost'));

            // If no URLs configured, show warning but don't use defaults
            if (CONFIG.APP_URLS.length === 0) {
                console.warn(
                    '[MIO-EXTRACTOR] No app URLs configured in settings. Please add URLs in extension settings.'
                );
                console.warn(
                    '[MIO-EXTRACTOR] Extension will not send sessions to any endpoints until URLs are configured.'
                );
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

                console.log(`[MIO-EXTRACTOR] Applied ${currentPlatform} polling multiplier: ${multiplier}`);
            }

            console.log('[MIO-EXTRACTOR] Loaded and applied all settings:', {
                appUrls: CONFIG.APP_URLS,
                totalUrls: CONFIG.APP_URLS.length,
                quickSettingsUrls: quickUrls.length,
                connectionUrls: connectionUrls.length,
                customUrls: customUrls.length,
                adaptiveIntervals: CONFIG.ADAPTIVE_INTERVALS,
                requestTimeout: CONFIG.REQUEST_TIMEOUT,
                maxRetries: CONFIG.MAX_RETRIES,
                minRequestInterval: CONFIG.MIN_REQUEST_INTERVAL,
                sessionCacheTTL: CONFIG.SESSION_CACHE_TTL,
                debugMode: CONFIG.DEBUG_MODE,
                performanceMonitoring: CONFIG.PERFORMANCE_MONITORING,
            });

            return settings;
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error loading settings:', error);
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
            console.error('[MIO-EXTRACTOR] Error getting user credentials from settings:', error);
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

        console.log('[MIO-EXTRACTOR] Credential check:', {
            hasEmail,
            hasPassword,
            bothProvided: hasEmail && hasPassword,
        });

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
            console.error('[MIO-EXTRACTOR] Error getting user credentials from storage:', error);
            return { userEmail: '', userPassword: '' };
        }
    }

    /**
     * Send session data to the trading app - Performance Optimized with Authentication
     */
    async function sendSessionToApp(sessionData) {
        console.log('[MIO-EXTRACTOR] Sending session to app:', sessionData.sessionKey);

        // Check cache first
        const cached = getCachedSession(sessionData.sessionKey);
        if (cached) {
            console.log('[MIO-EXTRACTOR] Using cached session data');
            return true;
        }

        // Get user credentials from extension settings
        const { userEmail, userPassword } = await getUserCredentialsFromStorage();
        if (!userEmail || !userPassword) {
            console.warn(
                '[MIO-EXTRACTOR] No user credentials found. Please configure email and password in extension settings.'
            );
            return false;
        }

        console.log('[MIO-EXTRACTOR] Using user credentials for secure session submission:', { userEmail });

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

        // Method 2: Optimized API calls with authentication token
        const promises = CONFIG.APP_URLS.map(async (appUrl) => {
            try {
                const response = await fetch(`${appUrl}/api/extension/session`, {
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

        // Check if user has provided both email and password
        const hasCredentials = await hasValidCredentials();
        if (!hasCredentials) {
            console.log('[MIO-EXTRACTOR] Missing email or password credentials, skipping extraction');
            console.log('[MIO-EXTRACTOR] Please configure both email and password in extension settings');
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
     * Listen for settings changes and reload configuration
     */
    function setupSettingsListener() {
        // Listen for storage changes
        chrome.storage.onChanged.addListener(async (changes, namespace) => {
            if (namespace === 'sync' && changes.extensionSettings) {
                console.log('[MIO-EXTRACTOR] Settings changed, reloading configuration...');

                // Reload settings
                await loadSettings();

                // Restart polling with new intervals
                startAdaptivePolling();

                console.log('[MIO-EXTRACTOR] Configuration updated with new settings:', {
                    intervals: CONFIG.ADAPTIVE_INTERVALS,
                    requestTimeout: CONFIG.REQUEST_TIMEOUT,
                    maxRetries: CONFIG.MAX_RETRIES,
                    debugMode: CONFIG.DEBUG_MODE,
                });
            }
        });
    }

    /**
     * Initialize the extension with performance optimizations
     */
    async function initialize() {
        console.log('[MIO-EXTRACTOR] Initializing performance-optimized extension on:', window.location.href);

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
                        if (entry.entryType === 'navigation' && entry.domContentLoadedEventEnd) {
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
     * Note: Content scripts cannot directly access chrome-extension:// URLs for Workers
     * This functionality is disabled to prevent security errors
     */
    let performanceWorker = null;

    function initializeWebWorker() {
        // Web Workers are not supported in content scripts due to security restrictions
        // Content scripts running on external domains cannot access chrome-extension:// URLs
        console.log('[MIO-EXTRACTOR] Web Worker disabled in content script for security compliance');
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
