/**
 * Chart Data Service Validators
 * 
 * Pure validation functions for chart data requests.
 * These functions have no external dependencies and can be easily unit tested.
 */

/**
 * Chart data request parameters
 */
export interface ChartDataRequestParams {
	symbol: string;
	resolution: string;
	barsCount: number;
}

/**
 * Validation result for chart data request
 */
export interface ValidationResult {
	valid: boolean;
	error?: string;
	params?: ChartDataRequestParams;
}

/**
 * User credentials
 */
export interface UserCredentials {
	userEmail: string;
	userPassword: string;
}

/**
 * Validation result for user credentials
 */
export interface CredentialsValidationResult {
	valid: boolean;
	error?: string;
	credentials?: UserCredentials;
}

/**
 * Validates chart data request parameters
 * 
 * @param symbol - Stock symbol (e.g., 'NSE:JUNIPER'), defaults to 'NSE:JUNIPER'
 * @param resolution - Time resolution (e.g., '1D', '1W'), defaults to '1D'
 * @param barsCountParam - Number of bars to fetch as string
 * @returns Validation result with parsed parameters or error
 */
export function validateChartDataRequest(
	symbol: string | null,
	resolution: string | null,
	barsCountParam: string | null
): ValidationResult {
	// Apply defaults
	const finalSymbol = symbol || 'NSE:JUNIPER';
	const finalResolution = resolution || '1D';
	const finalBarsCount = barsCountParam ? parseInt(barsCountParam, 10) : 300;
	
	// Validate barsCount
	if (isNaN(finalBarsCount) || finalBarsCount <= 0 || finalBarsCount > 300) {
		return {
			valid: false,
			error: 'Invalid barsCount parameter. Must be between 1 and 300.'
		};
	}
	
	return {
		valid: true,
		params: {
			symbol: finalSymbol,
			resolution: finalResolution,
			barsCount: finalBarsCount
		}
	};
}

/**
 * Validates user credentials
 * 
 * @param userEmail - User email address
 * @param userPassword - User password
 * @returns Validation result with credentials or error
 */
export function validateUserCredentials(
	userEmail: unknown,
	userPassword: unknown
): CredentialsValidationResult {
	// Check for missing credentials
	if (!userEmail || !userPassword) {
		return {
			valid: false,
			error: 'Missing authentication credentials. Please log in first.'
		};
	}
	
	// Ensure credentials are strings
	if (typeof userEmail !== 'string' || typeof userPassword !== 'string') {
		return {
			valid: false,
			error: 'Invalid credential types. Email and password must be strings.'
		};
	}
	
	return {
		valid: true,
		credentials: {
			userEmail,
			userPassword
		}
	};
}
