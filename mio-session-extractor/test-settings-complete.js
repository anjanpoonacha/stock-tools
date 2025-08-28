// Comprehensive Settings System Test
// Tests the complete settings flow: SettingsManager -> Settings UI -> Content Script

(function () {
    'use strict';

    console.log('[SETTINGS-TEST] Starting comprehensive settings system test...');

    // Test configuration
    const TEST_CONFIG = {
        testTimeout: 30000, // 30 seconds
        presetTestDelay: 2000, // 2 seconds between preset tests
        settingsReloadDelay: 1000, // 1 second for settings to reload
    };

    // Test results tracking
    const testResults = {
        passed: 0,
        failed: 0,
        errors: [],
        details: [],
    };

    /**
     * Test utility functions
     */
    function assert(condition, message) {
        if (condition) {
            testResults.passed++;
            testResults.details.push(`✓ ${message}`);
            console.log(`[SETTINGS-TEST] ✓ ${message}`);
        } else {
            testResults.failed++;
            testResults.errors.push(message);
            testResults.details.push(`✗ ${message}`);
            console.error(`[SETTINGS-TEST] ✗ ${message}`);
        }
    }

    function sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * Test 1: Settings Manager Initialization
     */
    async function testSettingsManagerInit() {
        console.log('[SETTINGS-TEST] Testing Settings Manager initialization...');

        // Check if SettingsManager is available
        assert(typeof window.SettingsManager !== 'undefined', 'SettingsManager is available globally');

        if (!window.SettingsManager) {
            return false;
        }

        const settingsManager = window.SettingsManager;

        // Test initialization
        try {
            await settingsManager.initialize();
            assert(settingsManager.isInitialized, 'SettingsManager initialized successfully');
        } catch (error) {
            assert(false, `SettingsManager initialization failed: ${error.message}`);
            return false;
        }

        // Test basic methods exist
        assert(typeof settingsManager.loadSettings === 'function', 'loadSettings method exists');
        assert(typeof settingsManager.saveSettings === 'function', 'saveSettings method exists');
        assert(typeof settingsManager.get === 'function', 'get method exists');
        assert(typeof settingsManager.set === 'function', 'set method exists');
        assert(typeof settingsManager.applyPreset === 'function', 'applyPreset method exists');
        assert(typeof settingsManager.getPresets === 'function', 'getPresets method exists');
        assert(typeof settingsManager.clearCache === 'function', 'clearCache method exists');

        return true;
    }

    /**
     * Test 2: Default Settings Structure
     */
    async function testDefaultSettings() {
        console.log('[SETTINGS-TEST] Testing default settings structure...');

        const settingsManager = window.SettingsManager;
        const settings = await settingsManager.loadSettings();

        // Test main structure
        assert(typeof settings === 'object', 'Settings is an object');
        assert(typeof settings.quickSettings === 'object', 'quickSettings section exists');
        assert(typeof settings.performance === 'object', 'performance section exists');
        assert(typeof settings.connection === 'object', 'connection section exists');
        assert(typeof settings.platforms === 'object', 'platforms section exists');

        // Test quickSettings structure
        assert(Array.isArray(settings.quickSettings.appUrls), 'quickSettings.appUrls is an array');
        assert(
            settings.quickSettings.appUrls.includes('https://stock-tools-jet.vercel.app'),
            'Default URL is set correctly'
        );

        // Test performance intervals
        const intervals = settings.performance?.pollingIntervals;
        assert(typeof intervals === 'object', 'pollingIntervals exists');
        assert(typeof intervals.active === 'number', 'active interval is a number');
        assert(typeof intervals.inactive === 'number', 'inactive interval is a number');
        assert(typeof intervals.background === 'number', 'background interval is a number');

        // Test default values
        assert(intervals.active === 30000, 'Default active interval is 30s');
        assert(intervals.inactive === 60000, 'Default inactive interval is 60s');
        assert(intervals.background === 120000, 'Default background interval is 120s');

        return true;
    }

    /**
     * Test 3: Preset System
     */
    async function testPresetSystem() {
        console.log('[SETTINGS-TEST] Testing preset system...');

        const settingsManager = window.SettingsManager;
        const presets = settingsManager.getPresets();

        // Test preset structure
        assert(typeof presets === 'object', 'Presets object exists');
        assert(typeof presets.performance === 'object', 'Performance preset exists');
        assert(typeof presets.balanced === 'object', 'Balanced preset exists');
        assert(typeof presets.battery === 'object', 'Battery preset exists');
        assert(typeof presets.developer === 'object', 'Developer preset exists');

        // Test battery preset specifically (this was the main issue)
        const batteryPreset = presets.battery;
        assert(typeof batteryPreset.settings === 'object', 'Battery preset has settings');

        const batteryIntervals = {
            active: batteryPreset.settings['performance.pollingIntervals.active'],
            inactive: batteryPreset.settings['performance.pollingIntervals.inactive'],
            background: batteryPreset.settings['performance.pollingIntervals.background'],
        };

        assert(batteryIntervals.active === 60000, 'Battery preset active interval is 60s');
        assert(batteryIntervals.inactive === 120000, 'Battery preset inactive interval is 120s');
        assert(batteryIntervals.background === 300000, 'Battery preset background interval is 300s (5min)');

        return true;
    }

    /**
     * Test 4: Preset Application
     */
    async function testPresetApplication() {
        console.log('[SETTINGS-TEST] Testing preset application...');

        const settingsManager = window.SettingsManager;

        // Test applying battery preset
        try {
            await settingsManager.applyPreset('battery');
            assert(true, 'Battery preset applied without error');

            // Wait for settings to be saved
            await sleep(TEST_CONFIG.settingsReloadDelay);

            // Force reload settings to ensure they were saved
            settingsManager.clearCache();
            const settings = await settingsManager.loadSettings(true);

            // Verify battery preset intervals were applied
            const intervals = settings.performance?.pollingIntervals;
            assert(intervals.active === 60000, 'Battery preset active interval applied (60s)');
            assert(intervals.inactive === 120000, 'Battery preset inactive interval applied (120s)');
            assert(intervals.background === 300000, 'Battery preset background interval applied (300s)');
        } catch (error) {
            assert(false, `Battery preset application failed: ${error.message}`);
            return false;
        }

        // Test applying balanced preset (reset to default)
        try {
            await settingsManager.applyPreset('balanced');
            assert(true, 'Balanced preset applied without error');

            await sleep(TEST_CONFIG.settingsReloadDelay);

            settingsManager.clearCache();
            const settings = await settingsManager.loadSettings(true);

            const intervals = settings.performance?.pollingIntervals;
            assert(intervals.active === 30000, 'Balanced preset active interval applied (30s)');
            assert(intervals.inactive === 60000, 'Balanced preset inactive interval applied (60s)');
            assert(intervals.background === 120000, 'Balanced preset background interval applied (120s)');
        } catch (error) {
            assert(false, `Balanced preset application failed: ${error.message}`);
            return false;
        }

        return true;
    }

    /**
     * Test 5: Settings Persistence
     */
    async function testSettingsPersistence() {
        console.log('[SETTINGS-TEST] Testing settings persistence...');

        const settingsManager = window.SettingsManager;

        // Set a custom value
        const testValue = 45000; // 45 seconds
        try {
            await settingsManager.set('performance.pollingIntervals.active', testValue);
            assert(true, 'Custom setting value set without error');

            // Clear cache and reload
            settingsManager.clearCache();
            const reloadedValue = settingsManager.get('performance.pollingIntervals.active');
            assert(
                reloadedValue === testValue,
                `Custom setting persisted correctly (${reloadedValue} === ${testValue})`
            );
        } catch (error) {
            assert(false, `Settings persistence test failed: ${error.message}`);
            return false;
        }

        return true;
    }

    /**
     * Test 6: Cache Management
     */
    async function testCacheManagement() {
        console.log('[SETTINGS-TEST] Testing cache management...');

        const settingsManager = window.SettingsManager;

        // Load settings to populate cache
        await settingsManager.loadSettings();

        // Verify cache is working (should be fast)
        const start = performance.now();
        await settingsManager.loadSettings();
        const cacheTime = performance.now() - start;
        assert(cacheTime < 10, `Cache is working (load time: ${cacheTime.toFixed(2)}ms)`);

        // Test cache clearing
        settingsManager.clearCache();
        assert(settingsManager.cacheTimestamp === 0, 'Cache cleared successfully');

        // Test force reload
        const start2 = performance.now();
        await settingsManager.loadSettings(true);
        const reloadTime = performance.now() - start2;
        assert(
            reloadTime > cacheTime,
            `Force reload bypassed cache (${reloadTime.toFixed(2)}ms > ${cacheTime.toFixed(2)}ms)`
        );

        return true;
    }

    /**
     * Test 7: Settings UI Integration (if available)
     */
    async function testSettingsUIIntegration() {
        console.log('[SETTINGS-TEST] Testing Settings UI integration...');

        // Check if we're on the settings page
        const isSettingsPage = window.location.href.includes('settings.html');
        if (!isSettingsPage) {
            assert(true, 'Settings UI test skipped (not on settings page)');
            return true;
        }

        // Wait for UI to initialize
        await sleep(2000);

        // Check if preset cards exist
        const presetCards = document.querySelectorAll('.preset-card');
        assert(presetCards.length >= 4, `Preset cards found (${presetCards.length})`);

        // Check if active preset is detected
        const activeCard = document.querySelector('.preset-card.active');
        assert(activeCard !== null, 'Active preset card is marked');

        if (activeCard) {
            const presetName = activeCard.dataset.preset;
            assert(typeof presetName === 'string', `Active preset detected: ${presetName}`);
        }

        return true;
    }

    /**
     * Test 8: Chrome Storage Integration
     */
    async function testChromeStorageIntegration() {
        console.log('[SETTINGS-TEST] Testing Chrome storage integration...');

        try {
            // Test if chrome.storage is available
            if (typeof chrome !== 'undefined' && chrome.storage) {
                // Try to read from storage
                const result = await new Promise((resolve, reject) => {
                    chrome.storage.sync.get(['extensionSettings'], (result) => {
                        if (chrome.runtime.lastError) {
                            reject(chrome.runtime.lastError);
                        } else {
                            resolve(result);
                        }
                    });
                });

                assert(typeof result === 'object', 'Chrome storage is accessible');
                assert(typeof result.extensionSettings === 'object', 'Extension settings exist in storage');
            } else {
                assert(true, 'Chrome storage test skipped (not in extension context)');
            }
        } catch (error) {
            assert(false, `Chrome storage test failed: ${error.message}`);
            return false;
        }

        return true;
    }

    /**
     * Run all tests
     */
    async function runAllTests() {
        console.log('[SETTINGS-TEST] Starting comprehensive settings system test suite...');

        const startTime = performance.now();

        try {
            // Run tests in sequence
            await testSettingsManagerInit();
            await testDefaultSettings();
            await testPresetSystem();
            await testPresetApplication();
            await testSettingsPersistence();
            await testCacheManagement();
            await testSettingsUIIntegration();
            await testChromeStorageIntegration();
        } catch (error) {
            console.error('[SETTINGS-TEST] Test suite error:', error);
            testResults.errors.push(`Test suite error: ${error.message}`);
            testResults.failed++;
        }

        const endTime = performance.now();
        const duration = endTime - startTime;

        // Print results
        console.log('\n[SETTINGS-TEST] ========== TEST RESULTS ==========');
        console.log(`[SETTINGS-TEST] Duration: ${duration.toFixed(2)}ms`);
        console.log(`[SETTINGS-TEST] Passed: ${testResults.passed}`);
        console.log(`[SETTINGS-TEST] Failed: ${testResults.failed}`);
        console.log(`[SETTINGS-TEST] Total: ${testResults.passed + testResults.failed}`);

        if (testResults.failed > 0) {
            console.log('\n[SETTINGS-TEST] ERRORS:');
            testResults.errors.forEach((error) => console.error(`[SETTINGS-TEST] - ${error}`));
        }

        console.log('\n[SETTINGS-TEST] DETAILED RESULTS:');
        testResults.details.forEach((detail) => console.log(`[SETTINGS-TEST] ${detail}`));

        console.log('\n[SETTINGS-TEST] ========== END RESULTS ==========');

        // Return summary
        return {
            passed: testResults.passed,
            failed: testResults.failed,
            errors: testResults.errors,
            duration: duration,
            success: testResults.failed === 0,
        };
    }

    // Auto-run tests when script loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runAllTests, 1000);
        });
    } else {
        setTimeout(runAllTests, 1000);
    }

    // Export for manual testing
    window.runSettingsTests = runAllTests;

    console.log('[SETTINGS-TEST] Test suite loaded. Run window.runSettingsTests() to execute manually.');
})();
