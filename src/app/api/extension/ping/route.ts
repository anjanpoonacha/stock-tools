// Simple ping endpoint for extension connectivity testing
import { NextResponse } from 'next/server';

// CORS headers for extension requests
const corsHeaders = {
	'Access-Control-Allow-Origin': '*',
	'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
	'Access-Control-Allow-Headers': 'Content-Type',
	'Access-Control-Max-Age': '86400',
};

// Handle CORS preflight requests
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 200,
		headers: corsHeaders
	});
}

export async function GET() {
	return NextResponse.json({
		status: 'ok',
		service: 'mio-trading-app',
		timestamp: new Date().toISOString(),
		message: 'Extension API is reachable'
	}, { headers: corsHeaders });
}
