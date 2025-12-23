# Framework Core Module

This is the foundation layer for the POC framework. All other framework components and POC implementations depend on these core types and classes.

## Files Overview

### 1. types.ts (55 lines)
Shared TypeScript type definitions:
- `Platform` - Supported platforms (marketinout | tradingview)
- `SessionData` - Session data structure
- `POCResult<T>` - Standardized result wrapper
- `POCOptions` - Configuration options
- `UserCredentials` - User credentials from environment

### 2. POCConfig.ts (105 lines)
Centralized configuration management:
- `getOutputDir(subdir?)` - Get output directory with auto-creation
- `getCredentials()` - Load credentials from .env (ADMIN_EMAIL, ADMIN_PASSWORD)
- `getEnv(key, required?)` - Get environment variable with validation
- `getKVConfig()` - Get KV configuration
- `isVerbose()` - Check if verbose logging is enabled
- `getTimeout(defaultValue?)` - Get timeout value

### 3. BasePOC.ts (178 lines)
Abstract base class using Template Method pattern:
- `run()` - Main entry point that orchestrates workflow
- Lifecycle hooks: `onStart()`, `onSuccess()`, `onError()`, `onComplete()`
- Abstract methods: `setup()`, `execute()`, `cleanup()`
- Utility methods for error handling and timing

### 4. POCRunner.ts (113 lines)
Orchestration utilities:
- `runPOC(poc)` - Run a single POC
- `runMultiple(pocs)` - Run multiple POCs in sequence (stops on failure)
- `runParallel(pocs)` - Run multiple POCs in parallel
- `runWithRecovery(pocs)` - Run with automatic error recovery
- `printSummary(results)` - Print execution summary

### 5. index.ts (19 lines)
Barrel export for all core modules

## Security Guarantees

✅ **NO hardcoded sessions or credentials**
✅ **All credentials loaded from environment variables**
✅ **Automatic directory creation with recursive: true**
✅ **Graceful error handling in all operations**

## Usage Example

```typescript
import { BasePOC, POCConfig, POCRunner, type POCResult } from './core/index.js';

interface MyPOCConfig {
  apiUrl: string;
}

interface MyPOCOutput {
  data: string;
}

class MyPOC extends BasePOC<MyPOCConfig, MyPOCOutput> {
  protected async setup(): Promise<void> {
    console.log('Setting up...');
  }

  protected async execute(): Promise<MyPOCOutput> {
    return { data: 'success' };
  }

  protected async cleanup(): Promise<void> {
    console.log('Cleaning up...');
  }
}

// Run the POC
const poc = new MyPOC({ apiUrl: 'https://api.example.com' });
const result = await POCRunner.runPOC(poc);
console.log(result);
```

## Environment Variables

Required:
- `ADMIN_EMAIL` - Admin user email
- `ADMIN_PASSWORD` - Admin user password
- `KV_REST_API_URL` - KV storage URL
- `KV_REST_API_TOKEN` - KV storage token

Optional:
- `POC_VERBOSE` - Enable verbose logging (true/false)
- `POC_TIMEOUT` - Default timeout in milliseconds
