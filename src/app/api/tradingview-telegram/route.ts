import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import type { TradingViewAlertPayload } from '@/types/tradingview';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID; // Optional

export async function POST(req: NextRequest) {
	try {
		let message: string;
		const contentType = req.headers.get('content-type') || '';

		console.log(`[Webhook] Incoming request: ${contentType}`);

		if (contentType.includes('application/json')) {
			const alert = (await req.json()) as TradingViewAlertPayload;
			console.log('[Webhook] Parsed JSON payload:', alert);
			message = alert.message || alert.text || JSON.stringify(alert);
		} else {
			message = await req.text();
			console.log('[Webhook] Raw text payload:', message);
		}

		console.log(`[Webhook] Sending to Telegram: ${message}`);

		await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message, TELEGRAM_TOPIC_ID);

		console.log('[Webhook] Message sent successfully');
		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error('[Webhook] Error:', (e as Error).message);
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
