// Test script to verify username/password persistence in extension settings
// Run this in the browser console on the settings page

(function testCredentialPersistence() {
    'use strict';

    console.log('[TEST] Starting credential persistence test...');

    // Test configuration
    const testEmail = 'test@example.com';
    const testPassword = 'testPassword123';

    // Wait for settings to be loaded
    function waitForSettingsManager() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50;

            function check() {
                if (window.SettingsManager && window.SettingsManager.isInitialized) {
                    resolve(window.SettingsManager);
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(check, 100);
                } else {
                    reject(new Error('SettingsManager not available after 5 seconds'));
                }
            }

            check();
        });
    }

    // Test functions
    async function testQuickSettingsCredentials() {
        console.log('[TEST] Testing Quick Settings credentials...');

        const quickEmailInput = document.getElementById('quickUserEmail');
        const quickPasswordInput = document.getElementById('quickUserPassword');
        const generalEmailInput = document.getElementById('userEmail');
        const generalPasswordInput = document.getElementById('userPassword');

        if (!quickEmailInput || !quickPasswordInput) {
            throw new Error('Quick Settings credential inputs not found');
        }

        // Set values in Quick Settings
        quickEmailInput.value = testEmail;
        quickPasswordInput.value = testPassword;

        // Trigger input events to sync with General Settings
        quickEmailInput.dispatchEvent(new Event('input', { bubbles: true }));
        quickPasswordInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Check if General Settings are synced
        if (generalEmailInput && generalEmailInput.value !== testEmail) {
            throw new Error('Email not synced from Quick Settings to General Settings');
        }

        if (generalPasswordInput && generalPasswordInput.value !== testPassword) {
            throw new Error('Password not synced from Quick Settings to General Settings');
        }

        console.log('[TEST] ✓ Quick Settings to General Settings sync working');

        // Trigger save
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn && !saveBtn.disabled) {
            saveBtn.click();

            // Wait for save to complete
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log('[TEST] ✓ Settings saved');
        }

        return true;
    }

    async function testGeneralSettingsCredentials() {
        console.log('[TEST] Testing General Settings credentials...');

        const quickEmailInput = document.getElementById('quickUserEmail');
        const quickPasswordInput = document.getElementById('quickUserPassword');
        const generalEmailInput = document.getElementById('userEmail');
        const generalPasswordInput = document.getElementById('userPassword');

        if (!generalEmailInput || !generalPasswordInput) {
            throw new Error('General Settings credential inputs not found');
        }

        // Clear and set new values in General Settings
        const newEmail = 'general@example.com';
        const newPassword = 'generalPassword456';

        generalEmailInput.value = newEmail;
        generalPasswordInput.value = newPassword;

        // Trigger input events to sync with Quick Settings
        generalEmailInput.dispatchEvent(new Event('input', { bubbles: true }));
        generalPasswordInput.dispatchEvent(new Event('input', { bubbles: true }));

        // Check if Quick Settings are synced
        if (quickEmailInput && quickEmailInput.value !== newEmail) {
            throw new Error('Email not synced from General Settings to Quick Settings');
        }

        if (quickPasswordInput && quickPasswordInput.value !== newPassword) {
            throw new Error('Password not synced from General Settings to Quick Settings');
        }

        console.log('[TEST] ✓ General Settings to Quick Settings sync working');

        // Trigger save
        const saveBtn = document.getElementById('saveBtn');
        if (saveBtn && !saveBtn.disabled) {
            saveBtn.click();

            // Wait for save to complete
            await new Promise((resolve) => setTimeout(resolve, 1000));

            console.log('[TEST] ✓ Settings saved');
        }

        return true;
    }

    async function testPersistence() {
        console.log('[TEST] Testing persistence after reload...');

        const settingsManager = await waitForSettingsManager();

        // Get current settings
        const currentSettings = await settingsManager.loadSettings(true); // Force reload

        console.log('[TEST] Current settings:', {
            quickEmail: currentSettings.quickSettings?.userEmail,
            quickPassword: currentSettings.quickSettings?.userPassword,
            generalEmail: currentSettings.general?.userEmail,
            generalPassword: currentSettings.general?.userPassword,
        });

        // Check if credentials are persisted in both locations
        if (!currentSettings.quickSettings?.userEmail || !currentSettings.quickSettings?.userPassword) {
            throw new Error('Credentials not persisted in quickSettings');
        }

        if (!currentSettings.general?.userEmail || !currentSettings.general?.userPassword) {
            throw new Error('Credentials not persisted in general settings');
        }

        if (currentSettings.quickSettings.userEmail !== currentSettings.general.userEmail) {
            throw new Error('Email mismatch between quickSettings and general settings');
        }

        if (currentSettings.quickSettings.userPassword !== currentSettings.general.userPassword) {
            throw new Error('Password mismatch between quickSettings and general settings');
        }

        console.log('[TEST] ✓ Credentials properly persisted and synchronized');

        return true;
    }

    async function testSpacing() {
        console.log('[TEST] Testing Quick Settings spacing...');

        const quickSettingsCards = document.querySelectorAll('.quick-setting-card');

        if (quickSettingsCards.length === 0) {
            throw new Error('Quick Settings cards not found');
        }

        quickSettingsCards.forEach((card, index) => {
            const settingItems = card.querySelectorAll('.setting-item');
            const computedStyle = window.getComputedStyle(card);

            console.log(`[TEST] Card ${index + 1}:`, {
                padding: computedStyle.padding,
                marginBottom: computedStyle.marginBottom,
                settingItemsCount: settingItems.length,
            });

            settingItems.forEach((item, itemIndex) => {
                const itemStyle = window.getComputedStyle(item);
                console.log(`[TEST]   Setting item ${itemIndex + 1}:`, {
                    marginBottom: itemStyle.marginBottom,
                });
            });
        });

        console.log('[TEST] ✓ Quick Settings spacing checked (see console for details)');

        return true;
    }

    // Run all tests
    async function runAllTests() {
        try {
            console.log('[TEST] Waiting for settings manager...');
            await waitForSettingsManager();

            console.log('[TEST] Running credential persistence tests...');

            await testQuickSettingsCredentials();
            await testGeneralSettingsCredentials();
            await testPersistence();
            await testSpacing();

            console.log('[TEST] ✅ All tests passed! Credential persistence is working correctly.');

            return {
                success: true,
                message: 'All credential persistence tests passed',
            };
        } catch (error) {
            console.error('[TEST] ❌ Test failed:', error.message);

            return {
                success: false,
                error: error.message,
            };
        }
    }

    // Export test function to global scope for manual execution
    window.testCredentialPersistence = runAllTests;

    // Auto-run tests if this script is executed directly
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(runAllTests, 1000);
        });
    } else {
        setTimeout(runAllTests, 1000);
    }

    console.log('[TEST] Test script loaded. You can also run tests manually with: testCredentialPersistence()');
})();
