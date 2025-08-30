'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, XCircle, Wifi, WifiOff, Database, Globe, Clock } from 'lucide-react';

interface ServiceStatus {
    name: string;
    status: 'online' | 'offline' | 'warning';
    lastChecked: Date;
    responseTime?: number;
}

interface ServiceStatusItemProps {
    service: ServiceStatus;
}

export function ServiceStatusItem({ service }: ServiceStatusItemProps) {
    const getStatusIcon = (status: ServiceStatus['status']) => {
        switch (status) {
            case 'online':
                return <CheckCircle className='w-3 h-3 text-green-600 dark:text-green-400' />;
            case 'warning':
                return <AlertCircle className='w-3 h-3 text-yellow-600 dark:text-yellow-400' />;
            case 'offline':
                return <XCircle className='w-3 h-3 text-destructive' />;
        }
    };

    const getServiceIcon = (serviceName: string, status: ServiceStatus['status']) => {
        switch (serviceName) {
            case 'MarketInOut':
            case 'TradingView':
                return <Globe className='w-3 h-3 text-muted-foreground' />;
            case 'Session Store':
                return <Database className='w-3 h-3 text-muted-foreground' />;
            case 'Extension':
                return status === 'online' ? (
                    <Wifi className='w-3 h-3 text-muted-foreground' />
                ) : (
                    <WifiOff className='w-3 h-3 text-muted-foreground' />
                );
            default:
                return null;
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
        <div className='flex items-center justify-between'>
            <div className='flex items-center gap-3'>
                {getStatusIcon(service.status)}
                <div>
                    <div className='flex items-center gap-2'>
                        <span className='text-sm font-medium'>{service.name}</span>
                        {getServiceIcon(service.name, service.status)}
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
                    <div className='text-xs text-muted-foreground mt-1'>{service.responseTime}ms</div>
                )}
            </div>
        </div>
    );
}
