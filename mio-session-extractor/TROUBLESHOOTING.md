# Troubleshooting Guide: Session Extractor Extension

## Error: `net::ERR_BLOCKED_BY_CLIENT`

### What This Means
The browser is blocking the extension from sending data to your local development server. This is **NOT** an error with the extension itself, but rather a browser security feature or extension conflict.

### Common Causes & Solutions

#### 1. Ad Blocker Blocking Localhost (Most Common) ⚠️

**Ad blockers like uBlock Origin, Adblock Plus, or similar extensions are blocking requests to localhost.**

**Solution:**
- **Option A: Temporarily disable your ad blocker**
  1. Click your ad blocker icon in the browser toolbar
  2. Pause/disable it for the current site
  3. Reload the page

- **Option B: Whitelist localhost in your ad blocker**
  1. Open your ad blocker settings
  2. Add `localhost` or `127.0.0.1` to the whitelist/allowlist
  3. For uBlock Origin: Click the uBlock icon → Click the power button to whitelist

#### 2. Privacy Extensions Blocking Requests

Extensions like Privacy Badger, Ghostery, or DuckDuckGo Privacy Essentials may block localhost requests.

**Solution:**
- Temporarily disable privacy extensions
- Or whitelist localhost in their settings

#### 3. Corporate Network/Firewall

Some corporate networks block localhost requests for security.

**Solution:**
- Connect to a different network (home WiFi, mobile hotspot)
- Or use the production URL instead of localhost

#### 4. Extension Not Properly Loaded

The extension might need to be reloaded after updating.

**Solution:**
1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Find "Multi-Platform Session Extractor"
3. Click the **Reload** button (circular arrow icon)
4. Refresh the TradingView/MarketInOut page

#### 5. Missing Permissions

The extension needs permission to access localhost.

**Solution:**
1. Go to `chrome://extensions/` (or `edge://extensions/`)
2. Find "Multi-Platform Session Extractor"
3. Click **Details**
4. Scroll to "Site access"
5. Ensure it says "On specific sites" or "On all sites"
6. Check that `http://localhost:3000` is in the allowed list

### How to Test if Ad Blocker is the Issue

1. **Open DevTools** (F12)
2. Go to the **Network** tab
3. Look for the failed request to `http://localhost:3000/api/extension/session`
4. Check the "Initiator" column - if it says "blocked by client", it's an ad blocker
5. Temporarily disable ALL ad blockers and privacy extensions
6. Reload the page
7. If it works now, you know which extension was blocking it

### Verification Steps

After applying a fix:

1. Reload the TradingView/MarketInOut page
2. Open DevTools Console (F12 → Console)
3. Look for: `[MIO-EXTRACTOR] Successfully sent to app: http://localhost:3000`
4. If you see this, the fix worked! ✅

### Still Not Working?

If none of the above solutions work:

1. **Check if your dev server is running:**
   ```bash
   curl http://localhost:3000/api/extension/session
   ```
   Should return: `{"error":"Method GET is not supported"}`

2. **Try a different browser:**
   - If it works in a different browser, it's definitely an extension conflict

3. **Check browser console for other errors:**
   - Open DevTools (F12) → Console tab
   - Look for any other error messages

4. **Use production URL instead:**
   - Edit `content-script.js`
   - Change `CONFIG.APP_URLS` to use your Vercel URL
   - Reload extension

### Contact Support

If you've tried all these steps and it still doesn't work:

1. Open browser DevTools (F12)
2. Go to Console tab
3. Copy all error messages
4. Take a screenshot
5. Create a GitHub issue with:
   - Browser name and version
   - All installed extensions (especially ad blockers)
   - Error messages
   - Screenshot

---

## Other Common Issues

### Extension Icon Shows "?" Instead of "✓"

**Cause:** Session hasn't been extracted yet or extraction failed.

**Solution:**
1. Make sure you're logged into TradingView/MarketInOut
2. Reload the page
3. Check DevTools console for errors

### Session Not Showing in App

**Cause:** Backend not receiving or storing the session.

**Solution:**
1. Check backend logs for `[EXTENSION-API] Received session from multi-platform browser extension`
2. Verify KV environment variables are set (`KV_REST_API_URL`, `KV_REST_API_TOKEN`)
3. Check session in KV store using `pnpm list-sessions`

### "Session Expired" Error

**Cause:** The session cookie has actually expired on the platform.

**Solution:**
1. Log out of TradingView/MarketInOut
2. Log back in
3. The extension will automatically extract the new session

---

## Quick Checklist ✅

Before reporting an issue, verify:

- [ ] Development server is running (`pnpm dev`)
- [ ] All ad blockers are disabled or whitelisted localhost
- [ ] All privacy extensions are disabled or whitelisted localhost
- [ ] Extension has been reloaded in `chrome://extensions/`
- [ ] Page has been refreshed after reloading extension
- [ ] You're logged into TradingView/MarketInOut
- [ ] DevTools console shows no other errors
- [ ] Extension has permission to access localhost (check extension details)

---

## For Developers

### Testing Without Localhost

If you can't use localhost, test against production:

1. Deploy your changes to Vercel
2. Update `CONFIG.APP_URLS` in `content-script.js`:
   ```javascript
   const CONFIG = {
       APP_URLS: ['https://your-app.vercel.app'],
       // ...
   };
   ```
3. Reload extension
4. Test on TradingView/MarketInOut

### Debug Mode

Enable verbose logging:

1. Open `content-script.js`
2. Find `CONFIG` object
3. Set any debug flags if available
4. Reload extension
5. Check console for detailed logs
