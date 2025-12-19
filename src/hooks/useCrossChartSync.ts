import { useEffect, useRef } from 'react';
import type { IChartApi, MouseEventParams, Time } from 'lightweight-charts';
import { map1DTo188m, map188mTo1D } from '@/lib/chart/timeframeMapping';

interface UseCrossChartSyncParams {
  chart1: IChartApi | null;  // Main chart (1D timeframe)
  chart2: IChartApi | null;  // Secondary chart (188m timeframe)
  bars1D: Array<{ time: number }>;  // 1D bars for time mapping
  bars188m: Array<{ time: number; values?: number[] }>;  // 188m bars (values optional for compatibility)
  enabled?: boolean;  // Enable/disable sync (default: true)
  rangeSyncEnabled?: boolean;  // Enable/disable range sync (default: true)
}

/**
 * Synchronizes crosshair and scroll/zoom behavior between two chart instances with different timeframes.
 * 
 * This hook establishes a bidirectional sync between a 1D chart and a 188m chart, handling:
 * - Crosshair position mapping between timeframes
 * - Scroll and zoom synchronization
 * - Circular update prevention to avoid infinite loops
 * 
 * **Circular Prevention Pattern**:
 * Uses ref flags to track which chart initiated an update. When chart1 updates chart2,
 * the `isUpdatingFromChart1` flag prevents chart2's listener from updating chart1 back.
 * The flag is cleared after 50ms to allow subsequent user interactions.
 * 
 * @example
 * ```tsx
 * const chart1 = useChartInstance();
 * const chart2 = useChartInstance();
 * 
 * useCrossChartSync({
 *   chart1,
 *   chart2,
 *   bars1D: dailyBars,
 *   bars188m: cvdBars,
 *   enabled: true
 * });
 * ```
 */
export function useCrossChartSync(params: UseCrossChartSyncParams): void {
  const { chart1, chart2, bars1D, bars188m, enabled = true, rangeSyncEnabled = true } = params;

  // Refs for circular update prevention
  const isUpdatingFromChart1 = useRef(false);
  const isUpdatingFromChart2 = useRef(false);
  const timeoutRefs = useRef<NodeJS.Timeout[]>([]);
  const hasLoggedWarning = useRef(false);
  const lastLoggedTime = useRef<number>(0);

  useEffect(() => {
    // Early exit if sync is disabled or charts are not ready
    if (!enabled || !chart1 || !chart2) {
      return;
    }

    // Early exit if data is missing
    if (!bars1D?.length || !bars188m?.length) {
      return;
    }

    // Crosshair sync: Chart1 -> Chart2
    const handleChart1CrosshairMove = (param: MouseEventParams) => {
      // Skip if this update came from chart2 to prevent circular updates
      if (isUpdatingFromChart2.current) {
        return;
      }

      try {
        if (param.time && param.point) {
          const time1D = typeof param.time === 'number' ? param.time : Number(param.time);

          // Get price from the first series data
          let price: any = param.point.y;
          if (param.seriesData && param.seriesData.size > 0) {
            const firstSeriesData = param.seriesData.values().next().value;
            if (firstSeriesData && 'close' in firstSeriesData) {
              price = firstSeriesData.close;
            } else if (firstSeriesData && 'value' in firstSeriesData) {
              price = firstSeriesData.value;
            }
          }

          // Sync crosshair to chart2
          const targetTime = time1D;

          // Set flag to prevent circular update
          isUpdatingFromChart1.current = true;

          // Get series from chart2 using the panes API
          const panes = chart2.panes();
          if (panes.length > 0) {
            const series = panes[0].getSeries();
            if (series.length > 0) {
              chart2.setCrosshairPosition(price as any, targetTime as Time, series[0]);
            } else {
              console.warn('[Cursor Sync] ❌ No series found on Chart2');
            }
          } else {
            console.warn('[Cursor Sync] ❌ No panes found on Chart2');
          }

          // Clear flag after short delay
          const timeout = setTimeout(() => {
            isUpdatingFromChart1.current = false;
          }, 50);
          timeoutRefs.current.push(timeout);
        } else if (!param.point) {
          // Crosshair left the chart - clear on chart2
          isUpdatingFromChart1.current = true;
          chart2.clearCrosshairPosition();
          const timeout = setTimeout(() => {
            isUpdatingFromChart1.current = false;
          }, 50);
          timeoutRefs.current.push(timeout);
        }
      } catch (error) {
        console.error('[Cursor Sync] Error Chart1 -> Chart2:', error);
      }
    };

    // Crosshair sync: Chart2 -> Chart1
    const handleChart2CrosshairMove = (param: MouseEventParams) => {
      // Skip if this update came from chart1 to prevent circular updates
      if (isUpdatingFromChart1.current) {
        return;
      }

      try {
        if (param.time && param.point) {
          const time2 = typeof param.time === 'number' ? param.time : Number(param.time);

          // Get price from the first series data
          let price: any = param.point.y;
          if (param.seriesData && param.seriesData.size > 0) {
            const firstSeriesData = param.seriesData.values().next().value;
            if (firstSeriesData && 'close' in firstSeriesData) {
              price = firstSeriesData.close;
            } else if (firstSeriesData && 'value' in firstSeriesData) {
              price = firstSeriesData.value;
            }
          }

          // Since both charts have the same timeframe, just sync directly
          const targetTime = time2;

          // Set flag to prevent circular update
          isUpdatingFromChart2.current = true;

          // Get series from chart1 using the panes API
          const panes = chart1.panes();
          if (panes.length > 0) {
            const series = panes[0].getSeries();
            if (series.length > 0) {
              chart1.setCrosshairPosition(price as any, targetTime as Time, series[0]);
            } else {
              console.warn('[Cursor Sync] ❌ No series found on Chart1');
            }
          } else {
            console.warn('[Cursor Sync] ❌ No panes found on Chart1');
          }

          // Clear flag after short delay
          const timeout = setTimeout(() => {
            isUpdatingFromChart2.current = false;
          }, 50);
          timeoutRefs.current.push(timeout);
        } else if (!param.point) {
          // Crosshair left the chart - clear on chart1
          isUpdatingFromChart2.current = true;
          chart1.clearCrosshairPosition();
          const timeout = setTimeout(() => {
            isUpdatingFromChart2.current = false;
          }, 50);
          timeoutRefs.current.push(timeout);
        }
      } catch (error) {
        console.error('[Cursor Sync] Error Chart2 -> Chart1:', error);
      }
    };

    // Scroll/Zoom sync: Chart1 -> Chart2
    const handleChart1VisibleRangeChange = () => {
      // Skip if range sync is disabled
      if (!rangeSyncEnabled) return;

      // Skip if this update came from chart2 to prevent circular updates
      if (isUpdatingFromChart2.current) {
        return;
      }

      try {
        const range = chart1.timeScale().getVisibleRange();
        if (range) {
          // Set flag to prevent circular update
          isUpdatingFromChart1.current = true;

          // Sync visible range to chart2 using official API
          chart2.timeScale().setVisibleRange(range);

          // Clear flag after short delay
          const timeout = setTimeout(() => {
            isUpdatingFromChart1.current = false;
          }, 50);
          timeoutRefs.current.push(timeout);
        }
      } catch (error) {
        console.error('[Range Sync] Error Chart1 -> Chart2:', error);
      }
    };

    // Scroll/Zoom sync: Chart2 -> Chart1
    const handleChart2VisibleRangeChange = () => {
      // Skip if range sync is disabled
      if (!rangeSyncEnabled) return;

      // Skip if this update came from chart1 to prevent circular updates
      if (isUpdatingFromChart1.current) {
        return;
      }

      try {
        const range = chart2.timeScale().getVisibleRange();
        if (range) {
          // Set flag to prevent circular update
          isUpdatingFromChart2.current = true;

          // Sync visible range to chart1 using official API
          chart1.timeScale().setVisibleRange(range);

          // Clear flag after short delay
          const timeout = setTimeout(() => {
            isUpdatingFromChart2.current = false;
          }, 50);
          timeoutRefs.current.push(timeout);
        }
      } catch (error) {
        console.error('[Range Sync] Error Chart2 -> Chart1:', error);
      }
    };

    // Subscribe to crosshair events
    chart1.subscribeCrosshairMove(handleChart1CrosshairMove);
    chart2.subscribeCrosshairMove(handleChart2CrosshairMove);

    // Subscribe to visible range changes
    chart1.timeScale().subscribeVisibleTimeRangeChange(handleChart1VisibleRangeChange);
    chart2.timeScale().subscribeVisibleTimeRangeChange(handleChart2VisibleRangeChange);

    // Cleanup function
    return () => {
      // Unsubscribe from all events
      try {
        chart1.unsubscribeCrosshairMove(handleChart1CrosshairMove);
        chart2.unsubscribeCrosshairMove(handleChart2CrosshairMove);
        chart1.timeScale().unsubscribeVisibleTimeRangeChange(handleChart1VisibleRangeChange);
        chart2.timeScale().unsubscribeVisibleTimeRangeChange(handleChart2VisibleRangeChange);
      } catch (error) {
        console.error('[Cursor Sync] Cleanup error:', error);
      }

      // Clear all pending timeouts
      timeoutRefs.current.forEach(clearTimeout);
      timeoutRefs.current = [];
    };
  }, [chart1, chart2, bars1D, bars188m, enabled, rangeSyncEnabled]);
}
