// MIO Session Extractor - Popup JavaScript
// Handles popup UI interactions and communication with content script

document.addEventListener('DOMContentLoaded', async () => {
    console.log('[MIO-EXTRACTOR] Popup loaded');

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

    // State
    let currentTab = null;
    let sessionData = null;

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
     * Check if current tab is MarketInOut
     */
    function isMarketInOutTab(tab) {
        return tab && tab.url && tab.url.includes('marketinout.com');
    }

    /**
     * Get stored session from Chrome storage
     */
    async function getStoredSession() {
        try {
            const result = await chrome.storage.local.get(['mioSession', 'lastUpdated']);
            if (result.mioSession && result.lastUpdated) {
                // Check if session is recent (within last 30 minutes)
                const sessionAge = Date.now() - result.lastUpdated;
                const maxAge = 30 * 60 * 1000; // 30 minutes

                if (sessionAge < maxAge) {
                    console.log('[MIO-EXTRACTOR] Found stored session:', result.mioSession.sessionKey);
                    return result.mioSession;
                } else {
                    console.log('[MIO-EXTRACTOR] Stored session is too old, ignoring');
                }
            }
            return null;
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error reading stored session:', error);
            return null;
        }
    }

    /**
     * Get status from content script and storage
     */
    async function getStatus() {
        try {
            currentTab = await getCurrentTab();

            if (!isMarketInOutTab(currentTab)) {
                updateStatus(elements.loginStatus, 'Not on MIO', 'error');
                updateStatus(elements.sessionStatus, 'N/A', 'error');
                updateStatus(elements.appStatus, 'N/A', 'error');
                elements.extractBtn.disabled = true;
                return;
            }

            // First, check stored session data
            const storedSession = await getStoredSession();

            // Send message to content script
            let response = null;
            try {
                response = await chrome.tabs.sendMessage(currentTab.id, {
                    action: 'getStatus',
                });
            } catch (error) {
                console.log('[MIO-EXTRACTOR] Could not reach content script:', error.message);
            }

            if (response) {
                // Update login status
                updateStatus(
                    elements.loginStatus,
                    response.isLoggedIn ? 'Logged In' : 'Not Logged In',
                    response.isLoggedIn ? 'success' : 'error'
                );

                // Update session status - prefer content script data, fallback to stored
                const sessionToUse = response.lastSession || storedSession;
                if (sessionToUse) {
                    sessionData = sessionToUse;
                    updateStatus(elements.sessionStatus, 'Available', 'success');
                    updateSessionInfo(sessionData);
                } else {
                    updateStatus(elements.sessionStatus, 'None', 'warning');
                    updateSessionInfo(null);
                }

                elements.extractBtn.disabled = !response.isLoggedIn;
            } else {
                // Content script not responding, use stored data only
                updateStatus(elements.loginStatus, 'Unknown', 'warning');

                if (storedSession) {
                    sessionData = storedSession;
                    updateStatus(elements.sessionStatus, 'Stored', 'success');
                    updateSessionInfo(sessionData);
                    elements.extractBtn.disabled = false;
                } else {
                    updateStatus(elements.sessionStatus, 'None', 'warning');
                    updateSessionInfo(null);
                    elements.extractBtn.disabled = true;
                }
            }

            // Check app connection by trying to reach it
            await checkAppConnection();
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error getting status:', error);
            updateStatus(elements.loginStatus, 'Error', 'error');
            updateStatus(elements.sessionStatus, 'Error', 'error');
            updateStatus(elements.appStatus, 'Error', 'error');
            elements.extractBtn.disabled = true;
        }
    }

    /**
     * Check app connection
     */
    async function checkAppConnection() {
        try {
            const appUrls = [
                'http://localhost:3000',
                'https://your-app-domain.com', // Replace with actual domain
            ];

            for (const url of appUrls) {
                try {
                    const response = await fetch(`${url}/api/extension/ping`, {
                        method: 'GET',
                        mode: 'cors',
                    });

                    if (response.ok) {
                        updateStatus(elements.appStatus, 'Connected', 'success');
                        return;
                    }
                } catch (e) {
                    // Continue to next URL
                }
            }

            updateStatus(elements.appStatus, 'Disconnected', 'warning');
        } catch (error) {
            updateStatus(elements.appStatus, 'Error', 'error');
        }
    }

    /**
     * Extract session manually
     */
    async function extractSession() {
        try {
            setLoading(true);

            if (!currentTab || !isMarketInOutTab(currentTab)) {
                throw new Error('Not on MarketInOut page');
            }

            const response = await chrome.tabs.sendMessage(currentTab.id, {
                action: 'extractSession',
            });

            if (response && response.success) {
                sessionData = response.sessionData;
                updateStatus(elements.sessionStatus, 'Extracted', 'success');
                updateSessionInfo(sessionData);

                // Show success message briefly
                const originalText = elements.extractBtn.textContent;
                elements.extractBtn.textContent = 'Success!';
                elements.extractBtn.style.background = '#4CAF50';

                setTimeout(() => {
                    elements.extractBtn.textContent = originalText;
                    elements.extractBtn.style.background = '';
                }, 2000);
            } else {
                throw new Error('Extraction failed');
            }
        } catch (error) {
            console.error('[MIO-EXTRACTOR] Error extracting session:', error);
            updateStatus(elements.sessionStatus, 'Failed', 'error');

            // Show error message briefly
            const originalText = elements.extractBtn.textContent;
            elements.extractBtn.textContent = 'Failed';
            elements.extractBtn.style.background = '#f44336';

            setTimeout(() => {
                elements.extractBtn.textContent = originalText;
                elements.extractBtn.style.background = '';
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
            'http://localhost:3000',
            'https://your-app-domain.com', // Replace with actual domain
        ];

        // Try to open the first available app URL
        chrome.tabs.create({ url: appUrls[0] });
    }

    /**
     * Show help information
     */
    function showHelp() {
        const helpText = `
MIO Session Extractor Help:

1. Navigate to marketinout.com and log in
2. Click "Extract Session" to capture your session
3. The extension will automatically send the session to your trading app
4. Use "Open App" to launch your trading tools

Troubleshooting:
- Make sure you're logged into MarketInOut
- Check that your trading app is running
- Try refreshing the MarketInOut page if extraction fails

For more help, check the extension documentation.
        `;

        alert(helpText.trim());
    }

    /**
     * Show settings (placeholder)
     */
    function showSettings() {
        alert(
            'Settings panel coming soon!\n\nFor now, you can configure the extension by editing the content-script.js file.'
        );
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

    // Initialize popup
    await getStatus();

    // Auto-refresh status every 5 seconds
    setInterval(getStatus, 5000);

    console.log('[MIO-EXTRACTOR] Popup initialized');
});
