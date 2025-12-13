import { NextResponse } from 'next/server';

/**
 * Deprecated endpoint - SessionFlowTester has been removed
 * This endpoint is kept for backward compatibility but returns a deprecation notice
 */
export async function POST() {
	return NextResponse.json({
		error: 'Deprecated',
		message: 'SessionFlowTester has been removed. This endpoint is no longer functional.',
		recommendation: 'Use the health monitoring endpoints at /api/session-health instead'
	}, { status: 410 }); // 410 Gone
}
