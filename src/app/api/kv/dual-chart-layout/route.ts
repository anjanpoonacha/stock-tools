import { kv } from '@vercel/kv';
import { NextResponse } from 'next/server';

const KV_KEY = 'mio-tv:dual-chart-layout';

export interface DualChartLayout {
	horizontal: {
		chart1: number;
		chart2: number;
	};
	vertical: {
		chart1: number;
		chart2: number;
	};
}

const DEFAULT_DUAL_CHART_LAYOUT: DualChartLayout = {
	horizontal: {
		chart1: 50,
		chart2: 50,
	},
	vertical: {
		chart1: 50,
		chart2: 50,
	},
};

// GET - Load dual chart layout
export async function GET() {
	try {
		const layout = await kv.get<DualChartLayout>(KV_KEY);
		return NextResponse.json(layout || DEFAULT_DUAL_CHART_LAYOUT);
	} catch (error) {
		console.error('Failed to load dual chart layout:', error);
		return NextResponse.json(DEFAULT_DUAL_CHART_LAYOUT);
	}
}

// POST - Save dual chart layout
export async function POST(request: Request) {
	try {
		const layout: DualChartLayout = await request.json();
		await kv.set(KV_KEY, layout);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error('Failed to save dual chart layout:', error);
		return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
	}
}
