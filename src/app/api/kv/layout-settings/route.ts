import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

const KV_KEYS = {
	MODE: 'mio-tv:layout-mode',
	RANGE_SYNC: 'mio-tv:range-sync',
};

export interface LayoutSettings {
	mode: 'horizontal' | 'vertical';
	rangeSync: boolean;
}

const DEFAULT_LAYOUT_SETTINGS: LayoutSettings = {
	mode: 'horizontal',
	rangeSync: true,
};

// GET - Load layout settings
export async function GET() {
	try {
		const mode = await kv.get<'horizontal' | 'vertical'>(KV_KEYS.MODE);
		const rangeSync = await kv.get<boolean>(KV_KEYS.RANGE_SYNC);

		if (mode !== null && rangeSync !== null) {
			return NextResponse.json({ mode, rangeSync });
		}
		return NextResponse.json(DEFAULT_LAYOUT_SETTINGS);
	} catch (error) {
		console.error('Failed to load layout settings:', error);
		return NextResponse.json(DEFAULT_LAYOUT_SETTINGS);
	}
}

// POST - Save layout settings
export async function POST(request: Request) {
	try {
		const settings: LayoutSettings = await request.json();
		await kv.set(KV_KEYS.MODE, settings.mode);
		await kv.set(KV_KEYS.RANGE_SYNC, settings.rangeSync);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to save layout settings:', error);
		return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
	}
}
