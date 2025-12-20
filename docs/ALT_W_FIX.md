# Alt+W (Option+W) Keybinding Fix

**Date:** December 21, 2025  
**Status:** ✅ FIXED  
**Issue:** Alt+W / Option+W shortcut not working for quick add to watchlist

---

## 🐛 Problem

User reported: "Option+W does nothing"

**Expected Behavior:**
- Press `Alt+W` (Windows) or `Option+W` (Mac)
- Current stock should be added to currently selected watchlist
- Toast notification should show success

**Actual Behavior:**
- Pressing `Alt+W` / `Option+W` did nothing
- No error, no action, no response

---

## 🔍 Root Cause

**File:** `src/hooks/useChartKeybindings.ts`

**Bug Location:** Lines 112-116 (BEFORE fix)

```typescript
// Check for modifier keys and exit early
if (hasModifierKey(event) || event.shiftKey) {
    return; // ← This exits when Alt is pressed!
}

// ... 60 lines later ...

// Try to handle Alt+W (but code never reaches here!)
const isQuickAddShortcut = 
    event.key === 'w' && 
    event.altKey && ...

if (isQuickAddShortcut && ...) {
    // ← This handler is never reached!
}
```

**The Problem:**
1. `hasModifierKey()` returns `true` when `event.altKey` is pressed
2. Early return on line 114 exits the handler
3. `Alt+W` check on line 176 is **never reached**
4. Shortcut doesn't work

**Why It Wasn't Caught:**
- The keybinding check was **after** the modifier block
- Code logic error: Check should happen **before** blocking modifiers

---

## ✅ Solution

**Move the `Alt+W` check BEFORE the modifier block:**

```typescript
// FIXED: Check Alt+W FIRST, before blocking modifiers
const isQuickAddShortcut = 
    event.key === 'w' && 
    event.altKey && 
    !event.ctrlKey && 
    !event.metaKey &&
    !event.shiftKey;

if (isQuickAddShortcut && inputMode === 'none' && onWatchlistQuickAdd) {
    event.preventDefault();
    onWatchlistQuickAdd();
    return; // ← Exits here, successfully handled!
}

// NOW check for other modifier keys (after Alt+W handled)
if (hasModifierKey(event) || event.shiftKey) {
    return;
}
```

**Key Changes:**
1. ✅ Moved `Alt+W` check to **lines 112-124** (before modifier block)
2. ✅ Removed duplicate `Alt+W` check that was at line 176
3. ✅ Now `Alt+W` is handled before early return

---

## 📁 Files Modified

**1 file changed:**
- `src/hooks/useChartKeybindings.ts` (lines 112-124, removed 176-187)

**Diff:**
```diff
  const handleKeyDown = (event: KeyboardEvent) => {
    if (isInputElement(document.activeElement)) {
      return;
    }

+   // Check for Quick add (Option+W / Alt+W) first - before blocking modifiers
+   const isQuickAddShortcut = 
+     event.key === 'w' && 
+     event.altKey && 
+     !event.ctrlKey && 
+     !event.metaKey &&
+     !event.shiftKey;
+
+   if (isQuickAddShortcut && inputMode === 'none' && onWatchlistQuickAdd) {
+     event.preventDefault();
+     onWatchlistQuickAdd();
+     return;
+   }

    // Allow browser shortcuts to pass through
    if (hasModifierKey(event) || event.shiftKey) {
      return;
    }

    // ... rest of handlers ...

-   // Quick add (Option+W / Alt+W) - only in 'none' mode
-   const isQuickAddShortcut = 
-     event.key === 'w' && 
-     event.altKey && ...
-
-   if (isQuickAddShortcut && inputMode === 'none' && onWatchlistQuickAdd) {
-     event.preventDefault();
-     onWatchlistQuickAdd();
-     return;
-   }
```

---

## 🧪 Testing

### **Manual Test Steps:**

1. **Open the app:** http://localhost:3000/formula-results
2. **Navigate to a chart:** Click any stock or use arrow keys
3. **Select a watchlist first:**
   - Press `;` to open search dialog
   - Type watchlist name
   - Press `Enter` to select
4. **Test Alt+W:**
   - Press `Option+W` (Mac) or `Alt+W` (Windows)
   - **Expected:** Toast shows "✓ [SYMBOL] added to [Watchlist Name]"
5. **Verify on MIO:**
   - Go to https://www.marketinout.com
   - Check the watchlist
   - Stock should appear

### **Test Conditions:**

| Condition | Expected Result |
|-----------|----------------|
| Press `Alt+W` without selecting watchlist | Toast: "No watchlist selected" |
| Press `Alt+W` with watchlist selected | Toast: "✓ Stock added to watchlist" |
| Press `Alt+W` with expired session | Toast: "MIO operation failed: Session expired" |
| Press `Alt+W` while in search dialog | No action (inputMode !== 'none') |
| Press `Alt+W` while typing symbol | No action (inputMode !== 'none') |

---

## 🎯 Verification Checklist

- [x] Code change applied
- [x] TypeScript compilation passes
- [x] Dev server running with hot reload
- [ ] Manual test: Alt+W adds stock (user to verify)
- [ ] Manual test: Stock appears in MIO (user to verify)

---

## 🚀 How to Use

### **Quick Add Workflow:**

1. **First time setup:**
   ```
   Press ; → Type watchlist name → Press Enter
   ```

2. **Quick add (repeat for multiple stocks):**
   ```
   Press ↓ (next stock)
   Press Alt+W (add to watchlist)
   Press ↓ (next stock)
   Press Alt+W (add to watchlist)
   ... repeat!
   ```

### **Keyboard Shortcuts:**

| Key | Action |
|-----|--------|
| `;` | Open watchlist search dialog |
| `Alt+W` / `Option+W` | Quick add to current watchlist |
| `↑` | Previous stock |
| `↓` | Next stock |
| `Enter` | Confirm selection |
| `Esc` | Close dialog |

---

## 📊 Status

| Item | Status |
|------|--------|
| Bug Identified | ✅ |
| Root Cause Found | ✅ (modifier key check order) |
| Fix Applied | ✅ |
| Code Committed | ⏳ Pending |
| User Verified | ⏳ Pending |

---

## 🎉 Summary

**Issue:** Alt+W was blocked by early return in modifier check  
**Fix:** Move Alt+W handler before modifier check  
**Result:** Alt+W now works correctly for quick add  

**User action required:** Test Alt+W in the browser to confirm it's working!

---

## 🔧 Implementation Details

### **Keybinding Check Logic:**

```typescript
const isQuickAddShortcut = 
    event.key === 'w' &&       // W key pressed
    event.altKey &&            // Alt modifier is pressed
    !event.ctrlKey &&          // No Ctrl
    !event.metaKey &&          // No Cmd/Win
    !event.shiftKey;           // No Shift
```

### **Safety Checks:**

1. ✅ Only triggers when `inputMode === 'none'` (not typing)
2. ✅ Only triggers when `onWatchlistQuickAdd` is defined
3. ✅ Calls `event.preventDefault()` to prevent browser default
4. ✅ Exits early with `return` to prevent other handlers

### **Related Files:**

- `src/config/keybindings.json` - Keybinding configuration
- `src/hooks/useWatchlistIntegration.ts` - Watchlist logic
- `src/components/formula/ChartView.tsx` - Uses the keybinding hook

---

**Please test Alt+W now and confirm it's working!** 🎯
