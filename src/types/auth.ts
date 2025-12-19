import { z } from 'zod';

// User Credentials Schema
export const UserCredentialsSchema = z.object({
	userEmail: z.string().min(1, 'Username is required'),
	userPassword: z.string().min(1, 'Password is required')
});

export type UserCredentials = z.infer<typeof UserCredentialsSchema>;

// Session Statistics Schema (separate from authentication)
export const SessionStatsSchema = z.object({
	platforms: z.object({
		marketinout: z.object({
			hasSession: z.boolean().optional(),
			sessionAvailable: z.boolean(),
			currentSessionId: z.string().nullable()
		}).optional(),
		tradingview: z.object({
			hasSession: z.boolean().optional(),
			sessionAvailable: z.boolean(),
			currentSessionId: z.string().nullable(),
			sessionId: z.string().nullable()
		}).optional()
	}).optional(),
	message: z.string(),
	availableUsers: z.array(z.string()).optional(),
	currentUser: z.string().optional(),
	// New fields for connection status
	offline: z.boolean().optional(),
	error: z.string().optional(),
	lastChecked: z.date().optional()
});

export type SessionStats = z.infer<typeof SessionStatsSchema>;

// Authentication Status Schema (simplified - no longer clears on session errors)
export const AuthStatusSchema = z.object({
	isAuthenticated: z.boolean(),
	userEmail: z.string().optional(),
	sessionStats: SessionStatsSchema.nullable().optional()
});

export type AuthStatus = z.infer<typeof AuthStatusSchema>;

// Watchlist Schemas
export const WatchlistItemSchema = z.object({
	id: z.union([z.string(), z.number()]),
	name: z.string(),
	symbols: z.array(z.string()),
	createdAt: z.string().optional(),
	updatedAt: z.string().optional(),
	owner: z.string().optional()
});

export type WatchlistItem = z.infer<typeof WatchlistItemSchema>;

// Platform-specific watchlist responses
export const MIOWatchlistResponseSchema = z.object({
	success: z.boolean(),
	message: z.string(),
	userEmail: z.string(),
	sessionId: z.string().optional(),
	watchlists: z.array(WatchlistItemSchema).optional(),
	totalWatchlists: z.number().optional(),
	error: z.string().optional()
});

export type MIOWatchlistResponse = z.infer<typeof MIOWatchlistResponseSchema>;

export const TVWatchlistResponseSchema = z.object({
	watchlists: z.array(WatchlistItemSchema).optional(),
	healthStatus: z.string().optional(),
	monitoringActive: z.boolean().optional(),
	error: z.string().optional()
});

export type TVWatchlistResponse = z.infer<typeof TVWatchlistResponseSchema>;

// Unified Watchlist Response Schema
export const UnifiedWatchlistResponseSchema = z.object({
	success: z.boolean(),
	userEmail: z.string(),
	platforms: z.object({
		mio: z.object({
			available: z.boolean(),
			watchlists: z.array(WatchlistItemSchema).optional(),
			error: z.string().optional()
		}),
		tradingview: z.object({
			available: z.boolean(),
			watchlists: z.array(WatchlistItemSchema).optional(),
			error: z.string().optional()
		})
	}),
	message: z.string(),
	totalWatchlists: z.number()
});

export type UnifiedWatchlistResponse = z.infer<typeof UnifiedWatchlistResponseSchema>;

// API Request/Response Schemas
export const AuthCheckRequestSchema = z.object({
	userEmail: z.string().email(),
	userPassword: z.string().min(1)
});

export type AuthCheckRequest = z.infer<typeof AuthCheckRequestSchema>;

export const AuthCheckResponseSchema = z.object({
	isAuthenticated: z.boolean(),
	userEmail: z.string(),
	sessionStats: z.object({
		platforms: z.object({
			marketinout: z.object({
				hasSession: z.boolean().optional(),
				sessionAvailable: z.boolean(),
				currentSessionId: z.string().nullable()
			}),
			tradingview: z.object({
				hasSession: z.boolean().optional(),
				sessionAvailable: z.boolean(),
				currentSessionId: z.string().nullable(),
				sessionId: z.string().nullable()
			})
		}),
		message: z.string(),
		availableUsers: z.array(z.string()).optional(),
		currentUser: z.string()
	}),
	message: z.string(),
	error: z.string().optional()
});

export type AuthCheckResponse = z.infer<typeof AuthCheckResponseSchema>;
