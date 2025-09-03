import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { sendTelegramMessage } from '../../lib/telegram';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('telegram', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('sendTelegramMessage', () => {
		it('should send telegram message successfully without topicId', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ message_id: 123, text: 'Test message' }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await sendTelegramMessage('test-token', 'test-chat-id', 'Test message');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.telegram.org/bottest-token/sendMessage',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						chat_id: 'test-chat-id',
						text: 'Test message',
						parse_mode: 'Markdown',
					}),
				}
			);
			expect(result).toEqual({ message_id: 123, text: 'Test message' });
		});

		it('should send telegram message successfully with topicId', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ message_id: 456, text: 'Test topic message' }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await sendTelegramMessage('test-token', 'test-chat-id', 'Test topic message', '789');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.telegram.org/bottest-token/sendMessage',
				{
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({
						chat_id: 'test-chat-id',
						text: 'Test topic message',
						parse_mode: 'Markdown',
						message_thread_id: 789,
					}),
				}
			);
			expect(result).toEqual({ message_id: 456, text: 'Test topic message' });
		});

		it('should handle numeric topicId correctly', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ message_id: 789 }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('test-token', 'test-chat-id', 'Test message', '123');

			const callArgs = mockFetch.mock.calls[0][1];
			const body = JSON.parse(callArgs.body);
			expect(body.message_thread_id).toBe(123);
			expect(typeof body.message_thread_id).toBe('number');
		});

		it('should throw error when telegram API returns error', async () => {
			const mockResponse = {
				ok: false,
				text: vi.fn().mockResolvedValue('Bad Request: chat not found'),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await expect(
				sendTelegramMessage('invalid-token', 'invalid-chat-id', 'Test message')
			).rejects.toThrow('Telegram API error: Bad Request: chat not found');

			expect(mockResponse.text).toHaveBeenCalled();
		});

		it('should handle fetch network errors', async () => {
			const networkError = new Error('Network error');
			mockFetch.mockRejectedValue(networkError);

			await expect(
				sendTelegramMessage('test-token', 'test-chat-id', 'Test message')
			).rejects.toThrow('Network error');
		});

		it('should construct correct URL with token', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('my-bot-token-123', 'chat-456', 'Hello World');

			expect(mockFetch).toHaveBeenCalledWith(
				'https://api.telegram.org/botmy-bot-token-123/sendMessage',
				expect.any(Object)
			);
		});

		it('should include all required headers', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('test-token', 'test-chat-id', 'Test message');

			const callArgs = mockFetch.mock.calls[0][1];
			expect(callArgs.headers).toEqual({ 'Content-Type': 'application/json' });
		});

		it('should always use POST method', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('test-token', 'test-chat-id', 'Test message');

			const callArgs = mockFetch.mock.calls[0][1];
			expect(callArgs.method).toBe('POST');
		});

		it('should always use Markdown parse mode', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('test-token', 'test-chat-id', 'Test message');

			const callArgs = mockFetch.mock.calls[0][1];
			const body = JSON.parse(callArgs.body);
			expect(body.parse_mode).toBe('Markdown');
		});

		it('should handle empty message text', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ message_id: 999 }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const result = await sendTelegramMessage('test-token', 'test-chat-id', '');

			const callArgs = mockFetch.mock.calls[0][1];
			const body = JSON.parse(callArgs.body);
			expect(body.text).toBe('');
			expect(result).toEqual({ message_id: 999 });
		});

		it('should handle special characters in message text', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({ message_id: 111 }),
			};
			mockFetch.mockResolvedValue(mockResponse);

			const specialText = 'Test with *bold* and _italic_ and `code`';
			await sendTelegramMessage('test-token', 'test-chat-id', specialText);

			const callArgs = mockFetch.mock.calls[0][1];
			const body = JSON.parse(callArgs.body);
			expect(body.text).toBe(specialText);
		});

		it('should not include message_thread_id when topicId is undefined', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('test-token', 'test-chat-id', 'Test message', undefined);

			const callArgs = mockFetch.mock.calls[0][1];
			const body = JSON.parse(callArgs.body);
			expect(body).not.toHaveProperty('message_thread_id');
		});

		it('should include message_thread_id when topicId is provided', async () => {
			const mockResponse = {
				ok: true,
				json: vi.fn().mockResolvedValue({}),
			};
			mockFetch.mockResolvedValue(mockResponse);

			await sendTelegramMessage('test-token', 'test-chat-id', 'Test message', '42');

			const callArgs = mockFetch.mock.calls[0][1];
			const body = JSON.parse(callArgs.body);
			expect(body.message_thread_id).toBe(42);
		});
	});
});
