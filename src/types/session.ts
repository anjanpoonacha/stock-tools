/**
 * Session Types
 * 
 * Shared type definitions for session-related functionality
 */

export interface SessionStats {
	hasSession: boolean;
	sessionAvailable: boolean;
	availableUsers: string[];
	currentUser?: string;
	platforms?: {
		marketinout?: { hasSession: boolean; sessionAvailable: boolean };
		tradingview?: { hasSession: boolean; sessionAvailable: boolean };
	};
	message: string;
}

export interface AuthCredentials {
	userEmail: string;
	userPassword: string;
}

export interface AuthOperationResult {
	userEmail: string;
	userPassword: string;
	sessionStats: SessionStats;
}
