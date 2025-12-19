import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';
import type { AllSettings } from '@/types/chartSettings';

const KV_KEY = 'mio-tv:all-settings-v2';

/**
 * Unified KV API endpoint for all settings (PanelLayout + ChartSettings)
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
 */

// GET - Load all settings
export async function GET() {
	try {
		const settings = await kv.get<AllSettings>(KV_KEY);
		return NextResponse.json(settings || null);
	} catch (error) {
		console.error('Failed to load settings:', error);
		return NextResponse.json(null);
	}
}

// POST - Save all settings
export async function POST(request: Request) {
	try {
		const settings: AllSettings = await request.json();
		await kv.set(KV_KEY, settings);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to save settings:', error);
		return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
	}
}
