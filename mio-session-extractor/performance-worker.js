// MIO Session Extractor - Performance Worker
// Phase 3: Web Worker for heavy computations and background processing

// Worker configuration
const WORKER_CONFIG = {
    BATCH_SIZE: 100,
    PROCESSING_INTERVAL: 1000,
    MAX_QUEUE_SIZE: 1000,
};

// Processing queues
let sessionProcessingQueue = [];
let performanceDataQueue = [];
let isProcessing = false;

/**
 * Phase 3: Heavy computation offloading
 * Process session data analysis in background
 */
function processSessionAnalytics(sessions) {
    const analytics = {
        totalSessions: sessions.length,
        averageSessionAge: 0,
        sessionSources: {},
        extractionPatterns: {},
        performanceMetrics: {
            processingTime: 0,
            memoryUsage: 0,
            cpuTime: 0,
        },
    };

    const startTime = performance.now();

    try {
        // Analyze session data
        let totalAge = 0;

        sessions.forEach((session) => {
            // Calculate session age
            if (session.extractedAt) {
                const age = Date.now() - new Date(session.extractedAt).getTime();
                totalAge += age;
            }

            // Track session sources
            const source = session.source || 'unknown';
            analytics.sessionSources[source] = (analytics.sessionSources[source] || 0) + 1;

            // Track extraction patterns
            const hour = new Date(session.extractedAt).getHours();
            analytics.extractionPatterns[hour] = (analytics.extractionPatterns[hour] || 0) + 1;
        });

        analytics.averageSessionAge = sessions.length > 0 ? totalAge / sessions.length : 0;
        analytics.performanceMetrics.processingTime = performance.now() - startTime;

        return analytics;
    } catch (error) {
        console.error('[WORKER] Error processing session analytics:', error);
        return null;
    }
}

/**
 * Phase 3: Performance data aggregation
 * Aggregate and analyze performance metrics
 */
function aggregatePerformanceData(performanceData) {
    const aggregated = {
        averageResponseTime: 0,
        totalRequests: 0,
        errorRate: 0,
        memoryTrends: [],
        cpuTrends: [],
        networkEfficiency: 0,
    };

    try {
        let totalResponseTime = 0;
        let totalErrors = 0;

        performanceData.forEach((data) => {
            if (data.responseTime) {
                totalResponseTime += data.responseTime;
                aggregated.totalRequests++;
            }

            if (data.error) {
                totalErrors++;
            }

            if (data.memoryUsage) {
                aggregated.memoryTrends.push({
                    timestamp: data.timestamp,
                    usage: data.memoryUsage,
                });
            }

            if (data.cpuUsage) {
                aggregated.cpuTrends.push({
                    timestamp: data.timestamp,
                    usage: data.cpuUsage,
                });
            }
        });

        aggregated.averageResponseTime =
            aggregated.totalRequests > 0 ? totalResponseTime / aggregated.totalRequests : 0;
        aggregated.errorRate = aggregated.totalRequests > 0 ? (totalErrors / aggregated.totalRequests) * 100 : 0;

        return aggregated;
    } catch (error) {
        console.error('[WORKER] Error aggregating performance data:', error);
        return null;
    }
}

/**
 * Phase 3: Batch processing with idle callbacks
 * Process queued tasks efficiently
 */
function processBatch() {
    if (isProcessing || sessionProcessingQueue.length === 0) {
        return;
    }

    isProcessing = true;

    try {
        const batch = sessionProcessingQueue.splice(0, WORKER_CONFIG.BATCH_SIZE);
        const results = [];

        batch.forEach((task) => {
            switch (task.type) {
                case 'sessionAnalytics':
                    const analytics = processSessionAnalytics(task.data);
                    if (analytics) {
                        results.push({
                            id: task.id,
                            type: 'sessionAnalytics',
                            result: analytics,
                        });
                    }
                    break;

                case 'performanceAggregation':
                    const aggregated = aggregatePerformanceData(task.data);
                    if (aggregated) {
                        results.push({
                            id: task.id,
                            type: 'performanceAggregation',
                            result: aggregated,
                        });
                    }
                    break;
            }
        });

        // Send results back to main thread
        if (results.length > 0) {
            self.postMessage({
                type: 'batchComplete',
                results: results,
            });
        }
    } catch (error) {
        console.error('[WORKER] Error processing batch:', error);
        self.postMessage({
            type: 'error',
            error: error.message,
        });
    } finally {
        isProcessing = false;
    }
}

/**
 * Message handler for main thread communication
 */
self.onmessage = function (e) {
    const { type, data, id } = e.data;

    switch (type) {
        case 'addTask':
            if (sessionProcessingQueue.length < WORKER_CONFIG.MAX_QUEUE_SIZE) {
                sessionProcessingQueue.push({
                    id: id || Date.now(),
                    type: data.taskType,
                    data: data.payload,
                    timestamp: Date.now(),
                });

                // Process immediately if queue was empty
                if (sessionProcessingQueue.length === 1) {
                    setTimeout(processBatch, 0);
                }
            } else {
                self.postMessage({
                    type: 'error',
                    error: 'Queue is full',
                });
            }
            break;

        case 'getQueueStatus':
            self.postMessage({
                type: 'queueStatus',
                queueSize: sessionProcessingQueue.length,
                isProcessing: isProcessing,
                maxQueueSize: WORKER_CONFIG.MAX_QUEUE_SIZE,
            });
            break;

        case 'clearQueue':
            sessionProcessingQueue = [];
            performanceDataQueue = [];
            self.postMessage({
                type: 'queueCleared',
            });
            break;

        default:
            console.warn('[WORKER] Unknown message type:', type);
    }
};

// Periodic batch processing
setInterval(() => {
    if (sessionProcessingQueue.length > 0) {
        processBatch();
    }
}, WORKER_CONFIG.PROCESSING_INTERVAL);

console.log('[WORKER] Performance worker initialized');
