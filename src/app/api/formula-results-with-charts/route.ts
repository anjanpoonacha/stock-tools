/**
 * Formula Results with Charts - SSE Streaming Route
 * 
 * Server-Sent Events (SSE) endpoint that:
 * 1. Fetches formula results immediately and streams them
 * 2. Fetches chart data in batches and streams each batch
 * 3. Sends progress updates and completion events
 * 
 * This reduces perceived load time from 8-10 seconds to instant formula display
 * with progressive chart loading.
 */

import { NextRequest } from 'next/server';
import { kv } from '@vercel/kv';
import type { MIOFormula, StoredFormulas } from '@/types/formula';
import type { Stock } from '@/types/stock';
import { enrichStockMetadata } from '@/lib/utils';
import { fetchChartsInBatches, type ChartBatchResult } from '@/lib/chart-data/batchChartFetcher';
import { resolveUserSession, fetchJWTToken, createChartDataServiceConfig } from '@/lib/chart-data/chartDataService';
import { getPersistentConnectionManager } from '@/lib/tradingview/persistentConnectionManager';

/**
 * Generate KV key for user formulas
 */
function generateFormulasKey(userEmail: string, userPassword: string): string {
	return `mio-formulas:${userEmail.toLowerCase().trim()}:${userPassword}`;
}

/**
 * Parse MIO API pipe-delimited response to Stock[] format
 */
function parseMIOResponse(data: string): Stock[] {
	const lines = data.trim().split('\n');
	const stocks: Stock[] = [];

	for (const line of lines) {
		const trimmedLine = line.trim();
		if (!trimmedLine) continue;

		const parts = trimmedLine.split('|');
		if (parts.length < 2) continue;

		const rawSymbol = parts[0].trim();
		const priceStr = parts[1].trim();

		// Convert symbol format: APLAPOLLO.NS → NSE:APLAPOLLO
		let symbol = rawSymbol;
		if (rawSymbol.endsWith('.NS')) {
			const baseSymbol = rawSymbol.replace('.NS', '');
			symbol = `NSE:${baseSymbol}`;
		}

		const price = parseFloat(priceStr);
		const name = rawSymbol.replace('.NS', '');
		const enrichedData = enrichStockMetadata(symbol);

		stocks.push({
			symbol,
			name,
			price: isNaN(price) ? undefined : price,
			sector: enrichedData.sector,
			industry: enrichedData.industry,
		});
	}

	return stocks;
}

/**
 * POST - Stream formula results and chart data
 */
export async function POST(request: NextRequest) {
	try {
		// Parse request body with error handling
		let body;
		try {
			const text = await request.text();
			if (!text || text.trim() === '') {
				// Return helpful error for empty body (likely browser dev tools or preflight)
				return new Response(
					JSON.stringify({ 
						error: 'Empty request body',
						hint: 'This endpoint requires POST with JSON body containing: userEmail, userPassword, formulaId'
					}),
					{ 
						status: 400,
						headers: { 'Content-Type': 'application/json' }
					}
				);
			}
			body = JSON.parse(text);
		} catch (parseError) {
			console.error('[SSE] Failed to parse request body:', parseError);
			return new Response(
				JSON.stringify({ 
					error: 'Invalid request body',
					details: parseError instanceof Error ? parseError.message : 'Unknown error'
				}),
				{ 
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		const { userEmail, userPassword, formulaId, resolutions = ['1W', '1D'], barsCount = 300 } = body;

		console.log('[SSE] Received request:', { userEmail, formulaId, resolutions, barsCount });

		// Validate required fields
		if (!userEmail || !userPassword || !formulaId) {
			console.error('[SSE] Missing required fields:', { 
				hasEmail: !!userEmail, 
				hasPassword: !!userPassword, 
				hasFormulaId: !!formulaId 
			});
			return new Response(
				JSON.stringify({ error: 'User email, password, and formulaId are required' }),
				{ 
					status: 400,
					headers: { 'Content-Type': 'application/json' }
				}
			);
		}

		// Create SSE stream
		const encoder = new TextEncoder();
		const stream = new ReadableStream({
			async start(controller) {
				try {
					// Helper to send SSE event
					const sendEvent = (type: string, data: unknown) => {
						const message = `data: ${JSON.stringify({ type, data })}\n\n`;
						controller.enqueue(encoder.encode(message));
					};

					// 1. Fetch formula from storage
					const key = generateFormulasKey(userEmail, userPassword);
					const storedData = await kv.get<StoredFormulas>(key);

					if (!storedData) {
						sendEvent('error', { message: 'No formulas found. Please extract formulas first.' });
						controller.close();
						return;
					}

					const formula = storedData.formulas.find((f: MIOFormula) => f.id === formulaId);
					if (!formula) {
						sendEvent('error', { message: 'Formula not found' });
						controller.close();
						return;
					}

					if (!formula.apiUrl) {
						sendEvent('error', { message: 'Formula does not have an API URL. Please re-extract formulas.' });
						controller.close();
						return;
					}

					// 2. Fetch stock results from MIO API
					console.log(`[SSE] Fetching stock results from: ${formula.apiUrl}`);
					const mioResponse = await fetch(formula.apiUrl);

					if (!mioResponse.ok) {
						sendEvent('error', { message: `MIO API returned ${mioResponse.status}` });
						controller.close();
						return;
					}

					const mioData = await mioResponse.text();
					const stocks: Stock[] = parseMIOResponse(mioData);

					console.log(`[SSE] Parsed ${stocks.length} stocks from MIO response`);

					// 3. Send formula results event immediately
					const symbols = stocks.map(s => s.symbol);
					const totalCharts = symbols.length * resolutions.length;

					sendEvent('formula-results', {
						formulaName: formula.name,
						stocks,
						totalCharts,
						resolutions,
						barsCount,
					});

					console.log(`[SSE] Sent formula results (${stocks.length} stocks)`);

					// 4. Resolve user session and get JWT token
					const serviceConfig = createChartDataServiceConfig();
					const sessionResult = await resolveUserSession(userEmail, userPassword, serviceConfig);

					if (!sessionResult.success) {
						sendEvent('error', { message: sessionResult.error || 'Failed to resolve session' });
						controller.close();
						return;
					}

					const jwtResult = await fetchJWTToken(
						sessionResult.sessionId!,
						sessionResult.sessionIdSign || '',
						sessionResult.userId || 0,
						serviceConfig
					);

					if (!jwtResult.success) {
						sendEvent('error', { message: jwtResult.error || 'Failed to get JWT token' });
						controller.close();
						return;
					}

					console.log(`[SSE] Authenticated successfully`);

					// 5. Acquire persistent connection for this request
					const persistentManager = getPersistentConnectionManager();
					await persistentManager.acquire(jwtResult.token!);
					
					try {
						console.log(`[SSE] Using persistent connection pool (refCount: ${persistentManager.getRefCount()})`);

					// 6. Fetch charts in batches with streaming
					const batchStartTime = Date.now();
					let totalLoaded = 0;

					await fetchChartsInBatches(jwtResult.token!, {
						symbols,
						resolutions,
						barsCount,
						cvdEnabled: false, // Disabled: CVD data not available, causes 2s timeout per symbol
						cvdAnchorPeriod: '3M',
						batchSize: 18, // Optimal batch size
						parallelConnections: 5,
						onBatchComplete: async (batch: ChartBatchResult) => {
							// Convert batch to chart data format
							const chartData: Record<string, Record<string, unknown>> = {};
							
							for (const chart of batch.charts) {
								if (!chart.error && chart.bars) {
									if (!chartData[chart.symbol]) {
										chartData[chart.symbol] = {};
									}
									chartData[chart.symbol][chart.resolution] = {
										bars: chart.bars,
										metadata: chart.metadata,
										indicators: chart.indicators,
									};
								}
							}

							totalLoaded += batch.charts.length;
							const progress = {
								loaded: totalLoaded,
								total: totalCharts,
								percentage: Math.round((totalLoaded / totalCharts) * 100),
							};

							// Send batch event
							sendEvent('chart-batch', {
								batchIndex: batch.batchIndex,
								totalBatches: batch.totalBatches,
								symbols: batch.symbols,
								chartData,
								progress,
								timing: batch.timing,
							});

							console.log(`[SSE] Sent batch ${batch.batchIndex}/${batch.totalBatches} (${progress.percentage}%)`);
						},
							// Pass the persistent connection pool
							connectionPool: persistentManager.getConnectionPool(),
						});

						// 7. Send completion event
						const totalDuration = Date.now() - batchStartTime;
						sendEvent('complete', {
							totalCharts,
							totalTime: totalDuration,
							avgTimePerChart: Math.round(totalDuration / totalCharts),
						});

						console.log(`[SSE] Stream complete: ${totalCharts} charts in ${totalDuration}ms`);
						
					} finally {
						// Release persistent connection after request completes
						persistentManager.release();
						console.log(`[SSE] Released persistent connection (refCount: ${persistentManager.getRefCount()})`);
					}
					
					controller.close();

				} catch (error) {
					console.error('[SSE] Stream error:', error);
					const message = `data: ${JSON.stringify({
						type: 'error',
						data: { message: error instanceof Error ? error.message : 'Unknown error' }
					})}\n\n`;
					controller.enqueue(encoder.encode(message));
					controller.close();
				}
			},
		});

		// Return SSE response
		return new Response(stream, {
			headers: {
				'Content-Type': 'text/event-stream',
				'Cache-Control': 'no-cache, no-transform',
				'Connection': 'keep-alive',
				'X-Accel-Buffering': 'no', // Disable nginx buffering
			},
		});

	} catch (error) {
		console.error('[SSE] Error setting up stream:', error);
		return new Response(
			JSON.stringify({
				error: error instanceof Error ? error.message : 'Failed to start stream'
			}),
			{ 
				status: 500,
				headers: { 'Content-Type': 'application/json' }
			}
		);
	}
}

/**
 * GET - Return info about this endpoint
 */
export async function GET() {
	return new Response(
		JSON.stringify({
			endpoint: '/api/formula-results-with-charts',
			method: 'POST',
			description: 'Server-Sent Events (SSE) endpoint for streaming formula results and chart data',
			requiredFields: ['userEmail', 'userPassword', 'formulaId'],
			optionalFields: ['resolutions', 'barsCount']
		}),
		{
			status: 200,
			headers: { 'Content-Type': 'application/json' }
		}
	);
}

/**
 * OPTIONS - CORS preflight handler
 */
export async function OPTIONS() {
	return new Response(null, {
		status: 204,
		headers: {
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
			'Access-Control-Allow-Headers': 'Content-Type'
		}
	});
}
