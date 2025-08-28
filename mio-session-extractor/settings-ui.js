// Multi-Platform Session Extractor - Settings UI Controller (Performance Optimized)
// Handles all UI interactions, form validation, and settings synchronization

(function () {
    'use strict';

    console.log('[SETTINGS-UI] Settings UI controller loading...');

    // UI State Management
    let settingsManager = null;
    let currentSettings = null;
    let isDirty = false;
    let isLoading = false;
    let customUrls = [];
    let quickUrls = [];

    // DOM Elements Cache
    const elements = {};

    // Performance optimized element caching
    function cacheElements() {
        const elementIds = [
            // Header actions
            'resetBtn',
            'exportBtn',
            'importBtn',
            'importFileInput',

            // Quick Settings
            'quickUrlInput',
            'addQuickUrlBtn',
            'quickUrls',
            'quickUserEmail',
            'quickUserPassword',
            'toggleQuickPassword',

            // General settings
            'userEmail',
            'userPassword',
            'togglePassword',
            'enableMarketInOut',
            'enableTradingView',
            'autoRefreshPopup',
            'uiTheme',
            'compactMode',
            'notificationsEnabled',

            // Performance settings
            'activePolling',
            'inactivePolling',
            'backgroundPolling',
            'popupPolling',
            'requestTimeout',
            'maxRetries',
            'minRequestInterval',
            'sessionCache',
            'connectionCache',

            // Connection settings
            'customUrlInput',
            'addUrlBtn',
            'customUrls',
            'connectionCheckFreq',
            'enablePostMessage',
            'enableStorageSync',

            // Platform settings
            'mioSessionCookie',
            'mioPollingMultiplier',
            'mioAdvancedDetection',
            'tvSessionCookie',
            'tvPollingMultiplier',
            'tvAdvancedDetection',

            // Advanced settings
            'enableWebWorker',
            'enableIntersectionObserver',
            'enablePerformanceObserver',
            'enableAutoRecovery',
            'debugMode',
            'logLevel',
            'enableMetrics',
            'storageQuotaWarning',
            'clearStorageBtn',

            // Status and actions
            'statusText',
            'saveBtn',
        ];

        elementIds.forEach((id) => {
            elements[id] = document.getElementById(id);
            if (!elements[id]) {
                console.warn(`[SETTINGS-UI] Element not found: ${id}`);
            }
        });

        // Cache additional elements
        elements.presetCards = document.querySelectorAll('.preset-card');
        elements.tabBtns = document.querySelectorAll('.tab-btn');
        elements.tabContents = document.querySelectorAll('.tab-content');
        elements.sliders = document.querySelectorAll('.setting-slider');
    }

    /**
     * Initialize the settings UI
     */
    async function initializeUI() {
        try {
            setLoading(true);
            updateStatus('Initializing settings...', 'info');

            // Cache DOM elements
            cacheElements();

            // Wait for settings manager to be available
            if (!window.SettingsManager) {
                throw new Error('Settings manager not available');
            }

            settingsManager = window.SettingsManager;
            await settingsManager.initialize();

            // Load current settings
            await loadSettings();

            // Set up event listeners
            setupEventListeners();

            // Initialize UI state
            initializeSliders();
            initializeTabs();
            initializePresets();
            initializeCustomUrls();

            updateStatus('Settings loaded successfully', 'success');
            console.log('[SETTINGS-UI] Settings UI initialized successfully');
        } catch (error) {
            console.error('[SETTINGS-UI] Failed to initialize:', error);
            updateStatus('Failed to load settings', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Load settings from storage and populate UI
     */
    async function loadSettings() {
        try {
            currentSettings = await settingsManager.loadSettings();
            populateUI(currentSettings);
            isDirty = false;
            updateSaveButton();
        } catch (error) {
            console.error('[SETTINGS-UI] Error loading settings:', error);
            throw error;
        }
    }

    /**
     * Populate UI elements with current settings
     */
    function populateUI(settings) {
        // Ensure settings structure exists
        if (!settings) {
            console.warn('[SETTINGS-UI] Settings object is null or undefined');
            return;
        }

        // General settings - Use quickSettings for user credentials
        if (elements.userEmail) {
            elements.userEmail.value = settings.quickSettings?.userEmail || settings.general?.userEmail || '';
        }
        if (elements.userPassword) {
            elements.userPassword.value = settings.quickSettings?.userPassword || settings.general?.userPassword || '';
        }
        if (elements.enableMarketInOut) {
            elements.enableMarketInOut.checked =
                settings.quickSettings?.enabledPlatforms?.marketinout ??
                settings.general?.enabledPlatforms?.marketinout ??
                true;
        }
        if (elements.enableTradingView) {
            elements.enableTradingView.checked =
                settings.quickSettings?.enabledPlatforms?.tradingview ??
                settings.general?.enabledPlatforms?.tradingview ??
                true;
        }
        if (elements.autoRefreshPopup) {
            elements.autoRefreshPopup.checked = settings.general?.autoRefreshPopup ?? true;
        }
        if (elements.uiTheme) {
            elements.uiTheme.value = settings.ui?.theme ?? 'auto';
        }
        if (elements.compactMode) {
            elements.compactMode.checked = settings.ui?.compactMode ?? false;
        }
        if (elements.notificationsEnabled) {
            elements.notificationsEnabled.checked = settings.ui?.notificationsEnabled ?? true;
        }

        // Performance settings
        if (elements.activePolling) {
            elements.activePolling.value = (settings.performance?.pollingIntervals?.active ?? 30000) / 1000;
        }
        if (elements.inactivePolling) {
            elements.inactivePolling.value = (settings.performance?.pollingIntervals?.inactive ?? 60000) / 1000;
        }
        if (elements.backgroundPolling) {
            elements.backgroundPolling.value = (settings.performance?.pollingIntervals?.background ?? 120000) / 1000;
        }
        if (elements.popupPolling) {
            elements.popupPolling.value = (settings.performance?.pollingIntervals?.popup ?? 15000) / 1000;
        }
        if (elements.requestTimeout) {
            elements.requestTimeout.value = (settings.performance?.requestSettings?.timeout ?? 5000) / 1000;
        }
        if (elements.maxRetries) {
            elements.maxRetries.value = settings.performance?.requestSettings?.maxRetries ?? 2;
        }
        if (elements.minRequestInterval) {
            elements.minRequestInterval.value = (settings.performance?.requestSettings?.minInterval ?? 10000) / 1000;
        }
        if (elements.sessionCache) {
            elements.sessionCache.value = (settings.performance?.cacheDurations?.session ?? 300000) / 60000;
        }
        if (elements.connectionCache) {
            elements.connectionCache.value = (settings.performance?.cacheDurations?.appConnection ?? 30000) / 1000;
        }

        // Connection settings
        if (elements.connectionCheckFreq) {
            elements.connectionCheckFreq.value = (settings.connection?.connectionCheckFrequency ?? 30000) / 1000;
        }
        if (elements.enablePostMessage) {
            elements.enablePostMessage.checked = settings.connection?.enablePostMessage ?? true;
        }
        if (elements.enableStorageSync) {
            elements.enableStorageSync.checked = settings.connection?.enableStorageSync ?? true;
        }

        // Platform settings
        if (elements.mioSessionCookie) {
            elements.mioSessionCookie.value = settings.platforms?.marketinout?.sessionCookieName ?? 'ASPSESSIONID';
        }
        if (elements.mioPollingMultiplier) {
            elements.mioPollingMultiplier.value = settings.platforms?.marketinout?.pollingMultiplier ?? 1.0;
        }
        if (elements.mioAdvancedDetection) {
            elements.mioAdvancedDetection.checked = settings.platforms?.marketinout?.enableAdvancedDetection ?? true;
        }
        if (elements.tvSessionCookie) {
            elements.tvSessionCookie.value = settings.platforms?.tradingview?.sessionCookieName ?? 'sessionid';
        }
        if (elements.tvPollingMultiplier) {
            elements.tvPollingMultiplier.value = settings.platforms?.tradingview?.pollingMultiplier ?? 1.2;
        }
        if (elements.tvAdvancedDetection) {
            elements.tvAdvancedDetection.checked = settings.platforms?.tradingview?.enableAdvancedDetection ?? true;
        }

        // Advanced settings
        if (elements.enableWebWorker) {
            elements.enableWebWorker.checked = settings.advanced?.enableWebWorker ?? true;
        }
        if (elements.enableIntersectionObserver) {
            elements.enableIntersectionObserver.checked = settings.advanced?.enableIntersectionObserver ?? true;
        }
        if (elements.enablePerformanceObserver) {
            elements.enablePerformanceObserver.checked = settings.advanced?.enablePerformanceObserver ?? true;
        }
        if (elements.enableAutoRecovery) {
            elements.enableAutoRecovery.checked = settings.advanced?.enableAutoRecovery ?? true;
        }
        if (elements.debugMode) {
            elements.debugMode.checked = settings.general?.debugMode ?? false;
        }
        if (elements.logLevel) {
            elements.logLevel.value = settings.advanced?.logLevel ?? 'info';
        }
        if (elements.enableMetrics) {
            elements.enableMetrics.checked = settings.advanced?.enableMetrics ?? true;
        }
        if (elements.storageQuotaWarning) {
            elements.storageQuotaWarning.value = settings.advanced?.storageQuotaWarning ?? 0.8;
        }

        // Update Quick Settings - Ensure both fields are populated from the same source
        if (elements.quickUserEmail) {
            elements.quickUserEmail.value = settings.quickSettings?.userEmail || '';
        }
        if (elements.quickUserPassword) {
            elements.quickUserPassword.value = settings.quickSettings?.userPassword || '';
        }

        // Update quick URLs
        quickUrls = [...(settings.quickSettings?.appUrls ?? [])];
        updateQuickUrlsList();

        // Update custom URLs
        customUrls = [...(settings.connection?.customUrls ?? [])];
        updateCustomUrlsList();

        // Update all slider values
        updateAllSliderValues();
    }

    /**
     * Set up all event listeners
     */
    function setupEventListeners() {
        // Header actions
        if (elements.resetBtn) {
            elements.resetBtn.addEventListener('click', handleReset);
        }
        if (elements.exportBtn) {
            elements.exportBtn.addEventListener('click', handleExport);
        }
        if (elements.importBtn) {
            elements.importBtn.addEventListener('click', handleImport);
        }
        if (elements.importFileInput) {
            elements.importFileInput.addEventListener('change', handleFileImport);
        }

        // Preset cards
        elements.presetCards.forEach((card) => {
            card.addEventListener('click', () => handlePresetSelect(card.dataset.preset));
        });

        // Tab navigation
        elements.tabBtns.forEach((btn) => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });

        // Form change detection
        const formElements = document.querySelectorAll('input, select, textarea');
        formElements.forEach((element) => {
            element.addEventListener('change', markDirty);
            element.addEventListener('input', markDirty);
        });

        // Slider value updates
        elements.sliders.forEach((slider) => {
            slider.addEventListener('input', updateSliderValue);
        });

        // Quick URL management
        if (elements.addQuickUrlBtn) {
            elements.addQuickUrlBtn.addEventListener('click', handleAddQuickUrl);
        }
        if (elements.quickUrlInput) {
            elements.quickUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleAddQuickUrl();
                }
            });
        }

        // Quick Settings credential sync
        if (elements.quickUserEmail) {
            elements.quickUserEmail.addEventListener('input', syncCredentials);
        }
        if (elements.quickUserPassword) {
            elements.quickUserPassword.addEventListener('input', syncCredentials);
        }
        if (elements.userEmail) {
            elements.userEmail.addEventListener('input', syncCredentials);
        }
        if (elements.userPassword) {
            elements.userPassword.addEventListener('input', syncCredentials);
        }

        // Custom URL management
        if (elements.addUrlBtn) {
            elements.addUrlBtn.addEventListener('click', handleAddCustomUrl);
        }
        if (elements.customUrlInput) {
            elements.customUrlInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    handleAddCustomUrl();
                }
            });
        }

        // Password toggle
        if (elements.togglePassword) {
            elements.togglePassword.addEventListener('click', handlePasswordToggle);
        }
        if (elements.toggleQuickPassword) {
            elements.toggleQuickPassword.addEventListener('click', handleQuickPasswordToggle);
        }

        // Advanced actions
        if (elements.clearStorageBtn) {
            elements.clearStorageBtn.addEventListener('click', handleClearStorage);
        }

        // Save button
        if (elements.saveBtn) {
            elements.saveBtn.addEventListener('click', handleSave);
        }

        // Keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);

        // Prevent accidental navigation
        window.addEventListener('beforeunload', (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            }
        });
    }

    /**
     * Initialize slider value displays
     */
    function initializeSliders() {
        elements.sliders.forEach((slider) => {
            updateSliderValue({ target: slider });
        });
    }

    /**
     * Initialize tab system
     */
    function initializeTabs() {
        // Show first tab by default
        if (elements.tabContents.length > 0) {
            elements.tabContents[0].classList.add('active');
        }
        if (elements.tabBtns.length > 0) {
            elements.tabBtns[0].classList.add('active');
        }
    }

    /**
     * Initialize preset system
     */
    function initializePresets() {
        // Detect and mark the active preset based on current settings
        updateActivePresetCard();
    }

    /**
     * Update active preset card based on current settings
     */
    function updateActivePresetCard() {
        if (!currentSettings || !settingsManager) return;

        // Get current performance intervals
        const currentIntervals = {
            active: currentSettings.performance?.pollingIntervals?.active || 30000,
            inactive: currentSettings.performance?.pollingIntervals?.inactive || 60000,
            background: currentSettings.performance?.pollingIntervals?.background || 120000,
        };

        // Get preset definitions from settings manager
        const presets = settingsManager.getPresets ? settingsManager.getPresets() : {};

        let activePreset = 'balanced'; // default fallback

        // Compare current settings with each preset
        for (const [presetName, presetConfig] of Object.entries(presets)) {
            if (presetConfig.settings) {
                // Extract intervals from flattened preset settings
                const presetIntervals = {
                    active: presetConfig.settings['performance.pollingIntervals.active'],
                    inactive: presetConfig.settings['performance.pollingIntervals.inactive'],
                    background: presetConfig.settings['performance.pollingIntervals.background'],
                };

                // Check if all three intervals are defined in the preset
                if (presetIntervals.active && presetIntervals.inactive && presetIntervals.background) {
                    // Check if current intervals match this preset
                    if (
                        currentIntervals.active === presetIntervals.active &&
                        currentIntervals.inactive === presetIntervals.inactive &&
                        currentIntervals.background === presetIntervals.background
                    ) {
                        activePreset = presetName;
                        break;
                    }
                }
            }
        }

        // Update preset card visual state
        elements.presetCards.forEach((card) => {
            card.classList.toggle('active', card.dataset.preset === activePreset);
        });

        console.log(`[SETTINGS-UI] Active preset detected: ${activePreset}`, {
            currentIntervals,
            detectedPreset: activePreset,
        });
    }

    /**
     * Initialize custom URLs list
     */
    function initializeCustomUrls() {
        updateCustomUrlsList();
    }

    /**
     * Update slider value display
     */
    function updateSliderValue(event) {
        const slider = event.target;
        const valueSpan = slider.parentElement.querySelector('.slider-value');
        if (!valueSpan) return;

        const value = parseFloat(slider.value);
        let displayValue = value.toString();

        // Format value based on slider type
        if (
            slider.id.includes('Polling') ||
            slider.id.includes('Timeout') ||
            slider.id.includes('Interval') ||
            slider.id.includes('Freq')
        ) {
            if (value >= 60) {
                displayValue = `${Math.round(value / 60)}min`;
            } else {
                displayValue = `${value}s`;
            }
        } else if (slider.id.includes('Cache')) {
            if (slider.id === 'sessionCache') {
                displayValue = `${value}min`;
            } else {
                displayValue = `${value}s`;
            }
        } else if (slider.id.includes('Multiplier')) {
            displayValue = `${value}x`;
        } else if (slider.id.includes('Quota')) {
            displayValue = `${Math.round(value * 100)}%`;
        } else if (slider.id === 'maxRetries') {
            displayValue = value.toString();
        }

        valueSpan.textContent = displayValue;
    }

    /**
     * Update all slider values
     */
    function updateAllSliderValues() {
        elements.sliders.forEach((slider) => {
            updateSliderValue({ target: slider });
        });
    }

    /**
     * Switch between tabs
     */
    function switchTab(tabName) {
        // Update tab buttons
        elements.tabBtns.forEach((btn) => {
            btn.classList.toggle('active', btn.dataset.tab === tabName);
        });

        // Update tab content
        elements.tabContents.forEach((content) => {
            content.classList.toggle('active', content.id === `${tabName}-tab`);
        });
    }

    /**
     * Handle preset selection
     */
    async function handlePresetSelect(presetName) {
        try {
            setLoading(true);
            updateStatus(`Applying ${presetName} preset...`, 'info');

            // Apply preset - this updates the settings in memory and saves them
            await settingsManager.applyPreset(presetName);

            // Clear cache and force reload to get the updated values
            settingsManager.clearCache();
            currentSettings = await settingsManager.loadSettings(true);

            // Update UI with new settings
            populateUI(currentSettings);

            // Update active preset card based on actual settings
            updateActivePresetCard();

            // Mark as clean since preset was saved automatically
            isDirty = false;
            updateSaveButton();

            updateStatus(`${presetName} preset applied and saved successfully`, 'success');

            // Notify content scripts about the settings change
            try {
                chrome.runtime.sendMessage({
                    action: 'settingsUpdated',
                    preset: presetName,
                });
            } catch (error) {
                console.warn('[SETTINGS-UI] Could not notify content scripts:', error);
            }
        } catch (error) {
            console.error('[SETTINGS-UI] Error applying preset:', error);
            updateStatus('Failed to apply preset', 'error');

            // Reload settings to ensure UI is in sync
            try {
                await loadSettings();
                updateActivePresetCard();
            } catch (reloadError) {
                console.error('[SETTINGS-UI] Error reloading settings after preset failure:', reloadError);
            }
        } finally {
            setLoading(false);
        }
    }

    /**
     * Handle custom URL addition
     */
    function handleAddCustomUrl() {
        const input = elements.customUrlInput;
        if (!input) return;

        const url = input.value.trim();
        if (!url) return;

        // Validate URL
        try {
            new URL(url);
        } catch (error) {
            updateStatus('Invalid URL format', 'error');
            return;
        }

        // Check for duplicates
        if (customUrls.includes(url)) {
            updateStatus('URL already exists', 'warning');
            return;
        }

        // Add URL
        customUrls.push(url);
        updateCustomUrlsList();
        input.value = '';
        markDirty();

        updateStatus('Custom URL added', 'success');
    }

    /**
     * Handle password toggle
     */
    function handlePasswordToggle() {
        if (!elements.userPassword || !elements.togglePassword) return;

        const isPassword = elements.userPassword.type === 'password';
        elements.userPassword.type = isPassword ? 'text' : 'password';

        // Update the icon
        const svg = elements.togglePassword.querySelector('svg');
        if (svg) {
            if (isPassword) {
                // Show "eye-off" icon when password is visible
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <path d="M21 4L3 20"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            } else {
                // Show "eye" icon when password is hidden
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        }

        // Update title
        elements.togglePassword.title = isPassword ? 'Hide password' : 'Show password';
    }

    /**
     * Handle quick URL addition
     */
    function handleAddQuickUrl() {
        const input = elements.quickUrlInput;
        if (!input) return;

        const url = input.value.trim();
        if (!url) return;

        // Validate URL
        try {
            new URL(url);
        } catch (error) {
            updateStatus('Invalid URL format', 'error');
            return;
        }

        // Check for duplicates
        if (quickUrls.includes(url)) {
            updateStatus('URL already exists', 'warning');
            return;
        }

        // Add URL
        quickUrls.push(url);
        updateQuickUrlsList();
        input.value = '';
        markDirty();

        updateStatus('Quick URL added', 'success');
    }

    /**
     * Handle quick password toggle
     */
    function handleQuickPasswordToggle() {
        if (!elements.quickUserPassword || !elements.toggleQuickPassword) return;

        const isPassword = elements.quickUserPassword.type === 'password';
        elements.quickUserPassword.type = isPassword ? 'text' : 'password';

        // Update the icon
        const svg = elements.toggleQuickPassword.querySelector('svg');
        if (svg) {
            if (isPassword) {
                // Show "eye-off" icon when password is visible
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <path d="M21 4L3 20"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            } else {
                // Show "eye" icon when password is hidden
                svg.innerHTML = `
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                    <circle cx="12" cy="12" r="3"></circle>
                `;
            }
        }

        // Update title
        elements.toggleQuickPassword.title = isPassword ? 'Hide password' : 'Show password';
    }

    /**
     * Update quick URLs list display
     */
    function updateQuickUrlsList() {
        const container = elements.quickUrls;
        if (!container) return;

        container.innerHTML = '';

        quickUrls.forEach((url, index) => {
            const urlItem = document.createElement('div');
            urlItem.className = 'url-item';
            urlItem.innerHTML = `
                <span class="url-text">${url}</span>
                <button class="url-remove" data-index="${index}">Remove</button>
            `;

            // Add remove event listener
            const removeBtn = urlItem.querySelector('.url-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    quickUrls.splice(index, 1);
                    updateQuickUrlsList();
                    markDirty();
                    updateStatus('Quick URL removed', 'info');
                });
            }

            container.appendChild(urlItem);
        });
    }

    /**
     * Update custom URLs list display
     */
    function updateCustomUrlsList() {
        const container = elements.customUrls;
        if (!container) return;

        container.innerHTML = '';

        customUrls.forEach((url, index) => {
            const urlItem = document.createElement('div');
            urlItem.className = 'url-item';
            urlItem.innerHTML = `
                <span class="url-text">${url}</span>
                <button class="url-remove" data-index="${index}">Remove</button>
            `;

            // Add remove event listener
            const removeBtn = urlItem.querySelector('.url-remove');
            if (removeBtn) {
                removeBtn.addEventListener('click', () => {
                    customUrls.splice(index, 1);
                    updateCustomUrlsList();
                    markDirty();
                    updateStatus('Custom URL removed', 'info');
                });
            }

            container.appendChild(urlItem);
        });
    }

    /**
     * Collect current form values
     */
    function collectFormValues() {
        const values = {};

        // Quick Settings - User credentials and URLs
        // Prioritize Quick Settings fields, then fall back to General settings fields
        const userEmail = elements.quickUserEmail?.value?.trim() || elements.userEmail?.value?.trim() || '';
        const userPassword = elements.quickUserPassword?.value?.trim() || elements.userPassword?.value?.trim() || '';

        values['quickSettings.userEmail'] = userEmail;
        values['quickSettings.userPassword'] = userPassword;
        values['quickSettings.appUrls'] = quickUrls;

        // Also update general settings to keep them in sync
        values['general.userEmail'] = userEmail;
        values['general.userPassword'] = userPassword;

        // General settings
        values['general.enabledPlatforms.marketinout'] = elements.enableMarketInOut?.checked ?? true;
        values['general.enabledPlatforms.tradingview'] = elements.enableTradingView?.checked ?? true;
        values['general.autoRefreshPopup'] = elements.autoRefreshPopup?.checked ?? true;
        values['general.debugMode'] = elements.debugMode?.checked ?? false;
        values['ui.theme'] = elements.uiTheme?.value ?? 'auto';
        values['ui.compactMode'] = elements.compactMode?.checked ?? false;
        values['ui.notificationsEnabled'] = elements.notificationsEnabled?.checked ?? true;

        // Performance settings
        values['performance.pollingIntervals.active'] = (parseFloat(elements.activePolling?.value) || 30) * 1000;
        values['performance.pollingIntervals.inactive'] = (parseFloat(elements.inactivePolling?.value) || 60) * 1000;
        values['performance.pollingIntervals.background'] =
            (parseFloat(elements.backgroundPolling?.value) || 120) * 1000;
        values['performance.pollingIntervals.popup'] = (parseFloat(elements.popupPolling?.value) || 15) * 1000;
        values['performance.requestSettings.timeout'] = (parseFloat(elements.requestTimeout?.value) || 5) * 1000;
        values['performance.requestSettings.maxRetries'] = parseInt(elements.maxRetries?.value) || 2;
        values['performance.requestSettings.minInterval'] =
            (parseFloat(elements.minRequestInterval?.value) || 10) * 1000;
        values['performance.cacheDurations.session'] = (parseFloat(elements.sessionCache?.value) || 5) * 60000;
        values['performance.cacheDurations.appConnection'] = (parseFloat(elements.connectionCache?.value) || 30) * 1000;

        // Connection settings
        values['connection.customUrls'] = customUrls;
        values['connection.connectionCheckFrequency'] = (parseFloat(elements.connectionCheckFreq?.value) || 30) * 1000;
        values['connection.enablePostMessage'] = elements.enablePostMessage?.checked ?? true;
        values['connection.enableStorageSync'] = elements.enableStorageSync?.checked ?? true;

        // Platform settings
        values['platforms.marketinout.sessionCookieName'] = elements.mioSessionCookie?.value || 'ASPSESSIONID';
        values['platforms.marketinout.pollingMultiplier'] = parseFloat(elements.mioPollingMultiplier?.value) || 1.0;
        values['platforms.marketinout.enableAdvancedDetection'] = elements.mioAdvancedDetection?.checked ?? true;
        values['platforms.tradingview.sessionCookieName'] = elements.tvSessionCookie?.value || 'sessionid';
        values['platforms.tradingview.pollingMultiplier'] = parseFloat(elements.tvPollingMultiplier?.value) || 1.2;
        values['platforms.tradingview.enableAdvancedDetection'] = elements.tvAdvancedDetection?.checked ?? true;

        // Advanced settings
        values['advanced.enableWebWorker'] = elements.enableWebWorker?.checked ?? true;
        values['advanced.enableIntersectionObserver'] = elements.enableIntersectionObserver?.checked ?? true;
        values['advanced.enablePerformanceObserver'] = elements.enablePerformanceObserver?.checked ?? true;
        values['advanced.enableAutoRecovery'] = elements.enableAutoRecovery?.checked ?? true;
        values['advanced.logLevel'] = elements.logLevel?.value || 'info';
        values['advanced.enableMetrics'] = elements.enableMetrics?.checked ?? true;
        values['advanced.storageQuotaWarning'] = parseFloat(elements.storageQuotaWarning?.value) || 0.8;

        return values;
    }

    /**
     * Handle save action
     */
    async function handleSave() {
        try {
            setLoading(true);
            updateStatus('Saving settings...', 'info');

            const formValues = collectFormValues();
            await settingsManager.setMultiple(formValues);

            isDirty = false;
            updateSaveButton();
            updateStatus('Settings saved successfully', 'success');

            // Notify other extension components
            try {
                chrome.runtime.sendMessage({
                    action: 'settingsUpdated',
                    settings: formValues,
                });
            } catch (error) {
                console.warn('[SETTINGS-UI] Could not notify extension components:', error);
            }
        } catch (error) {
            console.error('[SETTINGS-UI] Error saving settings:', error);
            updateStatus('Failed to save settings', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Handle reset action
     */
    async function handleReset() {
        if (!confirm('Are you sure you want to reset all settings to defaults? This cannot be undone.')) {
            return;
        }

        try {
            setLoading(true);
            updateStatus('Resetting settings...', 'info');

            await settingsManager.resetToDefaults();
            await loadSettings();

            // Reset preset selection
            elements.presetCards.forEach((card) => {
                card.classList.toggle('active', card.dataset.preset === 'balanced');
            });

            updateStatus('Settings reset to defaults', 'success');
        } catch (error) {
            console.error('[SETTINGS-UI] Error resetting settings:', error);
            updateStatus('Failed to reset settings', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Handle export action
     */
    function handleExport() {
        try {
            const exportData = settingsManager.exportSettings();
            const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = `mio-extractor-settings-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            updateStatus('Settings exported successfully', 'success');
        } catch (error) {
            console.error('[SETTINGS-UI] Error exporting settings:', error);
            updateStatus('Failed to export settings', 'error');
        }
    }

    /**
     * Handle import action
     */
    function handleImport() {
        elements.importFileInput?.click();
    }

    /**
     * Handle file import
     */
    async function handleFileImport(event) {
        const file = event.target.files[0];
        if (!file) return;

        try {
            setLoading(true);
            updateStatus('Importing settings...', 'info');

            const text = await file.text();
            const importData = JSON.parse(text);

            await settingsManager.importSettings(importData);
            await loadSettings();

            updateStatus('Settings imported successfully', 'success');
        } catch (error) {
            console.error('[SETTINGS-UI] Error importing settings:', error);
            updateStatus('Failed to import settings', 'error');
        } finally {
            setLoading(false);
            // Clear file input
            event.target.value = '';
        }
    }

    /**
     * Handle clear storage action
     */
    async function handleClearStorage() {
        if (!confirm('Are you sure you want to clear all extension storage? This will remove all session data.')) {
            return;
        }

        try {
            setLoading(true);
            updateStatus('Clearing storage...', 'info');

            await chrome.storage.local.clear();
            await chrome.storage.sync.clear();

            updateStatus('Extension storage cleared', 'success');
        } catch (error) {
            console.error('[SETTINGS-UI] Error clearing storage:', error);
            updateStatus('Failed to clear storage', 'error');
        } finally {
            setLoading(false);
        }
    }

    /**
     * Handle keyboard shortcuts
     */
    function handleKeyboardShortcuts(event) {
        // Ctrl/Cmd + S to save
        if ((event.ctrlKey || event.metaKey) && event.key === 's') {
            event.preventDefault();
            if (isDirty && !isLoading) {
                handleSave();
            }
        }

        // Escape to cancel changes
        if (event.key === 'Escape' && isDirty) {
            if (confirm('Discard unsaved changes?')) {
                loadSettings();
            }
        }
    }

    /**
     * Sync credentials between Quick Settings and General Settings
     */
    function syncCredentials(event) {
        const sourceElement = event.target;
        const isQuickSetting = sourceElement.id.startsWith('quick');

        if (sourceElement.id === 'quickUserEmail' && elements.userEmail) {
            elements.userEmail.value = sourceElement.value;
        } else if (sourceElement.id === 'quickUserPassword' && elements.userPassword) {
            elements.userPassword.value = sourceElement.value;
        } else if (sourceElement.id === 'userEmail' && elements.quickUserEmail) {
            elements.quickUserEmail.value = sourceElement.value;
        } else if (sourceElement.id === 'userPassword' && elements.quickUserPassword) {
            elements.quickUserPassword.value = sourceElement.value;
        }

        markDirty();
    }

    /**
     * Mark form as dirty (has unsaved changes)
     */
    function markDirty() {
        if (!isDirty) {
            isDirty = true;
            updateSaveButton();
            updateStatus('Settings modified', 'warning');
        }
    }

    /**
     * Update save button state
     */
    function updateSaveButton() {
        if (elements.saveBtn) {
            elements.saveBtn.disabled = !isDirty || isLoading;
            elements.saveBtn.textContent = isDirty ? 'Save Changes' : 'Saved';
        }
    }

    /**
     * Set loading state
     */
    function setLoading(loading) {
        isLoading = loading;
        document.body.classList.toggle('loading', loading);
        updateSaveButton();

        // Disable form elements during loading
        const formElements = document.querySelectorAll('input, select, textarea, button');
        formElements.forEach((element) => {
            element.disabled = loading;
        });
    }

    /**
     * Update status message
     */
    function updateStatus(message, type = 'info') {
        if (elements.statusText) {
            elements.statusText.textContent = message;
            elements.statusText.className = `status-${type}`;
        }

        // Auto-clear status after delay
        if (type === 'success' || type === 'info') {
            setTimeout(() => {
                if (elements.statusText && elements.statusText.textContent === message) {
                    elements.statusText.textContent = 'Ready';
                    elements.statusText.className = '';
                }
            }, 3000);
        }
    }

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeUI);
    } else {
        initializeUI();
    }

    console.log('[SETTINGS-UI] Settings UI controller loaded');
})();
