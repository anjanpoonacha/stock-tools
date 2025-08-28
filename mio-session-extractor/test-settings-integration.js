// Test script to verify settings integration is working
// This script can be run in the browser console to test the settings system

(async function testSettingsIntegration() {
    console.log('=== Testing Settings Integration ===');

    try {
        // Test 1: Load current settings
        console.log('\n1. Loading current settings...');
        const result = await chrome.storage.sync.get(['extensionSettings']);
        const settings = result.extensionSettings || {};

        console.log('Current settings structure:', {
            hasQuickSettings: !!settings.quickSettings,
            hasPerformance: !!settings.performance,
            hasGeneral: !!settings.general,
            hasPlatforms: !!settings.platforms,
        });

        // Test 2: Check if Battery Saver preset intervals are configured
        console.log('\n2. Checking Battery Saver preset intervals...');
        const performance = settings.performance || {};
        const intervals = performance.pollingIntervals || {};

        console.log('Current polling intervals:', intervals);

        // Expected Battery Saver intervals from settings.js:
        // active: 60000 (60s), inactive: 120000 (120s), background: 300000 (300s)
        const isBatterySaver =
            intervals.active === 60000 && intervals.inactive === 120000 && intervals.background === 300000;

        console.log('Is Battery Saver preset active?', isBatterySaver);

        // Test 3: Apply Battery Saver preset if not already applied
        if (!isBatterySaver) {
            console.log('\n3. Applying Battery Saver preset...');

            // Battery Saver preset from settings.js
            const batterySaverSettings = {
                'performance.pollingIntervals.active': 60000,
                'performance.pollingIntervals.inactive': 120000,
                'performance.pollingIntervals.background': 300000,
                'performance.requestSettings.timeout': 8000,
                'performance.requestSettings.maxRetries': 3,
                'advanced.enableWebWorker': false,
                'advanced.enablePerformanceObserver': false,
                'ui.animationsEnabled': false,
            };

            // Apply the settings manually for testing
            const updatedSettings = JSON.parse(JSON.stringify(settings));

            // Ensure nested objects exist
            if (!updatedSettings.performance) updatedSettings.performance = {};
            if (!updatedSettings.performance.pollingIntervals) updatedSettings.performance.pollingIntervals = {};
            if (!updatedSettings.performance.requestSettings) updatedSettings.performance.requestSettings = {};
            if (!updatedSettings.advanced) updatedSettings.advanced = {};
            if (!updatedSettings.ui) updatedSettings.ui = {};

            // Apply Battery Saver settings
            updatedSettings.performance.pollingIntervals.active = 60000;
            updatedSettings.performance.pollingIntervals.inactive = 120000;
            updatedSettings.performance.pollingIntervals.background = 300000;
            updatedSettings.performance.requestSettings.timeout = 8000;
            updatedSettings.performance.requestSettings.maxRetries = 3;
            updatedSettings.advanced.enableWebWorker = false;
            updatedSettings.advanced.enablePerformanceObserver = false;
            updatedSettings.ui.animationsEnabled = false;

            // Save updated settings
            await chrome.storage.sync.set({ extensionSettings: updatedSettings });
            console.log('Battery Saver preset applied successfully!');

            // Wait a moment for the content script to pick up the changes
            setTimeout(() => {
                console.log('\n4. Settings should now be updated in content script.');
                console.log(
                    'Check the console for "[MIO-EXTRACTOR] Settings changed, reloading configuration..." message'
                );
                console.log(
                    'The "Next check in:" message should now show 60, 120, or 300 seconds instead of 30 seconds'
                );
            }, 1000);
        } else {
            console.log('\n3. Battery Saver preset is already active!');
            console.log('The content script should be using 60s/120s/300s intervals instead of 30s/60s/120s');
        }

        // Test 4: Verify URL configuration
        console.log('\n4. Checking URL configuration...');
        const quickUrls = settings.quickSettings?.appUrls || [];
        const connectionUrls = settings.connection?.appUrls || [];
        const customUrls = settings.connection?.customUrls || [];

        console.log('Configured URLs:', {
            quickSettings: quickUrls,
            connection: connectionUrls,
            custom: customUrls,
            total: [...quickUrls, ...connectionUrls, ...customUrls].length,
        });

        const hasStockToolsUrl = [...quickUrls, ...connectionUrls, ...customUrls].some(
            (url) => url && url.includes('stock-tools-jet.vercel.app')
        );

        console.log('Has stock-tools-jet.vercel.app URL?', hasStockToolsUrl);

        console.log('\n=== Test Complete ===');
        console.log('✅ Settings integration test completed successfully!');
    } catch (error) {
        console.error('❌ Settings integration test failed:', error);
    }
})();
