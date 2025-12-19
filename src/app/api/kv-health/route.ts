import { NextRequest, NextResponse } from 'next/server';
import { kv } from '@vercel/kv';

// Simple authentication token for the cron job
const CRON_SECRET = process.env.CRON_SECRET || 'default-secret-change-me';

export async function GET(request: NextRequest) {
	try {
		// Check for authentication
		const authHeader = request.headers.get('authorization');
		const providedSecret = request.nextUrl.searchParams.get('secret');

		if (authHeader !== `Bearer ${CRON_SECRET}` && providedSecret !== CRON_SECRET) {
			return NextResponse.json(
				{ error: 'Unauthorized' },
				{ status: 401 }
			);
		}

		// Perform a simple KV operation to keep it active
		const healthKey = 'kv-health-check';
		const timestamp = new Date().toISOString();

		// Write operation
		await kv.set(healthKey, {
			lastCheck: timestamp,
			status: 'active',
			source: 'cron-health-check'
		});

		// Read operation to verify
		const healthData = await kv.get(healthKey);

		// Optional: Clean up old health check data (keep only last 10)
		const healthHistoryKey = 'kv-health-history';
		const history = await kv.get(healthHistoryKey) as string[] || [];
		history.push(timestamp);

		// Keep only last 10 entries
		if (history.length > 10) {
			history.splice(0, history.length - 10);
		}

		await kv.set(healthHistoryKey, history);

		return NextResponse.json({
			success: true,
			timestamp,
			kvStatus: 'active',
			healthData,
			message: 'KV storage is healthy and active'
		});

	} catch (error) {

		return NextResponse.json(
			{
				success: false,
				error: 'KV health check failed',
				details: error instanceof Error ? error.message : 'Unknown error',
				timestamp: new Date().toISOString()
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	// Allow POST method as well for flexibility
	return GET(request);
}
