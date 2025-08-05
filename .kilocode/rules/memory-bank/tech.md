# MIO TV Scripts - Technology Stack

## Frontend Technologies

### Core Framework
- **Next.js 15.3.3**: React-based full-stack framework with App Router
- **React 19**: Latest React version with concurrent features
- **TypeScript 5**: Static type checking for enhanced development experience

### UI Framework & Styling
- **ShadCN UI**: Modern component library built on Radix UI primitives
- **Radix UI**: Unstyled, accessible UI components
- **Tailwind CSS 4**: Utility-first CSS framework with custom design system
- **Lucide React**: Beautiful & consistent icon library
- **Next Themes**: Dark/light theme support with system preference detection

### State Management & Hooks
- **React Hooks**: Built-in state management with useState, useEffect
- **Custom Hooks**: 
  - [`useSessionId`](src/lib/useSessionId.ts:1) - Platform session management
  - [`useInternalSessionId`](src/lib/useInternalSessionId.ts:1) - Internal session handling
  - [`useSessionBridge`](src/lib/useSessionBridge.ts:1) - Cross-platform session bridging
- **Local Storage**: Client-side persistence for user preferences and session data

## Backend Technologies

### Server-Side Framework
- **Next.js API Routes**: Server-side API endpoints with TypeScript support
- **Node.js**: Runtime environment with built-in debugging support
- **File System API**: Server-side file operations for session storage

### External API Integration
- **Fetch API**: Modern HTTP client for external service calls
- **Cheerio**: Server-side HTML parsing for MIO watchlist extraction
- **Proxy Pattern**: Universal API proxy for cross-origin requests

### Session Management
- **Crypto Module**: Secure random session ID generation
- **File-based Storage**: JSON file storage in `/tmp/sessions.json`
- **Platform Isolation**: Separate session data per trading platform

## Development Tools

### Package Management
- **pnpm**: Fast, disk space efficient package manager
- **Node.js Inspector**: Built-in debugging with `--inspect` flag
- **Turbopack**: Next.js bundler for faster development builds

### Code Quality
- **ESLint 9**: JavaScript/TypeScript linting with Next.js configuration
- **TypeScript**: Static type checking across entire codebase
- **Prettier**: Code formatting (implied by consistent code style)

### Build & Development
- **Next.js Dev Server**: Hot reloading development environment
- **Static Generation**: Build-time page generation where applicable
- **API Route Handlers**: Server-side request processing

## External Platform APIs

### MarketInOut (MIO) Integration
- **Authentication**: Cookie-based session management
- **Watchlist API**: HTML scraping with Cheerio for data extraction
- **Screener API**: Direct API calls to screener endpoints
- **Session Validation**: Periodic session refresh and validation

### TradingView Integration
- **REST API**: JSON-based API for watchlist operations
- **Session Management**: Cookie-based authentication with sessionid
- **Watchlist Operations**: 
  - Fetch all watchlists
  - Append symbols to watchlists
  - Replace watchlist contents
- **Symbol Format**: NSE:/BSE: prefixed symbols

### Telegram Integration
- **Bot API**: HTTP-based API for message sending
- **Message Threading**: Topic-based message organization
- **Markdown Support**: Rich text formatting in messages
- **Error Handling**: Robust error handling and retry logic

## Data Processing

### Symbol Conversion
- **Format Mapping**: Bidirectional conversion between MIO and TradingView formats
- **Delimiter Support**: Multiple delimiter options (comma, space, newline, etc.)
- **Bulk Processing**: Efficient handling of large symbol lists
- **Validation**: Input validation and error handling

### Grouping & Organization
- **NSE Stock Data**: [`src/all_nse.json`](src/all_nse.json:1) - Complete NSE stock metadata
- **Industry/Sector Grouping**: Automatic categorization based on stock metadata
- **Group Format**: `###GroupName,SYMBOL1,SYMBOL2,...` sectioned format
- **Dynamic Regrouping**: Real-time regrouping based on user selection

## Security & Performance

### Security Measures
- **Session Isolation**: Platform-specific session data separation
- **Secure Random IDs**: Cryptographically secure session ID generation
- **Proxy Pattern**: All external API calls routed through internal proxy
- **Header Sanitization**: Request/response header normalization
- **Error Handling**: Secure error messages without sensitive data exposure

### Performance Optimizations
- **Code Splitting**: Automatic code splitting with Next.js
- **Component Lazy Loading**: Dynamic imports for heavy components
- **Mobile-First Design**: Optimized for mobile device performance
- **Caching**: Browser caching for static assets and API responses
- **Bulk Operations**: Optimized processing for large datasets

## Development Environment Setup

### Prerequisites
- **Node.js**: Version 18+ recommended
- **pnpm**: Package manager (`npm install -g pnpm`)
- **TypeScript**: Included in devDependencies

### Installation & Setup
```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start

# Run linting
pnpm lint
```

### Development Configuration
- **Port**: localhost:3000 (default Next.js port)
- **Hot Reloading**: Enabled in development mode
- **TypeScript**: Strict mode enabled
- **ESLint**: Next.js recommended configuration
- **Debugging**: Node.js inspector available on port 9229

## Deployment Considerations

### Production Requirements
- **Node.js Runtime**: Server-side rendering and API routes
- **File System Access**: Required for session storage (consider Redis for production)
- **Environment Variables**: Platform API keys and configuration
- **HTTPS**: Required for clipboard API and secure cookie handling

### Scalability Considerations
- **Session Storage**: File-based storage should be replaced with Redis/database
- **Rate Limiting**: Implement proper rate limiting for external API calls
- **Caching Layer**: Add Redis for API response caching
- **Load Balancing**: Consider multiple instances for high traffic

### Monitoring & Logging
- **Error Tracking**: Implement comprehensive error monitoring
- **Performance Monitoring**: Track API response times and user interactions
- **Usage Analytics**: Monitor feature usage and user behavior
- **Health Checks**: API endpoint health monitoring

## Technical Constraints

### Platform Limitations
- **MIO API**: Rate limiting requires careful request management
- **TradingView API**: Session validation needs periodic refresh
- **Browser APIs**: Clipboard API requires HTTPS and user interaction
- **Mobile Safari**: Some layout considerations for iOS devices

### Performance Constraints
- **Large Watchlists**: Memory usage for processing large symbol lists
- **API Response Times**: External API dependency affects user experience
- **Mobile Performance**: Touch interface optimization requirements
- **Network Reliability**: Offline handling and retry mechanisms

## Future Technical Improvements

### Immediate Technical Debt
- **Session Storage**: Migrate from file-based to Redis/database
- **Error Handling**: Implement comprehensive error boundaries
- **Testing**: Add unit and integration test coverage
- **Documentation**: Complete API documentation and user guides

### Scalability Enhancements
- **Microservices**: Consider service separation for different platforms
- **WebSocket**: Real-time updates for watchlist changes
- **PWA**: Progressive Web App features for mobile experience
- **Background Sync**: Service worker for offline functionality