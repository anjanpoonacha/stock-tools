import { join } from 'path';
import { LogFormatter } from './LogFormatter';
import { FileWriter } from './FileWriter';
import type { OutputConfig, LogLevel, LogMessage } from './types';

/**
 * Coordinates all output operations (console logging and file writing)
 */
export class OutputManager {
	private logger: LogFormatter;
	private config: OutputConfig;
	private logMessages: LogMessage[] = [];

	constructor(config: OutputConfig) {
		this.config = config;
		this.logger = new LogFormatter();

		// Ensure output directory exists if we're saving to files
		if (config.saveToFile) {
			FileWriter.ensureDirectory(config.directory);
		}
	}

	/**
	 * Save POC result to JSON file
	 * @param filename - Name of the file (e.g., 'result.json')
	 * @param data - Data to save
	 */
	async saveResult<T>(filename: string, data: T): Promise<void> {
		if (!this.config.saveToFile) {
			return;
		}

		const filePath = join(this.config.directory, filename);
		FileWriter.writeJSON(filePath, data, this.config.prettyPrint);
		this.logger.success(`Saved result to ${filePath}`);
	}

	/**
	 * Save CSV data
	 * @param filename - Name of the CSV file (e.g., 'data.csv')
	 * @param data - Array of objects to convert to CSV
	 */
	async saveCSV(filename: string, data: Record<string, any>[]): Promise<void> {
		if (!this.config.saveToFile) {
			return;
		}

		const filePath = join(this.config.directory, filename);
		FileWriter.writeCSV(filePath, data);
		this.logger.info(`Saved CSV to: ${filePath}`);
	}

	/**
	 * Log message to console and optionally to file
	 * @param level - Log level (info, success, error, warning, debug)
	 * @param message - Message to log
	 */
	log(level: LogLevel, message: string): void {
		// Store log message
		this.logMessages.push({
			level,
			message,
			timestamp: new Date().toISOString(),
		});

		// Print to console
		switch (level) {
			case 'info':
				this.logger.info(message);
				break;
			case 'success':
				this.logger.success(message);
				break;
			case 'error':
				this.logger.error(message);
				break;
			case 'warning':
				this.logger.warning(message);
				break;
			case 'debug':
				this.logger.debug(message);
				break;
			default:
				// Ensure exhaustiveness
				const _exhaustive: never = level;
				return _exhaustive;
		}

		// Append to log file if configured
		if (this.config.logFile) {
			FileWriter.appendLog(this.config.logFile, `[${level.toUpperCase()}] ${message}`);
		}
	}

	/**
	 * Get the logger instance for advanced formatting
	 * Use this when you need section(), subsection(), detail(), etc.
	 */
	getLogger(): LogFormatter {
		return this.logger;
	}

	/**
	 * Get the configured output directory
	 */
	getOutputDir(): string {
		return this.config.directory;
	}

	/**
	 * Get all logged messages
	 * @returns Copy of all log messages
	 */
	getLogMessages(): LogMessage[] {
		return [...this.logMessages];
	}

	/**
	 * Save all logged messages to file
	 * @param filename - Name of the log file (default: 'log.json')
	 */
	async saveLogMessages(filename = 'log.json'): Promise<void> {
		if (!this.config.saveToFile) {
			return;
		}
		await this.saveResult(filename, this.logMessages);
	}

	/**
	 * Clear logged messages
	 */
	clearLogs(): void {
		this.logMessages = [];
	}
}
