import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'fs';
import { dirname } from 'path';

/**
 * File operations utilities for writing output files
 */
export class FileWriter {
	/**
	 * Ensure directory exists (create if needed)
	 * Creates parent directories recursively
	 */
	static ensureDirectory(path: string): void {
		try {
			mkdirSync(path, { recursive: true });
		} catch (error) {
			console.error(`Failed to create directory ${path}:`, error);
		}
	}

	/**
	 * Write JSON to file
	 * @param filePath - Absolute path to the file
	 * @param data - Data to serialize as JSON
	 * @param pretty - Whether to pretty-print the JSON (default: false)
	 */
	static writeJSON(filePath: string, data: unknown, pretty = false): void {
		try {
			// Ensure parent directory exists
			const dir = dirname(filePath);
			this.ensureDirectory(dir);

			// Serialize and write
			const json = JSON.stringify(data, null, pretty ? 2 : 0);
			writeFileSync(filePath, json, 'utf-8');
		} catch (error) {
			console.error(`Failed to write JSON to ${filePath}:`, error);
		}
	}

	/**
	 * Append to log file with timestamp
	 * @param filePath - Absolute path to the log file
	 * @param message - Message to append
	 */
	static appendLog(filePath: string, message: string): void {
		try {
			// Ensure parent directory exists
			const dir = dirname(filePath);
			this.ensureDirectory(dir);

			// Format with timestamp
			const timestamp = new Date().toISOString();
			const line = `[${timestamp}] ${message}\n`;

			appendFileSync(filePath, line, 'utf-8');
		} catch (error) {
			console.error(`Failed to append to log ${filePath}:`, error);
		}
	}

	/**
	 * Write plain text to file
	 * @param filePath - Absolute path to the file
	 * @param text - Text content to write
	 */
	static writeText(filePath: string, text: string): void {
		try {
			// Ensure parent directory exists
			const dir = dirname(filePath);
			this.ensureDirectory(dir);

			writeFileSync(filePath, text, 'utf-8');
		} catch (error) {
			console.error(`Failed to write text to ${filePath}:`, error);
		}
	}

	/**
	 * Write CSV from array of objects
	 * @param filePath - Absolute path to the CSV file
	 * @param data - Array of objects to convert to CSV
	 */
	static writeCSV(filePath: string, data: Record<string, any>[]): void {
		try {
			if (data.length === 0) {
				this.writeText(filePath, '');
				return;
			}

			// Extract headers from first object
			const headers = Object.keys(data[0]);
			const headerRow = headers.join(',');

			// Convert rows to CSV
			const rows = data.map((row) => {
				return headers
					.map((header) => {
						const value = row[header];
						// Escape commas and quotes
						if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
							return `"${value.replace(/"/g, '""')}"`;
						}
						return value;
					})
					.join(',');
			});

			const csv = [headerRow, ...rows].join('\n');
			this.writeText(filePath, csv);
		} catch (error) {
			console.error(`Failed to write CSV to ${filePath}:`, error);
		}
	}

	/**
	 * Check if file exists
	 * @param filePath - Path to check
	 * @returns true if file exists
	 */
	static exists(filePath: string): boolean {
		return existsSync(filePath);
	}
}
