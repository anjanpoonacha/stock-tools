/**
 * MessageHandlerService
 * 
 * Handles all incoming WebSocket messages and routes them to appropriate handlers.
 * Extracted from WebSocketConnection to improve modularity (1186 lines → smaller components).
 * 
 * RESPONSIBILITIES:
 * - Parse and route incoming messages
 * - Handle protocol errors (recoverable vs fatal)
 * - Handle symbol resolution responses
 * - Handle data updates (OHLCV bars and indicators)
 * - Correlate responses with pending requests
 * 
 * ARCHITECTURE:
 * - Receives ServiceContext with all dependencies
 * - Message handlers are private (internal routing logic)
 * - Main entry point: handleMessage() - called from WebSocketConnection
 */

import type { ServiceContext } from './ServiceContext';
import type { TVMessage, OHLCVBar, SymbolMetadata, IndicatorBar, IndicatorData } from '../core/types';
import { ProtocolError, SymbolError } from '../errors/ConnectionError';
import { ConnectionState } from '../core/types';

/**
 * Pending symbol data structure (shared with WebSocketConnection)
 */
export interface PendingSymbolData {
	bars: OHLCVBar[];
	metadata: Partial<SymbolMetadata>;
	indicators: Map<string, IndicatorData>;
	symbolSessionId: string;
	seriesId: string;
	studyIds: Map<string, string>;
}

/**
 * MessageHandlerService
 * 
 * Processes incoming WebSocket messages and updates request/data state.
 */
export class MessageHandlerService {
	constructor(
		private ctx: ServiceContext,
		private getPendingData: () => PendingSymbolData | null,
		private getSeriesIdMap: () => Map<string, string>
	) {}

	/**
	 * Handle incoming WebSocket message
	 * 
	 * Main entry point - parses frame and routes messages to handlers.
	 * Also handles heartbeat responses.
	 */
	handleMessage(data: string): void {
		const { messages, heartbeats } = this.ctx.protocol.parseFrame(data);

		// Handle heartbeats FIRST (critical priority!)
		for (const heartbeat of heartbeats) {
			const echo = this.ctx.heartbeat.handleHeartbeat(heartbeat);
			if (this.ctx.ws) {
				this.ctx.ws.send(echo);
				this.ctx.heartbeat.recordSent();
				this.ctx.events.emit('heartbeat:sent', Date.now());
			}
		}

		// Process protocol messages
		for (const message of messages) {
			this.ctx.events.emit('message:received', message, data);

			// Dispatch to specific handlers
			switch (message.m) {
				case 'protocol_error':
					this.handleProtocolError(message);
					break;

				case 'critical_error':
					this.handleProtocolError(message); // Treat critical_error same as protocol_error
					break;

				case 'symbol_resolved':
					this.handleSymbolResolved(message);
					break;

				case 'symbol_error':
					this.handleSymbolError(message);
					break;

				case 'timescale_update':
				case 'du':
					this.handleDataUpdate(message);
					break;

				default:
					// Ignore unknown messages
					if (this.ctx.config.enableLogging) {
						console.log(`[MessageHandlerService] Unknown message: ${message.m}`);
					}
			}
		}
	}

	/**
	 * Handle protocol error message
	 * 
	 * Classifies errors as recoverable (request-level) or fatal (connection-level).
	 * Recoverable errors only fail the specific request; fatal errors terminate connection.
	 */
	private handleProtocolError(message: TVMessage): void {
		const turnaroundId = message.p[0] as string;
		const errorMessage = (message.p[1] || message.p[0]) as string;
		
		// Classify error severity
		const isRecoverable = this.isRecoverableError(errorMessage);
		
		if (isRecoverable) {
			// Request-level error - fail only this request
			if (this.ctx.config.enableLogging) {
				console.log(`[MessageHandlerService] ⚠️  Recoverable Error: ${errorMessage}`);
			}
			
			// Find and cancel only the specific request
			const request = this.ctx.requestTracker.getRequestByTurnaround(turnaroundId);
			if (request) {
				this.ctx.requestTracker.cancelRequest(request.id, `Protocol error: ${errorMessage}`);
			}
			
			// Emit warning, NOT error (keeps connection alive)
			this.ctx.events.emit('warning', errorMessage);
			
			// Connection stays READY - no state transition
		} else {
			// Connection-level error - fatal
			if (this.ctx.config.enableLogging) {
				console.log(`[MessageHandlerService] ❌ Fatal Error: ${errorMessage}`);
				console.log(`[MessageHandlerService] Full message:`, JSON.stringify(message));
			}
			
			const error = new ProtocolError(errorMessage);
			this.ctx.stateMachine.forceTransition(ConnectionState.ERROR);
			this.ctx.events.emit('error', error);
			this.ctx.requestTracker.cancelAllRequests('Fatal protocol error');
		}
	}
	
	/**
	 * Determine if an error is recoverable (request-level) vs fatal (connection-level)
	 * 
	 * Recoverable errors are typically data-related (bad symbol, invalid config, etc.)
	 * Fatal errors are authentication failures, protocol violations, etc.
	 */
	private isRecoverableError(errorMessage: string): boolean {
		const recoverablePatterns = [
			'exceed limit of series',
			'symbol not found',
			'invalid resolution',
			'invalid timeframe',
			'invalid period',
			'symbol error',
			'study error',
			'series error'
		];
		
		return recoverablePatterns.some(pattern => 
			errorMessage.toLowerCase().includes(pattern)
		);
	}

	/**
	 * Handle symbol_resolved message
	 * 
	 * Updates pending data with symbol metadata and resolves the resolve_symbol request.
	 */
	private handleSymbolResolved(message: TVMessage): void {
		const [, symbolSession, metadata] = message.p as [string, string, SymbolMetadata];
		
		// Find and resolve the resolve_symbol request
		const requests = this.ctx.requestTracker.getAllRequests();
		for (const request of requests) {
			if (request.type === 'resolve_symbol' && 
				request.params[1] === symbolSession) {
				this.ctx.requestTracker.resolveRequest(request.id, metadata);
				break;
			}
		}
		
		// Only update metadata if this is for the CURRENT symbol request
		// This prevents stale responses from overwriting current data
		const pendingData = this.getPendingData();
		if (pendingData && pendingData.symbolSessionId === symbolSession) {
			pendingData.metadata = metadata;
		}
	}

	/**
	 * Handle symbol_error message
	 * 
	 * Rejects the resolve_symbol request with a SymbolError.
	 */
	private handleSymbolError(message: TVMessage): void {
		const [, symbol, reason] = message.p as [string, string, string];
		
		const error = new SymbolError(symbol, reason);
		this.ctx.events.emit('symbol:error', symbol, reason);

		// Find and reject the resolve_symbol request
		const requests = this.ctx.requestTracker.getAllRequests();
		for (const request of requests) {
			if (request.type === 'resolve_symbol') {
				this.ctx.requestTracker.rejectRequest(request.id, error);
				break;
			}
		}
	}

	/**
	 * Handle timescale_update or du (data update) message
	 * 
	 * Parses OHLCV bars and indicator data, correlates with pending requests,
	 * and resolves the appropriate create_series/create_study requests.
	 * 
	 * Uses multi-tier correlation strategy:
	 * 1. Series ID mapping (most precise for concurrent requests)
	 * 2. Turnaround ID (good for single requests)
	 * 3. Fallback to oldest pending request (last resort)
	 */
	private handleDataUpdate(message: TVMessage): void {
		// Extract series data
		const [, data] = message.p as [string, Record<string, any>];
		
		// RACE CONDITION DEBUG: Log all data update messages
		if (this.ctx.config.enableLogging) {
			console.log('[MessageHandlerService] 📥 Data update received:', {
				messageType: message.m,
				seriesKeys: Object.keys(data),
				dataPreview: JSON.stringify(data).substring(0, 200)
			});
		}
		
		const pendingData = this.getPendingData();
		const seriesIdMap = this.getSeriesIdMap();
		
		// Check if we have pending data and look for its series ID in the response
		// Series ID is dynamic (sds_1, sds_2, etc.) to support symbol switching
		if (pendingData) {
			const seriesKey = pendingData.seriesId;
			
			if (data[seriesKey]) {
				const seriesData = data[seriesKey];
				
				// Parse OHLCV bars
				if (seriesData.s) {
					for (const bar of seriesData.s) {
						const ohlcvBar: OHLCVBar = {
							time: bar.v[0],
							open: bar.v[1],
							high: bar.v[2],
							low: bar.v[3],
							close: bar.v[4],
							volume: bar.v[5]
						};
						pendingData.bars.push(ohlcvBar);
					}
				}

				// ENHANCED: Multi-tier request correlation strategy
				// Priority 1: Series ID mapping (most precise for concurrent requests)
				if (seriesIdMap.has(seriesKey)) {
					const requestId = seriesIdMap.get(seriesKey)!;
					const request = this.ctx.requestTracker.getRequest(requestId);
					
					if (request) {
						this.ctx.requestTracker.resolveRequest(request.id, true);
						
						if (this.ctx.config.enableLogging) {
							console.log(`[MessageHandlerService] ✅ Resolved create_series via seriesId: ${seriesKey}`);
						}
					} else {
						if (this.ctx.config.enableLogging) {
							console.log(`[MessageHandlerService] ⚠️  Series ID ${seriesKey} mapped but request not found (may be cancelled)`);
						}
					}
				} else {
					// Priority 2: Turnaround ID (good for single requests)
					const turnaround = seriesData.ns?.d || seriesData.lbs?.d;
					
					if (turnaround) {
						const matchingRequest = this.ctx.requestTracker.getRequestByTurnaround(turnaround);
						
						if (matchingRequest) {
							this.ctx.requestTracker.resolveRequest(matchingRequest.id, true);
							
							if (this.ctx.config.enableLogging) {
								console.log(`[MessageHandlerService] ✅ Resolved create_series via turnaround: ${turnaround}`);
							}
						} else {
							if (this.ctx.config.enableLogging) {
								console.log(`[MessageHandlerService] ⚠️  Turnaround ${turnaround} not found (may be cancelled)`);
							}
						}
					} else {
						// Priority 3: Fallback to oldest pending request (last resort)
						const requests = this.ctx.requestTracker.getAllRequests();
						for (const request of requests) {
							if (request.type === 'create_series') {
								this.ctx.requestTracker.resolveRequest(request.id, true);
								
								if (this.ctx.config.enableLogging) {
									console.log(`[MessageHandlerService] ⚠️  No correlation ID, resolved oldest create_series`);
								}
								break;
							}
						}
					}
				}
			}
		}

		// Check for study data (only if we have pending data)
		if (pendingData) {
			for (const [studyType, studyId] of pendingData.studyIds.entries()) {
				if (data[studyId]) {
					const studyData = data[studyId];
					
					const indicatorBars: IndicatorBar[] = [];
					if (studyData.st) {
						for (const bar of studyData.st) {
							indicatorBars.push({
								time: bar.v[0],
								values: bar.v.slice(1)
							});
						}
					}

					pendingData.indicators.set(studyType, {
						indicatorId: studyId,
						type: studyType,
						config: {},
						bars: indicatorBars
					});

					this.ctx.events.emit('indicator:received', studyType, studyId, indicatorBars.length);

					// Resolve create_study request
					const requests = this.ctx.requestTracker.getAllRequests();
					for (const request of requests) {
						if (request.type === 'create_study' && 
							request.params[1] === studyId) {
							this.ctx.requestTracker.resolveRequest(request.id, true);
							break;
						}
					}
				}
			}
		}
	}
}
