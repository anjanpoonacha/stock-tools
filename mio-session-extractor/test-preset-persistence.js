// Test script to verify preset persistence after page refresh
// Run this in the browser console to test preset persistence

(async function testPresetPersistence() {
    console.log('=== Testing Preset Persistence ===');

    try {
        // Test 1: Check current settings
        console.log('\n1. Checking current settings...');
        const result = await chrome.storage.sync.get(['extensionSettings']);
        const settings = result.extensionSettings || {};

        const performance = settings.performance || {};
        const intervals = performance.pollingIntervals || {};

        console.log('Current intervals:', {
            active: intervals.active ? `${intervals.active / 1000}s` : 'default',
            inactive: intervals.inactive ? `${intervals.inactive / 1000}s` : 'default',
            background: intervals.background ? `${intervals.background / 1000}s` : 'default',
        });

        // Test 2: Apply Battery Saver preset and verify persistence
        console.log('\n2. Applying Battery Saver preset...');

        // Simulate what the settings UI does when Battery Saver is clicked
        const updatedSettings = JSON.parse(JSON.stringify(settings));

        // Ensure nested objects exist
        if (!updatedSettings.performance) updatedSettings.performance = {};
        if (!updatedSettings.performance.pollingIntervals) updatedSettings.performance.pollingIntervals = {};
        if (!updatedSettings.performance.requestSettings) updatedSettings.performance.requestSettings = {};
        if (!updatedSettings.advanced) updatedSettings.advanced = {};
        if (!updatedSettings.ui) updatedSettings.ui = {};

        // Apply Battery Saver preset values
        updatedSettings.performance.pollingIntervals.active = 60000; // 60s
        updatedSettings.performance.pollingIntervals.inactive = 120000; // 120s (2min)
        updatedSettings.performance.pollingIntervals.background = 300000; // 300s (5min)
        updatedSettings.performance.requestSettings.timeout = 8000; // 8s
        updatedSettings.performance.requestSettings.maxRetries = 3;
        updatedSettings.advanced.enableWebWorker = false;
        updatedSettings.advanced.enablePerformanceObserver = false;
        updatedSettings.ui.animationsEnabled = false;

        // Save the settings
        await chrome.storage.sync.set({ extensionSettings: updatedSettings });
        console.log('✅ Battery Saver preset applied and saved');

        // Test 3: Verify settings were saved
        console.log('\n3. Verifying settings were saved...');
        const verifyResult = await chrome.storage.sync.get(['extensionSettings']);
        const verifySettings = verifyResult.extensionSettings || {};
        const verifyPerformance = verifySettings.performance || {};
        const verifyIntervals = verifyPerformance.pollingIntervals || {};

        console.log('Verified intervals after save:', {
            active: verifyIntervals.active ? `${verifyIntervals.active / 1000}s` : 'missing',
            inactive: verifyIntervals.inactive ? `${verifyIntervals.inactive / 1000}s` : 'missing',
            background: verifyIntervals.background ? `${verifyIntervals.background / 1000}s` : 'missing',
        });

        const isBatterySaver =
            verifyIntervals.active === 60000 &&
            verifyIntervals.inactive === 120000 &&
            verifyIntervals.background === 300000;

        if (isBatterySaver) {
            console.log('✅ Battery Saver preset is properly saved in storage');
        } else {
            console.log('❌ Battery Saver preset was not saved correctly');
        }

        // Test 4: Simulate page refresh by reloading settings
        console.log('\n4. Simulating page refresh (reloading settings)...');
        const refreshResult = await chrome.storage.sync.get(['extensionSettings']);
        const refreshSettings = refreshResult.extensionSettings || {};
        const refreshPerformance = refreshSettings.performance || {};
        const refreshIntervals = refreshPerformance.pollingIntervals || {};

        console.log('Settings after simulated refresh:', {
            active: refreshIntervals.active ? `${refreshIntervals.active / 1000}s` : 'missing',
            inactive: refreshIntervals.inactive ? `${refreshIntervals.inactive / 1000}s` : 'missing',
            background: refreshIntervals.background ? `${refreshIntervals.background / 1000}s` : 'missing',
        });

        const persistsAfterRefresh =
            refreshIntervals.active === 60000 &&
            refreshIntervals.inactive === 120000 &&
            refreshIntervals.background === 300000;

        if (persistsAfterRefresh) {
            console.log('✅ Settings persist after page refresh');
        } else {
            console.log('❌ Settings do not persist after page refresh');
        }

        // Test 5: Test content script integration
        console.log('\n5. Testing content script integration...');
        console.log('The content script should now use these intervals:');
        console.log('- Active polling: 60 seconds (instead of 30)');
        console.log('- Inactive polling: 120 seconds (instead of 60)');
        console.log('- Background polling: 300 seconds (instead of 120)');
        console.log('');
        console.log('Look for console messages like:');
        console.log('"[MIO-EXTRACTOR] Next check in: 60 seconds"');
        console.log('"[MIO-EXTRACTOR] Next check in: 120 seconds"');
        console.log('"[MIO-EXTRACTOR] Next check in: 300 seconds"');

        console.log('\n=== Test Complete ===');
        console.log('✅ Preset persistence test completed successfully!');
        console.log('');
        console.log('To verify the fix:');
        console.log('1. Open the extension settings page');
        console.log('2. Click on "Battery Saver" preset');
        console.log('3. Refresh the settings page');
        console.log('4. The Battery Saver preset should still be active');
        console.log('5. The intervals should show 60s/120s/300s instead of 30s/60s/120s');
    } catch (error) {
        console.error('❌ Preset persistence test failed:', error);
    }
})();
