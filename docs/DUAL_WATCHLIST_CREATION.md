# Dual Platform Watchlist Creation

## Overview
Backend API endpoint that creates watchlists on both MIO and TradingView platforms simultaneously.

## Endpoint

**URL:** `POST /api/watchlist/create`

**Request Body:**
```typescript
{
  name: string;           // e.g., "AUTO_DailySetup"
  userEmail: string;      // Required for authentication
  userPassword: string;   // Required for authentication
}
```

**Response:**
```typescript
{
  mioId?: string;         // MIO watchlist ID (if successful)
  tvId?: string;          // TradingView watchlist ID (if successful)
  name: string;           // Watchlist name
  success: boolean;       // True if both succeeded
  error?: string;         // Error message (if any)
  needsSession?: boolean; // True if session is missing/expired
}
```

## Implementation Details

### Files Created/Modified

1. **`src/app/api/watchlist/create/route.ts`** (NEW)
   - Main API endpoint handler
   - Handles authentication via SessionResolver
   - Executes parallel watchlist creation on both platforms
   - Returns unified response structure

2. **`src/lib/tradingview.ts`** (MODIFIED)
   - Added `createWatchlist()` function
   - Creates watchlist via TradingView API
   - Endpoint: `POST https://www.tradingview.com/api/v1/symbols_list/custom/`

### Architecture

```
Frontend Request
    ↓
POST /api/watchlist/create
    ↓
SessionResolver (Get MIO + TV sessions)
    ↓
Promise.allSettled([
    MIOService.createWatchlist(),      ← Already exists
    createTVWatchlist()                ← NEW function
])
    ↓
Process results & return response
```

### Error Handling

The endpoint handles three scenarios:

1. **Both Succeed** (success: true)
   ```json
   {
     "mioId": "123",
     "tvId": "abc",
     "name": "AUTO_DailySetup",
     "success": true
   }
   ```

2. **Partial Success** (success: false, partial data)
   ```json
   {
     "mioId": "123",
     "name": "AUTO_DailySetup",
     "success": false,
     "error": "TradingView failed: Session expired"
   }
   ```

3. **Both Fail** (success: false, no data)
   ```json
   {
     "name": "AUTO_DailySetup",
     "success": false,
     "error": "Failed on both platforms. MIO: ..., TradingView: ...",
     "needsSession": true
   }
   ```

## Authentication

Uses **SessionResolver** pattern (same as `/api/mio-action`):
- Requires `userEmail` and `userPassword` in request body
- Fetches sessions from KV store dynamically
- NO hardcoded credentials

Sessions required:
- MIO: ASPSESSION cookie
- TradingView: sessionid cookie

## POC Scripts

Two POC scripts are provided for validation:

### 1. TradingView Only Test
```bash
tsx --env-file=.env scripts/poc-tradingview/poc-create-watchlist.ts
```

### 2. Dual Platform Test
```bash
tsx --env-file=.env scripts/poc-mio/poc-test-create-dual-watchlist.ts
```

## Usage Example

### Frontend/Client Side
```typescript
const response = await fetch('/api/watchlist/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    name: 'AUTO_DailySetup',
    userEmail: 'user@example.com',
    userPassword: 'password123',
  }),
});

const result = await response.json();

if (result.success) {
  console.log('Created on both platforms!');
  console.log('MIO ID:', result.mioId);
  console.log('TV ID:', result.tvId);
} else {
  console.error('Error:', result.error);
}
```

### Using curl
```bash
curl -X POST http://localhost:3000/api/watchlist/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "AUTO_DailySetup",
    "userEmail": "user@example.com",
    "userPassword": "password123"
  }'
```

## Naming Convention

The endpoint accepts the **full name** with prefix:
- Frontend should apply `AUTO_` prefix before calling
- Backend receives complete name: `"AUTO_DailySetup"`
- Backend passes name through to both platforms as-is

## Testing Checklist

- [ ] Run POC scripts to validate APIs
- [ ] Test with valid sessions (both platforms)
- [ ] Test with missing MIO session
- [ ] Test with missing TV session
- [ ] Test with expired sessions
- [ ] Test with invalid watchlist name
- [ ] Verify error messages
- [ ] Check parallel execution performance

## Future Enhancements

1. Add symbols during creation (currently creates empty watchlists)
2. Add retry logic for transient failures
3. Add rollback mechanism (delete created watchlist if other platform fails)
4. Add webhook/notification for async completion
5. Add batch creation support

## Related Files

- `src/lib/mio/MIOService.ts` - MIO service (createWatchlist exists)
- `src/lib/mio/apiClient.ts` - MIO API client
- `src/lib/SessionResolver.ts` - Session management
- `src/app/api/mio-action/route.ts` - Reference for auth pattern
- `scripts/poc-tradingview/poc-create-watchlist.ts` - TV POC
- `scripts/poc-mio/poc-test-create-dual-watchlist.ts` - Dual platform POC
