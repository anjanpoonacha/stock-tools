# Extension Fixes Testing Guide

## Issues Fixed

### ✅ 1. CORS Preflight Requests

- **Problem**: Excessive `OPTIONS /api/extension/session 204` requests
- **Fix**: Added CORS headers to both `/api/extension/session` and `/api/extension/ping` endpoints
- **Result**: Browser will cache preflight responses for 24 hours (`Access-Control-Max-Age: 86400`)

### ✅ 2. Frequent API Calls

- **Problem**: Extension making requests every 2 seconds
- **Fix**:
  - Increased check interval from 2s to 10s
  - Added request throttling (minimum 5s between requests)
  - Added processing lock to prevent concurrent requests
  - Added exponential backoff on failures

### ✅ 3. Session Status "None" Issue

- **Problem**: Popup showing "None" even after successful extraction
- **Fix**:
  - Enhanced popup to read from Chrome storage
  - Added fallback to stored session data
  - Added session age validation (30 minutes max)
  - Better error handling for content script communication

## Testing Steps

### 1. Test CORS Fix

1. Open Chrome DevTools → Network tab
2. Visit MarketInOut and log in
3. Check for reduced OPTIONS requests
4. Verify POST requests succeed (200 status)

### 2. Test Throttling

1. Open Chrome DevTools → Console
2. Look for `[MIO-EXTRACTOR]` messages
3. Verify requests are spaced 10+ seconds apart
4. Check for "Request throttled, waiting..." messages

### 3. Test Session Status

1. Open extension popup
2. Should show session status as "Available" or "Stored"
3. Session info should display extracted time
4. Manual extraction should work

### 4. Test App Connection

1. Make sure your Next.js app is running on localhost:3000
2. Extension popup should show "Connected" for app status
3. Check browser console for successful API calls

## Expected Behavior

### Before Fixes

```
OPTIONS /api/extension/session 204 in 37ms  (every 2-5 seconds)
OPTIONS /api/extension/session 204 in 32ms
OPTIONS /api/extension/session 204 in 69ms
...
```

### After Fixes

```
POST /api/extension/session 200 in 45ms   (once per session change)
GET /api/extension/ping 200 in 29ms       (every 10+ seconds)
```

## Debugging Commands

### Check Extension Storage

```javascript
// Run in extension popup console
chrome.storage.local.get(['mioSession', 'lastUpdated'], (result) => {
  console.log('Stored session:', result);
});
```

### Check Content Script Status

```javascript
// Run in MarketInOut page console
// Look for [MIO-EXTRACTOR] messages
```

### Test API Endpoints

```bash
# Test ping endpoint
curl http://localhost:3000/api/extension/ping

# Test CORS headers
curl -H "Origin: https://www.marketinout.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type" \
     -X OPTIONS \
     http://localhost:3000/api/extension/session
```

## Success Indicators

1. **Reduced Network Traffic**: Far fewer OPTIONS requests
2. **Session Persistence**: Popup shows session data even after page refresh
3. **Successful Authentication**: Your trading app receives session data
4. **Better Performance**: Extension feels more responsive
5. **Clear Logging**: Console messages show proper throttling and success states

## If Issues Persist

1. **Clear Extension Storage**:

   ```javascript
   chrome.storage.local.clear();
   ```

2. **Reload Extension**:
   - Go to `chrome://extensions/`
   - Click reload button for MIO Session Extractor

3. **Check Browser Console**:
   - Look for any remaining errors
   - Verify CORS headers are present in responses

4. **Verify App Configuration**:
   - Ensure localhost:3000 is running
   - Check that API endpoints return proper responses
