import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	savePlatformSession,
	getPlatformSession,
	getSession,
	updatePlatformSession,
	savePlatformSessionWithCleanup,
	getAllSessions,
	deletePlatformSession,
	deleteSession,
	getSessionStats,
	generateDeterministicSessionId,
	type PlatformSessionData
} from '../../lib/sessionStore.kv';

// Mock @vercel/kv
vi.mock('@vercel/kv', () => ({
	kv: {
		get: vi.fn(),
		set: vi.fn(),
		del: vi.fn(),
		keys: vi.fn(),
	},
}));

// Mock SessionResolver
vi.mock('../../lib/SessionResolver', () => ({
	SessionResolver: {
		invalidateCache: vi.fn(),
	},
}));

// Mock crypto.subtle for deterministic session ID generation
const mockCrypto = {
	subtle: {
		digest: vi.fn(),
	},
};

Object.defineProperty(global, 'crypto', {
	value: mockCrypto,
	writable: true,
});

describe('sessionStore.kv', () => {
	let mockKv: {
		get: ReturnType<typeof vi.fn>;
		set: ReturnType<typeof vi.fn>;
		del: ReturnType<typeof vi.fn>;
		keys: ReturnType<typeof vi.fn>;
	};

	beforeEach(async () => {
		vi.clearAllMocks();
		vi.clearAllTimers();
		vi.useFakeTimers();

		// Get the mocked kv instance
		const { kv } = await import('@vercel/kv');
		mockKv = kv as unknown as typeof mockKv;
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	describe('savePlatformSession', () => {
		it('should save session data successfully', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
				extractedAt: '2023-01-01T00:00:00Z',
			};

			mockKv.set.mockResolvedValue('OK');

			await savePlatformSession('internal-id', 'marketinout', sessionData);

			expect(mockKv.set).toHaveBeenCalledWith(
				'session:internal-id:marketinout',
				JSON.stringify(sessionData)
			);
		});

		it('should sanitize session data with non-string values', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
				customField: 'string-value',
			};

			mockKv.set.mockResolvedValue('OK');

			await savePlatformSession('internal-id', 'marketinout', sessionData);

			expect(mockKv.set).toHaveBeenCalledWith(
				'session:internal-id:marketinout',
				JSON.stringify(sessionData)
			);
		});

		it('should invalidate cache after saving', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
			};

			mockKv.set.mockResolvedValue('OK');
			const { SessionResolver } = await import('../../lib/SessionResolver');

			await savePlatformSession('internal-id', 'marketinout', sessionData);

			// Fast-forward timers to trigger cache invalidation
			vi.advanceTimersByTime(100);

			expect(SessionResolver.invalidateCache).toHaveBeenCalled();
		});
	});

	describe('getPlatformSession', () => {
		it('should retrieve session data successfully', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
				extractedAt: '2023-01-01T00:00:00Z',
			};

			mockKv.get.mockResolvedValue(JSON.stringify(sessionData));

			const result = await getPlatformSession('internal-id', 'marketinout');

			expect(result).toEqual(sessionData);
			expect(mockKv.get).toHaveBeenCalledWith('session:internal-id:marketinout');
		});

		it('should return undefined when session does not exist', async () => {
			mockKv.get.mockResolvedValue(null);

			const result = await getPlatformSession('non-existent-id', 'marketinout');

			expect(result).toBeUndefined();
		});

		it('should handle object data from KV', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
			};

			mockKv.get.mockResolvedValue(sessionData);

			const result = await getPlatformSession('internal-id', 'marketinout');

			expect(result).toEqual(sessionData);
		});

		it('should handle invalid JSON gracefully', async () => {
			mockKv.get.mockResolvedValue('invalid-json');

			const result = await getPlatformSession('internal-id', 'marketinout');

			expect(result).toBeUndefined();
		});

		it('should handle unexpected data types', async () => {
			mockKv.get.mockResolvedValue(123);

			const result = await getPlatformSession('internal-id', 'marketinout');

			expect(result).toBeUndefined();
		});
	});

	describe('getSession', () => {
		it('should retrieve all sessions for an internal ID', async () => {
			const sessionData1: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
			};
			const sessionData2: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
			};

			mockKv.keys.mockResolvedValue([
				'session:internal-id:marketinout',
				'session:internal-id:tradingview'
			]);
			mockKv.get
				.mockResolvedValueOnce(JSON.stringify(sessionData1))
				.mockResolvedValueOnce(JSON.stringify(sessionData2));

			const result = await getSession('internal-id');

			expect(result).toEqual({
				marketinout: sessionData1,
				tradingview: sessionData2,
			});
			expect(mockKv.keys).toHaveBeenCalledWith('session:internal-id:*');
		});

		it('should return undefined when no sessions exist', async () => {
			mockKv.keys.mockResolvedValue([]);

			const result = await getSession('non-existent-id');

			expect(result).toBeUndefined();
		});

		it('should handle sessions with invalid data', async () => {
			mockKv.keys.mockResolvedValue(['session:internal-id:marketinout']);
			mockKv.get.mockResolvedValue('invalid-json');

			const result = await getSession('internal-id');

			expect(result).toBeUndefined();
		});
	});

	describe('updatePlatformSession', () => {
		it('should merge updates with existing session data', async () => {
			const existingData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
				extractedAt: '2023-01-01T00:00:00Z',
			};

			const updates = {
				userEmail: 'updated@example.com',
				extractedAt: '2023-01-02T00:00:00Z',
			};

			mockKv.get.mockResolvedValue(JSON.stringify(existingData));
			mockKv.set.mockResolvedValue('OK');

			await updatePlatformSession('internal-id', 'marketinout', updates);

			expect(mockKv.set).toHaveBeenCalledWith(
				'session:internal-id:marketinout',
				JSON.stringify({
					...existingData,
					...updates,
				})
			);
		});

		it('should create new session when none exists', async () => {
			const updates = {
				userEmail: 'new@example.com',
				extractedAt: '2023-01-01T00:00:00Z',
			};

			mockKv.get.mockResolvedValue(null);
			mockKv.set.mockResolvedValue('OK');

			await updatePlatformSession('internal-id', 'marketinout', updates);

			expect(mockKv.set).toHaveBeenCalledWith(
				'session:internal-id:marketinout',
				JSON.stringify({
					sessionId: '',
					...updates,
				})
			);
		});

		it('should filter out undefined values', async () => {
			const existingData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
			};

			const updates = {
				userEmail: 'updated@example.com',
				extractedAt: undefined,
			};

			mockKv.get.mockResolvedValue(JSON.stringify(existingData));
			mockKv.set.mockResolvedValue('OK');

			await updatePlatformSession('internal-id', 'marketinout', updates);

			expect(mockKv.set).toHaveBeenCalledWith(
				'session:internal-id:marketinout',
				JSON.stringify({
					sessionId: 'test-session-id',
					userEmail: 'updated@example.com',
				})
			);
		});
	});

	describe('generateDeterministicSessionId', () => {
		it('should generate consistent session IDs for same inputs', async () => {
			const mockHashBuffer = new ArrayBuffer(32);
			const mockHashArray = new Uint8Array(mockHashBuffer);
			mockHashArray.fill(170); // Fill with 0xAA for predictable output

			mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);

			const sessionId1 = await generateDeterministicSessionId('test@example.com', 'password', 'marketinout');
			const sessionId2 = await generateDeterministicSessionId('test@example.com', 'password', 'marketinout');

			expect(sessionId1).toBe(sessionId2);
			expect(sessionId1).toMatch(/^det_[a-f0-9]{32}$/);
		});

		it('should generate different session IDs for different inputs', async () => {
			const mockHashBuffer1 = new ArrayBuffer(32);
			const mockHashArray1 = new Uint8Array(mockHashBuffer1);
			mockHashArray1.fill(170);

			const mockHashBuffer2 = new ArrayBuffer(32);
			const mockHashArray2 = new Uint8Array(mockHashBuffer2);
			mockHashArray2.fill(187);

			mockCrypto.subtle.digest
				.mockResolvedValueOnce(mockHashBuffer1)
				.mockResolvedValueOnce(mockHashBuffer2);

			const sessionId1 = await generateDeterministicSessionId('test1@example.com', 'password', 'marketinout');
			const sessionId2 = await generateDeterministicSessionId('test2@example.com', 'password', 'marketinout');

			expect(sessionId1).not.toBe(sessionId2);
		});
	});

	describe('savePlatformSessionWithCleanup', () => {
		it('should use deterministic session ID when user credentials are provided', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
				userEmail: 'test@example.com',
				userPassword: 'password',
				extractedAt: '2023-01-01T00:00:00Z',
			};

			const mockHashBuffer = new ArrayBuffer(32);
			const mockHashArray = new Uint8Array(mockHashBuffer);
			mockHashArray.fill(170);

			mockCrypto.subtle.digest.mockResolvedValue(mockHashBuffer);
			mockKv.set.mockResolvedValue('OK');

			const result = await savePlatformSessionWithCleanup('original-id', 'marketinout', sessionData);

			expect(result).toMatch(/^det_[a-f0-9]{32}$/);
			expect(mockKv.set).toHaveBeenCalledWith(
				expect.stringMatching(/^session:det_[a-f0-9]{32}:marketinout$/),
				JSON.stringify(sessionData)
			);
		});

		it('should use provided session ID when no user credentials', async () => {
			const sessionData: PlatformSessionData = {
				sessionId: 'test-session-id',
				extractedAt: '2023-01-01T00:00:00Z',
			};

			mockKv.set.mockResolvedValue('OK');

			const result = await savePlatformSessionWithCleanup('original-id', 'marketinout', sessionData);

			expect(result).toBe('original-id');
			expect(mockKv.set).toHaveBeenCalledWith(
				'session:original-id:marketinout',
				JSON.stringify(sessionData)
			);
		});
	});

	describe('getAllSessions', () => {
		it('should retrieve all sessions from KV store', async () => {
			const sessionData1: PlatformSessionData = {
				sessionId: 'test-session-id-1',
				userEmail: 'test1@example.com',
			};
			const sessionData2: PlatformSessionData = {
				sessionId: 'test-session-id-2',
				userEmail: 'test2@example.com',
			};

			mockKv.keys.mockResolvedValue([
				'session:internal-id-1:marketinout',
				'session:internal-id-2:tradingview'
			]);
			mockKv.get
				.mockResolvedValueOnce(JSON.stringify(sessionData1))
				.mockResolvedValueOnce(JSON.stringify(sessionData2));

			const result = await getAllSessions();

			expect(result).toEqual({
				'internal-id-1': {
					marketinout: sessionData1,
				},
				'internal-id-2': {
					tradingview: sessionData2,
				},
			});
		});

		it('should handle empty KV store', async () => {
			mockKv.keys.mockResolvedValue([]);

			const result = await getAllSessions();

			expect(result).toEqual({});
		});

		it('should skip sessions with invalid data', async () => {
			mockKv.keys.mockResolvedValue([
				'session:internal-id-1:marketinout',
				'session:internal-id-2:tradingview'
			]);
			mockKv.get
				.mockResolvedValueOnce('invalid-json')
				.mockResolvedValueOnce(JSON.stringify({ sessionId: 'valid' }));

			const result = await getAllSessions();

			expect(result).toEqual({
				'internal-id-2': {
					tradingview: { sessionId: 'valid' },
				},
			});
		});
	});

	describe('deletePlatformSession', () => {
		it('should delete session successfully', async () => {
			mockKv.del.mockResolvedValue(1);

			await deletePlatformSession('internal-id', 'marketinout');

			expect(mockKv.del).toHaveBeenCalledWith('session:internal-id:marketinout');
		});

		it('should invalidate cache after deletion', async () => {
			mockKv.del.mockResolvedValue(1);
			const { SessionResolver } = await import('../../lib/SessionResolver');

			await deletePlatformSession('internal-id', 'marketinout');

			// Fast-forward timers to trigger cache invalidation
			vi.advanceTimersByTime(100);

			expect(SessionResolver.invalidateCache).toHaveBeenCalled();
		});
	});

	describe('deleteSession', () => {
		it('should delete all sessions for an internal ID', async () => {
			mockKv.keys.mockResolvedValue([
				'session:internal-id:marketinout',
				'session:internal-id:tradingview'
			]);
			mockKv.del.mockResolvedValue(1);

			await deleteSession('internal-id');

			expect(mockKv.keys).toHaveBeenCalledWith('session:internal-id:*');
			expect(mockKv.del).toHaveBeenCalledTimes(2);
			expect(mockKv.del).toHaveBeenCalledWith('session:internal-id:marketinout');
			expect(mockKv.del).toHaveBeenCalledWith('session:internal-id:tradingview');
		});

		it('should handle case when no sessions exist', async () => {
			mockKv.keys.mockResolvedValue([]);

			await deleteSession('non-existent-id');

			expect(mockKv.del).not.toHaveBeenCalled();
		});

		it('should invalidate cache after deletion', async () => {
			mockKv.keys.mockResolvedValue(['session:internal-id:marketinout']);
			mockKv.del.mockResolvedValue(1);
			const { SessionResolver } = await import('../../lib/SessionResolver');

			await deleteSession('internal-id');

			// Fast-forward timers to trigger cache invalidation
			vi.advanceTimersByTime(100);

			expect(SessionResolver.invalidateCache).toHaveBeenCalled();
		});
	});

	describe('getSessionStats', () => {
		it('should return session statistics', async () => {
			mockKv.keys.mockResolvedValue([
				'session:id1:marketinout',
				'session:id2:marketinout',
				'session:id3:tradingview',
				'session:id4:tradingview',
				'session:id5:tradingview'
			]);

			const result = await getSessionStats();

			expect(result).toEqual({
				totalSessions: 5,
				platformCounts: {
					marketinout: 2,
					tradingview: 3,
				},
			});
		});

		it('should handle empty KV store', async () => {
			mockKv.keys.mockResolvedValue([]);

			const result = await getSessionStats();

			expect(result).toEqual({
				totalSessions: 0,
				platformCounts: {},
			});
		});

		it('should handle malformed keys gracefully', async () => {
			mockKv.keys.mockResolvedValue([
				'session:id1:marketinout',
				'session:id2', // Malformed key
				'session:id3:tradingview'
			]);

			const result = await getSessionStats();

			expect(result).toEqual({
				totalSessions: 3,
				platformCounts: {
					marketinout: 1,
					tradingview: 1,
				},
			});
		});
	});
});
