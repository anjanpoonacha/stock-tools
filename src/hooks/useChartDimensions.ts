/**
 * useChartDimensions Hook
 * Custom hook to track chart container dimensions using ResizeObserver
 */

import { useEffect, useState, type RefObject } from 'react';

export interface ChartDimensions {
  width: number;
  height: number;
}

/**
 * Track container dimensions using ResizeObserver
 * @param containerRef - Ref to the container element
 * @returns Current dimensions { width, height }
 */
export function useChartDimensions(
  containerRef: RefObject<HTMLElement | null>
): ChartDimensions {
  const [dimensions, setDimensions] = useState<ChartDimensions>({
    width: 0,
    height: 0,
  });

  useEffect(() => {
    if (!containerRef.current) return;

    // Create ResizeObserver to track dimension changes
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setDimensions({ width, height });
      }
    });

    // Start observing
    resizeObserver.observe(containerRef.current);

    // Cleanup on unmount
    return () => resizeObserver.disconnect();
  }, [containerRef]);

  return dimensions;
}
