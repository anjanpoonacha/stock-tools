# TradingView Session ID Fetching Fix

## Issue Description

There was a flaw in the TradingView session ID fetching logic where user credentials were not being respected. This caused the system to potentially return session IDs for the wrong user.

### Symptoms

- TradingView session ID showing as `null` in localStorage even when a user is logged in
- The localStorage data showed:

```json
{
  "isAuthenticated": true,
  "userEmail": "anjan",
  "sessionStats": {
    "platforms": {
      "marketinout": {
        "hasSession": false,
        "sessionAvailable": false,
        "currentSessionId": null
      },
      "tradingview": {
        "hasSession": false,
        "sessionAvailable": false,
        "currentSessionId": null,
        "sessionId": null
      }
    },
    "message": "No sessions found for user anjan - please use browser extension to capture sessions",
    "availableUsers": ["anjan"],
    "currentUser": "anjan"
  }
}
```

## Root Cause

The `useSessionBridge` hook was using a GET request to `/api/session/current?platform=tradingview` which didn't include user credentials. This caused the backend to call `SessionResolver.getLatestSession(platform)` which retrieves any TradingView session, regardless of which user it belongs to.

### Flow Before Fix

```
Frontend (useSessionBridge) 
  → GET /api/session/current?platform=tradingview (NO user credentials)
    → SessionResolver.getLatestSession('tradingview') (NO user filtering)
      → Returns ANY TradingView session (could be from different user)
```

## Solution

The fix modifies the `useSessionBridge` hook to:

1. Get user credentials from localStorage
2. Use a POST request to `/api/session/current` with these credentials
3. Extract the sessionId from the response

### Flow After Fix

```
Frontend (useSessionBridge) 
  → POST /api/session/current with user credentials
    → SessionResolver.getLatestSessionForUser('tradingview', credentials)
      → Returns only sessions for the specified user
```

## Implementation Details

The fix was implemented in `src/lib/useSessionBridge.ts`:

```typescript
// Before
const response = await fetch(`/api/session/current?platform=${platform}`);

// After
// Get stored credentials from localStorage
const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');

if (!storedCredentials) {
  throw new Error('Authentication required. Please log in first.');
}

let credentials;
try {
  credentials = JSON.parse(storedCredentials);
} catch (error) {
  throw new Error('Invalid authentication data. Please log in again.');
}

// Use POST with user credentials instead of GET
const response = await fetch(`/api/session/current`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    platform,
    userEmail: credentials.userEmail,
    userPassword: credentials.userPassword,
  }),
});
```

## Testing

Two test files were created to verify the fix:

1. `src/test-session-bridge.js` - A JavaScript test script that simulates the behavior of the useSessionBridge hook
2. `src/test-session-bridge.html` - An HTML test page that can be used to test the fix in a browser environment

### How to Test

1. Open `src/test-session-bridge.html` in a browser
2. Enter user credentials (default: "anjan" / "password123")
3. Click "Save to localStorage"
4. Click "Test TradingView Session"
5. Check the log for a successful response with a session ID

Alternatively, you can navigate to any page that uses the useSessionBridge hook (e.g., /tv-sync) and check the network tab for a POST request to /api/session/current with user credentials.

## Benefits of the Fix

1. **User-Scoped Sessions**: Sessions are now properly filtered by user credentials
2. **Consistent Approach**: Aligns with how ShortlistFetcherClient already handles user credentials
3. **Minimal Changes**: Only one file was modified, with no changes to the hook's API
4. **No Component Changes**: Components using useSessionBridge don't need to be modified

## Future Considerations

While this fix addresses the immediate issue, there are some potential future improvements:

1. **Centralized Auth**: Consider implementing a more centralized authentication system
2. **Credential Management**: Improve how credentials are stored and retrieved
3. **Error Handling**: Add more robust error handling for authentication failures
4. **Session Refresh**: Implement automatic session refresh when sessions expire
