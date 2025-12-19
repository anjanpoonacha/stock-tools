/**
 * Multi-Pane Chart Orchestrator Component
 * 
 * Manages multiple synchronized ChartPane instances with coordinated cursor synchronization
 * and pane visibility controls.
 * 
 * Features:
 * - Renders multiple chart panes based on configuration
 * - Coordinates crosshair synchronization across all panes
 * - Manages pane visibility with toggle controls
 * - Vertical stacking layout with responsive design
 * - Error boundary protection for individual panes
 * - Theme-aware styling using shadcn/ui components
 * 
 * @example
 * ```tsx
 * <MultiPaneChart
 *   panes={[
 *     {
 *       id: 'main',
 *       label: 'Primary Chart',
 *       enabled: true,
 *       symbol: 'NSE:RELIANCE',
 *       resolution: '1D',
 *       barsCount: 300,
 *       indicators: [createVolumeIndicator(true)],
 *       height: 500
 *     },
 *     {
 *       id: 'rsi',
 *       label: 'RSI',
 *       enabled: true,
 *       symbol: 'NSE:RELIANCE',
 *       resolution: '1D',
 *       barsCount: 300,
 *       indicators: [createRSIIndicator()],
 *       height: 200
 *     }
 *   ]}
 *   syncCrosshair={true}
 *   onPaneToggle={(paneId, enabled) => console.log(`Pane ${paneId} ${enabled ? 'enabled' : 'disabled'}`)}
 * />
 * ```
 */

'use client';

import React, { useState, useCallback } from 'react';
import type { MouseEventParams } from 'lightweight-charts';
import { ChartPane } from './ChartPane';
import type { MultiPaneChartProps } from './types';
import { useChartCursorSync } from '@/hooks/useChartCursorSync';
import { Switch } from '@/components/ui/switch';

/**
 * Multi-Pane Chart Component
 * 
 * Orchestrates multiple chart panes with synchronized cursors and independent visibility controls.
 */
export function MultiPaneChart({
	panes,
	onPaneToggle,
	syncTimeRange = true, // Future feature for time range synchronization
	syncCrosshair = true,
}: MultiPaneChartProps) {
	// Local state for pane visibility
	const [enabledPanes, setEnabledPanes] = useState<Record<string, boolean>>(() => {
		// Initialize from panes config
		return panes.reduce((acc, pane) => {
			acc[pane.id] = pane.enabled;
			return acc;
		}, {} as Record<string, boolean>);
	});

	// Initialize cursor synchronization hook
	const { handleCrosshairMove, currentCrosshair } = useChartCursorSync();

	/**
	 * Handle pane toggle
	 * Updates local state and calls parent callback if provided
	 */
	const handlePaneToggle = useCallback(
		(paneId: string, enabled: boolean) => {
			setEnabledPanes((prev) => ({
				...prev,
				[paneId]: enabled,
			}));

			// Notify parent component
			onPaneToggle?.(paneId, enabled);
		},
		[onPaneToggle]
	);

	/**
	 * Handle crosshair move from any pane
	 * Routes the event to the sync hook which propagates to all other panes
	 */
	const handleCrosshairMoveFromPane = useCallback(
		(paneId: string, param: MouseEventParams) => {
			// Only sync if syncCrosshair is enabled
			if (!syncCrosshair) {
				return;
			}

			// Extract time and price from MouseEventParams
			if (param.time) {
				handleCrosshairMove(paneId, param);
			}
		},
		[syncCrosshair, handleCrosshairMove]
	);

	/**
	 * Convert current crosshair state to external position format
	 * This is passed to each ChartPane to sync their crosshairs
	 */
	const externalCrosshairPosition = syncCrosshair && currentCrosshair
		? { time: currentCrosshair.time, price: currentCrosshair.price }
		: null;

	return (
		<div className="flex flex-col gap-4 w-full">
			{panes.map((pane, index) => {
				const isEnabled = enabledPanes[pane.id] ?? pane.enabled;

				return (
					<div key={pane.id} className="w-full">
						{/* Pane Header with Toggle Control */}
						<div className="flex items-center justify-between mb-2 px-2">
							<div className="flex items-center gap-3">
								<span className="text-sm font-medium text-foreground">
									{pane.label}
								</span>
								<span className="text-xs text-muted-foreground">
									{pane.symbol} • {pane.resolution}
								</span>
							</div>
							
							<div className="flex items-center gap-2">
								<label 
									htmlFor={`pane-toggle-${pane.id}`}
									className="text-xs text-muted-foreground cursor-pointer select-none"
								>
									{isEnabled ? 'Enabled' : 'Disabled'}
								</label>
								<Switch
									id={`pane-toggle-${pane.id}`}
									checked={isEnabled}
									onCheckedChange={(checked) => handlePaneToggle(pane.id, checked)}
									aria-label={`Toggle ${pane.label} pane`}
								/>
							</div>
						</div>

						{/* Render Pane if Enabled */}
						{isEnabled ? (
							<ErrorBoundary paneId={pane.id} paneLabel={pane.label}>
								<ChartPane
									paneId={pane.id}
									symbol={pane.symbol}
									resolution={pane.resolution}
									barsCount={pane.barsCount}
									height={pane.height}
									label={pane.label}
									indicators={pane.indicators}
									onCrosshairMove={handleCrosshairMoveFromPane}
									externalCrosshairPosition={externalCrosshairPosition}
								/>
							</ErrorBoundary>
						) : (
							<div 
								className="border border-dashed border-border rounded-lg bg-muted/20 flex items-center justify-center"
								style={{ height: 100 }}
							>
								<p className="text-sm text-muted-foreground">
									Pane disabled
								</p>
							</div>
						)}

						{/* Separator between panes (except after last pane) */}
						{index < panes.length - 1 && (
							<div className="h-px bg-border/50 mt-4" />
						)}
					</div>
				);
			})}

			{/* No panes message */}
			{panes.length === 0 && (
				<div className="border border-dashed border-border rounded-lg bg-muted/20 p-12 flex items-center justify-center">
					<p className="text-sm text-muted-foreground">
						No chart panes configured
					</p>
				</div>
			)}

			{/* Debug info (only in development) */}
			{process.env.NODE_ENV === 'development' && currentCrosshair && (
				<div className="mt-4 p-3 bg-muted/30 rounded-lg border border-border text-xs font-mono">
					<div className="font-semibold mb-1 text-foreground">Sync Debug Info:</div>
					<div className="text-muted-foreground space-y-1">
						<div>Time: {new Date(currentCrosshair.time * 1000).toLocaleString()}</div>
						{currentCrosshair.price && <div>Price: {currentCrosshair.price.toFixed(2)}</div>}
						<div>Enabled Panes: {Object.entries(enabledPanes).filter(([_, enabled]) => enabled).map(([id]) => id).join(', ')}</div>
					</div>
				</div>
			)}
		</div>
	);
}

/**
 * Error Boundary for Individual Panes
 * 
 * Wraps each pane to prevent a single pane's failure from crashing the entire multi-pane chart.
 * If a pane errors, it shows an error message while allowing other panes to continue functioning.
 */
interface ErrorBoundaryProps {
	paneId: string;
	paneLabel: string;
	children: React.ReactNode;
}

interface ErrorBoundaryState {
	hasError: boolean;
	error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
	constructor(props: ErrorBoundaryProps) {
		super(props);
		this.state = { hasError: false, error: null };
	}

	static getDerivedStateFromError(error: Error): ErrorBoundaryState {
		return { hasError: true, error };
	}

	componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
		console.error(`[MultiPaneChart] Error in pane ${this.props.paneId}:`, error, errorInfo);
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="border border-destructive/50 rounded-lg bg-destructive/5 p-6">
					<div className="text-destructive font-semibold mb-2">
						Error in {this.props.paneLabel}
					</div>
					<p className="text-destructive/80 text-sm mb-3">
						{this.state.error?.message || 'An unknown error occurred'}
					</p>
					<button
						onClick={() => this.setState({ hasError: false, error: null })}
						className="text-xs px-3 py-1.5 bg-destructive text-destructive-foreground rounded hover:bg-destructive/90 transition-colors"
					>
						Try Again
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}
