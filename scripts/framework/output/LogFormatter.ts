/**
 * Console formatting with ANSI colors
 * Extracted from test-cvd-integration.ts lines 26-55
 */
export class LogFormatter {
	private colors = {
		reset: '\x1b[0m',
		bright: '\x1b[1m',
		red: '\x1b[31m',
		green: '\x1b[32m',
		yellow: '\x1b[33m',
		blue: '\x1b[34m',
		cyan: '\x1b[36m',
		gray: '\x1b[90m',
	};

	/**
	 * Print a major section header with blue === border (80 chars wide)
	 */
	section(title: string): void {
		console.log('\n' + this.colors.bright + this.colors.blue + '='.repeat(80) + this.colors.reset);
		console.log(this.colors.bright + this.colors.blue + '  ' + title + this.colors.reset);
		console.log(this.colors.bright + this.colors.blue + '='.repeat(80) + this.colors.reset + '\n');
	}

	/**
	 * Print a subsection header with cyan --- border (80 chars wide)
	 */
	subsection(title: string): void {
		console.log('\n' + this.colors.cyan + '─'.repeat(80) + this.colors.reset);
		console.log(this.colors.cyan + '  ' + title + this.colors.reset);
		console.log(this.colors.cyan + '─'.repeat(80) + this.colors.reset);
	}

	/**
	 * Print a success message with green color and ✅ prefix
	 */
	success(msg: string): void {
		console.log(this.colors.green + '✅ ' + msg + this.colors.reset);
	}

	/**
	 * Print an error message with red color and ❌ prefix
	 */
	error(msg: string): void {
		console.log(this.colors.red + '❌ ' + msg + this.colors.reset);
	}

	/**
	 * Print a warning message with yellow color and ⚠️ prefix
	 */
	warning(msg: string): void {
		console.log(this.colors.yellow + '⚠️  ' + msg + this.colors.reset);
	}

	/**
	 * Print an info message with gray color and indentation
	 */
	info(msg: string): void {
		console.log(this.colors.gray + '   ' + msg + this.colors.reset);
	}

	/**
	 * Print a key-value detail with gray color and indentation
	 */
	detail(key: string, value: any): void {
		const valueStr = typeof value === 'object' ? JSON.stringify(value) : String(value);
		console.log(this.colors.gray + '   ' + key + ': ' + this.colors.reset + valueStr);
	}

	/**
	 * Print debug message with gray color and 🔍 prefix
	 */
	debug(msg: string): void {
		console.log(this.colors.gray + '🔍 ' + msg + this.colors.reset);
	}

	/**
	 * Print raw message without formatting
	 */
	raw(msg: string): void {
		console.log(msg);
	}

	/**
	 * Print blank line
	 */
	newline(): void {
		console.log();
	}
}
