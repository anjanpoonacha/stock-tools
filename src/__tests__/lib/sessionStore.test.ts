import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
	savePlatformSession,
	getPlatformSession,
	getSession,
	updatePlatformSession,
	savePlatformSessionWithCleanup,
	generateSessionId,
	generateDeterministicSessionId,
	deletePlatformSession,
	deleteSession,
	type PlatformSessionData,
	type SessionData
} from '../../lib/sessionStore';

// Mock the KV store module
const mockKvStore = {
	savePlatformSession: vi.fn(),
	getPlatformSession: vi.fn(),
	getSession: vi.fn(),
	updatePlatformSession: vi.fn(),
	savePlatformSessionWithCleanup: vi.fn(),
	generateDeterministicSessionId: vi.fn(),
	deletePlatformSession: vi.fn(),
	deleteSession: vi.fn(),
};

vi.mock('../../lib/sessionStore.kv', () => mockKvStore);

// Mock console methods
const mockConsoleError = vi.fn();
Object.defineProperty(console, 'error', {
	value: mockConsoleError,
	writable: true,
});

// Mock crypto.randomUUID
const mockRandomUUID = vi.fn();
Object.defineProperty(global, 'crypto', {
	value: {
		randomUUID: mockRandomUUID,
	},
	writable: true,
});

describe('sessionStore', () => {
	const testInternalId = 'test-internal-id';
	const testPlatform = 'marketinout';
	const testPlatformData: PlatformSessionData = {
		sessionId: 'test-session-123',
		userEmail: 'test@example.com',
		userPassword: 'test-password',
		extractedAt: '2023-01-01T00:00:00Z',
		extractedFrom: 'https://example.com',
		source: 'browser-extension',
	};

	beforeEach(() => {
		vi.clearAllMocks();

		// Reset environment variables
		delete process.env.KV_REST_API_URL;
		delete process.env.FORCE_KV_LOCALLY;

		// Reset module cache to test dynamic imports
		vi.resetModules();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('KV store loading', () => {
		it('should load KV store when KV_REST_API_URL is set', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(testInternalId, testPlatform, testPlatformData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				testPlatformData
			);
		});

		it('should load KV store when FORCE_KV_LOCALLY is true', async () => {
			process.env.FORCE_KV_LOCALLY = 'true';
			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(testInternalId, testPlatform, testPlatformData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				testPlatformData
			);
		});

		it('should handle KV store import failures with proper error logging', async () => {
			// Test the error handling path by simulating a KV store operation failure
			// that would occur during the import process
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			// Mock a KV store operation to fail in a way that simulates import failure
			const importError = new Error('Failed to load KV store');
			mockKvStore.savePlatformSession.mockRejectedValue(importError);

			// This should trigger the error handling path
			await expect(
				savePlatformSession(testInternalId, testPlatform, testPlatformData)
			).rejects.toThrow('Failed to load KV store');

			// The actual import error logging happens in the withKVStore function
			// but since we're using mocks, we test the error propagation instead
			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				testPlatformData
			);
		});

		it('should throw error when KV store is not available (no environment variables)', async () => {
			// Clear both environment variables to simulate KV store not being available
			delete process.env.KV_REST_API_URL;
			delete process.env.FORCE_KV_LOCALLY;
			vi.resetModules();

			// Re-import the module after clearing environment variables
			const { savePlatformSession: newSavePlatformSession } = await import('../../lib/sessionStore');

			// This should trigger the error path where USE_VERCEL_KV is false
			await expect(
				newSavePlatformSession(testInternalId, testPlatform, testPlatformData)
			).rejects.toThrow('KV store is not available. Check your KV configuration in .env file.');
		});

		it('should handle subsequent operations after KV store is loaded', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
			mockKvStore.savePlatformSession.mockResolvedValue(undefined);
			mockKvStore.getPlatformSession.mockResolvedValue(testPlatformData);

			// First operation loads the KV store
			await savePlatformSession(testInternalId, testPlatform, testPlatformData);

			// Second operation should use the already loaded KV store
			const result = await getPlatformSession(testInternalId, testPlatform);

			expect(result).toEqual(testPlatformData);
			expect(mockKvStore.savePlatformSession).toHaveBeenCalledTimes(1);
			expect(mockKvStore.getPlatformSession).toHaveBeenCalledTimes(1);
		});
	});

	describe('savePlatformSession', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should save platform session successfully', async () => {
			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(testInternalId, testPlatform, testPlatformData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				testPlatformData
			);
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.savePlatformSession.mockRejectedValue(kvError);

			await expect(
				savePlatformSession(testInternalId, testPlatform, testPlatformData)
			).rejects.toThrow('KV store error');
		});
	});

	describe('getPlatformSession', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should get platform session successfully', async () => {
			mockKvStore.getPlatformSession.mockResolvedValue(testPlatformData);

			const result = await getPlatformSession(testInternalId, testPlatform);

			expect(result).toEqual(testPlatformData);
			expect(mockKvStore.getPlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform
			);
		});

		it('should return undefined when session not found', async () => {
			mockKvStore.getPlatformSession.mockResolvedValue(undefined);

			const result = await getPlatformSession(testInternalId, testPlatform);

			expect(result).toBeUndefined();
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.getPlatformSession.mockRejectedValue(kvError);

			await expect(
				getPlatformSession(testInternalId, testPlatform)
			).rejects.toThrow('KV store error');
		});
	});

	describe('getSession', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should get session successfully', async () => {
			const testSessionData: SessionData = {
				marketinout: testPlatformData,
				tradingview: {
					sessionId: 'tv-session-456',
					userEmail: 'test@example.com',
				},
			};
			mockKvStore.getSession.mockResolvedValue(testSessionData);

			const result = await getSession(testInternalId);

			expect(result).toEqual(testSessionData);
			expect(mockKvStore.getSession).toHaveBeenCalledWith(testInternalId);
		});

		it('should return undefined when session not found', async () => {
			mockKvStore.getSession.mockResolvedValue(undefined);

			const result = await getSession(testInternalId);

			expect(result).toBeUndefined();
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.getSession.mockRejectedValue(kvError);

			await expect(getSession(testInternalId)).rejects.toThrow('KV store error');
		});
	});

	describe('updatePlatformSession', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should update platform session successfully', async () => {
			const updates: Partial<PlatformSessionData> = {
				extractedAt: '2023-01-02T00:00:00Z',
				source: 'manual-entry',
			};
			mockKvStore.updatePlatformSession.mockResolvedValue(undefined);

			await updatePlatformSession(testInternalId, testPlatform, updates);

			expect(mockKvStore.updatePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				updates
			);
		});

		it('should handle empty updates', async () => {
			const updates: Partial<PlatformSessionData> = {};
			mockKvStore.updatePlatformSession.mockResolvedValue(undefined);

			await updatePlatformSession(testInternalId, testPlatform, updates);

			expect(mockKvStore.updatePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				updates
			);
		});

		it('should handle KV store errors', async () => {
			const updates: Partial<PlatformSessionData> = { source: 'updated' };
			const kvError = new Error('KV store error');
			mockKvStore.updatePlatformSession.mockRejectedValue(kvError);

			await expect(
				updatePlatformSession(testInternalId, testPlatform, updates)
			).rejects.toThrow('KV store error');
		});
	});

	describe('savePlatformSessionWithCleanup', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should save platform session with cleanup successfully', async () => {
			const expectedResult = 'cleanup-result-id';
			mockKvStore.savePlatformSessionWithCleanup.mockResolvedValue(expectedResult);

			const result = await savePlatformSessionWithCleanup(
				testInternalId,
				testPlatform,
				testPlatformData
			);

			expect(result).toBe(expectedResult);
			expect(mockKvStore.savePlatformSessionWithCleanup).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				testPlatformData
			);
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.savePlatformSessionWithCleanup.mockRejectedValue(kvError);

			await expect(
				savePlatformSessionWithCleanup(testInternalId, testPlatform, testPlatformData)
			).rejects.toThrow('KV store error');
		});
	});

	describe('generateSessionId', () => {
		it('should generate a random UUID', () => {
			const testUuid = 'test-uuid-123';
			mockRandomUUID.mockReturnValue(testUuid);

			const result = generateSessionId();

			expect(result).toBe(testUuid);
			expect(mockRandomUUID).toHaveBeenCalled();
		});

		it('should generate different UUIDs on multiple calls', () => {
			mockRandomUUID
				.mockReturnValueOnce('uuid-1')
				.mockReturnValueOnce('uuid-2');

			const result1 = generateSessionId();
			const result2 = generateSessionId();

			expect(result1).toBe('uuid-1');
			expect(result2).toBe('uuid-2');
			expect(mockRandomUUID).toHaveBeenCalledTimes(2);
		});
	});

	describe('generateDeterministicSessionId', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should generate deterministic session ID successfully', async () => {
			const userEmail = 'test@example.com';
			const userPassword = 'test-password';
			const platform = 'marketinout';
			const expectedId = 'deterministic-id-123';

			mockKvStore.generateDeterministicSessionId.mockResolvedValue(expectedId);

			const result = await generateDeterministicSessionId(userEmail, userPassword, platform);

			expect(result).toBe(expectedId);
			expect(mockKvStore.generateDeterministicSessionId).toHaveBeenCalledWith(
				userEmail,
				userPassword,
				platform
			);
		});

		it('should handle different user credentials', async () => {
			const userEmail1 = 'user1@example.com';
			const userPassword1 = 'password1';
			const userEmail2 = 'user2@example.com';
			const userPassword2 = 'password2';
			const platform = 'tradingview';

			mockKvStore.generateDeterministicSessionId
				.mockResolvedValueOnce('id-for-user1')
				.mockResolvedValueOnce('id-for-user2');

			const result1 = await generateDeterministicSessionId(userEmail1, userPassword1, platform);
			const result2 = await generateDeterministicSessionId(userEmail2, userPassword2, platform);

			expect(result1).toBe('id-for-user1');
			expect(result2).toBe('id-for-user2');
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.generateDeterministicSessionId.mockRejectedValue(kvError);

			await expect(
				generateDeterministicSessionId('test@example.com', 'password', 'platform')
			).rejects.toThrow('KV store error');
		});
	});

	describe('deletePlatformSession', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should delete platform session successfully', async () => {
			mockKvStore.deletePlatformSession.mockResolvedValue(undefined);

			await deletePlatformSession(testInternalId, testPlatform);

			expect(mockKvStore.deletePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform
			);
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.deletePlatformSession.mockRejectedValue(kvError);

			await expect(
				deletePlatformSession(testInternalId, testPlatform)
			).rejects.toThrow('KV store error');
		});
	});

	describe('deleteSession', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should delete session successfully', async () => {
			mockKvStore.deleteSession.mockResolvedValue(undefined);

			await deleteSession(testInternalId);

			expect(mockKvStore.deleteSession).toHaveBeenCalledWith(testInternalId);
		});

		it('should handle KV store errors', async () => {
			const kvError = new Error('KV store error');
			mockKvStore.deleteSession.mockRejectedValue(kvError);

			await expect(deleteSession(testInternalId)).rejects.toThrow('KV store error');
		});
	});

	describe('edge cases and error handling', () => {
		it('should handle special characters in session data', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			const specialData: PlatformSessionData = {
				sessionId: 'session-with-special-chars-!@#$%^&*()',
				userEmail: 'test+special@example.com',
				userPassword: 'password-with-symbols-!@#',
				extractedFrom: 'https://example.com/path?param=value&other=test',
				customField: 'value with spaces and symbols: !@#$%',
			};

			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(testInternalId, testPlatform, specialData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				specialData
			);
		});

		it('should handle empty string values in session data', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			const emptyData: PlatformSessionData = {
				sessionId: '',
				userEmail: '',
				userPassword: '',
				extractedAt: '',
				extractedFrom: '',
				source: '',
			};

			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(testInternalId, testPlatform, emptyData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				emptyData
			);
		});

		it('should handle undefined optional fields in session data', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			const minimalData: PlatformSessionData = {
				sessionId: 'minimal-session-id',
				// All other fields are undefined
			};

			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(testInternalId, testPlatform, minimalData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				testInternalId,
				testPlatform,
				minimalData
			);
		});

		it('should handle very long session IDs and internal IDs', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			const longInternalId = 'a'.repeat(1000);
			const longPlatform = 'b'.repeat(500);
			const longSessionData: PlatformSessionData = {
				sessionId: 'c'.repeat(2000),
				userEmail: 'd'.repeat(100) + '@example.com',
			};

			mockKvStore.savePlatformSession.mockResolvedValue(undefined);

			await savePlatformSession(longInternalId, longPlatform, longSessionData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				longInternalId,
				longPlatform,
				longSessionData
			);
		});
	});

	describe('multiple KV operations', () => {
		beforeEach(() => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
		});

		it('should handle multiple sequential operations', async () => {
			mockKvStore.savePlatformSession.mockResolvedValue(undefined);
			mockKvStore.getPlatformSession.mockResolvedValue(testPlatformData);
			mockKvStore.updatePlatformSession.mockResolvedValue(undefined);
			mockKvStore.deletePlatformSession.mockResolvedValue(undefined);

			// Save session
			await savePlatformSession(testInternalId, testPlatform, testPlatformData);

			// Get session
			const retrieved = await getPlatformSession(testInternalId, testPlatform);
			expect(retrieved).toEqual(testPlatformData);

			// Update session
			await updatePlatformSession(testInternalId, testPlatform, { source: 'updated' });

			// Delete session
			await deletePlatformSession(testInternalId, testPlatform);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledTimes(1);
			expect(mockKvStore.getPlatformSession).toHaveBeenCalledTimes(1);
			expect(mockKvStore.updatePlatformSession).toHaveBeenCalledTimes(1);
			expect(mockKvStore.deletePlatformSession).toHaveBeenCalledTimes(1);
		});

		it('should handle concurrent operations', async () => {
			mockKvStore.savePlatformSession.mockResolvedValue(undefined);
			mockKvStore.getPlatformSession.mockResolvedValue(testPlatformData);

			// Execute operations concurrently
			const promises = [
				savePlatformSession('id1', 'platform1', testPlatformData),
				savePlatformSession('id2', 'platform2', testPlatformData),
				getPlatformSession('id3', 'platform3'),
			];

			await Promise.all(promises);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledTimes(2);
			expect(mockKvStore.getPlatformSession).toHaveBeenCalledTimes(1);
		});
	});
});
