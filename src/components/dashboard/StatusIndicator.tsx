'use client';

import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { Activity } from 'lucide-react';
import { ServiceStatusItem } from './ServiceStatusItem';
import { useServiceStatus } from '@/hooks/useServiceStatus';

export function StatusIndicator() {
    const { services, overallStatus, getOverallStatusColor, getOverallStatusText } = useServiceStatus();

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
                            <ServiceStatusItem key={service.name} service={service} />
                        ))}
                    </div>

                    <Separator />

                    <div className='text-xs text-muted-foreground text-center'>Status updates every 30 seconds</div>
                </div>
            </PopoverContent>
        </Popover>
    );
}
