import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock console.error before importing the module
const mockConsoleError = vi.fn();
vi.spyOn(console, 'error').mockImplementation(mockConsoleError);

describe('sessionStore - Additional Coverage', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.resetModules();

		// Clear environment variables
		delete process.env.KV_REST_API_URL;
		delete process.env.FORCE_KV_LOCALLY;
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('Dynamic Import Error Handling', () => {
		it('should handle KV store import failure and log error', async () => {
			// Set environment to trigger KV store loading
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			// Mock the dynamic import to fail
			const importError = new Error('Failed to import KV store module');
			vi.doMock('../../lib/sessionStore.kv', () => {
				throw importError;
			});

			// Import the module after setting up the mock
			const { savePlatformSession } = await import('../../lib/sessionStore');

			const testData = {
				sessionId: 'test-session',
				userEmail: 'test@example.com'
			};

			// This should trigger the import failure and error logging
			await expect(
				savePlatformSession('test-id', 'test-platform', testData)
			).rejects.toThrow('KV store is required but failed to load. Check your KV configuration.');

			// Verify that console.error was called with the import error
			// The actual error logged will be wrapped by Vitest, so we check for the structure
			expect(mockConsoleError).toHaveBeenCalledWith(
				'[SessionStore] Failed to load KV store:',
				expect.objectContaining({
					message: expect.stringContaining('There was an error when mocking a module'),
					cause: expect.objectContaining({
						message: 'Failed to import KV store module'
					})
				})
			);
		});

		it('should handle KV store not available error path', async () => {
			// Ensure no KV environment variables are set
			delete process.env.KV_REST_API_URL;
			delete process.env.FORCE_KV_LOCALLY;

			// Import the module with no KV configuration
			const { savePlatformSession } = await import('../../lib/sessionStore');

			const testData = {
				sessionId: 'test-session',
				userEmail: 'test@example.com'
			};

			// This should trigger the "KV store is not available" error
			await expect(
				savePlatformSession('test-id', 'test-platform', testData)
			).rejects.toThrow('KV store is not available. Check your KV configuration in .env file.');

			// Console.error should not be called in this path (only for import failures)
			expect(mockConsoleError).not.toHaveBeenCalled();
		});

		it('should handle FORCE_KV_LOCALLY environment variable', async () => {
			// Set FORCE_KV_LOCALLY to trigger KV loading
			process.env.FORCE_KV_LOCALLY = 'true';

			// Mock successful KV store
			const mockKvStore = {
				savePlatformSession: vi.fn().mockResolvedValue(undefined)
			};
			vi.doMock('../../lib/sessionStore.kv', () => mockKvStore);

			// Import the module after setting up the mock
			const { savePlatformSession } = await import('../../lib/sessionStore');

			const testData = {
				sessionId: 'test-session',
				userEmail: 'test@example.com'
			};

			await savePlatformSession('test-id', 'test-platform', testData);

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledWith(
				'test-id',
				'test-platform',
				testData
			);
		});

		it('should handle KV_REST_API_URL environment variable', async () => {
			// Set KV_REST_API_URL to trigger KV loading
			process.env.KV_REST_API_URL = 'https://test-kv.vercel-storage.com';

			// Mock successful KV store
			const mockKvStore = {
				getPlatformSession: vi.fn().mockResolvedValue({ sessionId: 'test' })
			};
			vi.doMock('../../lib/sessionStore.kv', () => mockKvStore);

			// Import the module after setting up the mock
			const { getPlatformSession } = await import('../../lib/sessionStore');

			const result = await getPlatformSession('test-id', 'test-platform');

			expect(result).toEqual({ sessionId: 'test' });
			expect(mockKvStore.getPlatformSession).toHaveBeenCalledWith('test-id', 'test-platform');
		});
	});

	describe('Error Propagation', () => {
		it('should propagate KV store operation errors', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			// Mock KV store with operation that throws
			const operationError = new Error('KV operation failed');
			const mockKvStore = {
				getSession: vi.fn().mockRejectedValue(operationError)
			};
			vi.doMock('../../lib/sessionStore.kv', () => mockKvStore);

			const { getSession } = await import('../../lib/sessionStore');

			await expect(getSession('test-id')).rejects.toThrow('KV operation failed');
			expect(mockKvStore.getSession).toHaveBeenCalledWith('test-id');
		});

		it('should handle multiple operations with cached KV store', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			// Mock KV store
			const mockKvStore = {
				savePlatformSession: vi.fn().mockResolvedValue(undefined),
				getPlatformSession: vi.fn().mockResolvedValue({ sessionId: 'test' }),
				deleteSession: vi.fn().mockResolvedValue(undefined)
			};
			vi.doMock('../../lib/sessionStore.kv', () => mockKvStore);

			const { savePlatformSession, getPlatformSession, deleteSession } = await import('../../lib/sessionStore');

			// First operation loads KV store
			await savePlatformSession('test-id', 'platform', { sessionId: 'test' });

			// Second operation uses cached KV store
			await getPlatformSession('test-id', 'platform');

			// Third operation also uses cached KV store
			await deleteSession('test-id');

			expect(mockKvStore.savePlatformSession).toHaveBeenCalledTimes(1);
			expect(mockKvStore.getPlatformSession).toHaveBeenCalledTimes(1);
			expect(mockKvStore.deleteSession).toHaveBeenCalledTimes(1);
		});
	});

	describe('Environment Variable Edge Cases', () => {
		it('should handle empty KV_REST_API_URL', async () => {
			process.env.KV_REST_API_URL = '';

			const { savePlatformSession } = await import('../../lib/sessionStore');

			await expect(
				savePlatformSession('test-id', 'platform', { sessionId: 'test' })
			).rejects.toThrow('KV store is not available. Check your KV configuration in .env file.');
		});

		it('should handle FORCE_KV_LOCALLY set to false', async () => {
			process.env.FORCE_KV_LOCALLY = 'false';

			const { savePlatformSession } = await import('../../lib/sessionStore');

			await expect(
				savePlatformSession('test-id', 'platform', { sessionId: 'test' })
			).rejects.toThrow('KV store is not available. Check your KV configuration in .env file.');
		});

		it('should handle both environment variables set', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';
			process.env.FORCE_KV_LOCALLY = 'true';

			// Mock successful KV store
			const mockKvStore = {
				updatePlatformSession: vi.fn().mockResolvedValue(undefined)
			};
			vi.doMock('../../lib/sessionStore.kv', () => mockKvStore);

			const { updatePlatformSession } = await import('../../lib/sessionStore');

			await updatePlatformSession('test-id', 'platform', { source: 'updated' });

			expect(mockKvStore.updatePlatformSession).toHaveBeenCalledWith(
				'test-id',
				'platform',
				{ source: 'updated' }
			);
		});
	});

	describe('generateSessionId Coverage', () => {
		it('should use crypto.randomUUID', async () => {
			// Mock crypto.randomUUID
			const mockRandomUUID = vi.fn().mockReturnValue('test-uuid-123');
			Object.defineProperty(global, 'crypto', {
				value: { randomUUID: mockRandomUUID },
				writable: true,
			});

			const { generateSessionId } = await import('../../lib/sessionStore');

			const result = generateSessionId();

			expect(result).toBe('test-uuid-123');
			expect(mockRandomUUID).toHaveBeenCalled();
		});
	});

	describe('All Function Coverage', () => {
		it('should cover all exported functions with KV store available', async () => {
			process.env.KV_REST_API_URL = 'https://test-kv-url.com';

			// Mock all KV store functions
			const mockKvStore = {
				savePlatformSession: vi.fn().mockResolvedValue(undefined),
				getPlatformSession: vi.fn().mockResolvedValue({ sessionId: 'test' }),
				getSession: vi.fn().mockResolvedValue({ platform: { sessionId: 'test' } }),
				updatePlatformSession: vi.fn().mockResolvedValue(undefined),
				savePlatformSessionWithCleanup: vi.fn().mockResolvedValue('cleanup-id'),
				generateDeterministicSessionId: vi.fn().mockResolvedValue('deterministic-id'),
				deletePlatformSession: vi.fn().mockResolvedValue(undefined),
				deleteSession: vi.fn().mockResolvedValue(undefined)
			};
			vi.doMock('../../lib/sessionStore.kv', () => mockKvStore);

			const {
				savePlatformSession,
				getPlatformSession,
				getSession,
				updatePlatformSession,
				savePlatformSessionWithCleanup,
				generateDeterministicSessionId,
				deletePlatformSession,
				deleteSession,
				generateSessionId
			} = await import('../../lib/sessionStore');

			// Test all functions
			await savePlatformSession('id', 'platform', { sessionId: 'test' });
			await getPlatformSession('id', 'platform');
			await getSession('id');
			await updatePlatformSession('id', 'platform', { source: 'test' });
			await savePlatformSessionWithCleanup('id', 'platform', { sessionId: 'test' });
			await generateDeterministicSessionId('email', 'password', 'platform');
			await deletePlatformSession('id', 'platform');
			await deleteSession('id');
			generateSessionId(); // Synchronous function

			// Verify all KV functions were called
			expect(mockKvStore.savePlatformSession).toHaveBeenCalled();
			expect(mockKvStore.getPlatformSession).toHaveBeenCalled();
			expect(mockKvStore.getSession).toHaveBeenCalled();
			expect(mockKvStore.updatePlatformSession).toHaveBeenCalled();
			expect(mockKvStore.savePlatformSessionWithCleanup).toHaveBeenCalled();
			expect(mockKvStore.generateDeterministicSessionId).toHaveBeenCalled();
			expect(mockKvStore.deletePlatformSession).toHaveBeenCalled();
			expect(mockKvStore.deleteSession).toHaveBeenCalled();
		});
	});
});
