// MIO Session Extractor - Content Script
// This script runs on marketinout.com pages and extracts ASPSESSIONID cookies

(function () {
    'use strict';

    console.log('[MIO-EXTRACTOR] Content script loaded on:', window.location.href);

    // Configuration
    const CONFIG = {
        APP_URLS: [
            'http://localhost:3001',
            'http://localhost:3000',
            // 'https://your-app-domain.com', // Replace with your actual domain
        ],
        CHECK_INTERVAL: 10000, // Check every 10 seconds (reduced from 2)
        RETRY_DELAY: 5000, // Wait 5 seconds between retries
        MIN_REQUEST_INTERVAL: 5000, // Minimum 5 seconds between API requests
        MAX_RETRIES: 3,
    };

    // State tracking
    let lastExtractedSession = null;
    let extractionAttempts = 0;
    let lastRequestTime = 0;
    let isProcessing = false;

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
     * Send session data to the trading app
     */
    async function sendSessionToApp(sessionData) {
        console.log('[MIO-EXTRACTOR] Sending session to app:', sessionData.sessionKey);

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

        // Method 2: Direct API call to trading app
        for (const appUrl of CONFIG.APP_URLS) {
            try {
                const response = await fetch(`${appUrl}/api/extension/session`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(sessionData),
                });

                if (response.ok) {
                    const result = await response.json();
                    console.log('[MIO-EXTRACTOR] Successfully sent to app:', appUrl, result);

                    // Update extension badge to show success
                    chrome.runtime.sendMessage({
                        action: 'updateBadge',
                        text: '✓',
                        color: '#4CAF50',
                    });

                    return true;
                } else {
                    console.warn('[MIO-EXTRACTOR] App responded with error:', response.status);
                }
            } catch (error) {
                console.log('[MIO-EXTRACTOR] Could not reach app at:', appUrl, error.message);
            }
        }

        // Method 3: PostMessage to any open app windows
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
     * Initialize the extension
     */
    function initialize() {
        console.log('[MIO-EXTRACTOR] Initializing on MarketInOut page');

        // Run initial check
        setTimeout(processSession, 1000);

        // Set up periodic checking
        setInterval(processSession, CONFIG.CHECK_INTERVAL);

        // Listen for page navigation changes
        let lastUrl = window.location.href;
        const observer = new MutationObserver(() => {
            if (window.location.href !== lastUrl) {
                lastUrl = window.location.href;
                console.log('[MIO-EXTRACTOR] Page navigation detected:', lastUrl);
                setTimeout(processSession, 2000); // Wait for page to load
            }
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        // Listen for messages from extension popup
        chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
            console.log('[MIO-EXTRACTOR] Received message:', request);

            if (request.action === 'extractSession') {
                processSession().then(() => {
                    sendResponse({
                        success: true,
                        sessionData: lastExtractedSession,
                        isLoggedIn: isLoggedIn(),
                    });
                });
                return true; // Keep message channel open for async response
            }

            if (request.action === 'getStatus') {
                sendResponse({
                    isLoggedIn: isLoggedIn(),
                    lastSession: lastExtractedSession,
                    url: window.location.href,
                });
            }
        });

        console.log('[MIO-EXTRACTOR] Extension initialized successfully');
    }

    // Start the extension when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
