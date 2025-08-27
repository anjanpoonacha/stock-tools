// MIO Session Extractor - Background Service Worker
// Handles extension badge updates and background tasks

chrome.runtime.onInstalled.addListener(() => {
    console.log('[MIO-EXTRACTOR] Extension installed');

    // Set initial badge
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#666666' });
});

// Handle messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('[MIO-EXTRACTOR] Background received message:', request);

    if (request.action === 'updateBadge') {
        chrome.action.setBadgeText({
            text: request.text || '',
            tabId: sender.tab?.id,
        });

        if (request.color) {
            chrome.action.setBadgeBackgroundColor({
                color: request.color,
                tabId: sender.tab?.id,
            });
        }

        console.log('[MIO-EXTRACTOR] Badge updated:', request.text);
    }

    sendResponse({ success: true });
});

// Handle extension icon click (when no popup is defined)
chrome.action.onClicked.addListener((tab) => {
    console.log('[MIO-EXTRACTOR] Extension icon clicked on tab:', tab.url);

    // Send message to content script to extract session
    chrome.tabs.sendMessage(tab.id, { action: 'extractSession' }, (response) => {
        if (chrome.runtime.lastError) {
            console.log('[MIO-EXTRACTOR] No content script found on this tab');
        } else {
            console.log('[MIO-EXTRACTOR] Manual extraction response:', response);
        }
    });
});

// Monitor tab updates to reset badge when leaving MarketInOut
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (!tab.url.includes('marketinout.com')) {
            // Reset badge when leaving MarketInOut
            chrome.action.setBadgeText({ text: '', tabId: tabId });
        }
    }
});

console.log('[MIO-EXTRACTOR] Background service worker loaded');
