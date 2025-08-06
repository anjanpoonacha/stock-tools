// src/app/api/test-session/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { SessionFlowTester, TestSuite } from '@/lib/sessionFlowTester';

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { action, testSuite, sessionId } = body;

		const tester = new SessionFlowTester();

		switch (action) {
			case 'runAllTests':
				console.log('[API] Running all session management tests...');
				const allTestResults = await tester.runAllTests();
				const report = tester.generateTestReport(allTestResults);
				
				return NextResponse.json({
					success: true,
					testSuites: allTestResults,
					report,
					summary: {
						totalSuites: allTestResults.length,
						totalTests: allTestResults.reduce((sum, suite) => sum + suite.tests.length, 0),
						totalSuccesses: allTestResults.reduce((sum, suite) => sum + suite.successCount, 0),
						totalFailures: allTestResults.reduce((sum, suite) => sum + suite.failureCount, 0),
						overallSuccess: allTestResults.every(suite => suite.overallSuccess)
					}
				});

			case 'runSpecificSuite':
				if (!testSuite) {
					return NextResponse.json({
						success: false,
						error: 'Test suite name is required'
					}, { status: 400 });
				}

				console.log(`[API] Running specific test suite: ${testSuite}`);
				let suiteResult: TestSuite;

				switch (testSuite) {
					case 'sessionCreationAndValidation':
						suiteResult = await tester['testSessionCreationAndValidation']();
						break;
					case 'healthMonitoringIntegration':
						suiteResult = await tester['testHealthMonitoringIntegration']();
						break;
					case 'errorHandlingScenarios':
						suiteResult = await tester['testErrorHandlingScenarios']();
						break;
					case 'cookieParsingRobustness':
						suiteResult = await tester['testCookieParsingRobustness']();
						break;
					case 'sessionRefreshMechanisms':
						suiteResult = await tester['testSessionRefreshMechanisms']();
						break;
					case 'crossPlatformOperations':
						suiteResult = await tester['testCrossPlatformOperations']();
						break;
					case 'completeSessionFlow':
						suiteResult = await tester['testCompleteSessionFlow']();
						break;
					default:
						return NextResponse.json({
							success: false,
							error: `Unknown test suite: ${testSuite}`
						}, { status: 400 });
				}

				return NextResponse.json({
					success: true,
					testSuite: suiteResult,
					summary: {
						suiteName: suiteResult.suiteName,
						totalTests: suiteResult.tests.length,
						successCount: suiteResult.successCount,
						failureCount: suiteResult.failureCount,
						overallSuccess: suiteResult.overallSuccess,
						duration: suiteResult.totalDuration
					}
				});

			case 'quickHealthCheck':
				console.log('[API] Running quick health check...');
				const healthResults = await tester.quickHealthCheck();
				
				return NextResponse.json({
					success: true,
					healthCheck: healthResults,
					summary: {
						overallHealth: healthResults.overallHealth,
						componentsHealthy: Object.values(healthResults).filter(Boolean).length - 1, // -1 for overallHealth
						totalComponents: Object.keys(healthResults).length - 1
					}
				});

			case 'validateSession':
				if (!sessionId) {
					return NextResponse.json({
						success: false,
						error: 'Session ID is required for validation'
					}, { status: 400 });
				}

				console.log(`[API] Validating session: ${sessionId}`);
				
				// Import session validation functions
				const { getHealthAwareSessionData } = await import('@/lib/sessionValidation');
				const { MIOService } = await import('@/lib/MIOService');
				
				try {
					const healthResult = getHealthAwareSessionData(sessionId);
					const sessionKeyValue = MIOService.getSessionKeyValue(sessionId);
					
					return NextResponse.json({
						success: true,
						validation: {
							sessionExists: healthResult.sessionExists,
							overallStatus: healthResult.overallStatus,
							recommendations: healthResult.recommendations,
							hasValidCookies: !!sessionKeyValue,
							sessionKeyValue: sessionKeyValue ? {
								key: sessionKeyValue.key,
								valueLength: sessionKeyValue.value.length
							} : null
						}
					});
				} catch (error) {
					return NextResponse.json({
						success: false,
						error: `Session validation failed: ${error instanceof Error ? error.message : String(error)}`
					}, { status: 500 });
				}

			case 'testSessionRefresh':
				if (!sessionId) {
					return NextResponse.json({
						success: false,
						error: 'Session ID is required for refresh test'
					}, { status: 400 });
				}

				console.log(`[API] Testing session refresh: ${sessionId}`);
				
				try {
					const { MIOService } = await import('@/lib/MIOService');
					const refreshResult = await MIOService.refreshSession(sessionId);
					
					return NextResponse.json({
						success: true,
						refreshTest: {
							refreshAttempted: true,
							refreshSuccess: refreshResult,
							sessionId
						}
					});
				} catch (error) {
					return NextResponse.json({
						success: true, // Still successful test, even if refresh failed
						refreshTest: {
							refreshAttempted: true,
							refreshSuccess: false,
							error: error instanceof Error ? error.message : String(error),
							sessionId
						}
					});
				}

			case 'testHealthMonitoring':
				if (!sessionId) {
					return NextResponse.json({
						success: false,
						error: 'Session ID is required for health monitoring test'
					}, { status: 400 });
				}

				console.log(`[API] Testing health monitoring: ${sessionId}`);
				
				try {
					const { SessionHealthMonitor } = await import('@/lib/sessionHealthMonitor');
					const monitor = SessionHealthMonitor.getInstance();
					
					// Attempt health check
					let healthCheckResult = false;
					try {
						await monitor.checkSessionHealth(sessionId, 'marketinout');
						healthCheckResult = true;
					} catch (error) {
						// Expected to fail with test data
					}
					
					const status = monitor.getSessionStatus(sessionId, 'marketinout');
					
					return NextResponse.json({
						success: true,
						healthMonitoring: {
							monitorActive: monitor.isRunning(),
							healthCheckAttempted: true,
							healthCheckSuccess: healthCheckResult,
							sessionStatus: status ? {
								healthStatus: status.healthStatus,
								lastChecked: status.lastChecked,
								consecutiveFailures: status.consecutiveFailures
							} : null
						}
					});
				} catch (error) {
					return NextResponse.json({
						success: false,
						error: `Health monitoring test failed: ${error instanceof Error ? error.message : String(error)}`
					}, { status: 500 });
				}

			default:
				return NextResponse.json({
					success: false,
					error: `Unknown action: ${action}`
				}, { status: 400 });
		}

	} catch (error) {
		console.error('[API] Session test error:', error);
		return NextResponse.json({
			success: false,
			error: `Server error: ${error instanceof Error ? error.message : String(error)}`
		}, { status: 500 });
	}
}

export async function GET(request: NextRequest) {
	try {
		const { searchParams } = new URL(request.url);
		const action = searchParams.get('action');

		if (action === 'getAvailableTests') {
			return NextResponse.json({
				success: true,
				availableTests: {
					testSuites: [
						{
							id: 'sessionCreationAndValidation',
							name: 'Session Creation & Validation',
							description: 'Tests session creation, storage, and basic validation functionality'
						},
						{
							id: 'healthMonitoringIntegration',
							name: 'Health Monitoring Integration',
							description: 'Tests health monitoring system integration and status tracking'
						},
						{
							id: 'errorHandlingScenarios',
							name: 'Error Handling Scenarios',
							description: 'Tests various error conditions and recovery mechanisms'
						},
						{
							id: 'cookieParsingRobustness',
							name: 'Cookie Parsing Robustness',
							description: 'Tests ASPSESSION cookie detection and parsing capabilities'
						},
						{
							id: 'sessionRefreshMechanisms',
							name: 'Session Refresh Mechanisms',
							description: 'Tests automatic session refresh and retry logic'
						},
						{
							id: 'crossPlatformOperations',
							name: 'Cross-Platform Operations',
							description: 'Tests multi-platform session management and bridging'
						},
						{
							id: 'completeSessionFlow',
							name: 'Complete End-to-End Flow',
							description: 'Tests full session lifecycle and component integration'
						}
					],
					individualActions: [
						{
							id: 'quickHealthCheck',
							name: 'Quick Health Check',
							description: 'Rapid validation of all session management components'
						},
						{
							id: 'validateSession',
							name: 'Validate Session',
							description: 'Validate a specific session ID (requires sessionId parameter)'
						},
						{
							id: 'testSessionRefresh',
							name: 'Test Session Refresh',
							description: 'Test session refresh mechanism (requires sessionId parameter)'
						},
						{
							id: 'testHealthMonitoring',
							name: 'Test Health Monitoring',
							description: 'Test health monitoring for a session (requires sessionId parameter)'
						}
					]
				}
			});
		}

		if (action === 'quickHealthCheck') {
			const tester = new SessionFlowTester();
			const healthResults = await tester.quickHealthCheck();
			
			return NextResponse.json({
				success: true,
				healthCheck: healthResults,
				summary: {
					overallHealth: healthResults.overallHealth,
					componentsHealthy: Object.values(healthResults).filter(Boolean).length - 1,
					totalComponents: Object.keys(healthResults).length - 1
				}
			});
		}

		return NextResponse.json({
			success: false,
			error: 'Invalid or missing action parameter'
		}, { status: 400 });

	} catch (error) {
		console.error('[API] Session test GET error:', error);
		return NextResponse.json({
			success: false,
			error: `Server error: ${error instanceof Error ? error.message : String(error)}`
		}, { status: 500 });
	}
}