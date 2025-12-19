/**
 * Tests for useChartCursorSync Hook
 * 
 * Comprehensive test suite for the cursor synchronization hook that manages
 * crosshair coordination across multiple chart instances.
 * 
 * Test Coverage:
 * - Chart registration and unregistration
 * - Crosshair position synchronization
 * - Edge case handling (null values, circular updates)
 * - State management
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useChartCursorSync } from '@/hooks/useChartCursorSync';
import type { IChartApi, MouseEventParams } from 'lightweight-charts';

/**
 * Creates a mock IChartApi instance for testing
 * @returns Mock chart API with jest.fn() implementations
 */
function createMockChart(): IChartApi {
	return {
		setCrosshairPosition: vi.fn(),
		timeScale: vi.fn(() => ({
			scrollToPosition: vi.fn(),
			fitContent: vi.fn(),
		})),
		remove: vi.fn(),
		resize: vi.fn(),
		applyOptions: vi.fn(),
	} as unknown as IChartApi;
}

/**
 * Creates a mock MouseEventParams for testing crosshair events
 * @param time - Unix timestamp for the crosshair position
 * @param price - Optional price value
 * @param hasPoint - Whether the crosshair has an active point
 * @returns Mock MouseEventParams object
 */
function createMockMouseEvent(
	time: number | null,
	price?: number,
	hasPoint = true
): MouseEventParams {
	const mockEvent: MouseEventParams = {
		time: time as any,
		point: hasPoint ? { x: 100, y: 100 } : undefined,
		seriesData: new Map(),
	} as MouseEventParams;

	// Add series data if price is provided
	if (price !== undefined && hasPoint) {
		mockEvent.seriesData = new Map([
			['series1', { value: price, time: time as any }],
		]);
	}

	return mockEvent;
}

describe('useChartCursorSync', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe('Registration Tests', () => {
		/**
		 * Test: Should successfully register a chart with a paneId
		 * 
		 * Verifies that the hook can register a chart instance and store it
		 * in the internal registry for future synchronization operations.
		 */
		it('should register a chart with paneId', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			// Verify registration by triggering a crosshair move and checking
			// if the chart receives the setCrosshairPosition call
			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent);
			});

			// The registered chart should receive the crosshair position update
			expect(mockChart.setCrosshairPosition).toHaveBeenCalledWith(
				100,
				1234567890,
				null
			);
		});

		/**
		 * Test: Should successfully unregister a chart
		 * 
		 * Verifies that unregistering a chart removes it from the registry
		 * and prevents it from receiving further crosshair updates.
		 */
		it('should unregister a chart', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			// Register and then unregister
			act(() => {
				result.current.registerChart('pane-1', mockChart);
				result.current.unregisterChart('pane-1');
			});

			// Trigger crosshair move
			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent);
			});

			// The unregistered chart should NOT receive any updates
			expect(mockChart.setCrosshairPosition).not.toHaveBeenCalled();
		});

		/**
		 * Test: Should handle registering multiple charts
		 * 
		 * Verifies that multiple charts can be registered simultaneously
		 * and all receive synchronized crosshair updates.
		 */
		it('should handle registering multiple charts', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart1 = createMockChart();
			const mockChart2 = createMockChart();
			const mockChart3 = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart1);
				result.current.registerChart('pane-2', mockChart2);
				result.current.registerChart('pane-3', mockChart3);
			});

			// Trigger crosshair move from pane-1
			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-1', mockEvent);
			});

			// All charts EXCEPT the source (pane-1) should receive updates
			expect(mockChart1.setCrosshairPosition).not.toHaveBeenCalled(); // Source chart
			expect(mockChart2.setCrosshairPosition).toHaveBeenCalledWith(100, 1234567890, null);
			expect(mockChart3.setCrosshairPosition).toHaveBeenCalledWith(100, 1234567890, null);
		});

		/**
		 * Test: Should handle null/undefined chart gracefully
		 * 
		 * Verifies that attempting to register a null or undefined chart
		 * doesn't crash and logs appropriate warnings.
		 */
		it('should handle null/undefined chart gracefully', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			act(() => {
				result.current.registerChart('pane-1', null as any);
				result.current.registerChart('pane-2', undefined as any);
			});

			// Should have logged warnings
			expect(consoleSpy).toHaveBeenCalledTimes(2);
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('Cannot register chart')
			);

			consoleSpy.mockRestore();
		});
	});

	describe('Synchronization Tests', () => {
		/**
		 * Test: Should propagate crosshair to all registered charts except source
		 * 
		 * Verifies the core synchronization behavior: when a crosshair moves
		 * on one chart, all other charts are updated, but not the source.
		 */
		it('should propagate crosshair to all registered charts except source', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart1 = createMockChart();
			const mockChart2 = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart1);
				result.current.registerChart('pane-2', mockChart2);
			});

			const mockEvent = createMockMouseEvent(1234567890, 150.5);
			
			act(() => {
				result.current.handleCrosshairMove('pane-1', mockEvent);
			});

			// Source chart (pane-1) should NOT be updated
			expect(mockChart1.setCrosshairPosition).not.toHaveBeenCalled();
			
			// Other chart (pane-2) should be updated with correct values
			expect(mockChart2.setCrosshairPosition).toHaveBeenCalledWith(
				150.5,
				1234567890,
				null
			);
		});

		/**
		 * Test: Should extract time and price from MouseEventParams
		 * 
		 * Verifies that the hook correctly extracts time and price data
		 * from the lightweight-charts MouseEventParams structure.
		 */
		it('should extract time and price from MouseEventParams', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			// Test with price in seriesData.value
			const mockEvent1 = createMockMouseEvent(1234567890, 200);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent1);
			});

			expect(mockChart.setCrosshairPosition).toHaveBeenCalledWith(
				200,
				1234567890,
				null
			);

			vi.clearAllMocks();

			// Test with candlestick data (close price)
			const mockEvent2: MouseEventParams = {
				time: 1234567890 as any,
				point: { x: 100, y: 100 },
				seriesData: new Map([
					['series1', { close: 300, open: 290, high: 310, low: 285, time: 1234567890 as any }],
				]),
			} as MouseEventParams;
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent2);
			});

			expect(mockChart.setCrosshairPosition).toHaveBeenCalledWith(
				300,
				1234567890,
				null
			);
		});

		/**
		 * Test: Should update currentCrosshair state
		 * 
		 * Verifies that the hook maintains internal state tracking
		 * the current crosshair position for external consumers.
		 */
		it('should update currentCrosshair state', () => {
			const { result } = renderHook(() => useChartCursorSync());

			// Initially, currentCrosshair should be null
			expect(result.current.currentCrosshair).toBeNull();

			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-1', mockEvent);
			});

			// Should update to the new crosshair position
			expect(result.current.currentCrosshair).toEqual({
				time: 1234567890,
				price: 100,
			});
		});

		/**
		 * Test: Should handle null/undefined parameters gracefully
		 * 
		 * Verifies that the hook handles edge cases where MouseEventParams
		 * contains null or undefined values without crashing.
		 */
		it('should handle null/undefined parameters gracefully', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			// Test with no point (crosshair left the chart)
			const mockEvent1 = createMockMouseEvent(null, undefined, false);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent1);
			});

			// Should clear currentCrosshair state
			expect(result.current.currentCrosshair).toBeNull();
			expect(mockChart.setCrosshairPosition).not.toHaveBeenCalled();

			// Test with null time
			const mockEvent2 = createMockMouseEvent(null, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent2);
			});

			expect(mockChart.setCrosshairPosition).not.toHaveBeenCalled();

			// Test with invalid time (NaN)
			const mockEvent3: MouseEventParams = {
				time: 'invalid' as any,
				point: { x: 100, y: 100 },
				seriesData: new Map(),
			} as MouseEventParams;
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent3);
			});

			expect(mockChart.setCrosshairPosition).not.toHaveBeenCalled();
		});

		/**
		 * Test: Should handle chart without setCrosshairPosition method
		 * 
		 * Verifies fallback behavior for older versions of lightweight-charts
		 * that don't support setCrosshairPosition.
		 */
		it('should handle chart without setCrosshairPosition method', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const consoleSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

			// Create chart without setCrosshairPosition
			const mockChart = {
				timeScale: vi.fn(() => ({})),
			} as unknown as IChartApi;

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent);
			});

			// Should log a debug message about missing method
			expect(consoleSpy).toHaveBeenCalledWith(
				expect.stringContaining('does not support setCrosshairPosition')
			);

			consoleSpy.mockRestore();
		});

		/**
		 * Test: Should handle errors from destroyed chart instances
		 * 
		 * Verifies that errors from destroyed or invalid chart instances
		 * are caught and the chart is automatically unregistered.
		 */
		it('should handle errors from destroyed chart instances', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

			// Create chart that throws error on setCrosshairPosition
			const mockChart = {
				setCrosshairPosition: vi.fn(() => {
					throw new Error('Chart has been destroyed');
				}),
			} as unknown as IChartApi;

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent);
			});

			// Should log error
			expect(consoleErrorSpy).toHaveBeenCalledWith(
				expect.stringContaining('Error syncing crosshair'),
				expect.any(Error)
			);

			// Should auto-unregister the problematic chart
			// Subsequent calls should not attempt to update it
			vi.clearAllMocks();
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent);
			});

			expect(mockChart.setCrosshairPosition).not.toHaveBeenCalled();

			consoleErrorSpy.mockRestore();
		});
	});

	describe('Edge Cases', () => {
		/**
		 * Test: Should not propagate to source pane
		 * 
		 * Verifies that the source pane (where the crosshair originated)
		 * never receives its own crosshair update to prevent circular updates.
		 */
		it('should not propagate to source pane', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const sourceChart = createMockChart();
			const otherChart = createMockChart();

			act(() => {
				result.current.registerChart('source-pane', sourceChart);
				result.current.registerChart('other-pane', otherChart);
			});

			const mockEvent = createMockMouseEvent(1234567890, 100);
			
			act(() => {
				result.current.handleCrosshairMove('source-pane', mockEvent);
			});

			// Source chart should NOT be updated
			expect(sourceChart.setCrosshairPosition).not.toHaveBeenCalled();
			
			// Other chart should be updated
			expect(otherChart.setCrosshairPosition).toHaveBeenCalled();
		});

		/**
		 * Test: Should handle unregistering non-existent chart
		 * 
		 * Verifies that attempting to unregister a chart that was never
		 * registered or already unregistered doesn't cause errors.
		 */
		it('should handle unregistering non-existent chart', () => {
			const { result } = renderHook(() => useChartCursorSync());

			// Should not throw error
			expect(() => {
				act(() => {
					result.current.unregisterChart('non-existent-pane');
				});
			}).not.toThrow();
		});

		/**
		 * Test: Should clean up on unmount
		 * 
		 * Verifies that when the hook is unmounted, it properly cleans up
		 * and doesn't attempt operations on unmounted charts.
		 */
		it('should clean up on unmount', () => {
			const { result, unmount } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			// Unmount the hook
			unmount();

			// Should not throw errors or cause issues
			expect(() => unmount()).not.toThrow();
		});

		/**
		 * Test: Should handle rapid consecutive crosshair moves
		 * 
		 * Verifies that the hook can handle rapid consecutive crosshair
		 * updates without performance issues or state corruption.
		 */
		it('should handle rapid consecutive crosshair moves', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			// Simulate rapid mouse movements
			act(() => {
				for (let i = 0; i < 100; i++) {
					const mockEvent = createMockMouseEvent(1234567890 + i, 100 + i);
					result.current.handleCrosshairMove('pane-2', mockEvent);
				}
			});

			// Should have processed all updates
			expect(mockChart.setCrosshairPosition).toHaveBeenCalledTimes(100);
			
			// Final state should reflect last update
			expect(result.current.currentCrosshair).toEqual({
				time: 1234567989,
				price: 199,
			});
		});

		/**
		 * Test: Should handle price without series data
		 * 
		 * Verifies that when no series data is available, the hook
		 * still propagates time-based crosshair updates.
		 */
		it('should handle price without series data', () => {
			const { result } = renderHook(() => useChartCursorSync());
			const mockChart = createMockChart();

			act(() => {
				result.current.registerChart('pane-1', mockChart);
			});

			// Event with no series data (no price)
			const mockEvent: MouseEventParams = {
				time: 1234567890 as any,
				point: { x: 100, y: 100 },
				seriesData: new Map(),
			} as MouseEventParams;
			
			act(() => {
				result.current.handleCrosshairMove('pane-2', mockEvent);
			});

			// Should still propagate with price = 0 (fallback)
			expect(mockChart.setCrosshairPosition).toHaveBeenCalledWith(
				0,
				1234567890,
				null
			);

			// State should not include price
			expect(result.current.currentCrosshair).toEqual({
				time: 1234567890,
				price: undefined,
			});
		});
	});
});
