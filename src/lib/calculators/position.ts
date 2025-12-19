/**
 * Position sizing and risk calculation utilities
 * 
 * Pure functions for calculating position sizes, risk amounts, and position values
 * for trading positions.
 */

/**
 * Calculate position size based on account value and risk parameters
 * 
 * @param accountValue - Total account value in currency
 * @param riskPercent - Percentage of account to risk (e.g., 1 for 1%)
 * @param entryPrice - Entry price per unit
 * @param stopLoss - Stop loss price per unit
 * @returns Number of units to purchase
 * 
 * @example
 * calculatePositionSize(10000, 2, 100, 95) // Returns 40 units
 * // Risk: $200 (2% of $10,000), Risk per unit: $5, Position size: 40 units
 */
export function calculatePositionSize(
	accountValue: number,
	riskPercent: number,
	entryPrice: number,
	stopLoss: number
): number {
	if (accountValue <= 0) {
		throw new Error('Account value must be positive');
	}
	if (riskPercent <= 0 || riskPercent > 100) {
		throw new Error('Risk percent must be between 0 and 100');
	}
	if (entryPrice <= 0) {
		throw new Error('Entry price must be positive');
	}
	if (stopLoss <= 0) {
		throw new Error('Stop loss must be positive');
	}
	if (Math.abs(entryPrice - stopLoss) < 0.000001) {
		throw new Error('Entry price and stop loss cannot be the same');
	}

	const riskAmount = accountValue * (riskPercent / 100);
	const riskPerUnit = Math.abs(entryPrice - stopLoss);
	const positionSize = riskAmount / riskPerUnit;

	return positionSize;
}

/**
 * Calculate total risk amount for a position
 * 
 * @param qty - Quantity of units
 * @param entryPrice - Entry price per unit
 * @param stopLoss - Stop loss price per unit
 * @returns Total risk amount in currency
 * 
 * @example
 * calculateRiskAmount(100, 50, 48) // Returns 200
 * // 100 units × $2 risk per unit = $200 total risk
 */
export function calculateRiskAmount(
	qty: number,
	entryPrice: number,
	stopLoss: number
): number {
	if (qty < 0) {
		throw new Error('Quantity cannot be negative');
	}
	if (entryPrice <= 0) {
		throw new Error('Entry price must be positive');
	}
	if (stopLoss <= 0) {
		throw new Error('Stop loss must be positive');
	}

	const riskPerUnit = Math.abs(entryPrice - stopLoss);
	return qty * riskPerUnit;
}

/**
 * Calculate total position value
 * 
 * @param qty - Quantity of units
 * @param price - Current price per unit
 * @returns Total position value in currency
 * 
 * @example
 * calculatePositionValue(50, 100.50) // Returns 5025
 * // 50 units × $100.50 = $5,025
 */
export function calculatePositionValue(qty: number, price: number): number {
	if (qty < 0) {
		throw new Error('Quantity cannot be negative');
	}
	if (price <= 0) {
		throw new Error('Price must be positive');
	}

	return qty * price;
}
