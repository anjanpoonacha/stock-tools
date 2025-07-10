import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import type { TradingViewAlertPayload } from '@/types/tradingview';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID; // Optional

export async function POST(req: NextRequest) {
	try {
		const alert = (await req.json()) as TradingViewAlertPayload;
		// Support both TradingView's "text" and custom "message" fields
		const message = alert.text || JSON.stringify(alert);

		await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message, TELEGRAM_TOPIC_ID);

		return NextResponse.json({ ok: true });
	} catch (e) {
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
