/**
 * Service Context
 * 
 * Shared dependencies for all v2 services.
 * Avoids passing 5+ parameters to every service constructor.
 * 
 * Pattern: Context Object (from Enterprise Application Architecture)
 */

import type { ProtocolHandler } from '../core/ProtocolHandler.js';
import type { RequestTracker } from '../components/RequestTracker.js';
import type { HeartbeatManager } from '../components/HeartbeatManager.js';
import type { StateMachine } from '../core/StateMachine.js';
import type { IWebSocketAdapter } from '../core/IWebSocketAdapter.js';
import type { TVMessage } from '../core/types.js';
import { EventEmitter } from 'events';

/**
 * Session management data
 */
export interface SessionManager {
	chartSessionId: string;
	quoteSessionId: string;
	symbolSessionCounter: number;
	seriesCounter: number;
	turnaroundCounter: number;
}

/**
 * Service Context
 * 
 * Contains all shared dependencies needed by services.
 * Passed to service constructors to avoid long parameter lists.
 */
export interface ServiceContext {
	/** Protocol handler for encoding/decoding messages */
	protocol: ProtocolHandler;
	
	/** Request tracker for managing pending requests */
	requestTracker: RequestTracker;
	
	/** Heartbeat manager for connection monitoring */
	heartbeat: HeartbeatManager;
	
	/** State machine for connection state */
	stateMachine: StateMachine;
	
	/** WebSocket adapter for sending messages */
	ws: IWebSocketAdapter | null;
	
	/** Event emitter for connection events */
	events: EventEmitter;
	
	/** Session IDs and counters */
	sessions: SessionManager;
	
	/** Configuration */
	config: {
		jwtToken: string;
		websocketUrl: string;
		chartId: string;
		connectionTimeout: number;
		dataTimeout: number;
		enableLogging: boolean;
		maxRequestsPerConnection: number;
	};
}
