// MIO Session Extractor - Background Service Worker (Performance Optimized)
// Phase 2 & 3: Advanced optimizations with efficient background processing

// Performance Configuration
const BACKGROUND_CONFIG = {
    BADGE_UPDATE_THROTTLE: 1000, // Throttle badge updates to 1 per second
    STORAGE_CLEANUP_INTERVAL: 300000, // Clean storage every 5 minutes
    MAX_STORAGE_ENTRIES: 50, // Maximum stored sessions
    IDLE_DETECTION_INTERVAL: 30000, // Check idle state every 30s
    TAB_LIFECYCLE_CLEANUP_DELAY: 5000, // Cleanup delay after tab close
};

// State management
let lastBadgeUpdate = 0;
let badgeUpdateQueue = new Map();
let storageCleanupTimer = null;
let tabStates = new Map(); // Track tab lifecycle states
let performanceMetrics = {
    badgeUpdates: 0,
    storageOperations: 0,
    messagesSent: 0,
    tabsTracked: 0,
};

/**
 * Phase 2: Background Script Efficiency
 * Lazy loading and optimized badge updates
 */

// Throttled badge update to prevent excessive UI updates
function updateBadgeThrottled(tabId, text, color) {
    const now = Date.now();
    const key = `${tabId}-${text}-${color}`;

    // Skip if same update was recently applied
    if (badgeUpdateQueue.has(key) && now - badgeUpdateQueue.get(key) < BACKGROUND_CONFIG.BADGE_UPDATE_THROTTLE) {
        return;
    }

    badgeUpdateQueue.set(key, now);

    // Batch badge updates
    requestIdleCallback(() => {
        chrome.action.setBadgeText({ text: text || '', tabId: tabId });
        if (color) {
            chrome.action.setBadgeBackgroundColor({ color: color, tabId: tabId });
        }
        performanceMetrics.badgeUpdates++;
    });
}

/**
 * Phase 2: Storage Optimization
 * Compress and manage storage efficiently
 */
function compressSessionData(sessionData) {
    try {
        // Simple compression: remove unnecessary fields and compress JSON
        const compressed = {
            k: sessionData.sessionKey,
            v: sessionData.sessionValue,
            t: Date.now(),
            u: sessionData.url ? sessionData.url.substring(0, 100) : undefined, // Truncate URL
        };
        return JSON.stringify(compressed);
    } catch (error) {
        console.error('[MIO-EXTRACTOR] Error compressing session data:', error);
        return JSON.stringify(sessionData);
    }
}

function decompressSessionData(compressedData) {
    try {
        const data = JSON.parse(compressedData);
        if (data.k && data.v) {
            // Decompress format
            return {
                sessionKey: data.k,
                sessionValue: data.v,
                extractedAt: new Date(data.t).toISOString(),
                url: data.u,
            };
        }
        return data; // Return as-is if not compressed format
    } catch (error) {
        console.error('[MIO-EXTRACTOR] Error decompressing session data:', error);
        return null;
    }
}

async function cleanupStorage() {
    try {
        const result = await chrome.storage.local.get(null);
        const entries = Object.entries(result);

        if (entries.length > BACKGROUND_CONFIG.MAX_STORAGE_ENTRIES) {
            // Sort by timestamp and keep only recent entries
            const sortedEntries = entries
                .filter(([key]) => key.startsWith('mioSession_'))
                .sort(([, a], [, b]) => (b.lastUpdated || 0) - (a.lastUpdated || 0))
                .slice(BACKGROUND_CONFIG.MAX_STORAGE_ENTRIES);

            // Remove old entries
            const keysToRemove = sortedEntries.map(([key]) => key);
            if (keysToRemove.length > 0) {
                await chrome.storage.local.remove(keysToRemove);
                console.log(`[MIO-EXTRACTOR] Cleaned up ${keysToRemove.length} old storage entries`);
            }
        }

        performanceMetrics.storageOperations++;
    } catch (error) {
        console.error('[MIO-EXTRACTOR] Error during storage cleanup:', error);
    }
}

/**
 * Phase 2: Tab Lifecycle Management
 * Efficient tracking and cleanup of tab states
 */
function trackTabState(tabId, state) {
    tabStates.set(tabId, {
        state: state,
        lastUpdate: Date.now(),
        isMarketInOut: false,
    });
    performanceMetrics.tabsTracked++;
}

function cleanupTabState(tabId) {
    setTimeout(() => {
        tabStates.delete(tabId);
        // Clear any tab-specific badge
        chrome.action.setBadgeText({ text: '', tabId: tabId }).catch(() => {
            // Tab might be closed, ignore error
        });
    }, BACKGROUND_CONFIG.TAB_LIFECYCLE_CLEANUP_DELAY);
}

/**
 * Phase 3: Event-Driven Architecture
 * Optimized message passing and state management
 */

// Lazy initialization on first use
chrome.runtime.onInstalled.addListener(() => {
    console.log('[MIO-EXTRACTOR] Performance-optimized background service worker installed');

    // Initialize with minimal operations
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#666666' });

    // Start storage cleanup timer
    storageCleanupTimer = setInterval(cleanupStorage, BACKGROUND_CONFIG.STORAGE_CLEANUP_INTERVAL);

    console.log('[MIO-EXTRACTOR] Background optimizations initialized');
});

// Optimized message handling with performance monitoring
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    const startTime = performance.now();

    try {
        if (request.action === 'updateBadge') {
            updateBadgeThrottled(sender.tab?.id, request.text, request.color);

            // Track tab state
            if (sender.tab?.id) {
                trackTabState(sender.tab.id, 'active');
            }
        }

        if (request.action === 'getCookie') {
            // Handle cookie requests from content script
            chrome.cookies.get(
                {
                    url: request.url,
                    name: request.name,
                },
                (cookie) => {
                    if (chrome.runtime.lastError) {
                        console.error('[MIO-EXTRACTOR] Error getting cookie:', chrome.runtime.lastError);
                        sendResponse({ success: false, error: chrome.runtime.lastError.message, cookie: null });
                    } else {
                        console.log(
                            `[MIO-EXTRACTOR] Cookie retrieved: ${request.name} from ${request.url}`,
                            cookie ? 'found' : 'not found'
                        );
                        sendResponse({ success: true, cookie: cookie });
                    }
                }
            );
            return true; // Keep message channel open for async response
        }

        if (request.action === 'storeSession') {
            // Phase 2: Compressed storage
            requestIdleCallback(async () => {
                try {
                    const compressed = compressSessionData(request.sessionData);
                    await chrome.storage.local.set({
                        [`mioSession_${Date.now()}`]: {
                            data: compressed,
                            lastUpdated: Date.now(),
                        },
                    });
                    performanceMetrics.storageOperations++;
                } catch (error) {
                    console.error('[MIO-EXTRACTOR] Error storing compressed session:', error);
                }
            });
        }

        performanceMetrics.messagesSent++;

        const processingTime = performance.now() - startTime;
        if (processingTime > 10) {
            // Log slow operations
            console.warn(
                `[MIO-EXTRACTOR] Slow message processing: ${processingTime.toFixed(2)}ms for ${request.action}`
            );
        }

        sendResponse({ success: true, processingTime });
    } catch (error) {
        console.error('[MIO-EXTRACTOR] Error handling message:', error);
        sendResponse({ success: false, error: error.message });
    }

    return true; // Keep message channel open for async operations
});

// Phase 3: Advanced tab lifecycle management
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        const isMarketInOut = tab.url.includes('marketinout.com');

        // Update tab state
        const tabState = tabStates.get(tabId) || {};
        tabState.isMarketInOut = isMarketInOut;
        tabState.lastUpdate = Date.now();
        tabStates.set(tabId, tabState);

        if (!isMarketInOut) {
            // Lazy badge reset - only if badge was previously set
            requestIdleCallback(() => {
                chrome.action.setBadgeText({ text: '', tabId: tabId });
            });
        }
    }
});

// Cleanup when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
    cleanupTabState(tabId);
});

// Phase 3: Idle detection for performance optimization
chrome.idle.onStateChanged.addListener((state) => {
    console.log(`[MIO-EXTRACTOR] System idle state changed: ${state}`);

    if (state === 'idle') {
        // Perform maintenance tasks during idle time
        requestIdleCallback(() => {
            cleanupStorage();

            // Clean up old tab states
            const now = Date.now();
            for (const [tabId, tabState] of tabStates.entries()) {
                if (now - tabState.lastUpdate > 300000) {
                    // 5 minutes old
                    tabStates.delete(tabId);
                }
            }
        });
    }
});

// Performance monitoring endpoint
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getPerformanceMetrics') {
        sendResponse({
            metrics: performanceMetrics,
            tabStates: tabStates.size,
            badgeQueue: badgeUpdateQueue.size,
            uptime: Date.now() - (chrome.runtime.getManifest().version_name || 0),
        });
        return true;
    }
});

// Cleanup on service worker shutdown
self.addEventListener('beforeunload', () => {
    if (storageCleanupTimer) {
        clearInterval(storageCleanupTimer);
    }
    console.log('[MIO-EXTRACTOR] Background service worker cleanup completed');
});

console.log('[MIO-EXTRACTOR] Performance-optimized background service worker loaded');
console.log('[MIO-EXTRACTOR] Phase 2 & 3 optimizations active');
