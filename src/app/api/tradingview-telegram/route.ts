import { NextRequest, NextResponse } from 'next/server';
import { sendTelegramMessage } from '@/lib/telegram';
import type { TradingViewAlertPayload } from '@/types/tradingview';
import { fetchWatchlistsWithAuth, appendSymbolToWatchlist } from '@/lib/tradingview';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN!;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID!;
const TELEGRAM_TOPIC_ID = process.env.TELEGRAM_TOPIC_ID; // Optional

const TV_WATCHLIST_NAME = '0.TriggeredToday';
const TV_WATCHLISTS_URL = 'https://www.tradingview.com/api/v1/symbols_list/all/';

// Extracts the symbol (no prefix) from alert payload or string
function extractSymbolFromAlert(alert: TradingViewAlertPayload | string): string | null {
	let raw = '';
	if (typeof alert === 'string') {
		raw = alert;
	} else {
		raw = (alert.message || alert.text || '') as string;
	}
	// Match first uppercase word (stock symbol)
	const m = raw.match(/\b([A-Z0-9]{1,10})\b/);
	return m ? m[1] : null;
}

export async function POST(req: NextRequest) {
	try {
		let message: string;
		let symbol: string | null = null;
		const contentType = req.headers.get('content-type') || '';

		console.log(`[Webhook] Incoming request: ${contentType}`);

		// Get sessionId from query params
		const { searchParams } = new URL(req.url);
		const sessionId = searchParams.get('sessionId');
		if (!sessionId) {
			return NextResponse.json({ error: 'Missing TradingView sessionId in query params' }, { status: 400 });
		}

		let alert: TradingViewAlertPayload | string;
		if (contentType.includes('application/json')) {
			alert = (await req.json()) as TradingViewAlertPayload;
			console.log('[Webhook] Parsed JSON payload:', alert);
			message = alert.message || alert.text || JSON.stringify(alert);
			symbol = extractSymbolFromAlert(alert);
		} else {
			message = await req.text();
			alert = message;
			console.log('[Webhook] Raw text payload:', message);
			symbol = extractSymbolFromAlert(message);
		}

		console.log(`[Webhook] Sending to Telegram: ${message}`);
		if (process.env.NODE_ENV === 'production') {
			await sendTelegramMessage(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, message, TELEGRAM_TOPIC_ID);
			console.log('[Webhook] Message sent successfully');
		} else {
			console.log('[Webhook] Skipped sending Telegram message (not in production mode)');
		}

		// TradingView watchlist logic
		if (symbol) {
			try {
				const tvSymbol = `NSE:${symbol}`;
				const cookie = `sessionid=${sessionId}`;
				const watchlists = await fetchWatchlistsWithAuth(TV_WATCHLISTS_URL, cookie);
				const wl = watchlists.find((w) => w.name === TV_WATCHLIST_NAME);
				if (!wl) {
					console.error(`[TradingView] Watchlist "${TV_WATCHLIST_NAME}" not found`);
				} else {
					await appendSymbolToWatchlist(wl.id, tvSymbol, cookie);
					console.log(`[TradingView] Symbol ${tvSymbol} added to watchlist "${TV_WATCHLIST_NAME}"`);
				}
			} catch (tvErr) {
				console.error('[TradingView] Error updating watchlist:', tvErr);
			}
		} else {
			console.warn('[TradingView] No symbol found in alert payload, skipping watchlist update');
		}

		return NextResponse.json({ ok: true });
	} catch (e) {
		console.error('[Webhook] Error:', (e as Error).message);
		return NextResponse.json({ error: (e as Error).message }, { status: 500 });
	}
}
