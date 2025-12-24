/**
 * Setup Helpers
 * 
 * Common setup/teardown utilities for tests.
 */

import { readFileSync } from 'fs';
import { WebSocketConnection } from '../../../src/lib/tradingview/v2/WebSocketConnection.js';
import { TradingViewCVDProvider } from '../../../src/lib/tradingview/v2/providers/index.js';
import { SessionResolver } from '../../../src/lib/SessionResolver.js';
import { TestContext } from './types.js';
import { logInfo, logSuccess, logError } from './logging.js';

/**
 * Setup authentication (load credentials and get JWT token)
 */
export async function setupAuth(): Promise<{ jwtToken: string; credentials: any; session: any }> {
	try {
		// Load credentials from credentials.json
		const credentials = JSON.parse(readFileSync('credentials.json', 'utf-8'));
		logInfo(`Loaded app credentials: ${credentials.tradingview.username}`);
		
		// Get TradingView session from KV
		const session = await SessionResolver.getLatestSessionForUser('tradingview', {
			userEmail: credentials.tradingview.username,
			userPassword: credentials.tradingview.password
		});
		
		if (!session) {
			throw new Error('No TradingView session found in KV store');
		}
		
		if (!session.sessionData.jwtToken) {
			throw new Error('JWT token not found in session data');
		}
		
		const jwtToken = session.sessionData.jwtToken;
		logInfo('JWT token retrieved from KV');
		logSuccess('Authentication setup complete');
		
		return { jwtToken, credentials, session };
		
	} catch (error: any) {
		logError(`Auth setup failed: ${error.message}`);
		throw error;
	}
}

/**
 * Setup WebSocket connection
 */
export async function setupConnection(
	jwtToken: string, 
	options?: { sessionId?: string; sessionIdSign?: string; withCVD?: boolean }
): Promise<{ connection: WebSocketConnection; cvdProvider?: any }> {
	try {
		// Create CVD provider if requested
		let cvdProvider;
		if (options?.withCVD && options.sessionId) {
			cvdProvider = new TradingViewCVDProvider(options.sessionId, options.sessionIdSign);
			logInfo('Created TradingViewCVDProvider');
		}
		
		const connection = new WebSocketConnection(
			{
				jwtToken,
				connectionTimeout: 30000,
				dataTimeout: 15000,
				enableLogging: true
			},
			cvdProvider, // CVD provider as 2nd parameter
			undefined // wsFactory as 3rd parameter (uses default)
		);
		
		logInfo('Created WebSocketConnection instance');
		logInfo('Initializing connection...');
		
		await connection.initialize();
		
		if (!connection.isReady()) {
			throw new Error('Connection not ready after initialization');
		}
		
		logSuccess('Connection initialized and ready');
		
		return { connection, cvdProvider };
		
	} catch (error: any) {
		logError(`Connection setup failed: ${error.message}`);
		throw error;
	}
}

/**
 * Setup complete test context
 */
export async function setupTestContext(options?: { withCVD?: boolean }): Promise<TestContext> {
	const { jwtToken, credentials, session } = await setupAuth();
	
	// Extract sessionId and sessionIdSign from session data for CVD provider
	const sessionId = session.sessionData.sessionId;
	const sessionIdSign = session.sessionData.sessionIdSign;
	
	const { connection, cvdProvider } = await setupConnection(jwtToken, {
		sessionId,
		sessionIdSign,
		withCVD: options?.withCVD
	});
	
	return {
		jwtToken,
		credentials,
		session,
		connection,
		cvdProvider
	};
}

/**
 * Teardown test context (cleanup connection)
 */
export async function teardownTestContext(ctx: TestContext): Promise<void> {
	try {
		logInfo('Disposing connection...');
		ctx.connection.dispose();
		logSuccess('Cleanup complete');
		
	} catch (error: any) {
		logError(`Cleanup failed: ${error.message}`);
	}
}

/**
 * Delay utility
 */
export function delay(ms: number): Promise<void> {
	return new Promise(resolve => setTimeout(resolve, ms));
}
