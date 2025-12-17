/**
 * Chart Data API Route
 * 
 * HTTP layer for chart data endpoint.
 * Handles HTTP requests/responses and delegates business logic to service layer.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChartData } from '@/lib/chart-data/chartDataService';
import type { ChartDataResponse } from '@/lib/tradingview/types';

/**
 * POST /api/chart-data
 * 
 * Query Parameters:
 * - symbol: Stock symbol (e.g., 'NSE:JUNIPER')
 * - resolution: Time resolution ('1D', '1W', '1M', '1', '5', '15', '30', '60') - default '1D'
 * - barsCount: Number of bars to fetch (max 300) - default 300
 * - cvdEnabled: Enable CVD indicator ('true' or 'false') - default 'false'
 * - cvdAnchorPeriod: CVD anchor period ('1W', '1M', '3M', '6M', '1Y') - default '3M'
 * - cvdTimeframe: CVD custom timeframe ('15S', '30S', '1', '5', etc.) - optional
 * 
 * Body:
 * - userEmail: User email for session lookup (from AuthContext)
 * - userPassword: User password for session lookup (from AuthContext)
 * 
 * Returns:
 * - success: boolean
 * - symbol: string
 * - resolution: string
 * - bars: OHLCVBar[]
 * - metadata: Partial<SymbolMetadata>
 * - indicators?: { cvd?: StudyData }
 * - error?: string
 */
export async function POST(request: NextRequest) {
	try {
		// Parse query parameters
		const symbol = request.nextUrl.searchParams.get('symbol');
		const resolution = request.nextUrl.searchParams.get('resolution');
		const barsCount = request.nextUrl.searchParams.get('barsCount');
		const cvdEnabled = request.nextUrl.searchParams.get('cvdEnabled');
		const cvdAnchorPeriod = request.nextUrl.searchParams.get('cvdAnchorPeriod');
		const cvdTimeframe = request.nextUrl.searchParams.get('cvdTimeframe');
		
		// Parse request body
		const body = await request.json();
		const userEmail = body.userEmail;
		const userPassword = body.userPassword;
		
		// Call service layer
		const result = await getChartData({
			symbol,
			resolution,
			barsCount,
			cvdEnabled,
			cvdAnchorPeriod,
			cvdTimeframe,
			userEmail,
			userPassword
		});
		
		// Format response based on service result
		if (result.success && result.data) {
			return NextResponse.json({
				success: true,
				symbol: result.data.symbol,
				resolution: result.data.resolution,
				bars: result.data.bars,
				metadata: result.data.metadata,
				indicators: result.data.indicators
			} as ChartDataResponse, { status: result.statusCode });
		} else {
			return NextResponse.json({
				success: false,
				error: result.error
			} as ChartDataResponse, { status: result.statusCode });
		}
		
	} catch (error) {
		console.error('[Chart Data API] Unexpected error:', error);
		return NextResponse.json({
			success: false,
			error: `Internal server error: ${error instanceof Error ? error.message : 'Unknown error'}`
		} as ChartDataResponse, { status: 500 });
	}
}

/**
 * OPTIONS handler for CORS preflight requests
 */
export async function OPTIONS() {
	return new NextResponse(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
