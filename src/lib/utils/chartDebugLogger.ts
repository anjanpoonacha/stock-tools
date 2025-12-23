/**
 * Chart Data Performance Debug Logger
 * 
 * Centralized debug logging for chart data API performance monitoring.
 * Only logs when DEBUG_CHART_DATA environment variable is enabled.
 * 
 * Usage:
 *   - Set DEBUG_CHART_DATA=true in .env (local development only)
 *   - Import and use debug() functions throughout chart data flow
 * 
 * Categories:
 *   - api: API route level
 *   - service: Service layer operations
 *   - session: Session resolution (KV/cache)
 *   - jwt: JWT token fetching
 *   - data: Data fetching operations
 *   - ws: WebSocket operations
 *   - pool: Connection pool operations
 *   - cvd: CVD indicator operations
 */

// Performance thresholds for warnings (in milliseconds)
const THRESHOLDS = {
	session: 100,      // Session resolution should be fast (cached or KV)
	jwt: 200,          // JWT fetch can take time (TradingView API)
	data: 1000,        // Data fetch includes WebSocket operations
	ws_connect: 100,   // WebSocket connection
	ws_auth: 100,      // WebSocket authentication
	ws_resolve: 100,   // Symbol resolution
	ws_series: 200,    // Series creation
	ws_study: 500,     // CVD study creation (expensive)
	cvd_config: 300,   // CVD config fetch
	total: 2000        // Total request time
};

/**
 * Check if debug logging is enabled
 */
export function isDebugEnabled(): boolean {
	return process.env.DEBUG_CHART_DATA === 'true';
}

/**
 * Format duration with performance indicator
 */
function formatDuration(ms: number, threshold?: number): string {
	const indicator = threshold && ms > threshold ? ' ⚠️ SLOW' : '';
	return `${ms}ms${indicator}`;
}

/**
 * Format timestamp for logs
 */
function timestamp(): string {
	return new Date().toISOString().split('T')[1].slice(0, -1); // HH:MM:SS.mmm
}

/**
 * Core debug log function
 */
function log(category: string, message: string, data?: any): void {
	if (!isDebugEnabled()) return;
	
	const prefix = `[${timestamp()}][Chart:${category}]`;
	if (data !== undefined) {
		console.log(prefix, message, data);
	} else {
		console.log(prefix, message);
	}
}

/**
 * API Route Level Logging
 */
export const debugApi = {
	requestStart: (symbol: string, resolution: string, barsCount: string, cvdEnabled: boolean) => {
		log('api', `📥 Request: ${symbol}, ${resolution}, ${barsCount} bars, CVD: ${cvdEnabled}`);
	},
	
	cacheHit: (cacheKey: string) => {
		log('api', `✅ Cache HIT: ${cacheKey}`);
	},
	
	cacheMiss: (cacheKey: string) => {
		log('api', `❌ Cache MISS: ${cacheKey}`);
	},
	
	requestComplete: (duration: number) => {
		log('api', `📤 Request complete: ${formatDuration(duration, THRESHOLDS.total)}`);
	}
};

/**
 * Service Layer Logging
 */
export const debugService = {
	sessionStart: () => {
		log('service', '🔐 Session resolution started');
	},
	
	sessionComplete: (duration: number, cached: boolean) => {
		const source = cached ? 'cache' : 'KV lookup';
		log('service', `🔐 Session resolved: ${formatDuration(duration, THRESHOLDS.session)} (${source})`);
	},
	
	jwtStart: () => {
		log('service', '🎫 JWT token fetch started');
	},
	
	jwtComplete: (duration: number, cached: boolean) => {
		const source = cached ? 'cache' : 'TradingView API';
		log('service', `🎫 JWT fetched: ${formatDuration(duration, THRESHOLDS.jwt)} (${source})`);
	},
	
	dataStart: (usePool: boolean) => {
		log('service', `📊 Data fetch started (${usePool ? 'connection pool' : 'direct'})`);
	},
	
	dataComplete: (duration: number) => {
		log('service', `📊 Data fetched: ${formatDuration(duration, THRESHOLDS.data)}`);
	},
	
	breakdown: (sessionMs: number, jwtMs: number, dataMs: number, totalMs: number) => {
		log('service', `⏱️  Breakdown: Session=${sessionMs}ms, JWT=${jwtMs}ms, Data=${dataMs}ms, Total=${totalMs}ms`);
	}
};

/**
 * WebSocket Operations Logging
 */
export const debugWs = {
	connecting: () => {
		log('ws', '🔌 Connecting to TradingView WebSocket...');
	},
	
	connected: (duration: number) => {
		log('ws', `🔌 Connected: ${formatDuration(duration, THRESHOLDS.ws_connect)}`);
	},
	
	authenticating: () => {
		log('ws', '🔑 Authenticating...');
	},
	
	authenticated: (duration: number) => {
		log('ws', `🔑 Authenticated: ${formatDuration(duration, THRESHOLDS.ws_auth)}`);
	},
	
	resolvingSymbol: (symbol: string) => {
		log('ws', `🔍 Resolving symbol: ${symbol}`);
	},
	
	symbolResolved: (duration: number) => {
		log('ws', `🔍 Symbol resolved: ${formatDuration(duration, THRESHOLDS.ws_resolve)}`);
	},
	
	creatingSeries: (resolution: string, barsCount: number) => {
		log('ws', `📈 Creating series: ${resolution}, ${barsCount} bars`);
	},
	
	seriesCreated: (duration: number) => {
		log('ws', `📈 Series created: ${formatDuration(duration, THRESHOLDS.ws_series)}`);
	},
	
	modifyingSeries: (symbol: string) => {
		log('ws', `📝 Modifying series to: ${symbol}`);
	},
	
	seriesModified: (duration: number) => {
		log('ws', `📝 Series modified: ${formatDuration(duration)}`);
	},
	
	waitingForData: (timeout: number) => {
		log('ws', `⏳ Waiting for data (timeout: ${timeout}ms)...`);
	},
	
	dataReceived: (barCount: number, duration: number) => {
		log('ws', `✅ Data received: ${barCount} bars in ${duration}ms`);
	},
	
	breakdown: (connectMs: number, authMs: number, resolveMs: number, seriesMs: number, waitMs: number) => {
		log('ws', `⏱️  WS Breakdown: Connect=${connectMs}ms, Auth=${authMs}ms, Resolve=${resolveMs}ms, Series=${seriesMs}ms, Wait=${waitMs}ms`);
	}
};

/**
 * Connection Pool Logging
 */
export const debugPool = {
	acquiring: () => {
		log('pool', '🔄 Acquiring connection from pool...');
	},
	
	reusingConnection: (connectionId: number, requestCount: number) => {
		log('pool', `♻️  Reusing connection #${connectionId} (request #${requestCount})`);
	},
	
	newConnection: (connectionId: number) => {
		log('pool', `🆕 Creating new connection #${connectionId}`);
	},
	
	refreshingConnection: (connectionId: number, requestCount: number) => {
		log('pool', `🔄 Refreshing connection #${connectionId} (after ${requestCount} requests)`);
	},
	
	fetchComplete: (duration: number) => {
		log('pool', `✅ Pool fetch complete: ${duration}ms`);
	}
};

/**
 * CVD-Specific Logging
 */
export const debugCvd = {
	configStart: (anchorPeriod: string, timeframe?: string) => {
		log('cvd', `⚙️  Fetching CVD config: anchor=${anchorPeriod}, timeframe=${timeframe || 'default'}`);
	},
	
	configFetched: (duration: number, source: 'cache' | 'TradingView') => {
		log('cvd', `⚙️  CVD config fetched: ${formatDuration(duration, THRESHOLDS.cvd_config)} (${source})`);
	},
	
	configDetails: (config: any) => {
		log('cvd', `⚙️  CVD config:`, {
			pineId: config.pineId,
			pineVersion: config.pineVersion,
			inputs: config.inputs,
			textLength: typeof config.text === 'string' ? config.text.length : 0
		});
	},
	
	studyStart: () => {
		log('cvd', '📊 Creating CVD study...');
	},
	
	studyCreated: (duration: number) => {
		log('cvd', `📊 CVD study created: ${formatDuration(duration, THRESHOLDS.ws_study)}`);
	},
	
	dataReceived: (pointCount: number) => {
		log('cvd', `✅ CVD data received: ${pointCount} data points`);
	},
	
	skipped: (reason: string) => {
		log('cvd', `⏭️  CVD skipped: ${reason}`);
	},
	
	error: (error: string) => {
		log('cvd', `❌ CVD error: ${error}`);
	}
};

/**
 * Session Resolution Logging
 */
export const debugSession = {
	kvLookupStart: (platform: string, userEmail: string) => {
		log('session', `🔍 KV lookup: ${platform}, ${userEmail}`);
	},
	
	kvLookupComplete: (duration: number, found: boolean) => {
		log('session', `🔍 KV lookup ${found ? 'found' : 'not found'}: ${duration}ms`);
	},
	
	cacheHit: (userEmail: string) => {
		log('session', `✅ Cache HIT: ${userEmail}`);
	}
};

/**
 * JWT Token Logging
 */
export const debugJwt = {
	apiCallStart: () => {
		log('jwt', '🌐 Calling TradingView API...');
	},
	
	apiCallComplete: (duration: number) => {
		log('jwt', `🌐 TradingView API responded: ${duration}ms`);
	},
	
	cacheHit: (sessionId: string) => {
		log('jwt', `✅ Cache HIT: ${sessionId.substring(0, 10)}...`);
	}
};
