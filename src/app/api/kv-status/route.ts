import { NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

export async function GET() {
	try {
		// Get health check data
		const healthKey = 'kv-health-check';
		const healthHistoryKey = 'kv-health-history';

		const [healthData, healthHistory] = await Promise.all([
			kv.get(healthKey),
			kv.get(healthHistoryKey) as Promise<string[] | null>
		]);

		// Get some basic KV statistics
		const keys = await kv.keys('*');
		const sessionKeys = keys.filter(key => key.startsWith('session:'));

		// Calculate uptime based on health history
		const now = new Date();
		const lastCheck = healthData && typeof healthData === 'object' && 'lastCheck' in healthData
			? new Date((healthData as { lastCheck: string }).lastCheck)
			: null;
		const timeSinceLastCheck = lastCheck ? now.getTime() - lastCheck.getTime() : null;

		// Determine KV status
		let kvStatus = 'unknown';
		let statusMessage = 'Unable to determine KV status';

		if (healthData && timeSinceLastCheck !== null) {
			if (timeSinceLastCheck < 24 * 60 * 60 * 1000) { // Less than 24 hours
				kvStatus = 'active';
				statusMessage = 'KV is active and healthy';
			} else {
				kvStatus = 'stale';
				statusMessage = 'KV health check is stale (>24h old)';
			}
		} else {
			kvStatus = 'inactive';
			statusMessage = 'No recent health check data found';
		}

		return NextResponse.json({
			status: kvStatus,
			message: statusMessage,
			timestamp: now.toISOString(),
			kvStats: {
				totalKeys: keys.length,
				sessionKeys: sessionKeys.length,
				lastHealthCheck: lastCheck?.toISOString() || null,
				timeSinceLastCheck: timeSinceLastCheck ? `${Math.round(timeSinceLastCheck / (1000 * 60))} minutes` : null
			},
			healthData,
			healthHistory: healthHistory || [],
			recentActivity: {
				last24Hours: healthHistory ? healthHistory.filter(timestamp => {
					const checkTime = new Date(timestamp);
					return now.getTime() - checkTime.getTime() < 24 * 60 * 60 * 1000;
				}).length : 0,
				lastWeek: healthHistory ? healthHistory.filter(timestamp => {
					const checkTime = new Date(timestamp);
					return now.getTime() - checkTime.getTime() < 7 * 24 * 60 * 60 * 1000;
				}).length : 0
			}
		});

	} catch (error) {

		return NextResponse.json(
			{
				status: 'error',
				message: 'Failed to retrieve KV status',
				error: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}
