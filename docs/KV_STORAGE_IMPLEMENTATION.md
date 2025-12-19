# Vercel KV Storage Implementation

## Overview

All user preferences and settings are now persisted in **Vercel KV** for cross-device synchronization and reliable storage.

## What's Stored

### 1. Panel Layout
- Toolbar panel width (%)
- Chart panel width (%)
- Stock list panel width (%)
- **Saved**: After 1 second of no resizing (debounced)

### 2. Chart Settings
- Resolution 1 & 2 (e.g., "1D", "5min")
- Zoom levels (SM, MD, LG, XL)
- CVD indicator settings
  - Show/hide
  - Anchor period
  - Custom period
- Grid visibility
- Dual view mode (on/off)
- Volume MA settings
- **Saved**: Immediately on change

### 3. Layout Settings
- Layout mode (horizontal/vertical)
- Range sync (enabled/disabled)
- **Saved**: Immediately on toggle

## Implementation Files

### `/src/lib/storage/kvStorage.ts`
- Core KV storage functions
- Type definitions
- Default values
- Save/load functions for all settings

### `/src/components/formula/ChartView.tsx`
- Loads settings from KV on mount
- Shows loading state while fetching
- Saves changes automatically
- Debounces panel resize saves

## Environment Requirements

**Vercel KV must be configured with these environment variables:**

```bash
KV_URL="..."
KV_REST_API_URL="..."
KV_REST_API_TOKEN="..."
KV_REST_API_READ_ONLY_TOKEN="..."
```

## Key Features

### ✅ Auto-Save
- All changes are automatically saved to KV
- Panel resizes are debounced (1 second delay)
- Chart settings save immediately

### ✅ Auto-Load
- Settings load on page mount
- Shows loading indicator while fetching
- Falls back to defaults if KV unavailable

### ✅ Cross-Device Sync
- Settings persist across:
  - Different browsers
  - Different devices
  - Page reloads
  - Sessions

### ✅ Graceful Fallback
- If KV is unavailable, uses default values
- Errors logged to console (not shown to user)
- App remains functional

## Usage

### For Users
No action needed! Settings are automatically saved and restored.

### For Developers

**Load all settings:**
```typescript
import { loadAllSettings } from '@/lib/storage/kvStorage';

const { panelLayout, chartSettings, layoutSettings } = await loadAllSettings();
```

**Save panel layout:**
```typescript
import { savePanelLayout } from '@/lib/storage/kvStorage';

await savePanelLayout({
  'toolbar-panel': 5,
  'chart-panel': 81,
  'stock-list-panel': 14,
});
```

**Save chart settings:**
```typescript
import { saveChartSettings } from '@/lib/storage/kvStorage';

await saveChartSettings({
  resolution1: '1D',
  resolution2: '1W',
  // ... other settings
});
```

## Console Logs

Watch for these indicators:
- `✅ Loaded panel layout from KV:` - Successfully loaded
- `✅ Saved panel layout to KV:` - Successfully saved
- `❌ Failed to load/save:` - Error occurred (check KV config)

## Testing

1. **Adjust settings** (resize panels, change resolution, toggle layout)
2. **Refresh page** - settings should be restored
3. **Open in different browser** - settings should sync
4. **Check console** - should see success logs

## Troubleshooting

### Settings not persisting?
- Check KV environment variables are set
- Look for error logs in console
- Verify KV database exists in Vercel dashboard

### Loading spinner stuck?
- Check browser console for errors
- Verify KV API endpoint is accessible
- Check network tab for failed requests

### Want to reset to defaults?
Run in browser console:
```javascript
// This will reset on next page load
localStorage.clear();
```

Or manually clear KV from Vercel dashboard.
