/**
 * POC: Profiling WebSocket Client
 * 
 * Measures actual response times for TradingView WebSocket operations
 * to optimize sleep times and identify bottlenecks.
 */

import { BaseWebSocketClient } from '../../src/lib/tradingview/baseWebSocketClient';
import { createSymbolSpec } from '../../src/lib/tradingview/protocol';
import type { OHLCVBar, SymbolMetadata } from '../../src/lib/tradingview/types';

interface TimingData {
	operation: string;
	duration: number;
	sleepTime: number;
	actualResponseTime: number;
}

/**
 * Profiling client that measures actual response times
 */
class ProfilingWebSocketClient extends BaseWebSocketClient {
	private timings: TimingData[] = [];
	private lastOperationTime = 0;
	private lastOperationName = '';
	private responseReceived = false;
	
	constructor(jwtToken: string) {
		super({ jwtToken, enableLogging: true });
	}
	
	/**
	 * Track operation start
	 */
	private startOperation(name: string): void {
		this.lastOperationTime = Date.now();
		this.lastOperationName = name;
		this.responseReceived = false;
		console.log(`[Profiling] 📤 START: ${name}`);
	}
	
	/**
	 * Track operation end
	 */
	private endOperation(sleepTime: number): void {
		const totalDuration = Date.now() - this.lastOperationTime;
		const actualResponseTime = this.responseReceived 
			? totalDuration - sleepTime 
			: totalDuration;
		
		this.timings.push({
			operation: this.lastOperationName,
			duration: totalDuration,
			sleepTime,
			actualResponseTime
		});
		
		console.log(`[Profiling] ✅ END: ${this.lastOperationName} (total=${totalDuration}ms, actual=${actualResponseTime}ms, sleep=${sleepTime}ms)`);
	}
	
	/**
	 * Override authenticate with profiling
	 */
	async authenticate(): Promise<void> {
		this.startOperation('authenticate:set_auth_token');
		this.send(this.createMessage('set_auth_token', [this.config.jwtToken]));
		await this.sleep(500);
		this.endOperation(500);
		
		this.startOperation('authenticate:set_locale');
		this.send(this.createMessage('set_locale', ['en', 'US']));
		await this.sleep(200);
		this.endOperation(200);
		
		this.onAuthenticated?.();
	}
	
	/**
	 * Override createChartSession with profiling
	 */
	protected async createChartSession(): Promise<void> {
		this.startOperation('createChartSession');
		this.send(this.createMessage('chart_create_session', [this.chartSessionId, '']));
		await this.sleep(200);
		this.endOperation(200);
	}
	
	/**
	 * Override resolveSymbol with profiling
	 */
	protected async resolveSymbol(symbolSpec: string, customSymbolSessionId?: string): Promise<void> {
		this.startOperation(`resolveSymbol:${symbolSpec}`);
		this.send(this.createMessage('resolve_symbol', [
			this.chartSessionId,
			customSymbolSessionId || this.symbolSessionId,
			symbolSpec
		]));
		await this.sleep(500);
		this.endOperation(500);
	}
	
	/**
	 * Override modifySeries with profiling
	 */
	protected async modifySeries(
		seriesId: string,
		turnaroundId: string,
		symbolSessionId: string,
		resolution: string
	): Promise<void> {
		this.startOperation(`modifySeries:${turnaroundId}`);
		this.send(this.createMessage('modify_series', [
			this.chartSessionId,
			seriesId,
			turnaroundId,
			symbolSessionId,
			resolution,
			''
		]));
		await this.sleep(200);
		this.endOperation(200);
	}
	
	/**
	 * Override createSeries with profiling
	 */
	protected async createSeries(resolution: string, barsCount: number): Promise<void> {
		this.startOperation(`createSeries:${resolution}`);
		this.send(this.createMessage('create_series', [
			this.chartSessionId,
			'sds_1',
			's1',
			this.symbolSessionId,
			resolution,
			barsCount,
			''
		]));
		await this.sleep(200);
		this.endOperation(200);
	}
	
	/**
	 * Override waitForData with profiling
	 */
	protected async waitForData(ms: number = 5000): Promise<void> {
		this.startOperation('waitForData');
		await this.sleep(ms);
		this.endOperation(ms);
	}
	
	/**
	 * Override message received to track responses
	 */
	protected onMessageReceived(msg: any): void {
		this.responseReceived = true;
		
		// Log important message types
		if (msg.m === 'symbol_resolved') {
			console.log(`[Profiling] 📥 RESPONSE: symbol_resolved`);
		} else if (msg.m === 'du' || msg.m === 'timescale_update') {
			console.log(`[Profiling] 📥 RESPONSE: ${msg.m} (data arrived)`);
		}
	}
	
	/**
	 * Helper to create message (expose protected method)
	 */
	private createMessage(method: string, params: any[]) {
		return { m: method, p: params };
	}
	
	/**
	 * Get timing report
	 */
	getTimingReport(): string {
		const lines: string[] = [];
		lines.push('\n' + '='.repeat(80));
		lines.push('📊 TIMING ANALYSIS REPORT');
		lines.push('='.repeat(80) + '\n');
		
		// Group by operation type
		const grouped = new Map<string, TimingData[]>();
		for (const timing of this.timings) {
			const opType = timing.operation.split(':')[0];
			if (!grouped.has(opType)) {
				grouped.set(opType, []);
			}
			grouped.get(opType)!.push(timing);
		}
		
		// Report each operation type
		for (const [opType, timings] of grouped.entries()) {
			const avgDuration = timings.reduce((sum, t) => sum + t.duration, 0) / timings.length;
			const avgSleep = timings.reduce((sum, t) => sum + t.sleepTime, 0) / timings.length;
			const avgActual = timings.reduce((sum, t) => sum + t.actualResponseTime, 0) / timings.length;
			const wastedTime = avgSleep - avgActual;
			const wastedPercent = (wastedTime / avgDuration) * 100;
			
			lines.push(`${opType}:`);
			lines.push(`  Count: ${timings.length}`);
			lines.push(`  Avg Total: ${Math.round(avgDuration)}ms`);
			lines.push(`  Avg Actual: ${Math.round(avgActual)}ms`);
			lines.push(`  Avg Sleep: ${Math.round(avgSleep)}ms`);
			lines.push(`  Wasted: ${Math.round(wastedTime)}ms (${Math.round(wastedPercent)}% of total)`);
			lines.push('');
		}
		
		// Overall summary
		const totalDuration = this.timings.reduce((sum, t) => sum + t.duration, 0);
		const totalSleep = this.timings.reduce((sum, t) => sum + t.sleepTime, 0);
		const totalActual = this.timings.reduce((sum, t) => sum + t.actualResponseTime, 0);
		const totalWasted = totalSleep - totalActual;
		const wastedPercent = (totalWasted / totalDuration) * 100;
		
		lines.push('─'.repeat(80));
		lines.push('OVERALL:');
		lines.push(`  Total Duration: ${totalDuration}ms`);
		lines.push(`  Actual Work: ${totalActual}ms (${Math.round((totalActual/totalDuration)*100)}%)`);
		lines.push(`  Sleep Time: ${totalSleep}ms`);
		lines.push(`  Wasted Time: ${totalWasted}ms (${Math.round(wastedPercent)}%)`);
		lines.push('');
		lines.push(`💡 OPTIMIZATION POTENTIAL: ${Math.round(wastedPercent)}% faster by reducing sleeps!`);
		lines.push('='.repeat(80) + '\n');
		
		return lines.join('\n');
	}
	
	/**
	 * Get optimization recommendations
	 */
	getOptimizationRecommendations(): string {
		const lines: string[] = [];
		lines.push('\n' + '='.repeat(80));
		lines.push('💡 OPTIMIZATION RECOMMENDATIONS');
		lines.push('='.repeat(80) + '\n');
		
		// Analyze each operation
		const grouped = new Map<string, TimingData[]>();
		for (const timing of this.timings) {
			const opType = timing.operation.split(':')[0];
			if (!grouped.has(opType)) {
				grouped.set(opType, []);
			}
			grouped.get(opType)!.push(timing);
		}
		
		for (const [opType, timings] of grouped.entries()) {
			const avgActual = timings.reduce((sum, t) => sum + t.actualResponseTime, 0) / timings.length;
			const currentSleep = timings[0].sleepTime;
			const recommendedSleep = Math.max(50, Math.ceil(avgActual * 1.5)); // 50% buffer, min 50ms
			const savings = currentSleep - recommendedSleep;
			
			if (savings > 0) {
				lines.push(`${opType}:`);
				lines.push(`  Current sleep: ${currentSleep}ms`);
				lines.push(`  Actual response: ${Math.round(avgActual)}ms`);
				lines.push(`  Recommended: ${recommendedSleep}ms (${Math.round(avgActual)}ms + 50% buffer)`);
				lines.push(`  Savings: ${savings}ms per operation`);
				lines.push('');
			}
		}
		
		// Calculate total savings
		let totalSavings = 0;
		for (const [, timings] of grouped.entries()) {
			const avgActual = timings.reduce((sum, t) => sum + t.actualResponseTime, 0) / timings.length;
			const currentSleep = timings[0].sleepTime;
			const recommendedSleep = Math.max(50, Math.ceil(avgActual * 1.5));
			totalSavings += (currentSleep - recommendedSleep) * timings.length;
		}
		
		lines.push('─'.repeat(80));
		lines.push(`TOTAL SAVINGS PER SYMBOL: ~${totalSavings}ms`);
		lines.push(`SPEEDUP: ~${Math.round((totalSavings / this.timings.reduce((sum, t) => sum + t.duration, 0)) * 100)}% faster`);
		lines.push('='.repeat(80) + '\n');
		
		return lines.join('\n');
	}
	
	/**
	 * Implement required template method
	 */
	protected async requestHistoricalBars(): Promise<void> {
		// This will be called by subclass
	}
}

/**
 * Test client that uses profiling
 */
class ProfilingTestClient extends ProfilingWebSocketClient {
	private symbol: string;
	private resolution: string;
	private barsCount: number;
	
	constructor(jwtToken: string, symbol: string, resolution: string, barsCount: number) {
		super(jwtToken);
		this.symbol = symbol;
		this.resolution = resolution;
		this.barsCount = barsCount;
	}
	
	protected async requestHistoricalBars(): Promise<void> {
		await this.createChartSession();
		await this.createQuoteSession();
		
		const symbolSpec = createSymbolSpec(this.symbol, 'dividends');
		await this.resolveSymbol(symbolSpec);
		await this.createSeries(this.resolution, this.barsCount);
		await this.waitForData(5000);
	}
	
	async fetchData(): Promise<{ bars: OHLCVBar[]; metadata: Partial<SymbolMetadata> }> {
		await this.connect();
		await this.authenticate();
		await this.requestHistoricalBars();
		
		return {
			bars: this.getBars(),
			metadata: this.getMetadata()
		};
	}
}

export { ProfilingWebSocketClient, ProfilingTestClient };
