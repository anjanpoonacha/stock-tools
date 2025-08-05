'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const ROUTES = [
	{ path: '/', label: 'Symbol Converter', value: 'converter' },
	{ path: '/csv-watchlist', label: 'CSV → TradingView', value: 'csv' },
	{ path: '/shortlist-fetcher', label: 'Fetch TV Watchlists', value: 'fetch' },
	{ path: '/tv-sync', label: 'Screener → TV', value: 'sync' },
	{ path: '/mio-sync', label: 'TV → MIO', value: 'mio' },
	{ path: '/mio-watchlist', label: 'Manage MIO Lists', value: 'miowatchlist' },
	{ path: '/mio-auth', label: 'MIO Login', value: 'mioauth' },
];

export default function TabNav() {
	const pathname = usePathname();

	// Find the route whose path matches the start of the current pathname
	const active =
		ROUTES.find((route) => (route.path === '/' ? pathname === '/' : pathname.startsWith(route.path)))?.value ||
		ROUTES[0].value;

	return (
		<Tabs value={active} className='w-full'>
			<TabsList className='w-full'>
				{ROUTES.map((route) => (
					<TabsTrigger key={route.value} value={route.value}>
						<Link href={route.path} className='w-full text-center'>
							{route.label}
						</Link>
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
