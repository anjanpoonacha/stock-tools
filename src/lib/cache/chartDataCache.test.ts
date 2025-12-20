/**
 * Tests for Chart Data Cache
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
	getCachedChartData,
	setCachedChartData,
	clearChartDataCache,
	getCacheStats
} from './chartDataCache';
import type { ChartDataResponse } from '@/lib/tradingview/types';

describe('chartDataCache', () => {
	beforeEach(() => {
		clearChartDataCache();
	});

	it('should return null for non-existent cache key', () => {
		const result = getCachedChartData('test-key');
		expect(result).toBeNull();
	});

	it('should store and retrieve cached data', () => {
		const mockData: ChartDataResponse = {
			success: true,
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			bars: [],
			metadata: {}
		};

		setCachedChartData('test-key', mockData);
		const result = getCachedChartData('test-key');
		
		expect(result).toEqual(mockData);
	});

	it('should return null for expired cache entry', async () => {
		const mockData: ChartDataResponse = {
			success: true,
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			bars: [],
			metadata: {}
		};

		// Mock Date.now to simulate time passing
		const originalDateNow = Date.now;
		let currentTime = Date.now();
		
		Date.now = () => currentTime;
		
		setCachedChartData('test-key', mockData);
		
		// Fast-forward 6 minutes (past TTL of 5 minutes)
		currentTime += 6 * 60 * 1000;
		
		const result = getCachedChartData('test-key');
		
		// Restore original Date.now
		Date.now = originalDateNow;
		
		expect(result).toBeNull();
	});

	it('should clear all cached data', () => {
		const mockData: ChartDataResponse = {
			success: true,
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			bars: [],
			metadata: {}
		};

		setCachedChartData('key1', mockData);
		setCachedChartData('key2', mockData);
		
		clearChartDataCache();
		
		expect(getCachedChartData('key1')).toBeNull();
		expect(getCachedChartData('key2')).toBeNull();
	});

	it('should return correct cache statistics', () => {
		const mockData: ChartDataResponse = {
			success: true,
			symbol: 'NSE:RELIANCE',
			resolution: '1D',
			bars: [],
			metadata: {}
		};

		setCachedChartData('key1', mockData);
		setCachedChartData('key2', mockData);
		
		const stats = getCacheStats();
		
		expect(stats.size).toBe(2);
		expect(stats.keys).toContain('key1');
		expect(stats.keys).toContain('key2');
	});
});
