# MIO Session Extractor - Browser Extension

A Chrome browser extension that automatically extracts MarketInOut session cookies and sends them to your trading application, eliminating the need for manual cookie copying.

## Features

- **Automatic Session Detection**: Detects when you're logged into MarketInOut
- **One-Click Extraction**: Extract ASPSESSIONID cookies with a single click
- **Seamless Integration**: Automatically sends session data to your trading app
- **Real-time Status**: Shows login status, session status, and app connectivity
- **Security**: Validates sessions and sanitizes cookie data
- **Background Operation**: Works automatically when you visit MarketInOut

## Installation

### Method 1: Load Unpacked Extension (Development)

1. **Download Extension Files**
   - Clone or download this `mio-session-extractor` folder
   - Ensure all files are present: `manifest.json`, `content-script.js`, `background.js`, `popup.html`, `popup.js`

2. **Open Chrome Extensions**
   - Open Chrome browser
   - Navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)

3. **Load Extension**
   - Click "Load unpacked"
   - Select the `mio-session-extractor` folder
   - Extension should appear in your extensions list

4. **Pin Extension** (Optional)
   - Click the puzzle piece icon in Chrome toolbar
   - Find "MIO Session Extractor" and click the pin icon
   - Extension icon will appear in toolbar for easy access

### Method 2: Chrome Web Store (Future)

*Coming soon - extension will be published to Chrome Web Store*

## Setup

### 1. Configure Your App URL

Edit the `content-script.js` file and update the APP_URLS:

```javascript
const CONFIG = {
    APP_URLS: [
        'http://localhost:3000',           // Your local development URL
        'https://your-app-domain.com',     // Your production URL
    ],
    // ...
};
```

### 2. Start Your Trading App

Make sure your Next.js trading application is running and accessible at the configured URL.

## Usage

### Automatic Mode (Recommended)

1. **Login to MarketInOut**
   - Navigate to `https://www.marketinout.com`
   - Log in with your credentials

2. **Automatic Extraction**
   - Extension automatically detects successful login
   - Extracts ASPSESSIONID cookie
   - Sends session data to your trading app
   - Shows success indicator in extension badge

3. **Use Your Trading App**
   - Open your trading application
   - You should be automatically authenticated
   - No manual session bridging required!

### Manual Mode

1. **Open Extension Popup**
   - Click the MIO Session Extractor icon in Chrome toolbar
   - View current status (login, session, app connection)

2. **Manual Extraction**
   - Click "Extract Session" button
   - Extension will capture current session
   - Status will update to show success/failure

3. **Open Trading App**
   - Click "Open App" button to launch your trading application
   - Or manually navigate to your app

## Status Indicators

### Extension Badge

- **✓** (Green): Session successfully extracted and sent
- **!** (Orange): Warning or partial success
- **✗** (Red): Error or extraction failed
- **(Empty)**: No active session or not on MarketInOut

### Popup Status

- **MarketInOut Status**: Shows if you're logged into MarketInOut
- **Session Status**: Shows if session data is available
- **App Connection**: Shows if your trading app is reachable

## Troubleshooting

### Common Issues

**Extension not working:**

- Make sure you're on `https://www.marketinout.com`
- Check that you're logged into MarketInOut
- Refresh the MarketInOut page and try again

**App not receiving session:**

- Verify your trading app is running
- Check the APP_URLS in `content-script.js` are correct
- Look at browser console for error messages

**Session extraction fails:**

- Clear browser cookies and log in again
- Check MarketInOut hasn't changed their cookie structure
- Try manual extraction using the popup

### Debug Mode

1. **Open Browser Console**
   - Press F12 in Chrome
   - Go to Console tab
   - Look for `[MIO-EXTRACTOR]` messages

2. **Check Extension Console**
   - Go to `chrome://extensions/`
   - Find MIO Session Extractor
   - Click "Inspect views: background page"
   - Check console for background script messages

3. **Network Tab**
   - Check if API calls to your trading app are successful
   - Look for `/api/extension/session` requests

### Getting Help

1. **Check Console Logs**: Look for `[MIO-EXTRACTOR]` messages in browser console
2. **Verify Configuration**: Ensure APP_URLS are correctly set
3. **Test API Endpoints**: Visit `http://localhost:3000/api/extension/ping` to test connectivity
4. **Extension Permissions**: Make sure extension has permissions for MarketInOut and your app domain

## Technical Details

### How It Works

1. **Content Script**: Runs on MarketInOut pages, monitors for login status
2. **Session Detection**: Checks for ASPSESSIONID cookies and login indicators
3. **Extraction**: Captures session cookies when user is logged in
4. **Validation**: Sends session data to your app's API for validation
5. **Storage**: Your app stores and manages the session using existing infrastructure

### Security

- **Origin Validation**: Only communicates with authorized domains
- **Cookie Sanitization**: Cleans and validates cookie data
- **Session Validation**: Verifies session is valid before storing
- **Secure Storage**: Uses Chrome's secure storage APIs

### Files Structure

```
mio-session-extractor/
├── manifest.json          # Extension configuration
├── content-script.js      # Runs on MarketInOut pages
├── background.js          # Background service worker
├── popup.html            # Extension popup UI
├── popup.js              # Popup functionality
├── icons/                # Extension icons (optional)
└── README.md             # This file
```

## Development

### Making Changes

1. **Edit Files**: Modify extension files as needed
2. **Reload Extension**: Go to `chrome://extensions/` and click reload button
3. **Test Changes**: Visit MarketInOut and test functionality
4. **Check Logs**: Monitor console for any errors

### Adding Features

- **New Domains**: Add to `host_permissions` in `manifest.json`
- **Additional APIs**: Update `content-script.js` APP_URLS
- **UI Changes**: Modify `popup.html` and `popup.js`
- **Background Tasks**: Update `background.js`

## Version History

- **v1.0.0**: Initial release with automatic session extraction
- **Future**: Chrome Web Store publication, additional features

## Support

For issues or questions:

1. Check the troubleshooting section above
2. Review browser console logs
3. Verify your trading app API endpoints are working
4. Test with a fresh MarketInOut login

---

**Note**: This extension is designed to work with your specific trading application. Make sure to configure the APP_URLS correctly for your setup.
