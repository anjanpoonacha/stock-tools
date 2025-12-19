import { useCallback, useRef, useState } from 'react';
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts';

/**
 * Return type for the useChartCursorSync hook
 */
export interface UseChartCursorSyncReturn {
  /** Register a chart instance for cursor synchronization */
  registerChart: (paneId: string, chart: IChartApi) => void;
  /** Unregister a chart instance from cursor synchronization */
  unregisterChart: (paneId: string) => void;
  /** Handle crosshair movement from a source chart */
  handleCrosshairMove: (sourcePaneId: string, param: MouseEventParams) => void;
  /** Current crosshair state across all synchronized charts */
  currentCrosshair: { time: number; price?: number } | null;
}

/**
 * Hook for synchronizing cursor/crosshair position across multiple chart instances.
 * 
 * This hook maintains a registry of chart instances and propagates crosshair movements
 * from one chart to all others, creating a synchronized cursor experience across
 * multiple chart panes.
 * 
 * ## Sync Mechanism
 * 
 * 1. **Registration Phase**: Charts register themselves with a unique paneId
 * 2. **Event Handling**: When a chart's crosshair moves, it calls handleCrosshairMove
 * 3. **Propagation**: The hook updates all OTHER charts (excluding source) with the new position
 * 4. **State Update**: Current crosshair state is maintained for external consumers
 * 
 * ## Usage Example
 * 
 * ```typescript
 * const { registerChart, unregisterChart, handleCrosshairMove } = useChartCursorSync();
 * 
 * // In chart component
 * useEffect(() => {
 *   if (chartRef.current) {
 *     registerChart('pane-1', chartRef.current);
 *     
 *     chartRef.current.subscribeCrosshairMove((param) => {
 *       handleCrosshairMove('pane-1', param);
 *     });
 *     
 *     return () => unregisterChart('pane-1');
 *   }
 * }, []);
 * ```
 * 
 * ## Performance Considerations
 * 
 * - All callbacks are memoized with useCallback for stability
 * - Chart registry uses useRef to avoid unnecessary re-renders
 * - Synchronization only occurs when crosshair is active (param.point exists)
 * - Invalid time values are filtered out to prevent errors
 * 
 * @returns {UseChartCursorSyncReturn} Methods and state for cursor synchronization
 */
export function useChartCursorSync(): UseChartCursorSyncReturn {
  // Registry of chart instances, keyed by paneId
  // Using useRef to avoid re-renders when charts are added/removed
  const chartRegistryRef = useRef<Map<string, IChartApi>>(new Map());

  // Current crosshair state for external consumers
  const [currentCrosshair, setCurrentCrosshair] = useState<{
    time: number;
    price?: number;
  } | null>(null);

  /**
   * Register a chart instance for cursor synchronization.
   * 
   * Adds the chart to the internal registry so it can receive crosshair updates
   * from other charts.
   * 
   * @param paneId - Unique identifier for the chart pane
   * @param chart - The lightweight-charts IChartApi instance
   */
  const registerChart = useCallback((paneId: string, chart: IChartApi) => {
    if (!chart) {
      console.warn(`[useChartCursorSync] Cannot register chart for pane ${paneId}: chart is null or undefined`);
      return;
    }

    chartRegistryRef.current.set(paneId, chart);
  }, []);

  /**
   * Unregister a chart instance from cursor synchronization.
   * 
   * Removes the chart from the internal registry. Should be called during cleanup
   * to prevent memory leaks and synchronization to unmounted charts.
   * 
   * @param paneId - Unique identifier for the chart pane to unregister
   */
  const unregisterChart = useCallback((paneId: string) => {
    chartRegistryRef.current.delete(paneId);
  }, []);

  /**
   * Handle crosshair movement from a source chart.
   * 
   * When a user moves their cursor over one chart, this function:
   * 1. Validates the crosshair position data
   * 2. Updates the current crosshair state
   * 3. Propagates the position to all OTHER registered charts (excluding source)
   * 
   * ## Edge Cases Handled:
   * - Invalid or missing time values are ignored
   * - Charts that are not ready or have been destroyed are skipped
   * - Source chart is excluded from propagation to avoid circular updates
   * - When crosshair leaves the chart (no point), state is cleared
   * 
   * @param sourcePaneId - The paneId of the chart where the crosshair moved
   * @param param - MouseEventParams from lightweight-charts crosshairMove event
   */
  const handleCrosshairMove = useCallback(
    (sourcePaneId: string, param: MouseEventParams) => {
      // If the crosshair is not active (user moved cursor outside chart), clear state
      if (!param.point || !param.time) {
        setCurrentCrosshair(null);
        return;
      }

      // Extract time value (can be number or string in lightweight-charts)
      const time = param.time;
      if (time === null || time === undefined) {
        return;
      }
      
      // Convert to number for state storage
      const timeValue = typeof time === 'number' ? time : Number(time);
      if (!isFinite(timeValue)) {
        return;
      }

      // Extract price from seriesData if available
      // This is useful for multi-series charts where we want to show the price
      let price: number | undefined;
      if (param.seriesData && param.seriesData.size > 0) {
        // Get the first series' value as the reference price
        const firstSeriesData = param.seriesData.values().next().value;
        if (firstSeriesData && 'value' in firstSeriesData) {
          price = firstSeriesData.value as number;
        } else if (firstSeriesData && 'close' in firstSeriesData) {
          // For candlestick data
          price = firstSeriesData.close as number;
        }
      }

      // Update current crosshair state for external consumers
      setCurrentCrosshair({ time: timeValue, price });

      // Propagate crosshair position to all other charts (not the source)
      chartRegistryRef.current.forEach((chart, paneId) => {
        // Skip the source chart to avoid circular updates
        if (paneId === sourcePaneId) {
          return;
        }

        try {
          // Check if the chart is still valid and has the setCrosshairPosition method
          // Note: setCrosshairPosition is available in lightweight-charts v4.0+
          if (chart && typeof chart.setCrosshairPosition === 'function') {
            // Set crosshair position at the synchronized time
            // Pass null for seriesApi to position on the time scale
            // Pass price if available for better visual alignment
            chart.setCrosshairPosition(price ?? 0, time, null as any);
          } else if (chart && typeof chart.timeScale === 'function') {
            // Fallback: If setCrosshairPosition is not available, we can't directly
            // set the crosshair, but we can at least ensure the time scale is aligned
            // This is a limitation of older lightweight-charts versions
            console.debug(
              `[useChartCursorSync] Chart ${paneId} does not support setCrosshairPosition`
            );
          }
        } catch (error) {
          // Catch errors from destroyed or invalid chart instances
          console.error(
            `[useChartCursorSync] Error syncing crosshair to chart ${paneId}:`,
            error
          );
          // Optionally, unregister the chart if it's causing errors
          chartRegistryRef.current.delete(paneId);
        }
      });
    },
    []
  );

  return {
    registerChart,
    unregisterChart,
    handleCrosshairMove,
    currentCrosshair,
  };
}
