// Multi-Platform Session Extractor - Settings Management (Performance Optimized)
// Centralized configuration system with validation, caching, and migration support

(function () {
    'use strict';

    // Default Configuration - Performance Optimized
    const DEFAULT_SETTINGS = {
        // Quick Settings - Most Important Settings
        quickSettings: {
            userEmail: '', // User email for session identification
            userPassword: '', // User password for session authentication
            appUrls: ['https://stock-tools-jet.vercel.app'], // Default app URL
            enabledPlatforms: {
                marketinout: true,
                tradingview: true,
            },
        },

        // General Settings
        general: {
            userEmail: '', // User email for session identification (synced with quickSettings)
            userPassword: '', // User password for session authentication (synced with quickSettings)
            autoRefreshPopup: true,
            debugMode: false,
            performanceMonitoring: true,
            enabledPlatforms: {
                marketinout: true,
                tradingview: true,
            },
        },

        // Performance Settings
        performance: {
            pollingIntervals: {
                active: 30000, // 30s when session is active
                inactive: 60000, // 60s when no session
                background: 120000, // 2min when tab is hidden
                error: 45000, // 45s after errors
                popup: 15000, // 15s popup refresh
            },
            cacheDurations: {
                session: 300000, // 5min session cache
                appConnection: 30000, // 30s app connection cache
                popupSession: 60000, // 1min popup session cache
            },
            requestSettings: {
                timeout: 5000, // 5s request timeout
                maxRetries: 2, // Maximum retry attempts
                minInterval: 10000, // 10s minimum between requests
                retryDelay: 8000, // 8s delay between retries
            },
            backgroundOptimizations: {
                badgeUpdateThrottle: 1000, // 1s badge update throttle
                storageCleanupInterval: 300000, // 5min storage cleanup
                maxStorageEntries: 50, // Maximum stored sessions
                idleDetectionInterval: 30000, // 30s idle detection
                tabCleanupDelay: 5000, // 5s tab cleanup delay
            },
        },

        // Connection Settings
        connection: {
            appUrls: ['https://stock-tools-jet.vercel.app'],
            customUrls: [], // User-defined URLs
            connectionCheckFrequency: 30000, // 30s connection checks
            enablePostMessage: true,
            enableStorageSync: true,
        },

        // Platform-Specific Settings
        platforms: {
            marketinout: {
                sessionCookieName: 'ASPSESSIONID',
                pollingMultiplier: 1.0, // Multiplier for base intervals
                enableAdvancedDetection: true,
                customSelectors: [], // User-defined selectors
            },
            tradingview: {
                sessionCookieName: 'sessionid',
                pollingMultiplier: 1.2, // Slightly slower for TradingView
                enableAdvancedDetection: true,
                customSelectors: [], // User-defined selectors
            },
        },

        // Advanced Settings
        advanced: {
            enableWebWorker: true,
            enableIntersectionObserver: true,
            enablePerformanceObserver: true,
            logLevel: 'info', // 'debug', 'info', 'warn', 'error'
            enableMetrics: true,
            enableAutoRecovery: true,
            storageQuotaWarning: 0.8, // Warn at 80% storage usage
        },

        // UI Settings
        ui: {
            theme: 'auto', // 'light', 'dark', 'auto'
            compactMode: false,
            showAdvancedOptions: false,
            animationsEnabled: true,
            notificationsEnabled: true,
        },
    };

    // Settings validation schema
    const VALIDATION_SCHEMA = {
        'performance.pollingIntervals.active': { min: 5000, max: 300000, type: 'number' },
        'performance.pollingIntervals.inactive': { min: 10000, max: 600000, type: 'number' },
        'performance.pollingIntervals.background': { min: 30000, max: 1800000, type: 'number' },
        'performance.pollingIntervals.error': { min: 5000, max: 300000, type: 'number' },
        'performance.pollingIntervals.popup': { min: 5000, max: 120000, type: 'number' },
        'performance.requestSettings.timeout': { min: 1000, max: 30000, type: 'number' },
        'performance.requestSettings.maxRetries': { min: 0, max: 10, type: 'number' },
        'performance.requestSettings.minInterval': { min: 1000, max: 60000, type: 'number' },
        'connection.appUrls': { type: 'array', itemType: 'string' },
        'connection.customUrls': { type: 'array', itemType: 'string' },
        'advanced.logLevel': { type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
        'ui.theme': { type: 'string', enum: ['light', 'dark', 'auto'] },
    };

    // Settings presets for different use cases
    const SETTINGS_PRESETS = {
        performance: {
            name: 'Performance Mode',
            description: 'Optimized for maximum performance and responsiveness',
            settings: {
                'performance.pollingIntervals.active': 15000,
                'performance.pollingIntervals.inactive': 30000,
                'performance.pollingIntervals.background': 60000,
                'performance.requestSettings.timeout': 3000,
                'performance.requestSettings.maxRetries': 1,
                'advanced.enableWebWorker': true,
                'advanced.enablePerformanceObserver': true,
            },
        },
        balanced: {
            name: 'Balanced Mode',
            description: 'Good balance between performance and battery life',
            settings: {
                'performance.pollingIntervals.active': 30000,
                'performance.pollingIntervals.inactive': 60000,
                'performance.pollingIntervals.background': 120000,
                'performance.requestSettings.timeout': 5000,
                'performance.requestSettings.maxRetries': 2,
                'advanced.enableWebWorker': true,
                'advanced.enablePerformanceObserver': true,
                'general.debugMode': false,
                'ui.animationsEnabled': true,
            },
        },
        battery: {
            name: 'Battery Saver',
            description: 'Optimized for minimal battery usage',
            settings: {
                'performance.pollingIntervals.active': 60000,
                'performance.pollingIntervals.inactive': 120000,
                'performance.pollingIntervals.background': 300000,
                'performance.requestSettings.timeout': 8000,
                'performance.requestSettings.maxRetries': 3,
                'advanced.enableWebWorker': false,
                'advanced.enablePerformanceObserver': false,
                'ui.animationsEnabled': false,
            },
        },
        developer: {
            name: 'Developer Mode',
            description: 'Enhanced debugging and monitoring features',
            settings: {
                'general.debugMode': true,
                'general.performanceMonitoring': true,
                'advanced.logLevel': 'debug',
                'advanced.enableMetrics': true,
                'ui.showAdvancedOptions': true,
                'performance.pollingIntervals.active': 10000,
            },
        },
    };

    /**
     * Settings Manager Class - Performance Optimized
     */
    class SettingsManager {
        constructor() {
            this.settings = null;
            this.cache = new Map();
            this.cacheTimestamp = 0;
            this.cacheTTL = 30000; // 30 second cache
            this.listeners = new Set();
            this.migrationVersion = '2.1.0';
            this.isInitialized = false;
        }

        /**
         * Initialize settings system
         */
        async initialize() {
            if (this.isInitialized) return;

            try {
                await this.loadSettings();
                await this.migrateSettings();
                this.isInitialized = true;
                console.log('[SETTINGS] Settings system initialized successfully');
            } catch (error) {
                console.error('[SETTINGS] Failed to initialize settings system:', error);
                this.settings = this.deepClone(DEFAULT_SETTINGS);
                this.isInitialized = true;
            }
        }

        /**
         * Load settings from Chrome storage with caching
         */
        async loadSettings(forceReload = false) {
            const now = Date.now();

            // Use cache if valid and not forcing reload
            if (!forceReload && this.settings && now - this.cacheTimestamp < this.cacheTTL) {
                return this.settings;
            }

            try {
                const result = await chrome.storage.sync.get(['extensionSettings', 'settingsVersion']);

                if (result.extensionSettings) {
                    this.settings = this.mergeWithDefaults(result.extensionSettings);
                    console.log('[SETTINGS] Loaded settings from storage' + (forceReload ? ' (forced reload)' : ''));
                } else {
                    this.settings = this.deepClone(DEFAULT_SETTINGS);
                    await this.saveSettings(); // Save defaults
                    console.log('[SETTINGS] Initialized with default settings');
                }

                this.cacheTimestamp = now;
                return this.settings;
            } catch (error) {
                console.error('[SETTINGS] Error loading settings:', error);
                this.settings = this.deepClone(DEFAULT_SETTINGS);
                return this.settings;
            }
        }

        /**
         * Clear cache to force reload on next access
         */
        clearCache() {
            this.cacheTimestamp = 0;
            console.log('[SETTINGS] Cache cleared');
        }

        /**
         * Save settings to Chrome storage
         */
        async saveSettings() {
            if (!this.settings) return;

            try {
                await chrome.storage.sync.set({
                    extensionSettings: this.settings,
                    settingsVersion: this.migrationVersion,
                    lastUpdated: Date.now(),
                });

                this.cacheTimestamp = Date.now();
                this.notifyListeners('settingsSaved', this.settings);
                console.log('[SETTINGS] Settings saved successfully');
            } catch (error) {
                console.error('[SETTINGS] Error saving settings:', error);
                throw error;
            }
        }

        /**
         * Get a setting value with dot notation support
         */
        get(path, defaultValue = null) {
            if (!this.settings) {
                console.warn('[SETTINGS] Settings not loaded, using default');
                return this.getFromObject(DEFAULT_SETTINGS, path, defaultValue);
            }

            return this.getFromObject(this.settings, path, defaultValue);
        }

        /**
         * Set a setting value with validation
         */
        async set(path, value) {
            if (!this.settings) {
                await this.loadSettings();
            }

            // Validate the setting
            if (!this.validateSetting(path, value)) {
                throw new Error(`Invalid value for setting: ${path}`);
            }

            // Update the setting
            this.setInObject(this.settings, path, value);

            // Save to storage
            await this.saveSettings();

            // Notify listeners
            this.notifyListeners('settingChanged', { path, value });

            console.log(`[SETTINGS] Updated setting: ${path} = ${JSON.stringify(value)}`);
        }

        /**
         * Get multiple settings at once
         */
        getMultiple(paths) {
            const result = {};
            for (const path of paths) {
                result[path] = this.get(path);
            }
            return result;
        }

        /**
         * Set multiple settings at once
         */
        async setMultiple(settings) {
            if (!this.settings) {
                await this.loadSettings();
            }

            const changes = [];
            for (const [path, value] of Object.entries(settings)) {
                if (!this.validateSetting(path, value)) {
                    throw new Error(`Invalid value for setting: ${path}`);
                }
                this.setInObject(this.settings, path, value);
                changes.push({ path, value });
            }

            await this.saveSettings();
            this.notifyListeners('settingsChanged', changes);

            console.log(`[SETTINGS] Updated ${changes.length} settings`);
        }

        /**
         * Apply a settings preset
         */
        async applyPreset(presetName) {
            const preset = SETTINGS_PRESETS[presetName];
            if (!preset) {
                throw new Error(`Unknown preset: ${presetName}`);
            }

            await this.setMultiple(preset.settings);
            console.log(`[SETTINGS] Applied preset: ${preset.name}`);
        }

        /**
         * Reset settings to defaults
         */
        async resetToDefaults() {
            this.settings = this.deepClone(DEFAULT_SETTINGS);
            await this.saveSettings();
            this.notifyListeners('settingsReset', this.settings);
            console.log('[SETTINGS] Settings reset to defaults');
        }

        /**
         * Export settings as JSON
         */
        exportSettings() {
            return {
                settings: this.settings,
                version: this.migrationVersion,
                exportedAt: new Date().toISOString(),
            };
        }

        /**
         * Import settings from JSON
         */
        async importSettings(data) {
            if (!data.settings) {
                throw new Error('Invalid settings data');
            }

            // Validate imported settings
            const validatedSettings = this.mergeWithDefaults(data.settings);

            this.settings = validatedSettings;
            await this.saveSettings();
            this.notifyListeners('settingsImported', this.settings);

            console.log('[SETTINGS] Settings imported successfully');
        }

        /**
         * Add settings change listener
         */
        addListener(callback) {
            this.listeners.add(callback);
        }

        /**
         * Remove settings change listener
         */
        removeListener(callback) {
            this.listeners.delete(callback);
        }

        /**
         * Get available presets
         */
        getPresets() {
            return SETTINGS_PRESETS;
        }

        /**
         * Get current settings with computed values
         */
        getComputedSettings() {
            const settings = this.deepClone(this.settings || DEFAULT_SETTINGS);

            // Apply platform-specific multipliers
            const baseIntervals = settings.performance.pollingIntervals;
            for (const [platform, config] of Object.entries(settings.platforms)) {
                if (config.pollingMultiplier !== 1.0) {
                    // Store computed intervals for this platform
                    settings.platforms[platform].computedIntervals = {
                        active: Math.round(baseIntervals.active * config.pollingMultiplier),
                        inactive: Math.round(baseIntervals.inactive * config.pollingMultiplier),
                        background: Math.round(baseIntervals.background * config.pollingMultiplier),
                        error: Math.round(baseIntervals.error * config.pollingMultiplier),
                    };
                }
            }

            return settings;
        }

        // Helper methods
        deepClone(obj) {
            return JSON.parse(JSON.stringify(obj));
        }

        mergeWithDefaults(userSettings) {
            const merged = this.deepClone(DEFAULT_SETTINGS);
            this.deepMerge(merged, userSettings);
            return merged;
        }

        deepMerge(target, source) {
            for (const key in source) {
                if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                    if (!target[key]) target[key] = {};
                    this.deepMerge(target[key], source[key]);
                } else {
                    target[key] = source[key];
                }
            }
        }

        getFromObject(obj, path, defaultValue) {
            const keys = path.split('.');
            let current = obj;

            for (const key of keys) {
                if (current && typeof current === 'object' && key in current) {
                    current = current[key];
                } else {
                    return defaultValue;
                }
            }

            return current;
        }

        setInObject(obj, path, value) {
            const keys = path.split('.');
            const lastKey = keys.pop();
            let current = obj;

            for (const key of keys) {
                if (!current[key] || typeof current[key] !== 'object') {
                    current[key] = {};
                }
                current = current[key];
            }

            current[lastKey] = value;
        }

        validateSetting(path, value) {
            const schema = VALIDATION_SCHEMA[path];
            if (!schema) return true; // No validation rule

            // Type validation
            if (schema.type === 'number' && typeof value !== 'number') {
                return false;
            }
            if (schema.type === 'string' && typeof value !== 'string') {
                return false;
            }
            if (schema.type === 'boolean' && typeof value !== 'boolean') {
                return false;
            }
            if (schema.type === 'array' && !Array.isArray(value)) {
                return false;
            }

            // Range validation for numbers
            if (schema.type === 'number') {
                if (schema.min !== undefined && value < schema.min) return false;
                if (schema.max !== undefined && value > schema.max) return false;
            }

            // Enum validation
            if (schema.enum && !schema.enum.includes(value)) {
                return false;
            }

            // Array item type validation
            if (schema.type === 'array' && schema.itemType) {
                for (const item of value) {
                    if (typeof item !== schema.itemType) return false;
                }
            }

            return true;
        }

        notifyListeners(event, data) {
            for (const callback of this.listeners) {
                try {
                    callback(event, data);
                } catch (error) {
                    console.error('[SETTINGS] Error in listener callback:', error);
                }
            }
        }

        async migrateSettings() {
            // Future migration logic can be added here
            // For now, just ensure we have the current version
            if (!this.settings._version) {
                this.settings._version = this.migrationVersion;
                await this.saveSettings();
            }
        }
    }

    // Create global settings manager instance
    window.SettingsManager = new SettingsManager();

    // Export for use in other scripts
    if (typeof module !== 'undefined' && module.exports) {
        module.exports = { SettingsManager, DEFAULT_SETTINGS, SETTINGS_PRESETS };
    }

    console.log('[SETTINGS] Settings management system loaded');
})();
