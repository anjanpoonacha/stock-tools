# User-Scoped Settings Test Plan

## ✅ Implementation Status: COMPLETE

All code changes are in place and verified:

1. ✅ **User Identity System** (`src/lib/storage/userIdentity.ts`)
   - `generateUserId(email, password)` → deterministic SHA-256 hash
   - `generateUserSettingsKey(userId)` → `settings:user_{hash}`

2. ✅ **API Layer** (`src/app/api/kv/settings/route.ts`)
   - GET requires `userEmail` & `userPassword` query params
   - POST requires `userEmail` & `userPassword` in body
   - Auto-migration from global key `mio-tv:all-settings-v2`

3. ✅ **Hook Layer** (`src/hooks/useKVSettings.ts`)
   - Extracts credentials from `useAuth()`
   - Passes credentials to API on GET/POST
   - Console logs: `"✅ Loaded user-specific settings for: {email}"`

4. ✅ **True DI Architecture**
   - ChartView.tsx uses `currentLayout.slots.map()`
   - TradingViewLiveChart.tsx accepts `indicators: IndicatorConfig[]`
   - Indicator registry pattern in place

---

## 🧪 Manual Test Scenarios

### Test 1: Single User Settings Persistence

**Steps:**
1. Open app in browser: `http://localhost:3000/dashboard`
2. Log in with User A credentials (any email/password)
3. Navigate to chart view
4. Open browser DevTools Console
5. **Verify console shows:** `"✅ Loaded user-specific settings for: {email}"`
6. Change settings:
   - Toggle CVD indicator ON
   - Change resolution to "1W"
   - Switch to horizontal layout
7. **Verify console shows:** `"✅ Saved user-specific settings for: {email}"`
8. Refresh the page (F5)
9. **Verify settings persisted:** CVD still ON, resolution still "1W", layout still horizontal

**Expected Result:** ✅ Settings persist across page refreshes

---

### Test 2: Multi-User Isolation

**Steps:**
1. **User A Session:**
   - Log in with email: `userA@test.com`, password: `passwordA`
   - Change CVD to ON, resolution to "1W"
   - Note the settings
   - Log out

2. **User B Session:**
   - Log in with email: `userB@test.com`, password: `passwordB`
   - **Verify:** Settings are DIFFERENT (CVD likely OFF, resolution likely "1D")
   - Change CVD to OFF, resolution to "1D"
   - Log out

3. **User A Re-login:**
   - Log in again with `userA@test.com` / `passwordA`
   - **Verify:** User A's settings are RESTORED (CVD ON, resolution "1W")

**Expected Result:** ✅ Each user has isolated settings

---

### Test 3: Auto-Migration from Global Key

**Steps:**
1. Clear browser cache and cookies (simulate new user)
2. Log in with NEW credentials (never used before)
3. Open DevTools Console
4. **Verify console shows:** One of:
   - `"✅ Loaded user-specific settings for: {email}"` (if global key exists)
   - Default settings loaded (if global key doesn't exist)
5. Change a setting (e.g., enable CVD)
6. Refresh page
7. **Verify:** Changed setting persisted

**Expected Result:** ✅ New users get default/migrated settings

---

### Test 4: Cross-Device Sync (Same Credentials)

**Steps:**
1. **Device/Browser 1:**
   - Log in with `sync@test.com` / `password123`
   - Enable CVD, set resolution to "1W"
   - Note the settings

2. **Device/Browser 2:**
   - Log in with SAME credentials: `sync@test.com` / `password123`
   - **Verify:** Settings are SYNCED (CVD ON, resolution "1W")
   - Change resolution to "1D"

3. **Device/Browser 1:**
   - Refresh page
   - **Verify:** Resolution is still "1W" (no real-time sync, only on save/load)

**Expected Result:** ✅ Settings sync on login (not real-time)

---

### Test 5: Layout-Specific Settings

**Steps:**
1. Log in
2. **Single Layout:**
   - Enable CVD, Volume, Price
   - Set resolution to "1D"
3. Switch to **Horizontal Layout:**
   - Change Chart 1 resolution to "1W"
   - Change Chart 2 resolution to "4H"
   - Disable Volume on Chart 2
4. Switch to **Vertical Layout:**
   - Verify default: Only CVD enabled (per requirements)
5. Switch back to **Single Layout:**
   - **Verify:** Settings preserved (CVD/Volume/Price ON, resolution "1D")
6. Switch to **Horizontal Layout:**
   - **Verify:** Settings preserved (Chart 1: "1W", Chart 2: "4H", Volume OFF on Chart 2)

**Expected Result:** ✅ Each layout maintains independent settings

---

### Test 6: Invalid Credentials Handling

**Steps:**
1. Open DevTools Network tab
2. Try to access settings API directly:
   ```
   GET /api/kv/settings (no query params)
   ```
3. **Verify:** Returns 401 error with `"Missing user credentials"`

**Expected Result:** ✅ API requires authentication

---

## 🔍 Console Log Verification

### Expected Console Logs (Normal Flow)

```
[useKVSettings] Loading settings...
✅ Loaded user-specific settings for: userA@test.com

[useKVSettings] Saving settings...
[Settings] Saved settings for userId: user_a1b2c3d4e5f6...
✅ Saved user-specific settings for: userA@test.com
```

### Expected Console Logs (Error Flow)

```
⚠️ No user credentials available for settings
[useKVSettings] Failed to load settings: fetch failed
```

---

## 📊 KV Storage Verification

### Using Vercel KV Dashboard:

1. Go to Vercel Dashboard → Storage → KV
2. Search for keys matching pattern: `settings:user_*`
3. **Expected keys:**
   - `settings:user_a1b2c3d4...` (User A)
   - `settings:user_xyz789ab...` (User B)
   - `mio-tv:all-settings-v2` (global fallback)

### Using Scripts (if KV CLI available):

```bash
# List all user settings keys
vercel kv list "settings:user_*"

# Get specific user settings
vercel kv get "settings:user_a1b2c3d4e5f6..."

# Get global settings (for comparison)
vercel kv get "mio-tv:all-settings-v2"
```

---

## ✅ Code Verification Checklist

- [x] `src/lib/storage/userIdentity.ts` exists and exports functions
- [x] `src/app/api/kv/settings/route.ts` uses `generateUserId()`
- [x] `src/hooks/useKVSettings.ts` passes credentials to API
- [x] `src/components/formula/ChartView.tsx` uses `currentLayout.slots.map()`
- [x] `src/components/TradingViewLiveChart.tsx` uses `indicators.find()`
- [x] Old API routes deleted (panel-layout, chart-settings, etc.)

---

## 🐛 Known Issues to IGNORE

These TypeScript errors are pre-existing and expected:

1. `Property 'order' does not exist on type Panel` (react-resizable-panels)
2. `Type 'string' is not assignable to type 'ChartZoomLevel'` (type mismatch)
3. `Type 'OHLCVBar[]' is not assignable to '...'` (CVD data type)

**Do NOT attempt to fix these during user-scoped settings testing.**

---

## 📝 Test Results Template

```
# User-Scoped Settings Test Results

**Date:** YYYY-MM-DD
**Tester:** [Your Name]
**Browser:** Chrome/Firefox/Safari [Version]

## Test 1: Single User Persistence
- [ ] Console shows "Loaded user-specific settings"
- [ ] Settings persist after refresh
- [ ] No console errors

## Test 2: Multi-User Isolation
- [ ] User A settings isolated from User B
- [ ] User A settings restored after logout/login
- [ ] Console shows different userIds

## Test 3: Auto-Migration
- [ ] New user gets default settings
- [ ] Settings save/load correctly

## Test 4: Cross-Device Sync
- [ ] Same credentials load same settings on different browser
- [ ] Settings sync on login (not real-time)

## Test 5: Layout-Specific Settings
- [ ] Single layout settings preserved
- [ ] Horizontal layout settings preserved
- [ ] Vertical layout settings preserved
- [ ] Switching layouts doesn't lose settings

## Test 6: Invalid Credentials
- [ ] API returns 401 without credentials
- [ ] Console shows warning message

## Overall Result
- [ ] PASS - All tests passed
- [ ] FAIL - [Describe issues]

## Issues Found
1. [Issue description]
2. [Issue description]

## Notes
[Additional observations]
```

---

## 🎯 Success Criteria

The implementation is considered **SUCCESSFUL** if:

1. ✅ Different users have isolated settings (Test 2 passes)
2. ✅ Settings persist across page refreshes (Test 1 passes)
3. ✅ Console logs show user-specific messages (Tests 1-2)
4. ✅ Each layout maintains independent settings (Test 5 passes)
5. ✅ No breaking errors in production build
6. ✅ CVD uses correct timeframe format (15S, 5, 1D not 15s, 5m, 1d)

---

## 🚀 Next Steps After Testing

### If All Tests Pass:
1. Delete backup files:
   - `src/components/formula/ChartView.backup.tsx`
   - `src/components/formula/ChartView copy.tsx`
   - `src/components/formula/ChartView.before-refactor2.tsx`
   - `src/components/formula/ChartView.monolithic-backup.tsx`
   - `src/components/formula/ChartView.old.txt`

2. Optional: Delete global key `mio-tv:all-settings-v2` if no longer needed

3. Update `docs/IMPORTANT_DOC.md` to mark user-scoped settings as complete

### If Tests Fail:
1. Document specific failures
2. Check console errors
3. Verify KV storage keys exist
4. Check if credentials are being passed correctly
5. Review API logs for userId generation
