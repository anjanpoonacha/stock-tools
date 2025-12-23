/**
 * Chart Data API Route
 * 
 * HTTP layer for chart data endpoint.
 * Handles HTTP requests/responses and delegates business logic to service layer.
 * Uses persistent WebSocket connections when available for improved performance.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getChartData } from '@/lib/chart-data/chartDataService';
import type { ChartDataResponse } from '@/lib/tradingview/types';
import { getCachedChartData, setCachedChartData } from '@/lib/cache/chartDataCache';
import { isServerCacheEnabled } from '@/lib/cache/cacheConfig';

/**
 * POST /api/chart-data
 * 
 * Query Parameters:
 * - symbol: Stock symbol (e.g., 'NSE:JUNIPER')
 * - resolution: Time resolution ('1D', '1W', '1M', '1', '5', '15', '30', '60') - default '1D'
 * - barsCount: Number of bars to fetch (1-2000) - default 300
 *   Verified through real API testing (Dec 18, 2025):
 *   Daily=2000 (8 years), 15min=2000 (4 months), Weekly=1500 (29 years), 5min=1000 (17 days)
 *   See: docs/BAR_COUNT_TEST_RESULTS.md
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
		
		// Validate user credentials
		if (!userEmail || !userPassword) {
			return NextResponse.json({
				success: false,
				error: 'User email and password are required'
			} as ChartDataResponse, { status: 401 });
		}
		
		// Check cache first (only if enabled via env var)
		const cacheKey = `${symbol}:${resolution}:${barsCount || '300'}:${cvdEnabled || 'false'}`;
		const cacheEnabled = isServerCacheEnabled();
		
		if (cacheEnabled) {
			const cached = getCachedChartData(cacheKey);
			
			if (cached) {
				return NextResponse.json(cached, { status: 200 });
			}
		}
		
		// Call service layer (handles auth, connection management, and data fetching)
		// OPTIMIZED: Single auth path - no duplicate session resolution or JWT fetching
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
			const response = {
				success: true,
				symbol: result.data.symbol,
				resolution: result.data.resolution,
				bars: result.data.bars,
				metadata: result.data.metadata,
				indicators: result.data.indicators
			} as ChartDataResponse;
			
			// Cache successful responses (only if enabled)
			if (cacheEnabled) {
				setCachedChartData(cacheKey, response);
			}
			
			return NextResponse.json(response, { status: result.statusCode });
		} else {
			return NextResponse.json({
				success: false,
				error: result.error
			} as ChartDataResponse, { status: result.statusCode });
		}
		
	} catch (error) {

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
