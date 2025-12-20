/**
 * Platform-specific session validation functions.
 * Contains validation logic for MarketInOut and TradingView platforms.
 */
import { MIOService } from '../mio';
import { getSession } from '../sessionStore';
import {
	SessionError,
	ErrorHandler,
	Platform,
	ErrorLogger
} from '../errors';

// Helper function to validate session ID parameter
export function validateSessionId(sessionId: string, functionName: string, platform: Platform = Platform.UNKNOWN): void {
	if (!sessionId) {
		const error = ErrorHandler.createGenericError(
			platform,
			functionName,
			'Missing required parameter: internalSessionId'
		);
		ErrorLogger.logError(error);
		throw error;
	}
}

// Helper function to cleanup invalid session
export async function cleanupInvalidSession(sessionId: string, platform?: string): Promise<void> {
	const { deleteSession } = await import('../sessionStore');
	deleteSession(sessionId);

	if (platform) {
		const { sessionHealthMonitor } = await import('../health');
		sessionHealthMonitor.stopMonitoring(sessionId, platform);
	}
}

// Helper function to handle validation errors consistently
export function handleValidationError(
	error: unknown,
	sessionId: string,
	platform: Platform,
	functionName: string
): SessionError {
	if (error instanceof SessionError) {
		return error;
	}

	return ErrorHandler.parseError(
		error,
		platform,
		functionName,
		undefined,
		undefined
	);
}

/**
 * Validate a MarketInOut session by attempting to fetch the watchlist.
 * If invalid, deletes the session and returns false.
 * Returns the watchlists array if valid, or throws SessionError if invalid.
 * Now integrates with proactive health monitoring and enhanced error handling.
 */
export async function validateAndCleanupMarketinoutSession(
	internalSessionId: string
): Promise<{ id: string; name: string }[]> {
	try {
		validateSessionId(internalSessionId, 'validateAndCleanupMarketinoutSession', Platform.MARKETINOUT);

		const result = await MIOService.getWatchlistsWithSession(internalSessionId);
		
		// Check if MIO operation failed
		if (!result.success) {
			await cleanupInvalidSession(internalSessionId, 'marketinout');

			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		const watchlists = result.data || [];
		if (watchlists.length === 0) {
			await cleanupInvalidSession(internalSessionId, 'marketinout');

			const error = ErrorHandler.createSessionExpiredError(
				Platform.MARKETINOUT,
				'validateAndCleanupMarketinoutSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		const { sessionHealthMonitor } = await import('../health');
		sessionHealthMonitor.startMonitoring(internalSessionId, 'marketinout');
		return watchlists;
	} catch (err: unknown) {

		// Always cleanup on any error
		await cleanupInvalidSession(internalSessionId, 'marketinout');

		// Handle and re-throw the error
		const sessionError = handleValidationError(err, internalSessionId, Platform.MARKETINOUT, 'validateAndCleanupMarketinoutSession');
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Validate TradingView session using the custom watchlists API endpoint.
 * Uses the new validateTradingViewSession function from tradingview.ts.
 */
export async function validateTradingViewSession(internalSessionId: string): Promise<boolean> {
	try {
		validateSessionId(internalSessionId, 'validateTradingViewSession', Platform.TRADINGVIEW);

		const session = await getSession(internalSessionId);
		if (!session?.tradingview?.sessionId) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.TRADINGVIEW,
				'validateTradingViewSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		const { validateTradingViewSession: validateTVSession } = await import('../tradingview');
		const cookie = `sessionid=${session.tradingview.sessionId}`;

		const validationResult = await validateTVSession(cookie);

		if (!validationResult.isValid) {
			await cleanupInvalidSession(internalSessionId, 'tradingview');

			const error = ErrorHandler.createSessionExpiredError(
				Platform.TRADINGVIEW,
				'validateTradingViewSession',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}


		const { sessionHealthMonitor } = await import('../health');
		sessionHealthMonitor.startMonitoring(internalSessionId, 'tradingview');
		return true;
	} catch (error) {
		await cleanupInvalidSession(internalSessionId, 'tradingview');

		const sessionError = handleValidationError(error, internalSessionId, Platform.TRADINGVIEW, 'validateTradingViewSession');
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Validate all platforms for a session and start monitoring for valid ones.
 * This is useful when a session is first established or when doing comprehensive validation.
 * Enhanced with detailed error categorization and recovery information.
 */
export async function validateAndMonitorAllPlatforms(internalSessionId: string): Promise<{
	validPlatforms: string[];
	invalidPlatforms: string[];
	errors: { [platform: string]: SessionError };
	summary: {
		totalPlatforms: number;
		validCount: number;
		invalidCount: number;
		canAutoRecover: boolean;
		recoveryActions: string[];
	};
}> {
	try {
		validateSessionId(internalSessionId, 'validateAndMonitorAllPlatforms');

		const session = await getSession(internalSessionId);
		if (!session) {
			const error = ErrorHandler.createSessionExpiredError(
				Platform.UNKNOWN,
				'validateAndMonitorAllPlatforms',
				internalSessionId
			);
			ErrorLogger.logError(error);
			throw error;
		}

		const results = {
			validPlatforms: [] as string[],
			invalidPlatforms: [] as string[],
			errors: {} as { [platform: string]: SessionError },
			summary: {
				totalPlatforms: 0,
				validCount: 0,
				invalidCount: 0,
				canAutoRecover: false,
				recoveryActions: [] as string[]
			}
		};

		const platforms = Object.keys(session);
		results.summary.totalPlatforms = platforms.length;

		const { sessionHealthMonitor } = await import('../health');

		for (const platform of platforms) {
			try {
				let isValid = false;

				switch (platform) {
					case 'marketinout':
						// Use existing MIO validation
						await validateAndCleanupMarketinoutSession(internalSessionId);
						isValid = true;
						break;

					case 'tradingview':
						// Use TradingView validation
						isValid = await validateTradingViewSession(internalSessionId);
						break;

					default:
						isValid = false;
						const unknownPlatformError = ErrorHandler.createGenericError(
							Platform.UNKNOWN,
							'validateAndMonitorAllPlatforms',
							`Unknown platform: ${platform}`
						);
						results.errors[platform] = unknownPlatformError;
						ErrorLogger.logError(unknownPlatformError);
				}

				if (isValid) {
					results.validPlatforms.push(platform);
					results.summary.validCount++;
					// Start monitoring for valid platform
					sessionHealthMonitor.startMonitoring(internalSessionId, platform);
				} else {
					results.invalidPlatforms.push(platform);
					results.summary.invalidCount++;
				}

			} catch (error) {

				results.invalidPlatforms.push(platform);
				results.summary.invalidCount++;

				// Handle SessionError instances
				if (error instanceof SessionError) {
					results.errors[platform] = error;

					// Check if this error can be auto-recovered
					if (error.canAutoRecover()) {
						results.summary.canAutoRecover = true;
						results.summary.recoveryActions.push(...error.getRecoveryInstructions());
					}
				} else {
					// Parse and categorize unknown errors
					const platformEnum = platform === 'marketinout' ? Platform.MARKETINOUT :
						platform === 'tradingview' ? Platform.TRADINGVIEW :
							Platform.UNKNOWN;

					const sessionError = ErrorHandler.parseError(
						error,
						platformEnum,
						'validateAndMonitorAllPlatforms',
						undefined,
						undefined
					);
					results.errors[platform] = sessionError;
					ErrorLogger.logError(sessionError);

					if (sessionError.canAutoRecover()) {
						results.summary.canAutoRecover = true;
						results.summary.recoveryActions.push(...sessionError.getRecoveryInstructions());
					}
				}

				// Stop monitoring for invalid platform
				sessionHealthMonitor.stopMonitoring(internalSessionId, platform);
			}
		}

		// Remove duplicate recovery actions
		results.summary.recoveryActions = [...new Set(results.summary.recoveryActions)];


		return results;
	} catch (error) {
		// If it's already a SessionError, re-throw it
		if (error instanceof SessionError) {
			throw error;
		}

		// Parse and wrap the error
		const sessionError = ErrorHandler.parseError(
			error,
			Platform.UNKNOWN,
			'validateAndMonitorAllPlatforms',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);
		throw sessionError;
	}
}

/**
 * Validate session and start health monitoring automatically.
 * This is the new unified validation function that combines validation with health monitoring.
 */
export async function validateAndStartMonitoring(
	internalSessionId: string,
	platform: string
): Promise<{
	isValid: boolean;
	healthStatus?: string;
	watchlists?: { id: string; name: string }[];
	error?: SessionError;
	monitoringStarted: boolean;
}> {
	try {
		// Validate input parameters
		if (!internalSessionId || !platform) {
			const error = ErrorHandler.createGenericError(
				Platform.UNKNOWN,
				'validateAndStartMonitoring',
				`Missing required parameters: internalSessionId=${!!internalSessionId}, platform=${platform}`
			);
			ErrorLogger.logError(error);
			return { isValid: false, error, monitoringStarted: false };
		}


		let isValid = false;
		let watchlists: { id: string; name: string }[] | undefined;
		let validationError: SessionError | undefined;

		// Perform platform-specific validation
		switch (platform) {
			case 'marketinout':
				try {
					watchlists = await validateAndCleanupMarketinoutSession(internalSessionId);
					isValid = true;
				} catch (error) {
					if (error instanceof SessionError) {
						validationError = error;
					} else {
						validationError = ErrorHandler.parseError(
							error,
							Platform.MARKETINOUT,
							'validateAndStartMonitoring',
							undefined,
							undefined
						);
					}
					isValid = false;
				}
				break;

			case 'tradingview':
				try {
					isValid = await validateTradingViewSession(internalSessionId);
				} catch (error) {
					if (error instanceof SessionError) {
						validationError = error;
					} else {
						validationError = ErrorHandler.parseError(
							error,
							Platform.TRADINGVIEW,
							'validateAndStartMonitoring',
							undefined,
							undefined
						);
					}
					isValid = false;
				}
				break;

			default:
				validationError = ErrorHandler.createGenericError(
					Platform.UNKNOWN,
					'validateAndStartMonitoring',
					`Unknown platform: ${platform}`
				);
				isValid = false;
		}

		let monitoringStarted = false;
		let healthStatus: string | undefined;

		const { sessionHealthMonitor } = await import('../health');

		if (isValid) {
			// Start health monitoring for valid session
			sessionHealthMonitor.startMonitoring(internalSessionId, platform);
			monitoringStarted = true;

			// Get initial health status
			healthStatus = await sessionHealthMonitor.checkSessionHealth(internalSessionId, platform);

		} else {
			// Stop any existing monitoring for invalid session
			sessionHealthMonitor.stopMonitoring(internalSessionId, platform);
			monitoringStarted = false;

			if (validationError) {
				ErrorLogger.logError(validationError);
			}

		}

		return {
			isValid,
			healthStatus,
			watchlists,
			error: validationError,
			monitoringStarted
		};

	} catch (error) {
		// Handle unexpected errors
		const sessionError = ErrorHandler.parseError(
			error,
			platform === 'marketinout' ? Platform.MARKETINOUT :
				platform === 'tradingview' ? Platform.TRADINGVIEW : Platform.UNKNOWN,
			'validateAndStartMonitoring',
			undefined,
			undefined
		);
		ErrorLogger.logError(sessionError);

		// Ensure monitoring is stopped on error
		const { sessionHealthMonitor } = await import('../health');
		sessionHealthMonitor.stopMonitoring(internalSessionId, platform);

		return {
			isValid: false,
			error: sessionError,
			monitoringStarted: false
		};
	}
}
