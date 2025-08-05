# MIO TV Scripts - System Architecture

## Overview

MIO TV Scripts is built as a modern Next.js application with a clean separation between frontend components, API services, and external platform integrations. The architecture follows a modular design pattern that enables scalable development and maintainable code.

## System Architecture

### Frontend Layer
- **Framework**: Next.js 15.3.3 with React 19 and TypeScript
- **UI Components**: ShadCN UI component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom design system
- **State Management**: React hooks and local storage for session persistence
- **Navigation**: Tab-based navigation system with 7 core tools

### API Layer
- **Route Handlers**: Next.js API routes for server-side operations
- **Proxy Service**: Universal proxy for external API calls
- **Session Management**: Secure session bridging across platforms
- **Data Processing**: Real-time symbol conversion and watchlist operations

### External Integrations
- **MarketInOut (MIO)**: Screener data and watchlist management
- **TradingView**: Watchlist synchronization and symbol management
- **Telegram**: Automated alert and notification system

## Core Components

### 1. Stock Format Converter (`/`)
**Location**: [`src/app/StockFormatConverter.tsx`](src/app/StockFormatConverter.tsx:1)
- **Purpose**: Bidirectional symbol format conversion between MIO and TradingView
- **Key Features**:
  - Real-time conversion with multiple delimiter support
  - Direction toggle (MIO ↔ TradingView)
  - Mobile-optimized input/output areas
  - Download functionality for converted symbols

### 2. Navigation System
**Location**: [`src/components/TabNav.tsx`](src/components/TabNav.tsx:1)
- **Purpose**: Unified navigation across all tools
- **Routes**:
  - `/` - Stock Format Converter
  - `/csv-watchlist` - CSV Watchlist operations
  - `/shortlist-fetcher` - Automated watchlist retrieval
  - `/tv-sync` - TradingView synchronization
  - `/mio-sync` - MarketInOut synchronization
  - `/mio-watchlist` - MIO watchlist management
  - `/mio-auth` - Authentication setup

### 3. Editor Components
**Location**: [`src/components/EditorWithClipboard.tsx`](src/components/EditorWithClipboard.tsx:1)
- **Purpose**: Code-editor-like input areas with clipboard integration
- **Features**:
  - Collapsible interface for mobile optimization
  - Clipboard paste/copy functionality
  - File import/export capabilities
  - Tooltip-based user guidance

### 4. Session Management
**Location**: [`src/lib/sessionStore.ts`](src/lib/sessionStore.ts:1)
- **Purpose**: Secure cross-platform session handling
- **Architecture**:
  - File-based session storage (`/tmp/sessions.json`)
  - Internal session ID generation
  - Platform-specific session data isolation
  - Automatic session cleanup and validation

## Service Layer

### MIO Service
**Location**: [`src/lib/MIOService.ts`](src/lib/MIOService.ts:1)
- **Responsibilities**:
  - Watchlist fetching and management
  - Session validation and authentication
  - HTML parsing for watchlist data extraction
  - Bulk symbol operations

### TradingView Service
**Location**: [`src/lib/tradingview.ts`](src/lib/tradingview.ts:1)
- **Responsibilities**:
  - Watchlist synchronization
  - Symbol appending to watchlists
  - API authentication handling
  - Data format normalization

### Telegram Service
**Location**: [`src/lib/telegram.ts`](src/lib/telegram.ts:1)
- **Responsibilities**:
  - Message sending to channels/groups
  - Topic-based message threading
  - Markdown formatting support
  - Error handling and retry logic

## API Endpoints

### Proxy Service
**Location**: [`src/app/api/proxy/route.ts`](src/app/api/proxy/route.ts:1)
- **Purpose**: Universal proxy for external API calls
- **Features**:
  - Request/response transformation
  - Header normalization
  - Content-type handling
  - Error handling and logging

### MIO Action
**Location**: [`src/app/api/mio-action/route.ts`](src/app/api/mio-action/route.ts:1)
- **Purpose**: MIO platform operations
- **Operations**:
  - Watchlist fetching
  - Symbol synchronization
  - Session validation

### TradingView Watchlists
**Location**: [`src/app/api/tradingview-watchlists/route.ts`](src/app/api/tradingview-watchlists/route.ts:1)
- **Purpose**: TradingView watchlist operations
- **Operations**:
  - Watchlist enumeration
  - Symbol retrieval
  - Bulk synchronization

## Data Flow Architecture

### Symbol Conversion Flow
1. **Input**: User pastes symbols in source format
2. **Parse**: [`parseInput()`](src/app/StockFormatConverter.tsx:18) splits by delimiter
3. **Convert**: [`convertSymbols()`](src/app/StockFormatConverter.tsx:31) transforms format
4. **Output**: Converted symbols with selected delimiter

### Watchlist Sync Flow
1. **Authentication**: Session validation across platforms
2. **Fetch**: Retrieve source watchlist via API
3. **Transform**: Convert symbol formats and apply grouping
4. **Sync**: Push to target platform via API
5. **Confirm**: User feedback and error handling

### Grouping System
**Location**: [`src/lib/utils.ts`](src/lib/utils.ts:27)
- **Data Source**: [`src/all_nse.json`](src/all_nse.json:1) - NSE stock metadata
- **Grouping Options**: Industry, Sector, None
- **Format**: `###GroupName,SYMBOL1,SYMBOL2,...`

## Security Architecture

### Session Security
- **Internal Session IDs**: Cryptographically secure random generation
- **Platform Isolation**: Separate session data per platform
- **File-based Storage**: Temporary file storage with automatic cleanup
- **Validation**: Periodic session validation and refresh

### API Security
- **Proxy Pattern**: All external calls routed through internal proxy
- **Header Sanitization**: Request/response header normalization
- **Error Handling**: Secure error messages without sensitive data exposure
- **Rate Limiting**: Built-in request throttling for external APIs

## Performance Considerations

### Frontend Optimization
- **Code Splitting**: Next.js automatic code splitting
- **Component Lazy Loading**: Dynamic imports for heavy components
- **Mobile-First**: Optimized for mobile device performance
- **Caching**: Browser caching for static assets

### Backend Optimization
- **Session Caching**: In-memory session data caching
- **API Response Caching**: Cached responses for frequently accessed data
- **Bulk Operations**: Optimized for large symbol list processing
- **Error Recovery**: Graceful degradation and retry mechanisms

## Deployment Architecture

### Development Environment
- **Local Development**: Next.js dev server with hot reloading
- **Package Management**: pnpm for efficient dependency management
- **Code Quality**: ESLint with TypeScript support
- **Debugging**: Node.js inspector integration

### Production Considerations
- **Static Generation**: Next.js static site generation where applicable
- **API Routes**: Server-side API handling
- **Session Persistence**: File-based session storage (production should use Redis)
- **Error Monitoring**: Comprehensive logging and error tracking

## Key Design Patterns

### Component Composition
- **Reusable Components**: Modular UI components with clear interfaces
- **Props-based Configuration**: Flexible component behavior via props
- **Hook-based State**: Custom hooks for shared logic

### Service Layer Pattern
- **Service Classes**: Encapsulated business logic in service classes
- **Static Methods**: Stateless service methods for pure operations
- **Error Boundaries**: Consistent error handling across services

### Proxy Pattern
- **API Abstraction**: Single proxy endpoint for all external calls
- **Request Transformation**: Consistent request/response handling
- **Security Layer**: Centralized security and validation

## Critical Implementation Paths

### Symbol Conversion Pipeline
1. [`StockFormatConverter.tsx`](src/app/StockFormatConverter.tsx:1) - Main UI component
2. [`parseInput()`](src/app/StockFormatConverter.tsx:18) - Input parsing logic
3. [`convertSymbols()`](src/app/StockFormatConverter.tsx:31) - Core conversion logic
4. [`RegroupBar`](src/components/RegroupBar.tsx:1) - Grouping functionality

### Session Management Pipeline
1. [`sessionStore.ts`](src/lib/sessionStore.ts:1) - Core session operations
2. [`useSessionId`](src/lib/useSessionId.ts:1) - React hook for session state
3. [`sessionAuth.ts`](src/middleware/sessionAuth.ts:1) - Authentication middleware
4. [`session-bridge`](src/app/api/auth/session-bridge/route.ts:1) - Cross-platform bridging

### Platform Integration Pipeline
1. [`MIOService.ts`](src/lib/MIOService.ts:1) - MIO platform integration
2. [`tradingview.ts`](src/lib/tradingview.ts:1) - TradingView platform integration
3. [`proxy/route.ts`](src/app/api/proxy/route.ts:1) - Universal API proxy
4. [`telegram.ts`](src/lib/telegram.ts:1) - Telegram notification system