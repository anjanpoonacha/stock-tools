export async function sendTelegramMessage(token: string, chatId: string, text: string, topicId?: string) {
	const url = `https://api.telegram.org/bot${token}/sendMessage`;
	const body: Record<string, unknown> = {
		chat_id: chatId,
		text,
		parse_mode: 'Markdown',
	};
	if (topicId) {
		body.message_thread_id = Number(topicId);
	}
	const res = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify(body),
	} as unknown as RequestInit);
	if (!res.ok) {
		throw new Error(`Telegram API error: ${await res.text()}`);
	}
	return res.json();
}
