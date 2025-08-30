/**
 * Icon Utilities
 * 
 * Centralized icon mapping and utility functions for consistent icon usage
 * across the application. Follows project preference for lucide-react icons.
 */

import {
	AlertCircle,
	CheckCircle,
	XCircle,
	RefreshCw,
	Clock,
	ExternalLink,
	Wifi,
	WifiOff,
	Database,
	Globe,
	Activity,
	User,
	Lock,
	LogIn,
	Users,
	Eye,
	EyeOff,
	ChevronDown,
	ChevronUp,
} from 'lucide-react';

import type { LucideIcon } from 'lucide-react';
import { ErrorSeverity, Platform, RecoveryAction } from '@/lib/sessionErrors';

/**
 * Get appropriate icon based on error severity
 */
export function getSeverityIcon(severity: ErrorSeverity): LucideIcon {
	switch (severity) {
		case ErrorSeverity.INFO:
		case ErrorSeverity.WARNING:
		case ErrorSeverity.ERROR:
		case ErrorSeverity.CRITICAL:
			return AlertCircle;
		default:
			return AlertCircle;
	}
}

/**
 * Get platform display configuration
 */
export function getPlatformConfig(platform: Platform) {
	switch (platform) {
		case Platform.MARKETINOUT:
			return {
				name: 'MarketInOut',
				icon: Globe,
			};
		case Platform.TRADINGVIEW:
			return {
				name: 'TradingView',
				icon: Globe,
			};
		case Platform.TELEGRAM:
			return {
				name: 'Telegram',
				icon: Globe,
			};
		default:
			return {
				name: 'Unknown',
				icon: AlertCircle,
			};
	}
}

/**
 * Get recovery action icon
 */
export function getRecoveryActionIcon(action: RecoveryAction): LucideIcon {
	switch (action) {
		case RecoveryAction.RETRY:
		case RecoveryAction.REFRESH_SESSION:
		case RecoveryAction.CLEAR_CACHE:
			return RefreshCw;
		case RecoveryAction.WAIT_AND_RETRY:
			return Clock;
		case RecoveryAction.RE_AUTHENTICATE:
		case RecoveryAction.UPDATE_CREDENTIALS:
		case RecoveryAction.CONTACT_SUPPORT:
			return ExternalLink;
		case RecoveryAction.CHECK_NETWORK:
			return AlertCircle;
		default:
			return AlertCircle;
	}
}

/**
 * Get status icon based on service status
 */
export function getStatusIcon(status: 'online' | 'offline' | 'warning'): LucideIcon {
	switch (status) {
		case 'online':
			return CheckCircle;
		case 'warning':
			return AlertCircle;
		case 'offline':
			return XCircle;
		default:
			return AlertCircle;
	}
}

/**
 * Get service type icon
 */
export function getServiceIcon(serviceName: string): LucideIcon {
	switch (serviceName.toLowerCase()) {
		case 'marketinout':
		case 'tradingview':
			return Globe;
		case 'session store':
			return Database;
		case 'extension':
			return Wifi;
		default:
			return Activity;
	}
}

/**
 * Get connection status icon
 */
export function getConnectionIcon(isConnected: boolean): LucideIcon {
	return isConnected ? Wifi : WifiOff;
}

/**
 * Common UI icons for consistent usage
 */
export const CommonIcons = {
	// Authentication
	user: User,
	lock: Lock,
	login: LogIn,
	users: Users,
	eye: Eye,
	eyeOff: EyeOff,

	// Navigation
	chevronDown: ChevronDown,
	chevronUp: ChevronUp,

	// Actions
	refresh: RefreshCw,
	clock: Clock,
	externalLink: ExternalLink,

	// Status
	checkCircle: CheckCircle,
	alertCircle: AlertCircle,
	xCircle: XCircle,

	// Services
	wifi: Wifi,
	wifiOff: WifiOff,
	database: Database,
	globe: Globe,
	activity: Activity,
} as const;

/**
 * Icon size variants for consistent sizing
 */
export const IconSizes = {
	xs: 'w-3 h-3',
	sm: 'w-4 h-4',
	md: 'w-5 h-5',
	lg: 'w-6 h-6',
	xl: 'w-8 h-8',
} as const;

/**
 * Status color variants for consistent theming
 */
export const StatusColors = {
	online: 'text-green-600 dark:text-green-400',
	warning: 'text-yellow-600 dark:text-yellow-400',
	offline: 'text-destructive',
	info: 'text-blue-600 dark:text-blue-400',
	muted: 'text-muted-foreground',
} as const;
