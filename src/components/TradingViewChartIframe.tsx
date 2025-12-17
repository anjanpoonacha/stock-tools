'use client';

import React, { useMemo } from 'react';
import { useTheme } from 'next-themes';

interface TradingViewChartIframeProps {
	symbol?: string;
	interval?: string;
	theme?: 'light' | 'dark';
	height?: number;
	width?: string | number;
	timezone?: string;
}

/**
 * TradingView Chart using iframe embed method to avoid CSP issues.
 * This component embeds TradingView's official widget using iframe,
 * which bypasses Content Security Policy restrictions that block inline scripts.
 */
export function TradingViewChartIframe({
	symbol = 'NSE:JUNIPER',
	interval = 'D',
	theme,
	height = 600,
	width = '100%',
	timezone = 'Asia/Kolkata',
}: TradingViewChartIframeProps) {
	const { theme: systemTheme } = useTheme();
	const effectiveTheme = theme || (systemTheme === 'dark' ? 'dark' : 'light');

	// Build TradingView widget URL with all parameters
	const widgetUrl = useMemo(() => {
		const params = new URLSearchParams({
			symbol: symbol,
			interval: interval,
			timezone: timezone,
			theme: effectiveTheme,
			style: '1', // Candlestick
			locale: 'en',
			toolbar_bg: effectiveTheme === 'dark' ? '#1e222d' : '#f1f3f6',
			enable_publishing: 'false',
			allow_symbol_change: 'true',
			save_image: 'false',
			hide_top_toolbar: 'false',
			hide_legend: 'false',
			hide_side_toolbar: 'false',
			studies: 'RSI@tv-basicstudies,MACD@tv-basicstudies,MASimple@tv-basicstudies',
		});

		return `https://www.tradingview.com/embed-widget/advanced-chart/?${params.toString()}`;
	}, [symbol, interval, timezone, effectiveTheme]);

	return (
		<div
			style={{
				width: width,
				height: height,
				position: 'relative',
				overflow: 'hidden',
			}}
		>
			<iframe
				src={widgetUrl}
				style={{
					width: '100%',
					height: '100%',
					border: 'none',
					margin: 0,
					padding: 0,
				}}
				title={`TradingView Chart: ${symbol}`}
				allow="fullscreen"
				loading="lazy"
			/>
		</div>
	);
}
