'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ArrowLeftRight, FileSpreadsheet, Download, List, UserCheck, TestTube } from 'lucide-react';
import { MIOIcon } from './icons/MIOIcon';
import { TVIcon } from './icons/TVIcon';

interface IconProps {
    className?: string;
}

const ROUTES = [
    { path: '/', label: 'Symbol Converter', value: 'converter', icon: ArrowLeftRight },
    { path: '/csv-watchlist', label: 'CSV → TradingView', value: 'csv', icon: FileSpreadsheet },
    { path: '/shortlist-fetcher', label: 'Fetch TV Watchlists', value: 'fetch', icon: Download },
    { path: '/tv-sync', label: 'Screener → TV', value: 'sync', icon: (props: IconProps) => <TVIcon {...props} /> },
    {
        path: '/mio-sync',
        label: 'TV → MIO',
        value: 'mio',
        icon: (props: IconProps) => <MIOIcon {...props} />,
    },
    { path: '/mio-watchlist', label: 'Manage MIO Lists', value: 'miowatchlist', icon: List },
    // { path: '/mio-auth', label: 'Authenticator', value: 'mioauth', icon: LogIn },
    { path: '/user-authentication', label: 'User Authentication', value: 'userauth', icon: UserCheck },
    { path: '/test-session-flow', label: 'Session Tests', value: 'sessiontest', icon: TestTube },
];

export default function TabNav() {
    const pathname = usePathname();

    // Find the route whose path matches the start of the current pathname
    const active =
        ROUTES.find((route) => (route.path === '/' ? pathname === '/' : pathname.startsWith(route.path)))?.value ||
        ROUTES[0].value;

    return (
        <Tabs value={active} className='w-full max-w-6xl'>
            <TabsList className='w-full h-auto p-1 bg-muted/50 backdrop-blur-sm border shadow-sm'>
                {ROUTES.map((route) => {
                    const IconComponent = route.icon;
                    return (
                        <TabsTrigger
                            key={route.value}
                            value={route.value}
                            className='flex-1 min-w-0 px-2 sm:px-3 py-2.5 text-xs sm:text-sm font-medium transition-all duration-200 data-[state=active]:bg-background data-[state=active]:shadow-sm data-[state=active]:text-foreground hover:text-foreground/80'
                        >
                            <Link
                                href={route.path}
                                className='w-full flex items-center justify-center gap-1.5 sm:gap-2'
                            >
                                <IconComponent className='h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0' />
                                <span className='truncate hidden sm:inline'>{route.label}</span>
                                <span className='truncate sm:hidden text-[10px] leading-tight'>
                                    {route.label.split(' ')[0]}
                                </span>
                            </Link>
                        </TabsTrigger>
                    );
                })}
            </TabsList>
        </Tabs>
    );
}
