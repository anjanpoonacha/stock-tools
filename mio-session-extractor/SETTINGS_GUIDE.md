# Multi-Platform Session Extractor - Settings Guide

## Overview

The Multi-Platform Session Extractor now includes a comprehensive settings system that allows users and developers to customize the extension's behavior for optimal performance and user experience.

## Accessing Settings

### Method 1: Extension Options

1. Right-click the extension icon in Chrome
2. Select "Options" from the context menu
3. The settings page will open in a new tab

### Method 2: Chrome Extensions Page

1. Go to `chrome://extensions/`
2. Find "Multi-Platform Session Extractor"
3. Click "Details"
4. Click "Extension options"

### Method 3: Popup Settings Link

1. Click the extension icon to open the popup
2. Click the "Settings" link at the bottom

## Settings Categories

### 1. Quick Presets

Choose from pre-configured settings optimized for different use cases:

- **Performance Mode**: Maximum performance and responsiveness
  - Faster polling intervals (15s active, 30s inactive)
  - Shorter timeouts (3s)
  - Fewer retries (1)
  - All performance features enabled

- **Balanced Mode** (Default): Good balance between performance and battery life
  - Standard polling intervals (30s active, 60s inactive)
  - Moderate timeouts (5s)
  - Standard retries (2)

- **Battery Saver**: Optimized for minimal battery usage
  - Slower polling intervals (60s active, 120s inactive)
  - Longer timeouts (8s)
  - More retries (3)
  - Some performance features disabled

- **Developer Mode**: Enhanced debugging and monitoring
  - Debug mode enabled
  - Detailed logging
  - Performance monitoring
  - Advanced options visible

### 2. General Settings

#### Platform Support

- **Enable MarketInOut Support**: Extract sessions from marketinout.com
- **Enable TradingView Support**: Extract sessions from tradingview.com

#### User Interface

- **Auto-refresh Popup**: Automatically update popup status
- **Theme**: Choose between Light, Dark, or Auto (system)
- **Compact Mode**: Use compact UI layout
- **Notifications**: Enable success/error notifications

### 3. Performance Settings

#### Polling Intervals

Control how often the extension checks for sessions:

- **Active Polling** (5-300s): When tab is active and user is present
- **Inactive Polling** (10-600s): When no session is found
- **Background Polling** (30-1800s): When tab is hidden or inactive
- **Popup Refresh** (5-120s): How often popup updates its status

#### Request Settings

- **Request Timeout** (1-30s): Maximum time to wait for API responses
- **Maximum Retries** (0-10): How many times to retry failed requests
- **Minimum Request Interval** (1-60s): Minimum time between API requests

#### Cache Settings

- **Session Cache Duration** (1-30min): How long to cache session data
- **Connection Cache Duration** (10-300s): How long to cache app connection status

### 4. Connection Settings

#### Application URLs

- **Default URLs**: Built-in localhost URLs (3001, 3000)
- **Custom URLs**: Add your own application URLs for deployment

#### Connection Options

- **Connection Check Frequency** (10-300s): How often to verify app connectivity
- **Enable PostMessage**: Send data via window.postMessage
- **Enable Storage Sync**: Store sessions in Chrome storage

### 5. Platform Settings

#### MarketInOut Settings

- **Session Cookie Name**: Name of the session cookie to extract (default: ASPSESSIONID)
- **Polling Speed Multiplier** (0.5x-2.0x): Adjust polling speed for this platform
- **Advanced Login Detection**: Use enhanced methods to detect login status

#### TradingView Settings

- **Session Cookie Name**: Name of the session cookie to extract (default: sessionid)
- **Polling Speed Multiplier** (0.5x-2.0x): Adjust polling speed for this platform
- **Advanced Login Detection**: Use enhanced methods to detect login status

### 6. Advanced Settings

#### Performance Features

- **Enable Web Worker**: Use Web Worker for background processing
- **Enable Intersection Observer**: Smart login form detection
- **Enable Performance Observer**: Monitor extension performance
- **Enable Auto Recovery**: Automatically recover from errors

#### Debugging

- **Debug Mode**: Enable detailed logging in console
- **Log Level**: Minimum log level to display (Error, Warning, Info, Debug)
- **Enable Metrics**: Collect performance metrics

#### Storage Management

- **Storage Quota Warning** (50%-100%): Warn when storage usage exceeds threshold
- **Clear Extension Storage**: Remove all stored session data

## Settings Management

### Export Settings

1. Click "Export" in the header
2. Settings will be downloaded as a JSON file
3. File includes timestamp and version information

### Import Settings

1. Click "Import" in the header
2. Select a previously exported JSON file
3. Settings will be validated and applied

### Reset to Defaults

1. Click "Reset" in the header
2. Confirm the action
3. All settings will be restored to factory defaults

## Keyboard Shortcuts

- **Ctrl/Cmd + S**: Save changes
- **Escape**: Discard unsaved changes (with confirmation)

## Technical Details

### Settings Storage

- User preferences are stored in Chrome's `chrome.storage.sync`
- Settings sync across devices when Chrome sync is enabled
- Performance data uses `chrome.storage.local` for device-specific storage

### Settings Validation

- All settings are validated before saving
- Invalid values are rejected with error messages
- Settings have defined minimum and maximum ranges

### Performance Impact

- Settings are cached for 30 seconds to reduce storage access
- UI updates are throttled to prevent excessive redraws
- Form validation is performed client-side for immediate feedback

## Troubleshooting

### Settings Not Saving

1. Check Chrome storage permissions
2. Ensure you're not in incognito mode (if sync storage is used)
3. Try clearing extension storage and reconfiguring

### Performance Issues

1. Try the "Battery Saver" preset
2. Increase polling intervals
3. Disable advanced features if not needed
4. Check browser console for errors

### Settings Reset Unexpectedly

1. Check if extension was updated (may reset settings)
2. Verify Chrome sync settings
3. Export settings regularly as backup

## Best Practices

### For Regular Users

1. Start with "Balanced" preset
2. Only modify settings if you experience issues
3. Export settings before making major changes
4. Use "Performance" mode only if needed

### For Developers

1. Enable "Developer" mode for debugging
2. Use custom URLs for testing deployments
3. Monitor performance metrics
4. Adjust log levels based on debugging needs

### For Battery-Conscious Users

1. Use "Battery Saver" preset
2. Increase polling intervals
3. Disable unnecessary features
4. Reduce connection check frequency

## Migration and Updates

### Version Compatibility

- Settings are automatically migrated between versions
- New settings get default values
- Deprecated settings are removed safely

### Backup Strategy

- Export settings before extension updates
- Keep multiple backup files with dates
- Test settings after major updates

## API Integration

### Settings Events

The extension broadcasts settings changes to all components:

```javascript
chrome.runtime.sendMessage({
    action: 'settingsUpdated',
    settings: newSettings
});
```

### Accessing Settings Programmatically

```javascript
// Get specific setting
const pollingInterval = settingsManager.get('performance.pollingIntervals.active');

// Get multiple settings
const settings = settingsManager.getMultiple([
    'general.debugMode',
    'performance.requestSettings.timeout'
]);

// Listen for changes
settingsManager.addListener((event, data) => {
    if (event === 'settingChanged') {
        console.log('Setting changed:', data.path, data.value);
    }
});
```

## Support

For issues with the settings system:

1. Check browser console for error messages
2. Try resetting to defaults
3. Export settings and check the JSON structure
4. Report bugs with settings export file attached

## Future Enhancements

Planned features for future versions:

- Settings profiles for different trading strategies
- Cloud backup and sync
- Settings templates sharing
- Advanced scheduling options
- Performance optimization suggestions
- Integration with trading platform APIs
