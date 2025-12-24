/**
 * Providers Module
 * 
 * External service providers for v2 WebSocketConnection.
 * Following dependency injection pattern.
 */

export type { CVDConfigProvider, CVDConfig } from './CVDConfigProvider.js';
export { TradingViewCVDProvider, MockCVDProvider } from './CVDConfigProvider.js';
