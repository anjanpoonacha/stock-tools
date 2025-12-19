/**
 * Indicator Registry - Dependency Injection System
 * 
 * Central registry for all chart indicators.
 * Adding a new indicator: Just add it to this registry!
 */

import { IndicatorType, IndicatorConfig } from '@/types/chartSettings';

// ============================================
// Indicator Definition (Plugin Interface)
// ============================================

export interface IndicatorDefinition {
	type: IndicatorType;
	label: string;
	description?: string;
	defaultSettings: Record<string, any>;
	// Future: Add settingsSchema for auto-generating UI
	// settingsSchema?: ZodSchema | JSONSchema;
}

// ============================================
// Indicator Registry (The DI Container)
// ============================================

export const INDICATOR_REGISTRY: Record<IndicatorType, IndicatorDefinition> = {
	price: {
		type: 'price',
		label: 'Price',
		description: 'Candlestick price chart',
		defaultSettings: {},
	},
	volume: {
		type: 'volume',
		label: 'Volume',
		description: 'Volume histogram with optional moving average',
		defaultSettings: {
			showMA: true,
			maLength: 30,
		},
	},
	cvd: {
		type: 'cvd',
		label: 'CVD',
		description: 'Cumulative Volume Delta indicator',
		defaultSettings: {
			anchorPeriod: '3M',
			useCustomPeriod: false,
			customPeriod: '15S',
			useManualInput: false,
			manualPeriod: '',
		},
	},
};

// ============================================
// Helper Functions (DI Utilities)
// ============================================

/**
 * Create a new indicator config with default settings
 */
export function createIndicator(
	type: IndicatorType,
	enabled: boolean = false,
	settingsOverride?: Record<string, any>
): IndicatorConfig {
	const definition = INDICATOR_REGISTRY[type];
	
	return {
		type,
		enabled,
		settings: {
			...definition.defaultSettings,
			...settingsOverride,
		},
	};
}

/**
 * Get all available indicator types
 */
export function getAllIndicatorTypes(): IndicatorType[] {
	return Object.keys(INDICATOR_REGISTRY) as IndicatorType[];
}

/**
 * Get indicator definition
 */
export function getIndicatorDefinition(type: IndicatorType): IndicatorDefinition {
	return INDICATOR_REGISTRY[type];
}

/**
 * Check if an indicator type is registered
 */
export function isValidIndicatorType(type: string): type is IndicatorType {
	return type in INDICATOR_REGISTRY;
}

/**
 * Create a full set of indicators (all types) with specified enabled states
 */
export function createFullIndicatorSet(enabledTypes: IndicatorType[] = []): IndicatorConfig[] {
	return getAllIndicatorTypes().map(type => 
		createIndicator(type, enabledTypes.includes(type))
	);
}
