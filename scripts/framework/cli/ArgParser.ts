/**
 * ArgParser - Command-line argument parser
 * 
 * Supports:
 * - Positional arguments: script.ts arg1 arg2
 * - Flags: --flag or -f
 * - Flag values: --key=value or --key value
 * - Required arguments with validation
 * 
 * @example
 * ```ts
 * const parser = new ArgParser();
 * const name = parser.getRequired(0, 'name');
 * const debug = parser.hasFlag('--debug');
 * const port = parser.getFlag('--port') || '3000';
 * ```
 */
export class ArgParser {
  private args: string[];

  /**
   * @param args - Arguments to parse (defaults to process.argv.slice(2))
   */
  constructor(args = process.argv.slice(2)) {
    this.args = args;
  }

  /**
   * Get positional argument by index
   * @param index - Zero-based index
   * @returns Argument value or undefined
   */
  get(index: number): string | undefined {
    // Filter out flags to get only positional arguments
    const positional = this.args.filter((arg) => !arg.startsWith('-'));
    return positional[index];
  }

  /**
   * Get required positional argument (throws if missing)
   * @param index - Zero-based index
   * @param name - Name for error message
   * @returns Argument value
   * @throws Error if argument is missing
   */
  getRequired(index: number, name: string): string {
    const value = this.get(index);
    if (value === undefined) {
      throw new Error(`Missing required argument: ${name} at position ${index}`);
    }
    return value;
  }

  /**
   * Check if flag exists (--flag or -f)
   * @param flag - Flag to check (e.g., '--debug' or '-d')
   * @returns true if flag exists
   */
  hasFlag(flag: string): boolean {
    // Normalize flag format
    const normalizedFlag = flag.startsWith('-') ? flag : `--${flag}`;
    
    // Check for exact match or short form
    return this.args.some((arg) => {
      // Check exact match
      if (arg === normalizedFlag) return true;
      
      // Check short form (e.g., -d matches --debug)
      if (normalizedFlag.startsWith('--') && arg.startsWith('-') && !arg.startsWith('--')) {
        const shortForm = `-${normalizedFlag.slice(2)[0]}`;
        return arg === shortForm;
      }
      
      return false;
    });
  }

  /**
   * Get flag value (--key=value or --key value)
   * @param flag - Flag to get value for (e.g., '--port')
   * @returns Flag value or undefined
   */
  getFlag(flag: string): string | undefined {
    // Normalize flag format
    const normalizedFlag = flag.startsWith('-') ? flag : `--${flag}`;
    
    for (let i = 0; i < this.args.length; i++) {
      const arg = this.args[i];
      
      // Format: --key=value
      if (arg.startsWith(normalizedFlag + '=')) {
        return arg.split('=')[1];
      }
      
      // Format: --key value
      if (arg === normalizedFlag && i + 1 < this.args.length) {
        const nextArg = this.args[i + 1];
        // Make sure next arg is not another flag
        if (!nextArg.startsWith('-')) {
          return nextArg;
        }
      }
      
      // Check short form (e.g., -p value)
      if (normalizedFlag.startsWith('--') && arg.startsWith('-') && !arg.startsWith('--')) {
        const shortForm = `-${normalizedFlag.slice(2)[0]}`;
        if (arg === shortForm && i + 1 < this.args.length) {
          const nextArg = this.args[i + 1];
          if (!nextArg.startsWith('-')) {
            return nextArg;
          }
        }
      }
    }
    
    return undefined;
  }

  /**
   * Print usage help
   * @param scriptName - Name of the script
   * @param usage - Usage description
   * @param options - Array of option descriptions
   */
  static printUsage(scriptName: string, usage: string, options: string[]): void {
    console.log(`Usage: ${scriptName} ${usage}\n`);
    
    if (options.length > 0) {
      console.log('Options:');
      options.forEach((option) => {
        console.log(`  ${option}`);
      });
      console.log();
    }
  }
}
