export interface OutputConfig {
	directory: string;
	saveToFile: boolean;
	prettyPrint: boolean;
	logFile?: string;
}

export type LogLevel = 'info' | 'success' | 'error' | 'warning' | 'debug';

export interface LogMessage {
	level: LogLevel;
	message: string;
	timestamp: string;
}
