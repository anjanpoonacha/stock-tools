'use client';

import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { CheckCircle, AlertCircle, XCircle, Wifi, WifiOff, Database, Globe, Activity, Clock } from 'lucide-react';

interface ServiceStatus {
    name: string;
    status: 'online' | 'offline' | 'warning';
    lastChecked: Date;
    responseTime?: number;
}

export function StatusIndicator() {
    const [services, setServices] = useState<ServiceStatus[]>([
        {
            name: 'MarketInOut',
            status: 'online',
            lastChecked: new Date(),
            responseTime: 245,
        },
        {
            name: 'TradingView',
            status: 'online',
            lastChecked: new Date(),
            responseTime: 180,
        },
        {
            name: 'Session Store',
            status: 'online',
            lastChecked: new Date(),
            responseTime: 95,
        },
        {
            name: 'Extension',
            status: 'warning',
            lastChecked: new Date(Date.now() - 30000), // 30 seconds ago
        },
    ]);

    const [overallStatus, setOverallStatus] = useState<'online' | 'warning' | 'offline'>('online');

    useEffect(() => {
        // Determine overall status based on individual services
        const hasOffline = services.some((s) => s.status === 'offline');
        const hasWarning = services.some((s) => s.status === 'warning');

        if (hasOffline) {
            setOverallStatus('offline');
        } else if (hasWarning) {
            setOverallStatus('warning');
        } else {
            setOverallStatus('online');
        }
    }, [services]);

    // Simulate periodic status checks
    useEffect(() => {
        const interval = setInterval(() => {
            setServices((prev) =>
                prev.map((service) => ({
                    ...service,
                    lastChecked: new Date(),
                    responseTime: service.responseTime ? Math.floor(Math.random() * 100) + 150 : undefined,
                }))
            );
        }, 30000); // Check every 30 seconds

        return () => clearInterval(interval);
    }, []);

    const getStatusIcon = (status: ServiceStatus['status']) => {
        switch (status) {
            case 'online':
                return <CheckCircle className='w-3 h-3 text-green-500' />;
            case 'warning':
                return <AlertCircle className='w-3 h-3 text-yellow-500' />;
            case 'offline':
                return <XCircle className='w-3 h-3 text-red-500' />;
        }
    };

    const getOverallStatusColor = () => {
        switch (overallStatus) {
            case 'online':
                return 'bg-green-500';
            case 'warning':
                return 'bg-yellow-500';
            case 'offline':
                return 'bg-red-500';
        }
    };

    const getOverallStatusText = () => {
        switch (overallStatus) {
            case 'online':
                return 'All Systems Operational';
            case 'warning':
                return 'Some Issues Detected';
            case 'offline':
                return 'Service Disruption';
        }
    };

    const formatLastChecked = (date: Date) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);

        if (minutes === 0) {
            return 'Just now';
        } else if (minutes === 1) {
            return '1 minute ago';
        } else if (minutes < 60) {
            return `${minutes} minutes ago`;
        } else {
            return date.toLocaleTimeString();
        }
    };

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button variant='ghost' size='sm' className='flex items-center gap-2 h-8'>
                    <div className={cn('w-2 h-2 rounded-full animate-pulse', getOverallStatusColor())} />
                    <span className='text-sm text-muted-foreground hidden sm:inline'>
                        {overallStatus === 'online' ? 'Ready' : overallStatus === 'warning' ? 'Issues' : 'Offline'}
                    </span>
                </Button>
            </PopoverTrigger>
            <PopoverContent className='w-80' align='end'>
                <div className='space-y-4'>
                    <div className='flex items-center gap-2'>
                        <Activity className='w-4 h-4 text-muted-foreground' />
                        <h4 className='font-medium'>System Status</h4>
                    </div>

                    <div className='flex items-center gap-2 p-3 rounded-lg bg-muted/50'>
                        <div className={cn('w-3 h-3 rounded-full', getOverallStatusColor())} />
                        <span className='font-medium'>{getOverallStatusText()}</span>
                    </div>

                    <Separator />

                    <div className='space-y-3'>
                        {services.map((service) => (
                            <div key={service.name} className='flex items-center justify-between'>
                                <div className='flex items-center gap-3'>
                                    {getStatusIcon(service.status)}
                                    <div>
                                        <div className='flex items-center gap-2'>
                                            <span className='text-sm font-medium'>{service.name}</span>
                                            {service.name === 'MarketInOut' && (
                                                <Globe className='w-3 h-3 text-muted-foreground' />
                                            )}
                                            {service.name === 'TradingView' && (
                                                <Globe className='w-3 h-3 text-muted-foreground' />
                                            )}
                                            {service.name === 'Session Store' && (
                                                <Database className='w-3 h-3 text-muted-foreground' />
                                            )}
                                            {service.name === 'Extension' &&
                                                (service.status === 'online' ? (
                                                    <Wifi className='w-3 h-3 text-muted-foreground' />
                                                ) : (
                                                    <WifiOff className='w-3 h-3 text-muted-foreground' />
                                                ))}
                                        </div>
                                        <div className='flex items-center gap-2 text-xs text-muted-foreground'>
                                            <Clock className='w-3 h-3' />
                                            <span>{formatLastChecked(service.lastChecked)}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className='text-right'>
                                    <Badge
                                        variant={
                                            service.status === 'online'
                                                ? 'default'
                                                : service.status === 'warning'
                                                ? 'secondary'
                                                : 'destructive'
                                        }
                                        className='text-xs'
                                    >
                                        {service.status}
                                    </Badge>
                                    {service.responseTime && (
                                        <div className='text-xs text-muted-foreground mt-1'>
                                            {service.responseTime}ms
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>

                    <Separator />

                    <div className='text-xs text-muted-foreground text-center'>Status updates every 30 seconds</div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
