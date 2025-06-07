# Stock Format Converter

A mobile-first React application (built with Next.js and ShadCN UI) for converting lists of stock symbols between MarketInOut and TradingView formats.

## Features

- **Mobile-first UI**: Responsive and touch-friendly for mobile devices.
- **Large Code Editor Area**: Paste or type lists in any format, styled like a code editor.
- **Delimiter Options**: Choose or input your preferred delimiter (comma, space, newline, etc.).
- **Prefix Options**: Choose or input the prefix (e.g., `NSE:` for TradingView, none for MarketInOut).
- **Bidirectional Conversion**: Convert from MarketInOut to TradingView and vice versa.
- **Modern UI**: All controls use ShadCN UI components for a clean, accessible experience.

## Example User Flow

1. Paste a list like `TCS.NS, INFY.NS` into the input area.
2. Select delimiter (comma) and prefix (`NSE:`).
3. Click "Convert to TradingView".
4. Output area shows: `NSE:TCS, NSE:INFY`.
5. Switch direction, paste `NSE:TCS, NSE:INFY`, and convert back to `TCS.NS, INFY.NS`.

## Format Reference

### TradingView Format

- NSE stocks: `NSE:TCS`
- BSE stocks: `BSE:TCS`
- Multiple symbols: `NSE:TCS,NSE:INFY,BSE:SBIN`
- **Sectioned/Grouped format:**
  - Each group/sector starts with `###<GroupName>,` followed by the symbols in that group, separated by commas.
  - Example: `###Financial Services,NSE:AAVAS,NSE:ABCAPITAL,###Technology,NSE:INFY,NSE:TCS`

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

### Running the App

```sh
pnpm dev
```

The app will be available at [http://localhost:3000](http://localhost:3000).

## Project Structure

- `/app` or `/pages`: Next.js routing
- `/components`: Reusable UI elements
- Main UI: `StockFormatConverter.tsx`

## Tech Stack

- [Next.js](https://nextjs.org/)
- [React](https://react.dev/)
- [ShadCN UI](https://ui.shadcn.com/)
- [pnpm](https://pnpm.io/)

## License

MIT
