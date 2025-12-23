# Output Module - Usage Examples

## Quick Start

### Basic Console Logging

```typescript
import { LogFormatter } from './output';

const logger = new LogFormatter();

logger.section('Main Task');
logger.subsection('Subtask 1');
logger.success('Operation completed');
logger.error('Something went wrong');
logger.warning('Please review this');
logger.info('Additional information');
logger.debug('Debug data for developers');
logger.detail('Response time', '150ms');
logger.newline();
```

### File Operations

```typescript
import { FileWriter } from './output';

// Write JSON (creates parent directories automatically)
FileWriter.writeJSON('/path/to/deeply/nested/data.json', { key: 'value' }, true);

// Write CSV with proper escaping
FileWriter.writeCSV('/path/to/file.csv', [
  { name: 'John, Jr.', age: 25, note: 'Contains "quotes"' },
  { name: 'Jane', age: 30, note: 'Normal data' }
]);

// Append to log file with timestamps
FileWriter.appendLog('/path/to/app.log', 'User logged in');

// Write plain text
FileWriter.writeText('/path/to/file.txt', 'Hello World');

// Check if file exists
if (FileWriter.exists('/path/to/file.txt')) {
  console.log('File exists!');
}
```

### OutputManager - Coordinated Output

```typescript
import { OutputManager } from './output';

const output = new OutputManager({
  directory: './output',
  saveToFile: true,
  prettyPrint: true,
  logFile: './output/app.log', // Optional: also write logs to file
});

// Use logger for formatted console output
const logger = output.getLogger();
logger.section('Data Processing');

// Log messages (both console + optional file)
output.log('info', 'Processing started');
output.log('success', 'Data validated');
output.log('warning', 'Some records skipped');

// Save results to JSON
await output.saveResult('results.json', {
  status: 'complete',
  records: 150
});

// Save CSV data
await output.saveCSV('export.csv', [
  { id: 1, value: 100 },
  { id: 2, value: 200 }
]);

// Save all log messages to JSON
await output.saveLogMessages('execution-log.json');

// Get logged messages programmatically
const logs = output.getLogMessages();
console.log(`Total logs: ${logs.length}`);

// Clear logs if needed
output.clearLogs();
```

## POC Script Pattern

```typescript
import { OutputManager } from './framework/output';
import { join } from 'path';

async function main() {
  // Setup output manager
  const output = new OutputManager({
    directory: join(__dirname, '_output', 'my-poc'),
    saveToFile: true,
    prettyPrint: true,
  });

  const logger = output.getLogger();

  try {
    logger.section('POC: Testing API');

    // Your POC logic
    output.log('info', 'Fetching data from API...');
    const data = await fetchData();
    output.log('success', 'Data fetched successfully');

    logger.detail('Records received', data.length);

    // Save results
    await output.saveResult('api-response.json', data);
    
    logger.subsection('Summary');
    logger.success('POC completed successfully');

  } catch (error) {
    output.log('error', `Failed: ${error.message}`);
    throw error;
  } finally {
    // Always save logs
    await output.saveLogMessages();
  }
}

main().catch(console.error);
```

## Advanced Features

### Custom CSV Escaping

The CSV writer automatically handles:
- Commas in values → wraps in quotes
- Quotes in values → escapes as double quotes
- Mixed comma + quotes → both handling applied

```typescript
// Input:
[
  { name: 'Smith, John', note: 'Says "hello"' }
]

// Output CSV:
name,note
"Smith, John","Says ""hello"""
```

### Log Message Tracking

```typescript
const output = new OutputManager({ /* config */ });

output.log('info', 'Step 1');
output.log('success', 'Step 2');

// Get all messages with timestamps
const messages = output.getLogMessages();
// [
//   { level: 'info', message: 'Step 1', timestamp: '2025-...' },
//   { level: 'success', message: 'Step 2', timestamp: '2025-...' }
// ]

// Save to JSON for analysis
await output.saveLogMessages('execution-history.json');

// Clear for next run
output.clearLogs();
```

### Pretty Print Toggle

```typescript
// Compact JSON (smaller files)
const compact = new OutputManager({
  directory: './output',
  saveToFile: true,
  prettyPrint: false, // Single line
});

// Pretty JSON (readable)
const pretty = new OutputManager({
  directory: './output',
  saveToFile: true,
  prettyPrint: true, // Indented
});
```

## Color Output Reference

The LogFormatter uses ANSI color codes:

| Method | Color | Icon | Usage |
|--------|-------|------|-------|
| `section()` | Blue (bright) | `===` | Major section headers |
| `subsection()` | Cyan | `───` | Sub-section headers |
| `success()` | Green | ✅ | Successful operations |
| `error()` | Red | ❌ | Error messages |
| `warning()` | Yellow | ⚠️ | Warning messages |
| `info()` | Gray | (indent) | Info/status messages |
| `debug()` | Gray | 🔍 | Debug information |
| `detail()` | Gray + Reset | (indent) | Key-value pairs |
| `raw()` | None | - | Unformatted output |
| `newline()` | - | - | Blank line |

## Tips

1. **Always use `prettyPrint: true` during development** for readable JSON
2. **Use `logFile` option** to persist all console logs to a file
3. **Call `saveLogMessages()`** at the end of POCs for execution history
4. **FileWriter creates directories automatically** - no need for mkdirSync
5. **CSV escaping is automatic** - just pass your data array

## Integration with Other Modules

```typescript
import { OutputManager } from './framework/output';
import { SessionProvider } from './framework/session';
import { MIOHttpClient } from './framework/http';

async function pocWithModules() {
  // Setup output first
  const output = new OutputManager({
    directory: './output/poc-test',
    saveToFile: true,
    prettyPrint: true,
  });

  const logger = output.getLogger();
  logger.section('POC with Framework Modules');

  // Use session provider
  const session = new SessionProvider({
    service: 'mio',
    cacheExpiry: 3600,
  });

  const sessionData = await session.getSession();
  logger.success('Session retrieved');

  // Use HTTP client
  const client = new MIOHttpClient(sessionData);
  const data = await client.get('/api/endpoint');
  
  output.log('success', 'API call completed');
  
  // Save results
  await output.saveResult('api-data.json', data);
  await output.saveLogMessages();
}
```
