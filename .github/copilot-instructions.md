# Copilot Instructions for Stock Format Converter (React/Next.js with ShadCN UI)

## Project Overview

This project is a mobile-first React application (using Next.js and ShadCN UI) that converts lists of stock symbols between MarketInOut and TradingView formats. It features a large, code-editor-like input area, delimiter and prefix options, and supports both conversion directions.

## Key Features

- **Mobile-first UI**: Prioritize responsive design for mobile devices.
- **Large Input Area**: Main area should resemble a code editor, allowing users to paste or type lists in any format.
- **Delimiter Options**: Users can select or input their preferred delimiter (comma, space, newline, etc.).
- **Prefix Options**: Users can choose or input the prefix (e.g., `NSE:` for TradingView, none for MarketInOut).
- **Bidirectional Conversion**: Support conversion from MarketInOut to TradingView and vice versa.
- **ShadCN UI**: Use ShadCN UI components for all UI elements.
- **Next.js**: Use Next.js for project structure and routing.
- **Use pnpm**: Use `pnpm` as the package manager for all dependency management, installation, and scripts. All setup and install instructions should use `pnpm` instead of npm or yarn.

## UI/UX Guidelines

- The main input area should be prominent and styled like a code editor (use ShadCN's textarea or similar component, with monospace font and large size).
- Place delimiter and prefix options below or above the input area, using dropdowns or input fields.
- Provide clear buttons for conversion direction (MarketInOut → TradingView, TradingView → MarketInOut).
- Show the converted result in a similar code-editor-like area below the input.
- Ensure all controls are easily accessible and usable on mobile devices.

## Implementation Hints

- Use React state to manage input, output, delimiter, prefix, and conversion direction.
- Parse the input using the selected delimiter, trim and clean symbols, and apply/remove prefixes as needed.
- Use ShadCN UI components for all controls (dropdowns, buttons, textareas, etc.).
- Ensure accessibility and good touch targets for mobile users.

## Example User Flow

1. User pastes a list like `TCS.NS, INFY.NS` into the input area.
2. User selects delimiter (comma) and prefix (`NSE:`).
3. User clicks "Convert to TradingView".
4. Output area shows: `NSE:TCS, NSE:INFY`.
5. User can switch direction, paste `NSE:TCS, NSE:INFY`, and convert back to `TCS.NS, INFY.NS`.

## File/Folder Suggestions

- Use `/app` or `/pages` for Next.js routing.
- Place main UI in a single page/component (e.g., `StockFormatConverter.tsx`).
- Use a `components/` folder for reusable UI elements if needed.

---

**Copilot: Follow these instructions to scaffold, implement, and style the application as described above. Prioritize mobile usability and clean, modern UI using ShadCN components. Use pnpm for all package management and scripts.**

Use the ShadCN cli command

```sh
npx shadcn@latest add <component-name>
```
