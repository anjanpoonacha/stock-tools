import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

const KV_KEY = 'mio-tv:chart-settings';

export interface ChartSettings {
	resolution1: string;
	resolution2: string;
	zoomLevel1: string;
	zoomLevel2: string;
	// Chart 1 Indicator Visibility
	showPrice1: boolean;
	showVolume1: boolean;
	showCVD1: boolean;
	cvdAnchorPeriod1: string;
	cvdUseCustomPeriod1: boolean;
	cvdCustomPeriod1: string;
	// Chart 2 Indicator Visibility
	showPrice2: boolean;
	showVolume2: boolean;
	showCVD2: boolean;
	cvdAnchorPeriod2: string;
	cvdUseCustomPeriod2: boolean;
	cvdCustomPeriod2: string;
	showGrid: boolean;
	dualViewMode: boolean;
	showVolumeMA: boolean;
	volumeMALength: number;
}

// GET - Load chart settings
export async function GET() {
	try {
		const settings = await kv.get<ChartSettings>(KV_KEY);
		return NextResponse.json(settings || null);
	} catch (error) {
		console.error('Failed to load chart settings:', error);
		return NextResponse.json(null);
	}
}

// POST - Save chart settings
export async function POST(request: Request) {
	try {
		const settings: ChartSettings = await request.json();
		await kv.set(KV_KEY, settings);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to save chart settings:', error);
		return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
	}
}
