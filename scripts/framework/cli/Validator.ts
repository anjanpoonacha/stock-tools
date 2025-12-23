/**
 * Validator - Input validation utilities
 * 
 * Provides common validation functions for CLI arguments
 * and user input.
 */
export class Validator {
  /**
   * Validate email format
   * @param email - Email address to validate
   * @returns true if valid email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate required value (not empty/null/undefined)
   * @param value - Value to validate
   * @param name - Name for error message
   * @throws Error if value is empty, null, or undefined
   */
  static validateRequired(value: any, name: string): void {
    if (value === null || value === undefined || value === '') {
      throw new Error(`${name} is required and cannot be empty`);
    }
  }

  /**
   * Validate and parse number
   * @param value - Value to parse as number
   * @param name - Name for error message
   * @returns Parsed number
   * @throws Error if value is not a valid number
   */
  static validateNumber(value: any, name: string): number {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error(`${name} must be a valid number, got: ${value}`);
    }
    return num;
  }

  /**
   * Validate positive number (> 0)
   * @param value - Number to validate
   * @param name - Name for error message
   * @throws Error if value is not positive
   */
  static validatePositive(value: number, name: string): void {
    if (value <= 0) {
      throw new Error(`${name} must be positive, got: ${value}`);
    }
  }
}
