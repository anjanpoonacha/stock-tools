/**
 * Chart Data Service Layer
 * 
 * Public API for chart data service.
 */

export {
	getChartData,
	resolveUserSession,
	fetchJWTToken,
	fetchHistoricalData,
	createChartDataServiceConfig,
	type ChartDataServiceConfig
} from './chartDataService';

export {
	validateChartDataRequest,
	validateUserCredentials,
	type ChartDataRequestParams,
	type ValidationResult,
	type UserCredentials,
	type CredentialsValidationResult
} from './validators';

export type {
	SessionResolutionResult,
	JWTTokenResult,
	HistoricalDataResult,
	ChartDataServiceResult
} from './types';
