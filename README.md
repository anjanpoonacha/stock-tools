# MIO TV Scripts

A Next.js web application integrating MarketInOut (MIO) and TradingView APIs for stock market analysis and charting.

## Features

- **Stock Format Converter**: Convert stock symbols between MarketInOut and TradingView formats
- **TradingView Charts**: Interactive charts with CVD (Cumulative Volume Delta) indicators
- **Watchlist Integration**: Synchronized watchlists across MIO and TradingView platforms
- **Formula Editor**: Custom formula creation and analysis using MIO data
- **Multi-chart Layouts**: Horizontal and vertical split views with cross-chart synchronization

## External API Integrations

### TradingView WebSocket Protocol

Real-time chart data via WebSocket connections. See [TRADINGVIEW_WEBSOCKET_PROTOCOL.md](./docs/TRADINGVIEW_WEBSOCKET_PROTOCOL.md) for protocol details.

### CVD (Cumulative Volume Delta)

TradingView Pine Script indicator integration. Quick reference: [CVD_QUICK_REFERENCE.md](./CVD_QUICK_REFERENCE.md) | Full guide: [CVD_SETTINGS_GUIDE.md](./docs/CVD_SETTINGS_GUIDE.md)

### MarketInOut API

Stock screening and formula calculations. See [API_REFERENCE.md](./docs/API_REFERENCE.md) for endpoint documentation.

## Format Reference

### TradingView Format
- NSE stocks: `NSE:TCS`
- BSE stocks: `BSE:TCS`
- Multiple symbols: `NSE:TCS,NSE:INFY,BSE:SBIN`

### MarketInOut Format
- NSE stocks: `TCS.NS`
- BSE stocks: `TCS.BO` or `TCS.BS`
- Multiple symbols: `TCS.NS, INFY.NS, SBIN.BO`

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18+ recommended)
- [pnpm](https://pnpm.io/) (install with `npm install -g pnpm`)

### Installation

```sh
pnpm install
```

### Configuration

Copy `.env.example` to `.env` and configure:
- TradingView session credentials
- MarketInOut credentials
- Cloudflare KV bindings (for production)

### Running the App

```sh
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Documentation

- [API Reference](./docs/API_REFERENCE.md) - External API integration guides
- [CVD Settings Guide](./docs/CVD_SETTINGS_GUIDE.md) - Comprehensive CVD configuration
- [CVD Quick Reference](./CVD_QUICK_REFERENCE.md) - CVD integration cheat sheet
- [Known Issues](./docs/KNOWN_ISSUES.md) - Current limitations and workarounds
- [Changelog](./CHANGELOG.md) - Project history and completed features

## Tech Stack

- [Next.js](https://nextjs.org/) 15+ - React framework
- [React](https://react.dev/) 19+ - UI library
- [ShadCN UI](https://ui.shadcn.com/) - Component library
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) - TradingView charting
- [SWR](https://swr.vercel.app/) - Data fetching
- [pnpm](https://pnpm.io/) - Package manager

## License

MIT
