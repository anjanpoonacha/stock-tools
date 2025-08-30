/**
 * useStatusBadge Hook
 * 
 * Provides consistent status badge rendering logic and styling
 * across different components.
 */

import { useMemo } from 'react';
import { cn } from '@/lib/utils';
import { getStatusIcon, StatusColors } from '@/lib/iconUtils';
import type { LucideIcon } from 'lucide-react';

export type StatusType = 'online' | 'offline' | 'warning' | 'info' | 'success' | 'error';

interface StatusBadgeConfig {
	variant: 'default' | 'secondary' | 'destructive' | 'outline';
	icon: LucideIcon;
	iconColor: string;
	bgColor: string;
	text: string;
}

export function useStatusBadge(status: StatusType, customText?: string) {
	const config = useMemo((): StatusBadgeConfig => {
		switch (status) {
			case 'online':
			case 'success':
				return {
					variant: 'default',
					icon: getStatusIcon('online'),
					iconColor: StatusColors.online,
					bgColor: 'bg-green-600 dark:bg-green-400',
					text: customText || 'Online',
				};
			case 'warning':
				return {
					variant: 'secondary',
					icon: getStatusIcon('warning'),
					iconColor: StatusColors.warning,
					bgColor: 'bg-yellow-600 dark:bg-yellow-400',
					text: customText || 'Warning',
				};
			case 'offline':
			case 'error':
				return {
					variant: 'destructive',
					icon: getStatusIcon('offline'),
					iconColor: StatusColors.offline,
					bgColor: 'bg-destructive',
					text: customText || 'Offline',
				};
			case 'info':
				return {
					variant: 'outline',
					icon: getStatusIcon('warning'), // Using warning icon for info
					iconColor: StatusColors.info,
					bgColor: 'bg-blue-600 dark:bg-blue-400',
					text: customText || 'Info',
				};
			default:
				return {
					variant: 'secondary',
					icon: getStatusIcon('warning'),
					iconColor: StatusColors.muted,
					bgColor: 'bg-muted',
					text: customText || 'Unknown',
				};
		}
	}, [status, customText]);

	const getStatusDotClass = useMemo(() => {
		return cn('w-2 h-2 rounded-full animate-pulse', config.bgColor);
	}, [config.bgColor]);

	const getIconClass = (size: 'xs' | 'sm' | 'md' = 'sm') => {
		const sizeClasses = {
			xs: 'w-3 h-3',
			sm: 'w-4 h-4',
			md: 'w-5 h-5',
		};
		return cn(sizeClasses[size], config.iconColor);
	};

	return {
		...config,
		getStatusDotClass,
		getIconClass,
	};
}

/**
 * Hook for service status with predefined configurations
 */
export function useServiceStatus(
	serviceName: string,
	status: 'online' | 'offline' | 'warning',
	responseTime?: number
) {
	const badge = useStatusBadge(status);

	const displayText = useMemo(() => {
		switch (status) {
			case 'online':
				return responseTime ? `Active (${responseTime}ms)` : 'Active';
			case 'warning':
				return 'Issues Detected';
			case 'offline':
				return 'No Session';
			default:
				return 'Unknown';
		}
	}, [status, responseTime]);

	const overallStatusText = useMemo(() => {
		switch (status) {
			case 'online':
				return 'All Systems Operational';
			case 'warning':
				return 'Some Issues Detected';
			case 'offline':
				return 'Service Disruption';
			default:
				return 'Status Unknown';
		}
	}, [status]);

	return {
		...badge,
		serviceName,
		displayText,
		overallStatusText,
		responseTime,
	};
}

/**
 * Hook for platform status badges
 */
export function usePlatformStatus(
	platform: string,
	hasSession: boolean,
	sessionAvailable: boolean
) {
	const status: StatusType = sessionAvailable ? 'online' : hasSession ? 'warning' : 'offline';
	const badge = useStatusBadge(status);

	const displayText = useMemo(() => {
		if (sessionAvailable) return 'Active';
		if (hasSession) return 'Session Found';
		return 'No Session';
	}, [hasSession, sessionAvailable]);

	return {
		...badge,
		platform,
		displayText,
		hasSession,
		sessionAvailable,
	};
}
