import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { cn, regroupTVWatchlist, downloadTextFile } from '@/lib/utils';

describe('Utils', () => {
	describe('cn function', () => {
		it('should merge class names correctly', () => {
			const result = cn('px-2 py-1', 'bg-red-500');
			expect(result).toBe('px-2 py-1 bg-red-500');
		});

		it('should handle conditional classes', () => {
			const result = cn('px-2', true && 'py-1', false && 'bg-red-500');
			expect(result).toBe('px-2 py-1');
		});

		it('should handle conflicting Tailwind classes', () => {
			const result = cn('px-2 px-4', 'py-1 py-2');
			expect(result).toBe('px-4 py-2');
		});

		it('should handle empty inputs', () => {
			const result = cn();
			expect(result).toBe('');
		});

		it('should handle undefined and null values', () => {
			const result = cn('px-2', undefined, null, 'py-1');
			expect(result).toBe('px-2 py-1');
		});
	});

	describe('regroupTVWatchlist function', () => {
		describe('None option', () => {
			it('should remove group headers and return flat list', () => {
				const input = '###Technology,INFY.NS,TCS.NS,###Banking,HDFC.NS,ICICI.NS';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('INFY.NS,TCS.NS,HDFC.NS,ICICI.NS');
			});

			it('should handle input without group headers', () => {
				const input = 'INFY.NS,TCS.NS,HDFC.NS';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('INFY.NS,TCS.NS,HDFC.NS');
			});

			it('should handle empty input', () => {
				const input = '';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('');
			});

			it('should filter out empty symbols', () => {
				const input = '###Tech,INFY.NS,,TCS.NS,';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('INFY.NS,TCS.NS');
			});
		});

		describe('Industry/Sector grouping', () => {
			it('should group symbols by Industry', () => {
				const input = 'RELIANCE.NS,TCS.NS';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('###');
				expect(result).toContain('RELIANCE.NS');
				expect(result).toContain('TCS.NS');
			});

			it('should group symbols by Sector', () => {
				const input = 'RELIANCE.NS,TCS.NS';
				const result = regroupTVWatchlist(input, 'Sector');
				expect(result).toContain('###');
				expect(result).toContain('RELIANCE.NS');
				expect(result).toContain('TCS.NS');
			});

			it('should handle symbols with NSE: prefix', () => {
				const input = 'NSE:RELIANCE,NSE:TCS';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('NSE:RELIANCE');
				expect(result).toContain('NSE:TCS');
			});

			it('should handle symbols with BSE: prefix', () => {
				const input = 'BSE:RELIANCE,BSE:TCS';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('BSE:RELIANCE');
				expect(result).toContain('BSE:TCS');
			});

			it('should handle symbols without .NS suffix', () => {
				const input = 'RELIANCE,TCS';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('RELIANCE');
				expect(result).toContain('TCS');
			});

			it('should put unknown symbols in Other group', () => {
				const input = 'UNKNOWN_SYMBOL.NS';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('###Other');
				expect(result).toContain('UNKNOWN_SYMBOL.NS');
			});

			it('should handle grouped input and regroup', () => {
				const input = '###OldGroup,RELIANCE.NS,TCS.NS';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('RELIANCE.NS');
				expect(result).toContain('TCS.NS');
				expect(result).not.toContain('OldGroup');
			});

			it('should handle mixed grouped and flat input', () => {
				const input = '###Group1,RELIANCE.NS,TCS.NS,HDFC.NS';
				const result = regroupTVWatchlist(input, 'Sector');
				expect(result).toContain('RELIANCE.NS');
				expect(result).toContain('TCS.NS');
				expect(result).toContain('HDFC.NS');
			});

			it('should handle symbols with .BO suffix', () => {
				const input = 'RELIANCE.BO,TCS.BO';
				const result = regroupTVWatchlist(input, 'Industry');
				expect(result).toContain('RELIANCE.BO');
				expect(result).toContain('TCS.BO');
			});
		});

		describe('edge cases', () => {
			it('should handle whitespace in input', () => {
				const input = ' RELIANCE.NS , TCS.NS ';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('RELIANCE.NS,TCS.NS');
			});

			it('should handle multiple consecutive commas', () => {
				const input = 'RELIANCE.NS,,,,TCS.NS';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('RELIANCE.NS,TCS.NS');
			});

			it('should handle input with only commas', () => {
				const input = ',,,';
				const result = regroupTVWatchlist(input, 'None');
				expect(result).toBe('');
			});
		});
	});

	describe('downloadTextFile function', () => {
		let mockCreateElement: ReturnType<typeof vi.fn>;
		let mockCreateObjectURL: ReturnType<typeof vi.fn>;
		let mockRevokeObjectURL: ReturnType<typeof vi.fn>;
		let mockAppendChild: ReturnType<typeof vi.fn>;
		let mockRemoveChild: ReturnType<typeof vi.fn>;
		let mockClick: ReturnType<typeof vi.fn>;
		let mockSetTimeout: ReturnType<typeof vi.fn>;

		beforeEach(() => {
			// Mock DOM methods
			mockClick = vi.fn();
			mockAppendChild = vi.fn();
			mockRemoveChild = vi.fn();
			mockCreateElement = vi.fn(() => ({
				href: '',
				download: '',
				click: mockClick,
			}));

			// Mock URL methods
			mockCreateObjectURL = vi.fn(() => 'blob:mock-url');
			mockRevokeObjectURL = vi.fn();

			// Mock setTimeout
			mockSetTimeout = vi.fn((callback: () => void) => {
				callback();
				return 1;
			});

			// Setup global mocks
			global.document = {
				createElement: mockCreateElement,
				body: {
					appendChild: mockAppendChild,
					removeChild: mockRemoveChild,
				},
			} as unknown as Document;

			global.URL = {
				createObjectURL: mockCreateObjectURL,
				revokeObjectURL: mockRevokeObjectURL,
			} as unknown as typeof URL;

			global.setTimeout = mockSetTimeout as unknown as typeof setTimeout;
			global.Blob = vi.fn() as unknown as typeof Blob;
		});

		afterEach(() => {
			vi.clearAllMocks();
		});

		it('should create and download a text file', () => {
			const text = 'Hello, World!';
			const filename = 'test.txt';

			downloadTextFile(text, filename);

			expect(global.Blob).toHaveBeenCalledWith([text], { type: 'text/plain' });
			expect(mockCreateObjectURL).toHaveBeenCalled();
			expect(mockCreateElement).toHaveBeenCalledWith('a');
			expect(mockAppendChild).toHaveBeenCalled();
			expect(mockClick).toHaveBeenCalled();
			expect(mockSetTimeout).toHaveBeenCalled();
		});

		it('should set correct href and download attributes', () => {
			const text = 'Test content';
			const filename = 'download.txt';
			const mockElement = {
				href: '',
				download: '',
				click: mockClick,
			};
			mockCreateElement.mockReturnValue(mockElement);

			downloadTextFile(text, filename);

			expect(mockElement.href).toBe('blob:mock-url');
			expect(mockElement.download).toBe(filename);
		});

		it('should clean up after download', () => {
			const text = 'Test content';
			const filename = 'test.txt';

			downloadTextFile(text, filename);

			expect(mockSetTimeout).toHaveBeenCalled();
			expect(mockRemoveChild).toHaveBeenCalled();
			expect(mockRevokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
		});

		it('should not do anything if text is empty', () => {
			downloadTextFile('', 'test.txt');

			expect(global.Blob).not.toHaveBeenCalled();
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
			expect(mockCreateElement).not.toHaveBeenCalled();
		});

		it('should not do anything if text is null', () => {
			downloadTextFile(null as unknown as string, 'test.txt');

			expect(global.Blob).not.toHaveBeenCalled();
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
			expect(mockCreateElement).not.toHaveBeenCalled();
		});

		it('should not do anything if text is undefined', () => {
			downloadTextFile(undefined as unknown as string, 'test.txt');

			expect(global.Blob).not.toHaveBeenCalled();
			expect(mockCreateObjectURL).not.toHaveBeenCalled();
			expect(mockCreateElement).not.toHaveBeenCalled();
		});

		it('should handle different file extensions', () => {
			const text = '{"key": "value"}';
			const filename = 'data.json';
			const mockElement = {
				href: '',
				download: '',
				click: mockClick,
			};
			mockCreateElement.mockReturnValue(mockElement);

			downloadTextFile(text, filename);

			expect(mockElement.download).toBe(filename);
		});
	});
});
