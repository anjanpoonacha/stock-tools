# TradingView POC Scripts (Framework-based)

Framework-based versions of TradingView POC scripts with automatic session management, reusable components, and enhanced error handling.

## Quick Start

```bash
# Step 1: Get User ID
tsx --env-file=.env scripts/migrated/tradingview/poc-1-get-user-id.ts <email> <password>

# Step 2: Get JWT Token
tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts <email> <password>

# Step 3: Fetch Historical Bars
tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts <email> <password>
```

## Scripts

### POC 1: Get User ID
Fetches TradingView user ID for a given account.

**Usage:**
```bash
tsx --env-file=.env scripts/migrated/tradingview/poc-1-get-user-id.ts <email> <password>
```

**Output:**
- File: `scripts/poc-output/tradingview/1-user-data.json`
- Contains: `userId`, `username`

### POC 2: Get JWT Token
Fetches JWT token for WebSocket authentication.

**Usage:**
```bash
# Fetch user ID dynamically
tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts <email> <password> [chartId]

# Load user ID from Step 1 output
tsx --env-file=.env scripts/migrated/tradingview/poc-2-get-jwt-token.ts <email> <password> --load-from-file
```

**Options:**
- `chartId` - Chart ID (default: `S09yY40x`)
- `--load-from-file` - Load user ID from Step 1 output

**Output:**
- File: `scripts/poc-output/tradingview/2-jwt-token.json`
- Contains: `jwtToken`, `userId`, `chartId`, `expiresAt`, `expiresIn`

### POC 3: WebSocket Client
Connects to TradingView WebSocket and fetches historical OHLCV bars.

**Usage:**
```bash
# Basic usage
tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts <email> <password>

# Custom configuration
tsx --env-file=.env scripts/migrated/tradingview/poc-3-websocket-client.ts <email> <password> \
  --symbol NSE:TCS \
  --resolution 1W \
  --bars 500 \
  --cvd \
  --cvd-anchor 3M \
  --cvd-timeframe 30S
```

**Options:**
- `--symbol <symbol>` - Symbol to fetch (default: `NSE:JUNIPER`)
- `--resolution <resolution>` - Resolution (default: `1D`)
- `--bars <count>` - Number of bars (default: `300`)
- `--chart <chartId>` - Chart ID (default: `S09yY40x`)
- `--cvd` - Enable CVD indicator
- `--cvd-anchor <period>` - CVD anchor period (default: `3M`)
- `--cvd-timeframe <tf>` - CVD custom timeframe (e.g., `30S`)
- `--load-from-file` - Load JWT from Step 2 output

**Output:**
- File: `scripts/poc-output/tradingview/3-bars-output.json`
- Contains: `bars[]`, `symbolMetadata`, `indicators`, `messagesExchanged`
- Messages log: `scripts/poc-output/tradingview/3-websocket-messages.log`

## Key Features

### 1. No Hardcoded Sessions
All scripts fetch sessions dynamically from KV store:
```typescript
const sessionInfo = await sessionProvider.getSessionForUser('tradingview', credentials);
```

### 2. Reusable HTTP Client
Unified HTTP client with automatic authentication:
```typescript
const response = await tvClient.getUserId();
const jwtResponse = await tvClient.getJWTToken(userId, chartId);
```

### 3. Structured Output
Consistent output management:
```typescript
await output.saveResult('result.json', data);
```

### 4. Enhanced Error Handling
Framework handles errors automatically with troubleshooting tips.

### 5. CLI Flexibility
Support for flags, options, and file loading.

## Framework Components

These scripts use the following framework components:

- **BasePOC** - Template method pattern for POC workflow
- **SessionProvider** - Dynamic session management with caching
- **TVHttpClient** - TradingView HTTP client
- **OutputManager** - File and console output
- **ArgParser** - CLI argument parsing
- **POCConfig** - Configuration utilities

## Output Directory Structure

```
scripts/poc-output/tradingview/
├── 1-user-data.json           # User ID and username
├── 2-jwt-token.json           # JWT token with expiry
├── 3-bars-output.json         # Historical bars and metadata
└── 3-websocket-messages.log   # WebSocket message log
```

## Differences from Original

| Aspect | Original | Migrated |
|--------|----------|----------|
| Session Management | Hardcoded in config | Dynamic from KV store |
| HTTP Requests | Manual fetch | Reusable HTTP client |
| Error Handling | Try-catch | Framework lifecycle hooks |
| Output | Manual file writing | Structured output manager |
| CLI | Config file only | Flags and options |
| LOC | 623 total | 944 total (but more reusable) |

## See Also

- [Migration Report](./MIGRATION_REPORT.md) - Detailed migration analysis
- [Framework Documentation](../../framework/EXAMPLES.md) - Framework usage guide
- [Original POCs](../../poc-tradingview/) - Original implementations
