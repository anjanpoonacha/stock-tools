/**
 * Assertion Helpers
 * 
 * Simple assertion utilities for test framework.
 */

/**
 * Custom assertion error
 */
export class AssertionError extends Error {
	constructor(message: string, public expected?: any, public actual?: any) {
		super(message);
		this.name = 'AssertionError';
	}
}

/**
 * Assert that two values are equal
 */
export function assertEqual<T>(actual: T, expected: T, message?: string): void {
	if (actual !== expected) {
		const errorMessage = message || `Expected ${expected}, got ${actual}`;
		throw new AssertionError(errorMessage, expected, actual);
	}
}

/**
 * Assert that two values are deeply equal (for objects/arrays)
 */
export function assertDeepEqual(actual: any, expected: any, message?: string): void {
	const actualStr = JSON.stringify(actual);
	const expectedStr = JSON.stringify(expected);
	
	if (actualStr !== expectedStr) {
		const errorMessage = message || `Expected ${expectedStr}, got ${actualStr}`;
		throw new AssertionError(errorMessage, expected, actual);
	}
}

/**
 * Assert that a condition is true
 */
export function assertTrue(condition: boolean, message?: string): void {
	if (!condition) {
		throw new AssertionError(message || 'Expected condition to be true');
	}
}

/**
 * Assert that a condition is false
 */
export function assertFalse(condition: boolean, message?: string): void {
	if (condition) {
		throw new AssertionError(message || 'Expected condition to be false');
	}
}

/**
 * Assert that a value is defined (not null/undefined)
 */
export function assertDefined<T>(value: T | null | undefined, message?: string): asserts value is T {
	if (value === null || value === undefined) {
		throw new AssertionError(message || 'Expected value to be defined');
	}
}

/**
 * Assert that a value is null or undefined
 */
export function assertUndefined(value: any, message?: string): void {
	if (value !== null && value !== undefined) {
		throw new AssertionError(message || 'Expected value to be null or undefined');
	}
}

/**
 * Assert that a function throws an error
 */
export async function assertThrows(
	fn: () => Promise<any> | any,
	expectedError?: string | RegExp,
	message?: string
): Promise<void> {
	let thrown = false;
	let error: Error | undefined;
	
	try {
		await fn();
	} catch (e: any) {
		thrown = true;
		error = e;
	}
	
	if (!thrown) {
		throw new AssertionError(message || 'Expected function to throw an error');
	}
	
	if (expectedError && error) {
		if (typeof expectedError === 'string') {
			if (!error.message.includes(expectedError)) {
				throw new AssertionError(
					`Expected error message to include "${expectedError}", got "${error.message}"`
				);
			}
		} else {
			if (!expectedError.test(error.message)) {
				throw new AssertionError(
					`Expected error message to match ${expectedError}, got "${error.message}"`
				);
			}
		}
	}
}

/**
 * Assert that a value is greater than another
 */
export function assertGreaterThan(actual: number, expected: number, message?: string): void {
	if (actual <= expected) {
		throw new AssertionError(
			message || `Expected ${actual} to be greater than ${expected}`,
			expected,
			actual
		);
	}
}

/**
 * Assert that a value is less than another
 */
export function assertLessThan(actual: number, expected: number, message?: string): void {
	if (actual >= expected) {
		throw new AssertionError(
			message || `Expected ${actual} to be less than ${expected}`,
			expected,
			actual
		);
	}
}

/**
 * Assert that an array contains a value
 */
export function assertContains<T>(array: T[], value: T, message?: string): void {
	if (!array.includes(value)) {
		throw new AssertionError(
			message || `Expected array to contain ${value}`,
			value,
			array
		);
	}
}

/**
 * Assert that an array has a specific length
 */
export function assertLength(array: any[], length: number, message?: string): void {
	if (array.length !== length) {
		throw new AssertionError(
			message || `Expected array length ${length}, got ${array.length}`,
			length,
			array.length
		);
	}
}
