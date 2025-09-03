import { describe, it, expect } from 'vitest';
import {
	getSeverityIcon,
	getPlatformConfig,
	getRecoveryActionIcon,
	getStatusIcon,
	getServiceIcon,
	getConnectionIcon,
	CommonIcons,
	IconSizes,
	StatusColors,
} from '@/lib/iconUtils';
import { ErrorSeverity, Platform, RecoveryAction } from '@/lib/sessionErrors';
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

describe('iconUtils', () => {
	describe('getSeverityIcon', () => {
		it('should return AlertCircle for INFO severity', () => {
			const icon = getSeverityIcon(ErrorSeverity.INFO);
			expect(icon).toBe(AlertCircle);
		});

		it('should return AlertCircle for WARNING severity', () => {
			const icon = getSeverityIcon(ErrorSeverity.WARNING);
			expect(icon).toBe(AlertCircle);
		});

		it('should return AlertCircle for ERROR severity', () => {
			const icon = getSeverityIcon(ErrorSeverity.ERROR);
			expect(icon).toBe(AlertCircle);
		});

		it('should return AlertCircle for CRITICAL severity', () => {
			const icon = getSeverityIcon(ErrorSeverity.CRITICAL);
			expect(icon).toBe(AlertCircle);
		});

		it('should return AlertCircle for unknown severity', () => {
			const icon = getSeverityIcon('UNKNOWN' as ErrorSeverity);
			expect(icon).toBe(AlertCircle);
		});
	});

	describe('getPlatformConfig', () => {
		it('should return correct config for MARKETINOUT platform', () => {
			const config = getPlatformConfig(Platform.MARKETINOUT);
			expect(config).toEqual({
				name: 'MarketInOut',
				icon: Globe,
			});
		});

		it('should return correct config for TRADINGVIEW platform', () => {
			const config = getPlatformConfig(Platform.TRADINGVIEW);
			expect(config).toEqual({
				name: 'TradingView',
				icon: Globe,
			});
		});

		it('should return correct config for TELEGRAM platform', () => {
			const config = getPlatformConfig(Platform.TELEGRAM);
			expect(config).toEqual({
				name: 'Telegram',
				icon: Globe,
			});
		});

		it('should return default config for unknown platform', () => {
			const config = getPlatformConfig('UNKNOWN' as Platform);
			expect(config).toEqual({
				name: 'Unknown',
				icon: AlertCircle,
			});
		});
	});

	describe('getRecoveryActionIcon', () => {
		it('should return RefreshCw for RETRY action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.RETRY);
			expect(icon).toBe(RefreshCw);
		});

		it('should return RefreshCw for REFRESH_SESSION action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.REFRESH_SESSION);
			expect(icon).toBe(RefreshCw);
		});

		it('should return RefreshCw for CLEAR_CACHE action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.CLEAR_CACHE);
			expect(icon).toBe(RefreshCw);
		});

		it('should return Clock for WAIT_AND_RETRY action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.WAIT_AND_RETRY);
			expect(icon).toBe(Clock);
		});

		it('should return ExternalLink for RE_AUTHENTICATE action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.RE_AUTHENTICATE);
			expect(icon).toBe(ExternalLink);
		});

		it('should return ExternalLink for UPDATE_CREDENTIALS action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.UPDATE_CREDENTIALS);
			expect(icon).toBe(ExternalLink);
		});

		it('should return ExternalLink for CONTACT_SUPPORT action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.CONTACT_SUPPORT);
			expect(icon).toBe(ExternalLink);
		});

		it('should return AlertCircle for CHECK_NETWORK action', () => {
			const icon = getRecoveryActionIcon(RecoveryAction.CHECK_NETWORK);
			expect(icon).toBe(AlertCircle);
		});

		it('should return AlertCircle for unknown action', () => {
			const icon = getRecoveryActionIcon('UNKNOWN' as RecoveryAction);
			expect(icon).toBe(AlertCircle);
		});
	});

	describe('getStatusIcon', () => {
		it('should return CheckCircle for online status', () => {
			const icon = getStatusIcon('online');
			expect(icon).toBe(CheckCircle);
		});

		it('should return AlertCircle for warning status', () => {
			const icon = getStatusIcon('warning');
			expect(icon).toBe(AlertCircle);
		});

		it('should return XCircle for offline status', () => {
			const icon = getStatusIcon('offline');
			expect(icon).toBe(XCircle);
		});

		it('should return AlertCircle for unknown status', () => {
			const icon = getStatusIcon('unknown' as 'online' | 'warning' | 'offline');
			expect(icon).toBe(AlertCircle);
		});
	});

	describe('getServiceIcon', () => {
		it('should return Globe for marketinout service', () => {
			const icon = getServiceIcon('marketinout');
			expect(icon).toBe(Globe);
		});

		it('should return Globe for MarketInOut service (case insensitive)', () => {
			const icon = getServiceIcon('MarketInOut');
			expect(icon).toBe(Globe);
		});

		it('should return Globe for tradingview service', () => {
			const icon = getServiceIcon('tradingview');
			expect(icon).toBe(Globe);
		});

		it('should return Globe for TradingView service (case insensitive)', () => {
			const icon = getServiceIcon('TradingView');
			expect(icon).toBe(Globe);
		});

		it('should return Database for session store service', () => {
			const icon = getServiceIcon('session store');
			expect(icon).toBe(Database);
		});

		it('should return Database for Session Store service (case insensitive)', () => {
			const icon = getServiceIcon('Session Store');
			expect(icon).toBe(Database);
		});

		it('should return Wifi for extension service', () => {
			const icon = getServiceIcon('extension');
			expect(icon).toBe(Wifi);
		});

		it('should return Wifi for Extension service (case insensitive)', () => {
			const icon = getServiceIcon('Extension');
			expect(icon).toBe(Wifi);
		});

		it('should return Activity for unknown service', () => {
			const icon = getServiceIcon('unknown-service');
			expect(icon).toBe(Activity);
		});

		it('should return Activity for empty service name', () => {
			const icon = getServiceIcon('');
			expect(icon).toBe(Activity);
		});
	});

	describe('getConnectionIcon', () => {
		it('should return Wifi for connected status', () => {
			const icon = getConnectionIcon(true);
			expect(icon).toBe(Wifi);
		});

		it('should return WifiOff for disconnected status', () => {
			const icon = getConnectionIcon(false);
			expect(icon).toBe(WifiOff);
		});
	});

	describe('CommonIcons', () => {
		it('should export all authentication icons', () => {
			expect(CommonIcons.user).toBe(User);
			expect(CommonIcons.lock).toBe(Lock);
			expect(CommonIcons.login).toBe(LogIn);
			expect(CommonIcons.users).toBe(Users);
			expect(CommonIcons.eye).toBe(Eye);
			expect(CommonIcons.eyeOff).toBe(EyeOff);
		});

		it('should export all navigation icons', () => {
			expect(CommonIcons.chevronDown).toBe(ChevronDown);
			expect(CommonIcons.chevronUp).toBe(ChevronUp);
		});

		it('should export all action icons', () => {
			expect(CommonIcons.refresh).toBe(RefreshCw);
			expect(CommonIcons.clock).toBe(Clock);
			expect(CommonIcons.externalLink).toBe(ExternalLink);
		});

		it('should export all status icons', () => {
			expect(CommonIcons.checkCircle).toBe(CheckCircle);
			expect(CommonIcons.alertCircle).toBe(AlertCircle);
			expect(CommonIcons.xCircle).toBe(XCircle);
		});

		it('should export all service icons', () => {
			expect(CommonIcons.wifi).toBe(Wifi);
			expect(CommonIcons.wifiOff).toBe(WifiOff);
			expect(CommonIcons.database).toBe(Database);
			expect(CommonIcons.globe).toBe(Globe);
			expect(CommonIcons.activity).toBe(Activity);
		});
	});

	describe('IconSizes', () => {
		it('should export all size variants', () => {
			expect(IconSizes.xs).toBe('w-3 h-3');
			expect(IconSizes.sm).toBe('w-4 h-4');
			expect(IconSizes.md).toBe('w-5 h-5');
			expect(IconSizes.lg).toBe('w-6 h-6');
			expect(IconSizes.xl).toBe('w-8 h-8');
		});

		it('should have consistent format for all sizes', () => {
			Object.values(IconSizes).forEach((size) => {
				expect(size).toMatch(/^w-\d+ h-\d+$/);
			});
		});
	});

	describe('StatusColors', () => {
		it('should export all status color variants', () => {
			expect(StatusColors.online).toBe('text-green-600 dark:text-green-400');
			expect(StatusColors.warning).toBe('text-yellow-600 dark:text-yellow-400');
			expect(StatusColors.offline).toBe('text-destructive');
			expect(StatusColors.info).toBe('text-blue-600 dark:text-blue-400');
			expect(StatusColors.muted).toBe('text-muted-foreground');
		});

		it('should have consistent format for themed colors', () => {
			const themedColors = [StatusColors.online, StatusColors.warning, StatusColors.info];
			themedColors.forEach((color) => {
				expect(color).toMatch(/^text-\w+-\d+ dark:text-\w+-\d+$/);
			});
		});

		it('should have simple format for non-themed colors', () => {
			expect(StatusColors.offline).toMatch(/^text-\w+$/);
			expect(StatusColors.muted).toMatch(/^text-[\w-]+$/);
		});
	});

	describe('type safety', () => {
		it('should maintain type safety for CommonIcons', () => {
			// This test ensures that CommonIcons maintains proper typing
			const iconKeys = Object.keys(CommonIcons);
			expect(iconKeys.length).toBeGreaterThan(0);

			// Verify each icon is a valid LucideIcon component (can be function or object)
			Object.values(CommonIcons).forEach((IconComponent) => {
				expect(['function', 'object']).toContain(typeof IconComponent);
				expect(IconComponent).toBeDefined();
			});
		});

		it('should maintain type safety for IconSizes', () => {
			const sizeKeys = Object.keys(IconSizes);
			expect(sizeKeys).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
		});

		it('should maintain type safety for StatusColors', () => {
			const colorKeys = Object.keys(StatusColors);
			expect(colorKeys).toEqual(['online', 'warning', 'offline', 'info', 'muted']);
		});
	});
});
