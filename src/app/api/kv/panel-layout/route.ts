import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

const KV_KEY = 'mio-tv:panel-layout';

export interface PanelLayout {
	'toolbar-panel': number;
	'chart-panel': number;
	'stock-list-panel': number;
}

const DEFAULT_PANEL_LAYOUT: PanelLayout = {
	'toolbar-panel': 5,
	'chart-panel': 81,
	'stock-list-panel': 14,
};

// GET - Load panel layout
export async function GET() {
	try {
		const layout = await kv.get<PanelLayout>(KV_KEY);
		return NextResponse.json(layout || DEFAULT_PANEL_LAYOUT);
	} catch (error) {
		console.error('Failed to load panel layout:', error);
		return NextResponse.json(DEFAULT_PANEL_LAYOUT);
	}
}

// POST - Save panel layout
export async function POST(request: Request) {
	try {
		const layout: PanelLayout = await request.json();
		await kv.set(KV_KEY, layout);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to save panel layout:', error);
		return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
	}
}
