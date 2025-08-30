'use client';

import React, { useState } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
    CheckCircle,
    XCircle,
    Clock,
    Play,
    RefreshCw,
    AlertTriangle,
    Activity,
    Database,
    Shield,
    Zap,
    Network,
    Settings,
    FileText,
    Download,
} from 'lucide-react';
import { useInternalSessionId } from '@/lib/useInternalSessionId';

interface TestResult {
    testName: string;
    success: boolean;
    message: string;
    details?: unknown;
    duration: number;
    timestamp: string;
}

interface TestSuite {
    suiteName: string;
    tests: TestResult[];
    overallSuccess: boolean;
    totalDuration: number;
    successCount: number;
    failureCount: number;
}

interface TestProgress {
    currentSuite: string;
    currentTest: string;
    completedSuites: number;
    totalSuites: number;
    completedTests: number;
    totalTests: number;
    isRunning: boolean;
}

export default function TestSessionFlowPage() {
    const [testResults, setTestResults] = useState<TestSuite[]>([]);
    const [testProgress, setTestProgress] = useState<TestProgress>({
        currentSuite: '',
        currentTest: '',
        completedSuites: 0,
        totalSuites: 7,
        completedTests: 0,
        totalTests: 0,
        isRunning: false,
    });
    const [customSessionId, setCustomSessionId] = useState<string>('');
    const [healthCheckResults, setHealthCheckResults] = useState<Record<string, boolean> | null>(null);
    const [testReport, setTestReport] = useState<string>('');
    const [error, setError] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(false);

    const { internalSessionId } = useInternalSessionId();

    const testSuites = [
        {
            id: 'sessionCreationAndValidation',
            name: 'Session Creation & Validation',
            description: 'Tests session creation, storage, and basic validation functionality',
            icon: Database,
            color: 'bg-blue-500',
        },
        {
            id: 'healthMonitoringIntegration',
            name: 'Health Monitoring Integration',
            description: 'Tests health monitoring system integration and status tracking',
            icon: Activity,
            color: 'bg-green-500',
        },
        {
            id: 'errorHandlingScenarios',
            name: 'Error Handling Scenarios',
            description: 'Tests various error conditions and recovery mechanisms',
            icon: Shield,
            color: 'bg-red-500',
        },
        {
            id: 'cookieParsingRobustness',
            name: 'Cookie Parsing Robustness',
            description: 'Tests ASPSESSION cookie detection and parsing capabilities',
            icon: Settings,
            color: 'bg-purple-500',
        },
        {
            id: 'sessionRefreshMechanisms',
            name: 'Session Refresh Mechanisms',
            description: 'Tests automatic session refresh and retry logic',
            icon: RefreshCw,
            color: 'bg-orange-500',
        },
        {
            id: 'crossPlatformOperations',
            name: 'Cross-Platform Operations',
            description: 'Tests multi-platform session management and bridging',
            icon: Network,
            color: 'bg-cyan-500',
        },
        {
            id: 'completeSessionFlow',
            name: 'Complete End-to-End Flow',
            description: 'Tests full session lifecycle and component integration',
            icon: Zap,
            color: 'bg-yellow-500',
        },
    ];

    const runAllTests = async () => {
        setLoading(true);
        setError('');
        setTestProgress((prev) => ({ ...prev, isRunning: true }));

        try {
            const response = await fetch('/api/test-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'runAllTests' }),
            });

            const data = await response.json();

            if (data.success) {
                setTestResults(data.testSuites);
                setTestReport(data.report);
                setTestProgress((prev) => ({
                    ...prev,
                    isRunning: false,
                    completedSuites: data.testSuites.length,
                    completedTests: data.summary.totalTests,
                }));
            } else {
                setError(data.error || 'Failed to run tests');
            }
        } catch (err) {
            setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
            setTestProgress((prev) => ({ ...prev, isRunning: false }));
        }
    };

    const runSpecificSuite = async (suiteId: string) => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/test-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'runSpecificSuite', testSuite: suiteId }),
            });

            const data = await response.json();

            if (data.success) {
                // Update or add the specific suite result
                setTestResults((prev) => {
                    const filtered = prev.filter((suite) => suite.suiteName !== data.testSuite.suiteName);
                    return [...filtered, data.testSuite];
                });
            } else {
                setError(data.error || 'Failed to run test suite');
            }
        } catch (err) {
            setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const runQuickHealthCheck = async () => {
        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/test-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'quickHealthCheck' }),
            });

            const data = await response.json();

            if (data.success) {
                setHealthCheckResults(data.healthCheck);
            } else {
                setError(data.error || 'Failed to run health check');
            }
        } catch (err) {
            setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const validateSession = async (sessionId: string) => {
        if (!sessionId.trim()) {
            setError('Session ID is required');
            return;
        }

        setLoading(true);
        setError('');

        try {
            const response = await fetch('/api/test-session', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'validateSession', sessionId: sessionId.trim() }),
            });

            const data = await response.json();

            if (data.success) {
                // Add validation result as a custom test result
                const validationSuite: TestSuite = {
                    suiteName: 'Session Validation',
                    tests: [
                        {
                            testName: `Validate Session: ${sessionId}`,
                            success: data.validation.sessionExists,
                            message: data.validation.sessionExists
                                ? 'Session is valid'
                                : 'Session not found or invalid',
                            details: data.validation,
                            duration: 0,
                            timestamp: new Date().toISOString(),
                        },
                    ],
                    overallSuccess: data.validation.sessionExists,
                    totalDuration: 0,
                    successCount: data.validation.sessionExists ? 1 : 0,
                    failureCount: data.validation.sessionExists ? 0 : 1,
                };

                setTestResults((prev) => {
                    const filtered = prev.filter((suite) => suite.suiteName !== 'Session Validation');
                    return [...filtered, validationSuite];
                });
            } else {
                setError(data.error || 'Failed to validate session');
            }
        } catch (err) {
            setError(`Network error: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
            setLoading(false);
        }
    };

    const downloadReport = () => {
        if (!testReport) return;

        const blob = new Blob([testReport], { type: 'text/markdown' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session-test-report-${new Date().toISOString().split('T')[0]}.md`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const getStatusIcon = (success: boolean) => {
        return success ? (
            <CheckCircle className='h-4 w-4 text-green-500' />
        ) : (
            <XCircle className='h-4 w-4 text-red-500' />
        );
    };

    const getStatusBadge = (success: boolean) => {
        return <Badge variant={success ? 'default' : 'destructive'}>{success ? 'PASSED' : 'FAILED'}</Badge>;
    };

    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <div className='container mx-auto p-6 space-y-6'>
                <div className='flex items-center justify-between'>
                    <div>
                        <h1 className='text-3xl font-bold'>Session Management Flow Testing</h1>
                        <p className='text-muted-foreground mt-2'>
                            Comprehensive testing suite for session management, health monitoring, and error handling
                        </p>
                    </div>
                    <div className='flex gap-2'>
                        {testReport && (
                            <Button onClick={downloadReport} variant='outline' size='sm'>
                                <Download className='h-4 w-4 mr-2' />
                                Download Report
                            </Button>
                        )}
                    </div>
                </div>

                {error && (
                    <Alert variant='destructive'>
                        <AlertTriangle className='h-4 w-4' />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                <Tabs defaultValue='overview' className='space-y-6'>
                    <TabsList className='grid w-full grid-cols-4'>
                        <TabsTrigger value='overview'>Overview</TabsTrigger>
                        <TabsTrigger value='test-suites'>Test Suites</TabsTrigger>
                        <TabsTrigger value='individual-tests'>Individual Tests</TabsTrigger>
                        <TabsTrigger value='results'>Results</TabsTrigger>
                    </TabsList>

                    <TabsContent value='overview' className='space-y-6'>
                        {/* Quick Actions */}
                        <Card>
                            <CardHeader>
                                <CardTitle className='flex items-center gap-2'>
                                    <Play className='h-5 w-5' />
                                    Quick Actions
                                </CardTitle>
                                <CardDescription>Run comprehensive tests or quick health checks</CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div className='flex gap-4'>
                                    <Button onClick={runAllTests} disabled={loading} className='flex-1'>
                                        {loading ? (
                                            <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                                        ) : (
                                            <Play className='h-4 w-4 mr-2' />
                                        )}
                                        Run All Tests
                                    </Button>
                                    <Button
                                        onClick={runQuickHealthCheck}
                                        disabled={loading}
                                        variant='outline'
                                        className='flex-1'
                                    >
                                        <Activity className='h-4 w-4 mr-2' />
                                        Quick Health Check
                                    </Button>
                                </div>

                                {testProgress.isRunning && (
                                    <div className='space-y-2'>
                                        <div className='flex justify-between text-sm'>
                                            <span>Progress</span>
                                            <span>
                                                {testProgress.completedSuites}/{testProgress.totalSuites} suites
                                            </span>
                                        </div>
                                        <Progress
                                            value={(testProgress.completedSuites / testProgress.totalSuites) * 100}
                                        />
                                        {testProgress.currentSuite && (
                                            <p className='text-sm text-muted-foreground'>
                                                Running: {testProgress.currentSuite}
                                            </p>
                                        )}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Health Check Results */}
                        {healthCheckResults && (
                            <Card>
                                <CardHeader>
                                    <CardTitle className='flex items-center gap-2'>
                                        <Activity className='h-5 w-5' />
                                        System Health Check
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className='grid grid-cols-2 md:grid-cols-3 gap-4'>
                                        {Object.entries(healthCheckResults).map(([component, status]) => {
                                            if (component === 'overallHealth') return null;
                                            return (
                                                <div key={component} className='flex items-center gap-2'>
                                                    {getStatusIcon(status as boolean)}
                                                    <span className='capitalize'>
                                                        {component.replace(/([A-Z])/g, ' $1').trim()}
                                                    </span>
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className='mt-4 pt-4 border-t'>
                                        <div className='flex items-center gap-2'>
                                            {getStatusIcon(healthCheckResults.overallHealth)}
                                            <span className='font-medium'>
                                                Overall Health:{' '}
                                                {healthCheckResults.overallHealth ? 'Healthy' : 'Issues Detected'}
                                            </span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}

                        {/* Test Results Summary */}
                        {testResults.length > 0 && (
                            <Card>
                                <CardHeader>
                                    <CardTitle>Test Results Summary</CardTitle>
                                </CardHeader>
                                <CardContent>
                                    <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                                        <div className='text-center'>
                                            <div className='text-2xl font-bold text-blue-600'>{testResults.length}</div>
                                            <div className='text-sm text-muted-foreground'>Test Suites</div>
                                        </div>
                                        <div className='text-center'>
                                            <div className='text-2xl font-bold text-green-600'>
                                                {testResults.reduce((sum, suite) => sum + suite.successCount, 0)}
                                            </div>
                                            <div className='text-sm text-muted-foreground'>Passed</div>
                                        </div>
                                        <div className='text-center'>
                                            <div className='text-2xl font-bold text-red-600'>
                                                {testResults.reduce((sum, suite) => sum + suite.failureCount, 0)}
                                            </div>
                                            <div className='text-sm text-muted-foreground'>Failed</div>
                                        </div>
                                        <div className='text-center'>
                                            <div className='text-2xl font-bold text-purple-600'>
                                                {testResults.reduce((sum, suite) => sum + suite.totalDuration, 0)}ms
                                            </div>
                                            <div className='text-sm text-muted-foreground'>Total Time</div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
                    </TabsContent>

                    <TabsContent value='test-suites' className='space-y-4'>
                        <div className='grid gap-4 md:grid-cols-2'>
                            {testSuites.map((suite) => {
                                const Icon = suite.icon;
                                const suiteResult = testResults.find((r) =>
                                    r.suiteName.toLowerCase().includes(suite.name.toLowerCase().split(' ')[0])
                                );

                                return (
                                    <Card key={suite.id} className='relative'>
                                        <CardHeader>
                                            <div className='flex items-start justify-between'>
                                                <div className='flex items-center gap-3'>
                                                    <div className={`p-2 rounded-lg ${suite.color} text-white`}>
                                                        <Icon className='h-5 w-5' />
                                                    </div>
                                                    <div>
                                                        <CardTitle className='text-lg'>{suite.name}</CardTitle>
                                                        <CardDescription className='text-sm'>
                                                            {suite.description}
                                                        </CardDescription>
                                                    </div>
                                                </div>
                                                {suiteResult && getStatusBadge(suiteResult.overallSuccess)}
                                            </div>
                                        </CardHeader>
                                        <CardContent>
                                            <div className='flex justify-between items-center'>
                                                <Button
                                                    onClick={() => runSpecificSuite(suite.id)}
                                                    disabled={loading}
                                                    variant='outline'
                                                    size='sm'
                                                >
                                                    {loading ? (
                                                        <RefreshCw className='h-4 w-4 mr-2 animate-spin' />
                                                    ) : (
                                                        <Play className='h-4 w-4 mr-2' />
                                                    )}
                                                    Run Suite
                                                </Button>
                                                {suiteResult && (
                                                    <div className='text-sm text-muted-foreground'>
                                                        {suiteResult.successCount}/{suiteResult.tests.length} tests
                                                        passed
                                                    </div>
                                                )}
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    </TabsContent>

                    <TabsContent value='individual-tests' className='space-y-6'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Session Validation</CardTitle>
                                <CardDescription>Test specific session IDs for validation and health</CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div className='grid gap-4'>
                                    <div>
                                        <Label htmlFor='sessionId'>Session ID</Label>
                                        <Input
                                            id='sessionId'
                                            placeholder={internalSessionId || 'Enter session ID to validate'}
                                            value={customSessionId}
                                            onChange={(e) => setCustomSessionId(e.target.value)}
                                        />
                                    </div>
                                    <div className='flex gap-2'>
                                        <Button
                                            onClick={() => validateSession(customSessionId || internalSessionId || '')}
                                            disabled={loading || (!customSessionId && !internalSessionId)}
                                        >
                                            Validate Session
                                        </Button>
                                        {internalSessionId && (
                                            <Button
                                                onClick={() => validateSession(internalSessionId)}
                                                disabled={loading}
                                                variant='outline'
                                            >
                                                Validate Current Session
                                            </Button>
                                        )}
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    <TabsContent value='results' className='space-y-6'>
                        {testResults.length === 0 ? (
                            <Card>
                                <CardContent className='text-center py-8'>
                                    <FileText className='h-12 w-12 mx-auto text-muted-foreground mb-4' />
                                    <h3 className='text-lg font-medium mb-2'>No Test Results</h3>
                                    <p className='text-muted-foreground mb-4'>
                                        Run some tests to see detailed results here
                                    </p>
                                    <Button onClick={runAllTests} disabled={loading}>
                                        <Play className='h-4 w-4 mr-2' />
                                        Run All Tests
                                    </Button>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className='space-y-4'>
                                {testResults.map((suite, suiteIndex) => (
                                    <Card key={suiteIndex}>
                                        <CardHeader>
                                            <div className='flex items-center justify-between'>
                                                <CardTitle className='flex items-center gap-2'>
                                                    {getStatusIcon(suite.overallSuccess)}
                                                    {suite.suiteName}
                                                </CardTitle>
                                                <div className='flex items-center gap-2'>
                                                    {getStatusBadge(suite.overallSuccess)}
                                                    <Badge variant='outline'>{suite.totalDuration}ms</Badge>
                                                </div>
                                            </div>
                                            <CardDescription>
                                                {suite.successCount} passed, {suite.failureCount} failed
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className='space-y-3'>
                                                {suite.tests.map((test, testIndex) => (
                                                    <div key={testIndex} className='border rounded-lg p-3'>
                                                        <div className='flex items-start justify-between mb-2'>
                                                            <div className='flex items-center gap-2'>
                                                                {getStatusIcon(test.success)}
                                                                <span className='font-medium'>{test.testName}</span>
                                                            </div>
                                                            <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                                                <Clock className='h-3 w-3' />
                                                                {test.duration}ms
                                                            </div>
                                                        </div>
                                                        <p className='text-sm text-muted-foreground mb-2'>
                                                            {test.message}
                                                        </p>
                                                        {test.details != null && (
                                                            <details className='text-xs'>
                                                                <summary className='cursor-pointer text-muted-foreground hover:text-foreground'>
                                                                    View Details
                                                                </summary>
                                                                <pre className='mt-2 p-2 bg-muted rounded text-xs overflow-auto'>
                                                                    {typeof test.details === 'string'
                                                                        ? test.details
                                                                        : JSON.stringify(test.details, null, 2)}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </TabsContent>
                </Tabs>
            </div>
        </DashboardLayout>
    );
}
