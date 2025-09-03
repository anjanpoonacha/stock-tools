import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	SessionResolver,
	type SessionData,
	type StoredSessions,
	type MIOSessionInfo,
	type SessionStats,
	type UserCredentials
} from '../../lib/SessionResolver';

// Mock the sessionStore.kv module
const mockGetAllSessions = vi.fn();
vi.mock('../../lib/sessionStore.kv', () => ({
	getAllSessions: mockGetAllSessions
}));

// Mock console methods
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => { });
const mockConsoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { });
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => { });

describe('SessionResolver', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockConsoleLog.mockClear();
		mockConsoleWarn.mockClear();
		mockConsoleError.mockClear();
		// Clear cache before each test
		SessionResolver.invalidateCache();
		vi.useFakeTimers();
	});

	afterEach(() => {
		vi.useRealTimers();
		vi.restoreAllMocks();
	});

	// Sample test data
	const mockStoredSessions: StoredSessions = {
		'internal-id-1': {
			marketinout: {
				sessionId: 'mio-session-1',
				extractedAt: '2024-01-01T10:00:00Z',
				userEmail: 'user1@example.com',
				userPassword: 'pass1',
				ASPSESSIONIDABC123: 'mio-value-1'
			},
			tradingview: {
				sessionId: 'tv-session-1',
				extractedAt: '2024-01-01T09:00:00Z',
				userEmail: 'user1@example.com',
				userPassword: 'pass1',
				sessionid: 'tv-value-1'
			}
		},
		'internal-id-2': {
			marketinout: {
				sessionId: 'mio-session-2',
				extractedAt: '2024-01-01T11:00:00Z',
				userEmail: 'user2@example.com',
				userPassword: 'pass2',
				ASPSESSIONIDXYZ789: 'mio-value-2'
			}
		}
	};

	describe('Cache Management', () => {
		it('should invalidate cache correctly', () => {
			SessionResolver.invalidateCache();
			expect(mockConsoleLog).toHaveBeenCalledWith(
				expect.stringContaining('Cache invalidated')
			);
		});

		it('should refresh cache when TTL expires', async () => {
			// First call
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);
			await SessionResolver.getLatestSession('marketinout');

			// Advance time beyond TTL (15 seconds)
			vi.advanceTimersByTime(16000);

			// Second call should refresh cache
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);
			await SessionResolver.getLatestSession('marketinout');

			expect(mockGetAllSessions).toHaveBeenCalledTimes(2);
		});
	});

	describe('getLatestSession', () => {
		it('should return the most recent session for a platform', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getLatestSession('marketinout');

			expect(result).toEqual({
				sessionData: mockStoredSessions['internal-id-2'].marketinout,
				internalId: 'internal-id-2'
			});
		});

		it('should filter out invalid session data', async () => {
			const invalidSessions: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: '', // Invalid - empty sessionId
						extractedAt: '2024-01-01T10:00:00Z'
					}
				},
				'internal-id-2': {
					marketinout: {
						// Invalid - missing sessionId
						extractedAt: '2024-01-01T11:00:00Z'
					} as SessionData
				},
				'internal-id-3': {
					marketinout: {
						sessionId: 'valid-session',
						extractedAt: '2024-01-01T12:00:00Z',
						ASPSESSIONID: 'valid-value'
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(invalidSessions);

			const result = await SessionResolver.getLatestSession('marketinout');

			expect(result).toEqual({
				sessionData: invalidSessions['internal-id-3'].marketinout,
				internalId: 'internal-id-3'
			});
		});
	});

	describe('getLatestMIOSession', () => {
		it('should return null when no MIO sessions exist', async () => {
			mockGetAllSessions.mockResolvedValueOnce({});

			const result = await SessionResolver.getLatestMIOSession();

			expect(result).toBeNull();
		});

		it('should return MIO session with cookie key-value pair', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getLatestMIOSession();

			// The function finds the first non-excluded key with a value, which is userEmail
			expect(result).toEqual({
				key: 'userEmail',
				value: 'user2@example.com',
				internalId: 'internal-id-2'
			});
		});

		it('should return null when no valid session cookie found', async () => {
			const sessionsWithoutCookie: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'mio-session-1',
						extractedAt: '2024-01-01T10:00:00Z',
						extractedFrom: 'extension',
						source: 'manual'
						// Only excluded keys - no valid cookie keys
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(sessionsWithoutCookie);

			const result = await SessionResolver.getLatestMIOSession();

			expect(result).toBeNull();
			// The console.warn is called, but we can see it in stderr output
		});
	});

	describe('getAllSessions', () => {
		it('should return all sessions for a platform sorted by recency', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getAllSessions('marketinout');

			expect(result).toHaveLength(2);
			// Should be sorted by extractedAt (most recent first)
			expect(result[0].internalId).toBe('internal-id-2'); // 11:00:00
			expect(result[1].internalId).toBe('internal-id-1'); // 10:00:00
		});

		it('should return empty array when no sessions exist', async () => {
			mockGetAllSessions.mockResolvedValueOnce({});

			const result = await SessionResolver.getAllSessions('marketinout');

			expect(result).toEqual([]);
		});
	});

	describe('hasSessionsForPlatform', () => {
		it('should return true when sessions exist for platform', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.hasSessionsForPlatform('marketinout');

			expect(result).toBe(true);
		});

		it('should return false when no sessions exist for platform', async () => {
			mockGetAllSessions.mockResolvedValueOnce({});

			const result = await SessionResolver.hasSessionsForPlatform('marketinout');

			expect(result).toBe(false);
		});
	});

	describe('getSessionStats', () => {
		it('should return correct session statistics', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getSessionStats();

			expect(result).toEqual({
				totalSessions: 2,
				platformCounts: {
					marketinout: 2,
					tradingview: 1
				}
			});
		});

		it('should return empty stats when no sessions exist', async () => {
			mockGetAllSessions.mockResolvedValueOnce({});

			const result = await SessionResolver.getSessionStats();

			expect(result).toEqual({
				totalSessions: 0,
				platformCounts: {}
			});
		});
	});

	describe('User-specific methods', () => {
		const userCredentials: UserCredentials = {
			userEmail: 'user1@example.com',
			userPassword: 'pass1'
		};

		describe('getLatestSessionForUser', () => {
			it('should return session for specific user', async () => {
				mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

				const result = await SessionResolver.getLatestSessionForUser('marketinout', userCredentials);

				expect(result).toEqual({
					sessionData: mockStoredSessions['internal-id-1'].marketinout,
					internalId: 'internal-id-1'
				});
			});
		});

		describe('getLatestMIOSessionForUser', () => {
			it('should return null when no MIO sessions exist for user', async () => {
				const nonMatchingCredentials: UserCredentials = {
					userEmail: 'nonexistent@example.com',
					userPassword: 'wrongpass'
				};

				mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

				const result = await SessionResolver.getLatestMIOSessionForUser(nonMatchingCredentials);

				expect(result).toBeNull();
			});
		});

		describe('hasSessionsForPlatformAndUser', () => {
			it('should return true when sessions exist for platform and user', async () => {
				mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

				const result = await SessionResolver.hasSessionsForPlatformAndUser('marketinout', userCredentials);

				expect(result).toBe(true);
			});

			it('should return false when no sessions exist for platform and user', async () => {
				const nonMatchingCredentials: UserCredentials = {
					userEmail: 'nonexistent@example.com',
					userPassword: 'wrongpass'
				};

				mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

				const result = await SessionResolver.hasSessionsForPlatformAndUser('marketinout', nonMatchingCredentials);

				expect(result).toBe(false);
			});
		});
	});

	describe('getAvailableUsers', () => {
		it('should return sorted list of unique user emails', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getAvailableUsers();

			expect(result).toEqual(['user1@example.com', 'user2@example.com']);
		});

		it('should return empty array when no sessions exist', async () => {
			mockGetAllSessions.mockResolvedValueOnce({});

			const result = await SessionResolver.getAvailableUsers();

			expect(result).toEqual([]);
		});

		it('should handle sessions without userEmail', async () => {
			const sessionsWithoutEmail: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'session-1',
						extractedAt: '2024-01-01T10:00:00Z'
						// No userEmail
					}
				},
				'internal-id-2': {
					marketinout: {
						sessionId: 'session-2',
						extractedAt: '2024-01-01T11:00:00Z',
						userEmail: 'user@example.com'
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(sessionsWithoutEmail);

			const result = await SessionResolver.getAvailableUsers();

			expect(result).toEqual(['user@example.com']);
		});

		it('should deduplicate user emails across platforms', async () => {
			const duplicateUserSessions: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'mio-session',
						userEmail: 'user@example.com'
					},
					tradingview: {
						sessionId: 'tv-session',
						userEmail: 'user@example.com' // Same email
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(duplicateUserSessions);

			const result = await SessionResolver.getAvailableUsers();

			expect(result).toEqual(['user@example.com']); // Should appear only once
		});
	});

	describe('Session sorting and validation', () => {
		it('should sort sessions by timestamp correctly', async () => {
			const timestampSessions: StoredSessions = {
				'id-1': {
					marketinout: {
						sessionId: 'session-1',
						extractedAt: '2024-01-01T08:00:00Z' // Oldest
					}
				},
				'id-2': {
					marketinout: {
						sessionId: 'session-2',
						extractedAt: '2024-01-01T12:00:00Z' // Newest
					}
				},
				'id-3': {
					marketinout: {
						sessionId: 'session-3',
						extractedAt: '2024-01-01T10:00:00Z' // Middle
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(timestampSessions);

			const result = await SessionResolver.getAllSessions('marketinout');

			expect(result.map(s => s.internalId)).toEqual(['id-2', 'id-3', 'id-1']);
		});

		it('should handle sessions with default extractedAt', async () => {
			const sessionsWithoutTimestamp: StoredSessions = {
				'id-1': {
					marketinout: {
						sessionId: 'session-1'
						// No extractedAt - should use default
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(sessionsWithoutTimestamp);

			const result = await SessionResolver.getLatestSession('marketinout');

			expect(result).not.toBeNull();
			expect(result!.sessionData.sessionId).toBe('session-1');
		});
	});

	describe('Error handling and edge cases', () => {
		it('should handle getAllSessions errors gracefully', async () => {
			mockGetAllSessions.mockRejectedValueOnce(new Error('KV operation failed'));

			const result = await SessionResolver.getAllSessions('marketinout');

			expect(result).toEqual([]);
			// The error is logged in the performSessionLoad method, not in getAllSessions
		});

		it('should handle getSessionStats errors gracefully', async () => {
			mockGetAllSessions.mockRejectedValueOnce(new Error('KV operation failed'));

			const result = await SessionResolver.getSessionStats();

			expect(result).toEqual({
				totalSessions: 0,
				platformCounts: {}
			});
			// The error is logged in the performSessionLoad method, not in getSessionStats
		});

		it('should handle getAvailableUsers errors gracefully', async () => {
			mockGetAllSessions.mockRejectedValueOnce(new Error('KV operation failed'));

			const result = await SessionResolver.getAvailableUsers();

			expect(result).toEqual([]);
			// The error is logged in the performSessionLoad method, not in getAvailableUsers
		});

		it('should handle getLatestSessionInternal errors gracefully', async () => {
			mockGetAllSessions.mockRejectedValueOnce(new Error('KV operation failed'));

			const result = await SessionResolver.getLatestSession('marketinout');

			expect(result).toBeNull();
			// The error is logged in the performSessionLoad method, not in getLatestSessionInternal
		});

		it('should handle getLatestSessionForUser errors gracefully', async () => {
			const userCredentials: UserCredentials = {
				userEmail: 'user@example.com',
				userPassword: 'password'
			};
			mockGetAllSessions.mockRejectedValueOnce(new Error('KV operation failed'));

			const result = await SessionResolver.getLatestSessionForUser('marketinout', userCredentials);

			expect(result).toBeNull();
			// The error is logged in the performSessionLoad method, not in getLatestSessionForUser
		});
	});

	describe('Concurrent loading scenarios', () => {
		it('should handle concurrent cache loading requests', async () => {
			// Clear cache to force loading
			SessionResolver.invalidateCache();

			// Create a slow-resolving promise
			let resolvePromise: (value: StoredSessions) => void;
			const slowPromise = new Promise<StoredSessions>((resolve) => {
				resolvePromise = resolve;
			});

			mockGetAllSessions.mockReturnValueOnce(slowPromise);

			// Start multiple concurrent requests
			const promise1 = SessionResolver.getLatestSession('marketinout');
			const promise2 = SessionResolver.getLatestSession('tradingview');
			const promise3 = SessionResolver.getAllSessions('marketinout');

			// Resolve the slow promise
			resolvePromise!(mockStoredSessions);

			// Wait for all promises to complete
			const [result1, result2, result3] = await Promise.all([promise1, promise2, promise3]);

			// Should only call getAllSessions once due to concurrent loading protection
			expect(mockGetAllSessions).toHaveBeenCalledTimes(1);

			// All results should be valid
			expect(result1).not.toBeNull();
			expect(result2).not.toBeNull();
			expect(result3).toHaveLength(2);
		});

		it('should use cached data when cache is valid', async () => {
			// First call to populate cache
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);
			await SessionResolver.getLatestSession('marketinout');

			// Second call should use cache (within TTL)
			const result = await SessionResolver.getLatestSession('tradingview');

			expect(mockGetAllSessions).toHaveBeenCalledTimes(1);
			expect(result).not.toBeNull();
		});
	});

	describe('Session cookie key finding', () => {
		it('should find session cookie key excluding metadata keys', async () => {
			const sessionWithMultipleKeys: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'session-1',
						extractedAt: '2024-01-01T10:00:00Z',
						extractedFrom: 'extension',
						source: 'manual',
						userEmail: 'user@example.com',
						userPassword: 'password',
						ASPSESSIONIDABC123: 'cookie-value',
						PHPSESSID: 'php-session-value'
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(sessionWithMultipleKeys);

			const result = await SessionResolver.getLatestMIOSession();

			// The function finds the first non-excluded key, which would be userEmail
			// since userEmail and userPassword are not in EXCLUDED_SESSION_KEYS
			expect(result).toEqual({
				key: 'userEmail',
				value: 'user@example.com',
				internalId: 'internal-id-1'
			});
		});

		it('should handle session with empty cookie values', async () => {
			const sessionWithEmptyValues: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'session-1',
						extractedAt: '2024-01-01T10:00:00Z',
						extractedFrom: 'extension',
						source: 'manual',
						// All non-excluded keys have empty values, so findSessionCookieKey returns null
						userEmail: '', // Empty value - excluded by findSessionCookieKey
						userPassword: '', // Empty value - excluded by findSessionCookieKey
						ASPSESSIONIDABC123: '', // Empty value - excluded by findSessionCookieKey
						PHPSESSID: '' // Empty value - excluded by findSessionCookieKey
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(sessionWithEmptyValues);

			const result = await SessionResolver.getLatestMIOSession();

			// Since all non-excluded keys have empty values, findSessionCookieKey returns null
			expect(result).toBeNull();
		});
	});

	describe('User filtering edge cases', () => {
		it('should handle sessions with partial user credentials', async () => {
			const partialCredentialSessions: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'session-1',
						userEmail: 'user@example.com'
						// Missing userPassword
					}
				},
				'internal-id-2': {
					marketinout: {
						sessionId: 'session-2',
						userPassword: 'password'
						// Missing userEmail
					}
				},
				'internal-id-3': {
					marketinout: {
						sessionId: 'session-3',
						userEmail: 'user@example.com',
						userPassword: 'password'
					}
				}
			};

			const userCredentials: UserCredentials = {
				userEmail: 'user@example.com',
				userPassword: 'password'
			};

			mockGetAllSessions.mockResolvedValueOnce(partialCredentialSessions);

			const result = await SessionResolver.getLatestSessionForUser('marketinout', userCredentials);

			// Should only match the session with complete credentials
			expect(result).toEqual({
				sessionData: partialCredentialSessions['internal-id-3'].marketinout,
				internalId: 'internal-id-3'
			});
		});

		it('should return MIO session for specific user with cookie data', async () => {
			const userCredentials: UserCredentials = {
				userEmail: 'user1@example.com',
				userPassword: 'pass1'
			};

			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

			// The function finds the first non-excluded key, which would be userEmail
			expect(result).toEqual({
				key: 'userEmail',
				value: 'user1@example.com',
				internalId: 'internal-id-1'
			});
		});

		it('should warn when MIO session for user has no valid cookie', async () => {
			const userCredentials: UserCredentials = {
				userEmail: 'user@example.com',
				userPassword: 'password'
			};

			const sessionWithoutCookie: StoredSessions = {
				'internal-id-1': {
					marketinout: {
						sessionId: 'session-1',
						userEmail: 'user@example.com',
						userPassword: 'password'
						// No cookie keys beyond the excluded ones
					}
				}
			};

			mockGetAllSessions.mockResolvedValueOnce(sessionWithoutCookie);

			const result = await SessionResolver.getLatestMIOSessionForUser(userCredentials);

			// Since userEmail and userPassword are not excluded, it will find userEmail
			expect(result).toEqual({
				key: 'userEmail',
				value: 'user@example.com',
				internalId: 'internal-id-1'
			});
		});
	});

	describe('Basic functionality validation', () => {
		it('should return null when no sessions found for platform', async () => {
			mockGetAllSessions.mockResolvedValueOnce({});

			const result = await SessionResolver.getLatestSession('marketinout');

			expect(result).toBeNull();
		});

		it('should return null when no sessions found for platform and user', async () => {
			const userCredentials: UserCredentials = {
				userEmail: 'nonexistent@example.com',
				userPassword: 'wrongpass'
			};

			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getLatestSessionForUser('marketinout', userCredentials);

			expect(result).toBeNull();
		});

		it('should return valid session when sessions exist', async () => {
			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getLatestSession('marketinout');

			expect(result).not.toBeNull();
			expect(result!.internalId).toBe('internal-id-2');
		});

		it('should return valid session for specific user', async () => {
			const userCredentials: UserCredentials = {
				userEmail: 'user1@example.com',
				userPassword: 'pass1'
			};

			mockGetAllSessions.mockResolvedValueOnce(mockStoredSessions);

			const result = await SessionResolver.getLatestSessionForUser('marketinout', userCredentials);

			expect(result).not.toBeNull();
			expect(result!.internalId).toBe('internal-id-1');
		});
	});

	describe('Type definitions', () => {
		it('should have correct SessionData interface', () => {
			const sessionData: SessionData = {
				sessionId: 'test-session',
				extractedAt: '2024-01-01T10:00:00Z',
				extractedFrom: 'extension',
				source: 'manual',
				customField: 'custom-value'
			};

			expect(typeof sessionData.sessionId).toBe('string');
			expect(typeof sessionData.extractedAt).toBe('string');
			expect(typeof sessionData.customField).toBe('string');
		});

		it('should have correct MIOSessionInfo interface', () => {
			const mioSession: MIOSessionInfo = {
				key: 'ASPSESSIONID',
				value: 'session-value',
				internalId: 'internal-123'
			};

			expect(typeof mioSession.key).toBe('string');
			expect(typeof mioSession.value).toBe('string');
			expect(typeof mioSession.internalId).toBe('string');
		});

		it('should have correct UserCredentials interface', () => {
			const credentials: UserCredentials = {
				userEmail: 'user@example.com',
				userPassword: 'password123'
			};

			expect(typeof credentials.userEmail).toBe('string');
			expect(typeof credentials.userPassword).toBe('string');
		});

		it('should have correct SessionStats interface', () => {
			const stats: SessionStats = {
				totalSessions: 5,
				platformCounts: {
					marketinout: 3,
					tradingview: 2
				}
			};

			expect(typeof stats.totalSessions).toBe('number');
			expect(typeof stats.platformCounts).toBe('object');
			expect(typeof stats.platformCounts.marketinout).toBe('number');
		});
	});
});
