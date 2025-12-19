import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import type { AllSettings } from '@/types/chartSettings';
import { generateUserId, generateUserSettingsKey } from '@/lib/storage/userIdentity';

// Global fallback key for auto-migration from non-user-scoped settings
const GLOBAL_SETTINGS_KEY = 'mio-tv:all-settings-v2';

/**
 * Unified KV API endpoint for all settings (PanelLayout + ChartSettings)
 * 
 * NOW USER-SCOPED: Settings are stored per-user based on their credentials.
 * This enables multi-user support while maintaining backwards compatibility.
 * 
 * User-Scoping Pattern:
 * - Each user gets their own settings key: mio-tv:settings:{userId}
 * - userId is generated from hash(userEmail + userPassword)
 * - Credentials are required for both GET and POST operations
 * - Auto-migrates from global settings if user settings don't exist yet
 * 
 * This endpoint replaces the following separate endpoints:
 * - /api/kv/panel-layout
 * - /api/kv/chart-settings
 * - /api/kv/dual-chart-layout
 * - /api/kv/layout-settings
 * 
 * Benefits:
 * - Single source of truth for all settings
 * - Atomic updates (no partial state inconsistencies)
 * - Reduced API calls and network overhead
 * - Simplified state management
 * - Multi-user support with isolated settings
 */

// GET - Load user-specific settings
export async function GET(request: Request) {
	try {
		const { searchParams } = new URL(request.url);
		const userEmail = searchParams.get('userEmail');
		const userPassword = searchParams.get('userPassword');

		// Require user credentials for scoped settings
		if (!userEmail || !userPassword) {
			return NextResponse.json(
				{ error: 'Missing user credentials' },
				{ status: 401 }
			);
		}

		// Generate user-specific storage key
		const userId = await generateUserId(userEmail, userPassword);
		const userSettingsKey = generateUserSettingsKey(userId);

		// Try to load user-specific settings
		let settings = await kv.get<AllSettings>(userSettingsKey);

		// Auto-migration: If no user settings exist, try loading from global key
		if (!settings) {
			settings = await kv.get<AllSettings>(GLOBAL_SETTINGS_KEY);
		}

		return NextResponse.json(settings || null);
	} catch (error) {

		return NextResponse.json(null);
	}
}

// POST - Save user-specific settings
export async function POST(request: Request) {
	try {
		const body = await request.json();
		const { userEmail, userPassword, settings } = body;

		// Require user credentials for scoped settings
		if (!userEmail || !userPassword) {
			return NextResponse.json(
				{ error: 'Missing user credentials' },
				{ status: 401 }
			);
		}

		// Generate user-specific storage key
		const userId = await generateUserId(userEmail, userPassword);
		const userSettingsKey = generateUserSettingsKey(userId);

		// Save settings to user-specific key
		await kv.set(userSettingsKey, settings);

		// Debug logging to verify user isolation

		return NextResponse.json({ success: true });
	} catch (error) {

		return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
	}
}
