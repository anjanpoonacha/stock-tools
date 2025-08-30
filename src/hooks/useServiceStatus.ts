'use client';

import { useState, useEffect } from 'react';

interface ServiceStatus {
	name: string;
	status: 'online' | 'offline' | 'warning';
	lastChecked: Date;
	responseTime?: number;
}

type OverallStatus = 'online' | 'warning' | 'offline';

interface UseServiceStatusReturn {
	services: ServiceStatus[];
	overallStatus: OverallStatus;
	getOverallStatusColor: () => string;
	getOverallStatusText: () => string;
}

export function useServiceStatus(): UseServiceStatusReturn {
	const [services, setServices] = useState<ServiceStatus[]>([
		{
			name: 'MarketInOut',
			status: 'online',
			lastChecked: new Date(),
			responseTime: 245,
		},
		{
			name: 'TradingView',
			status: 'online',
			lastChecked: new Date(),
			responseTime: 180,
		},
		{
			name: 'Session Store',
			status: 'online',
			lastChecked: new Date(),
			responseTime: 95,
		},
		{
			name: 'Extension',
			status: 'warning',
			lastChecked: new Date(Date.now() - 30000), // 30 seconds ago
		},
	]);

	const [overallStatus, setOverallStatus] = useState<OverallStatus>('online');

	// Determine overall status based on individual services
	useEffect(() => {
		const hasOffline = services.some((s) => s.status === 'offline');
		const hasWarning = services.some((s) => s.status === 'warning');

		if (hasOffline) {
			setOverallStatus('offline');
		} else if (hasWarning) {
			setOverallStatus('warning');
		} else {
			setOverallStatus('online');
		}
	}, [services]);

	// Simulate periodic status checks
	useEffect(() => {
		const interval = setInterval(() => {
			setServices((prev) =>
				prev.map((service) => ({
					...service,
					lastChecked: new Date(),
					responseTime: service.responseTime ? Math.floor(Math.random() * 100) + 150 : undefined,
				}))
			);
		}, 30000); // Check every 30 seconds

		return () => clearInterval(interval);
	}, []);

	const getOverallStatusColor = () => {
		switch (overallStatus) {
			case 'online':
				return 'bg-green-600 dark:bg-green-400';
			case 'warning':
				return 'bg-yellow-600 dark:bg-yellow-400';
			case 'offline':
				return 'bg-destructive';
		}
	};

	const getOverallStatusText = () => {
		switch (overallStatus) {
			case 'online':
				return 'All Systems Operational';
			case 'warning':
				return 'Some Issues Detected';
			case 'offline':
				return 'Service Disruption';
		}
	};

	return {
		services,
		overallStatus,
		getOverallStatusColor,
		getOverallStatusText,
	};
}
