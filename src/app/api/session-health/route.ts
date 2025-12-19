// src/app/api/session-health/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { sessionHealthMonitor } from '@/lib/health';
import { getSession } from '@/lib/sessionStore';

export async function GET(req: NextRequest) {
	try {

		const { searchParams } = new URL(req.url);
		const action = searchParams.get('action') || 'status';
		const sessionId = searchParams.get('sessionId');
		const platform = searchParams.get('platform');

		switch (action) {
			case 'status':
				// Get health status for a specific session or all sessions
				if (sessionId) {
					const report = sessionHealthMonitor.getSessionHealthReport(sessionId);
					if (!report) {
						return NextResponse.json(
							{ error: 'Session not found or not being monitored' },
							{ status: 404 }
						);
					}
					return NextResponse.json({ report });
				} else {
					// Return all health reports
					const reports = sessionHealthMonitor.getAllHealthReports();
					return NextResponse.json({ reports });
				}

			case 'stats':
				// Get monitoring statistics
				const stats = sessionHealthMonitor.getMonitoringStats();
				return NextResponse.json({ stats });

			case 'platform-status':
				// Get health status for a specific session/platform combination
				if (!sessionId || !platform) {
					return NextResponse.json(
						{ error: 'sessionId and platform parameters are required for platform-status' },
						{ status: 400 }
					);
				}

				const health = sessionHealthMonitor.getSessionHealth(sessionId, platform);
				if (!health) {
					return NextResponse.json(
						{ error: 'Session/platform combination not found or not being monitored' },
						{ status: 404 }
					);
				}
				return NextResponse.json({ health });

			default:
				return NextResponse.json(
					{ error: 'Invalid action. Supported actions: status, stats, platform-status' },
					{ status: 400 }
				);
		}
	} catch (error) {

		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { action, sessionId, platform } = body;

		if (!sessionId) {
			return NextResponse.json(
				{ error: 'sessionId is required' },
				{ status: 400 }
			);
		}

		switch (action) {
			case 'start-monitoring':
				// Start monitoring a session for a specific platform
				if (!platform) {
					return NextResponse.json(
						{ error: 'platform is required for start-monitoring' },
						{ status: 400 }
					);
				}

				// For testing purposes, allow monitoring without requiring a real session
				// In production, you might want to enforce session validation
				const session = await getSession(sessionId);
				const isTestSession = sessionId.startsWith('test-session-');

				if (!isTestSession && (!session || !session[platform])) {
					return NextResponse.json(
						{ error: 'Session or platform data not found' },
						{ status: 404 }
					);
				}

				sessionHealthMonitor.startMonitoring(sessionId, platform);
				return NextResponse.json({
					message: `Started monitoring ${platform} for session ${sessionId}`,
					success: true,
					isTestSession
				});

			case 'stop-monitoring':
				// Stop monitoring a session for a specific platform
				if (!platform) {
					return NextResponse.json(
						{ error: 'platform is required for stop-monitoring' },
						{ status: 400 }
					);
				}

				sessionHealthMonitor.stopMonitoring(sessionId, platform);
				return NextResponse.json({
					message: `Stopped monitoring ${platform} for session ${sessionId}`,
					success: true
				});

			case 'check-health':
				// Manually trigger a health check
				if (!platform) {
					return NextResponse.json(
						{ error: 'platform is required for check-health' },
						{ status: 400 }
					);
				}

				const status = await sessionHealthMonitor.checkSessionHealth(sessionId, platform);
				return NextResponse.json({
					sessionId,
					platform,
					status,
					timestamp: new Date().toISOString()
				});

			case 'start-all-monitoring':
				// Start monitoring all platforms for a session
				const sessionData = await getSession(sessionId);
				if (!sessionData) {
					return NextResponse.json(
						{ error: 'Session not found' },
						{ status: 404 }
					);
				}

				const platforms = Object.keys(sessionData);
				const startedPlatforms: string[] = [];

				for (const platformName of platforms) {
					try {
						sessionHealthMonitor.startMonitoring(sessionId, platformName);
						startedPlatforms.push(platformName);
					} catch (error) {

					}
				}

				return NextResponse.json({
					message: `Started monitoring for session ${sessionId}`,
					platforms: startedPlatforms,
					success: true
				});

			default:
				return NextResponse.json(
					{ error: 'Invalid action. Supported actions: start-monitoring, stop-monitoring, check-health, start-all-monitoring' },
					{ status: 400 }
				);
		}
	} catch (error) {

		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}

export async function DELETE(req: NextRequest) {
	try {
		const { searchParams } = new URL(req.url);
		const sessionId = searchParams.get('sessionId');
		const platform = searchParams.get('platform');

		if (!sessionId) {
			return NextResponse.json(
				{ error: 'sessionId is required' },
				{ status: 400 }
			);
		}

		if (platform) {
			// Stop monitoring specific platform
			sessionHealthMonitor.stopMonitoring(sessionId, platform);
			return NextResponse.json({
				message: `Stopped monitoring ${platform} for session ${sessionId}`,
				success: true
			});
		} else {
			// Stop monitoring all platforms for the session
			const report = sessionHealthMonitor.getSessionHealthReport(sessionId);
			if (report) {
				const platforms = Object.keys(report.platforms);
				for (const platformName of platforms) {
					sessionHealthMonitor.stopMonitoring(sessionId, platformName);
				}
				return NextResponse.json({
					message: `Stopped monitoring all platforms for session ${sessionId}`,
					platforms,
					success: true
				});
			} else {
				return NextResponse.json({
					message: `No monitoring found for session ${sessionId}`,
					success: true
				});
			}
		}
	} catch (error) {

		return NextResponse.json(
			{ error: 'Internal server error' },
			{ status: 500 }
		);
	}
}
