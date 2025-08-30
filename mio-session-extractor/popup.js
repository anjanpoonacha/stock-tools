// Multi-Platform Session Extractor - Popup JavaScript (Performance Optimized)
// Handles popup UI interactions and communication with content script for MarketInOut and TradingView

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[MULTI-EXTRACTOR] Performance-optimized multi-platform popup loaded');

    // Platform Detection
    const PLATFORMS = {
        MARKETINOUT: 'marketinout',
        TRADINGVIEW: 'tradingview',
        UNKNOWN: 'unknown',
    };

    // Performance Configuration
    const POPUP_CONFIG = {
        AUTO_REFRESH_INTERVAL: 15000, // Reduced from 5s to 15s
        APP_CONNECTION_CACHE_TTL: 30000, // Cache app connection status for 30s
        SESSION_CACHE_TTL: 60000, // Cache session data for 60s
        MAX_RETRIES: 2,
        REQUEST_TIMEOUT: 3000, // 3 second timeout for requests
    };

    // DOM elements
    const elements = {
        loginStatus: document.getElementById('loginStatus'),
        sessionStatus: document.getElementById('sessionStatus'),
        appStatus: document.getElementById('appStatus'),
        sessionInfo: document.getElementById('sessionInfo'),
        sessionKey: document.getElementById('sessionKey'),
        extractedTime: document.getElementById('extractedTime'),
        extractBtn: document.getElementById('extractBtn'),
        openAppBtn: document.getElementById('openAppBtn'),
        loading: document.getElementById('loading'),
        content: document.getElementById('content'),
        helpLink: document.getElementById('helpLink'),
        settingsLink: document.getElementById('settingsLink'),
    };

    // State with caching
    let currentTab = null;
    let sessionData = null;
    let lastAppConnectionCheck = 0;
    let appConnectionStatus = null;
    let lastStatusUpdate = 0;
    let autoRefreshTimer = null;
    let isUpdating = false;

    /**
     * Update status display
     */
    function updateStatus(element, text, type) {
        element.textContent = text;
        element.className = `status-value status-${type}`;
    }

    /**
     * Show/hide loading state
     */
    function setLoading(show) {
        if (show) {
            elements.content.style.display = 'none';
            elements.loading.classList.add('show');
        } else {
            elements.content.style.display = 'block';
            elements.loading.classList.remove('show');
        }
    }

    /**
     * Update session info display
     */
    function updateSessionInfo(data) {
        if (data) {
            elements.sessionKey.textContent = data.sessionKey || '-';
            elements.extractedTime.textContent = data.extractedAt
                ? new Date(data.extractedAt).toLocaleTimeString()
                : '-';
            elements.sessionInfo.style.display = 'block';
        } else {
            elements.sessionInfo.style.display = 'none';
        }
    }

    /**
     * Get current active tab
     */
    async function getCurrentTab() {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        return tab;
    }

    /**
     * Get stored session from Chrome storage for specific platform
     */
    async function getStoredSession(platform = null) {
        try {
            const storageKeys = ['mioSession', 'tvSession', 'lastUpdated'];
            const result = await chrome.storage.local.get(storageKeys);

            // Determine which session to use based on platform
            let sessionData = null;
            if (platform === PLATFORMS.TRADINGVIEW && result.tvSession) {
                sessionData = result.tvSession;
            } else if (platform === PLATFORMS.MARKETINOUT && result.mioSession) {
                sessionData = result.mioSession;
            } else {
                // Fallback to any available session
                sessionData = result.mioSession || result.tvSession;
            }

            if (sessionData && result.lastUpdated) {
                // Check if session is recent (within last 30 minutes)
                const sessionAge = Date.now() - result.lastUpdated;
                const maxAge = 30 * 60 * 1000; // 30 minutes

                if (sessionAge < maxAge) {
                    console.log('[MULTI-EXTRACTOR] Found stored session for platform:', platform || 'any');
                    return sessionData;
                } else {
                    console.log('[MULTI-EXTRACTOR] Stored session is too old, ignoring');
                }
            }
            return null;
        } catch (error) {
            console.error('[MULTI-EXTRACTOR] Error reading stored session:', error);
            return null;
        }
    }

    /**
     * Detect current platform from tab URL
     */
    function detectPlatform(tab) {
        if (!tab || !tab.url) return PLATFORMS.UNKNOWN;

        if (tab.url.includes('marketinout.com')) {
            return PLATFORMS.MARKETINOUT;
        } else if (tab.url.includes('tradingview.com')) {
            return PLATFORMS.TRADINGVIEW;
        }

        return PLATFORMS.UNKNOWN;
    }

    /**
     * Check if current tab is a supported platform
     */
    function isSupportedPlatform(tab) {
        const platform = detectPlatform(tab);
        return platform !== PLATFORMS.UNKNOWN;
    }

    /**
     * Get platform display name
     */
    function getPlatformDisplayName(platform) {
        switch (platform) {
            case PLATFORMS.MARKETINOUT:
                return 'MarketInOut';
            case PLATFORMS.TRADINGVIEW:
                return 'TradingView';
            default:
                return 'Unknown';
        }
    }

    /**
     * Multi-platform status retrieval
     */
    async function getStatus() {
        try {
            currentTab = await getCurrentTab();
            const currentPlatform = detectPlatform(currentTab);

            if (!isSupportedPlatform(currentTab)) {
                const platformName = getPlatformDisplayName(currentPlatform);
                updateStatus(elements.loginStatus, `Not on supported platform`, 'error');
                updateStatus(elements.sessionStatus, 'N/A', 'error');
                updateStatus(elements.appStatus, 'N/A', 'error');
                elements.extractBtn.disabled = true;
                return;
            }

            const platformName = getPlatformDisplayName(currentPlatform);
            console.log(`[MULTI-EXTRACTOR] Checking status for ${platformName}`);

            // First, check stored session data for current platform
            const storedSession = await getStoredSession(currentPlatform);

            // Send message to content script
            let response = null;
            try {
                response = await chrome.tabs.sendMessage(currentTab.id, {
                    action: 'getStatus',
                });
            } catch (error) {
                console.log(`[MULTI-EXTRACTOR] Could not reach ${platformName} content script:`, error.message);
            }

            if (response) {
                // Update login status with platform info
                updateStatus(
                    elements.loginStatus,
                    response.isLoggedIn ? `${platformName}: Logged In` : `${platformName}: Not Logged In`,
                    response.isLoggedIn ? 'success' : 'error'
                );

                // Update session status - prefer content script data, fallback to stored
                const sessionToUse = response.lastSession || storedSession;
                if (sessionToUse) {
                    sessionData = sessionToUse;
                    updateStatus(elements.sessionStatus, `${platformName}: Available`, 'success');
                    updateSessionInfo(sessionData);
                } else {
                    updateStatus(elements.sessionStatus, `${platformName}: None`, 'warning');
                    updateSessionInfo(null);
                }

                elements.extractBtn.disabled = !response.isLoggedIn;
            } else {
                // Content script not responding, use stored data only
                updateStatus(elements.loginStatus, `${platformName}: Unknown`, 'warning');

                if (storedSession) {
                    sessionData = storedSession;
                    updateStatus(elements.sessionStatus, `${platformName}: Stored`, 'success');
                    updateSessionInfo(sessionData);
                    elements.extractBtn.disabled = false;
                } else {
                    updateStatus(elements.sessionStatus, `${platformName}: None`, 'warning');
                    updateSessionInfo(null);
                    elements.extractBtn.disabled = true;
                }
            }

            // Check app connection by trying to reach it
            await checkAppConnection();
        } catch (error) {
            console.error('[MULTI-EXTRACTOR] Error getting status:', error);
            updateStatus(elements.loginStatus, 'Error', 'error');
            updateStatus(elements.sessionStatus, 'Error', 'error');
            updateStatus(elements.appStatus, 'Error', 'error');
            elements.extractBtn.disabled = true;
        }
    }

    /**
     * Check app connection with caching and timeout
     */
    async function checkAppConnection(forceRefresh = false) {
        const now = Date.now();

        // Use cached result if available and not expired
        if (
            !forceRefresh &&
            appConnectionStatus &&
            now - lastAppConnectionCheck < POPUP_CONFIG.APP_CONNECTION_CACHE_TTL
        ) {
            updateStatus(elements.appStatus, appConnectionStatus.text, appConnectionStatus.type);
            return;
        }

        try {
            const appUrls = [
                // 'http://localhost:3001',
                // 'http://localhost:3000',
                // 'https://your-app-domain.com', // Replace with actual domain
            ];

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), POPUP_CONFIG.REQUEST_TIMEOUT);

            for (const url of appUrls) {
                try {
                    const response = await fetch(`${url}/api/extension/ping`, {
                        method: 'GET',
                        mode: 'cors',
                        signal: controller.signal,
                    });

                    clearTimeout(timeoutId);

                    if (response.ok) {
                        appConnectionStatus = { text: 'Connected', type: 'success' };
                        lastAppConnectionCheck = now;
                        updateStatus(elements.appStatus, 'Connected', 'success');
                        return;
                    }
                } catch (e) {
                    if (e.name === 'AbortError') {
                        console.log('[MIO-EXTRACTOR] App connection check timed out for:', url);
                    }
                    // Continue to next URL
                }
            }

            clearTimeout(timeoutId);
            appConnectionStatus = { text: 'Disconnected', type: 'warning' };
            lastAppConnectionCheck = now;
            updateStatus(elements.appStatus, 'Disconnected', 'warning');
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error checking app connection:', error);
            appConnectionStatus = { text: 'Error', type: 'error' };
            lastAppConnectionCheck = now;
            updateStatus(elements.appStatus, 'Error', 'error');
        }
    }

    /**
     * Extract session manually for current platform
     */
    async function extractSession() {
        try {
            setLoading(true);

            if (!currentTab || !isSupportedPlatform(currentTab)) {
                const platform = detectPlatform(currentTab);
                const platformName = getPlatformDisplayName(platform);
                throw new Error(`Not on supported platform (current: ${platformName})`);
            }

            const currentPlatform = detectPlatform(currentTab);
            const platformName = getPlatformDisplayName(currentPlatform);

            const response = await chrome.tabs.sendMessage(currentTab.id, {
                action: 'extractSession',
            });

            if (response && response.success) {
                sessionData = response.sessionData;
                updateStatus(elements.sessionStatus, `${platformName}: Extracted`, 'success');
                updateSessionInfo(sessionData);

                // Show success message briefly
                const originalText = elements.extractBtn.textContent;
                elements.extractBtn.textContent = 'Success!';
                elements.extractBtn.classList.add('btn-success');

                setTimeout(() => {
                    elements.extractBtn.textContent = originalText;
                    elements.extractBtn.classList.remove('btn-success');
                }, 2000);
            } else {
                throw new Error(`${platformName} extraction failed`);
            }
        } catch (error) {
            console.error('[MULTI-EXTRACTOR] Error extracting session:', error);
            updateStatus(elements.sessionStatus, 'Failed', 'error');

            // Show error message briefly
            const originalText = elements.extractBtn.textContent;
            elements.extractBtn.textContent = 'Failed';
            elements.extractBtn.classList.add('btn-error');

            setTimeout(() => {
                elements.extractBtn.textContent = originalText;
                elements.extractBtn.classList.remove('btn-error');
            }, 2000);
        } finally {
            setLoading(false);
        }
    }

    /**
     * Open trading app
     */
    function openApp() {
        const appUrls = [
            // No default URLs - configure in extension settings
        ];

        // Try to open the first available app URL
        chrome.tabs.create({ url: appUrls[0] });
    }

    /**
     * Show help information
     */
    function showHelp() {
        const helpText = `
Multi-Platform Session Extractor Help:

Supported Platforms:
• MarketInOut (marketinout.com)
• TradingView (tradingview.com)

How to use:
1. Navigate to a supported platform and log in
2. Click "Extract Session" to capture your session
3. The extension will automatically send the session to your trading app
4. Use "Open App" to launch your trading tools

Troubleshooting:
- Make sure you're logged into the platform
- Check that your trading app is running (localhost:3000 or localhost:3001)
- Try refreshing the page if extraction fails
- Ensure you're on a supported platform

For more help, check the extension documentation.
        `;

        alert(helpText.trim());
    }

    /**
     * Show settings page
     */
    function showSettings() {
        chrome.runtime.openOptionsPage();
    }

    // Event listeners
    elements.extractBtn.addEventListener('click', extractSession);
    elements.openAppBtn.addEventListener('click', openApp);
    elements.helpLink.addEventListener('click', (e) => {
        e.preventDefault();
        showHelp();
    });
    elements.settingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        showSettings();
    });

    /**
     * Optimized status update with throttling
     */
    async function updateStatusOptimized(forceRefresh = false) {
        const now = Date.now();

        // Prevent concurrent updates
        if (isUpdating && !forceRefresh) {
            console.log('[MULTI-EXTRACTOR] Status update already in progress, skipping');
            return;
        }

        // Throttle updates (minimum interval between updates)
        if (!forceRefresh && now - lastStatusUpdate < 5000) {
            console.log('[MULTI-EXTRACTOR] Status update throttled');
            return;
        }

        isUpdating = true;
        lastStatusUpdate = now;

        try {
            await getStatus();
        } catch (error) {
            console.error('[MULTI-EXTRACTOR] Error in optimized status update:', error);
        } finally {
            isUpdating = false;
        }
    }

    /**
     * Start adaptive auto-refresh with performance monitoring
     */
    function startAdaptiveRefresh() {
        // Clear any existing timer
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
        }

        // Set up adaptive refresh interval
        autoRefreshTimer = setInterval(() => {
            updateStatusOptimized(false);
        }, POPUP_CONFIG.AUTO_REFRESH_INTERVAL);

        console.log(
            '[MULTI-EXTRACTOR] Adaptive refresh started with',
            POPUP_CONFIG.AUTO_REFRESH_INTERVAL / 1000,
            'second interval'
        );
    }

    /**
     * Cleanup function for popup
     */
    function cleanup() {
        if (autoRefreshTimer) {
            clearInterval(autoRefreshTimer);
            autoRefreshTimer = null;
        }
        console.log('[MULTI-EXTRACTOR] Popup cleanup completed');
    }

    // Initialize popup with performance optimizations
    console.log('[MULTI-EXTRACTOR] Initializing performance-optimized multi-platform popup...');

    // Initial status check
    await updateStatusOptimized(true);

    // Start adaptive refresh
    startAdaptiveRefresh();

    // Cleanup on popup close
    window.addEventListener('beforeunload', cleanup);
    window.addEventListener('unload', cleanup);

    console.log('[MULTI-EXTRACTOR] Performance-optimized multi-platform popup initialized successfully');
    console.log('[MULTI-EXTRACTOR] Configuration:', {
        autoRefreshInterval: POPUP_CONFIG.AUTO_REFRESH_INTERVAL / 1000 + 's',
        appConnectionCacheTTL: POPUP_CONFIG.APP_CONNECTION_CACHE_TTL / 1000 + 's',
        requestTimeout: POPUP_CONFIG.REQUEST_TIMEOUT / 1000 + 's',
        supportedPlatforms: Object.values(PLATFORMS).filter((p) => p !== PLATFORMS.UNKNOWN),
    });
});
