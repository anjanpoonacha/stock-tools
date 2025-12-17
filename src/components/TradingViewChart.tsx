'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useTheme } from 'next-themes';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, AlertTriangle } from 'lucide-react';

interface TradingViewChartProps {
	symbol?: string;
	interval?: string;
	theme?: 'light' | 'dark';
	height?: number;
	width?: string | number;
	timezone?: string;
}

// Extend Window interface to include TradingView widget
declare global {
	interface Window {
		TradingView?: {
			widget: new (config: Record<string, unknown>) => unknown;
		};
	}
}

export function TradingViewChart({
	symbol = 'NSE:JUNIPER',
	interval = 'D',
	theme,
	height = 600,
	width = '100%',
	timezone = 'Asia/Kolkata',
}: TradingViewChartProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetRef = useRef<unknown>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const { theme: systemTheme } = useTheme();
	const [mounted, setMounted] = useState(false);

	// Use effect for client-side only rendering
	useEffect(() => {
		setMounted(true);
	}, []);

	// Determine theme: use prop if provided, otherwise use system theme
	const effectiveTheme = theme || (systemTheme === 'dark' ? 'dark' : 'light');

	useEffect(() => {
		if (!mounted || !containerRef.current) return;

		const containerId = `tradingview_${Math.random().toString(36).substring(7)}`;
		containerRef.current.id = containerId;

		let scriptElement: HTMLScriptElement | null = null;

		const loadWidget = () => {
			try {
				if (!window.TradingView) {
					throw new Error('TradingView library not loaded');
				}

				// Clear previous widget if exists
				if (containerRef.current) {
					containerRef.current.innerHTML = '';
				}

				// Create new widget
				widgetRef.current = new window.TradingView.widget({
					autosize: true,
					symbol: symbol,
					interval: interval,
					timezone: timezone,
					theme: effectiveTheme,
					style: '1', // Candlestick
					locale: 'en',
					toolbar_bg: effectiveTheme === 'dark' ? '#1e222d' : '#f1f3f6',
					enable_publishing: false,
					allow_symbol_change: true,
					hide_side_toolbar: false,
					save_image: false,
					container_id: containerId,
					studies: [
						'RSI@tv-basicstudies',
						'MACD@tv-basicstudies',
						'MASimple@tv-basicstudies',
					],
					drawings_access: {
						type: 'black',
						tools: [
							{ name: 'Trend Line' },
							{ name: 'Horizontal Line' },
							{ name: 'Vertical Line' },
							{ name: 'Rectangle' },
							{ name: 'Text' },
							{ name: 'Callout' },
							{ name: 'Brush' },
							{ name: 'Highlighter' },
						],
					},
					overrides: {
						// Additional customization can be added here
					},
					disabled_features: [
						'use_localstorage_for_settings',
						'header_symbol_search',
						'header_compare',
					],
					enabled_features: [
						'study_templates',
						'side_toolbar_in_fullscreen_mode',
						'header_in_fullscreen_mode',
					],
				});

				setIsLoading(false);
				setError(null);
			} catch (err) {
				console.error('Error initializing TradingView widget:', err);
				setError(err instanceof Error ? err.message : 'Failed to load chart');
				setIsLoading(false);
			}
		};

		// Check if TradingView is already loaded
		if (window.TradingView) {
			loadWidget();
		} else {
			// Load TradingView script
			scriptElement = document.createElement('script');
			scriptElement.src = 'https://s3.tradingview.com/tv.js';
			scriptElement.async = true;
			scriptElement.onload = () => {
				loadWidget();
			};
			scriptElement.onerror = () => {
				setError('Failed to load TradingView library');
				setIsLoading(false);
			};
			document.head.appendChild(scriptElement);
		}

		// Cleanup
		return () => {
			widgetRef.current = null;
			if (scriptElement && scriptElement.parentNode) {
				scriptElement.parentNode.removeChild(scriptElement);
			}
		};
	}, [mounted, symbol, interval, effectiveTheme, timezone]);

	// Show loading state on server-side render
	if (!mounted) {
		return (
			<div
				style={{
					width: width,
					height: height,
					display: 'flex',
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div style={{ width: width, height: height }}>
			{isLoading && (
				<div
					style={{
						width: '100%',
						height: '100%',
						display: 'flex',
						alignItems: 'center',
						justifyContent: 'center',
						backgroundColor: effectiveTheme === 'dark' ? '#1e222d' : '#f1f3f6',
					}}
				>
					<div className="flex flex-col items-center gap-4">
						<Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Loading TradingView chart...</p>
					</div>
				</div>
			)}

			{error && (
				<Alert variant="destructive">
					<AlertTriangle className="h-4 w-4" />
					<AlertDescription>
						<span className="font-medium">Chart Error:</span> {error}
					</AlertDescription>
				</Alert>
			)}

			<div ref={containerRef} style={{ width: '100%', height: '100%' }} />
		</div>
	);
}
