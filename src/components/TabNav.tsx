'use client';

import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function TabNav() {
	const pathname = usePathname();
	let value: string = 'converter';
	if (pathname.startsWith('/shortlist-fetcher')) value = 'fetch';
	else if (pathname.startsWith('/csv-watchlist')) value = 'csv';

	return (
		<Tabs value={value} className='w-full'>
			<TabsList className='w-full'>
				<TabsTrigger value='converter'>
					<Link href='/' className='w-full text-center'>
						Stock Format Converter
					</Link>
				</TabsTrigger>
				<TabsTrigger value='csv'>
					<Link href='/csv-watchlist' className='w-full text-center'>
						CSV Watchlist
					</Link>
				</TabsTrigger>
				<TabsTrigger value='fetch'>
					<Link href='/shortlist-fetcher' className='w-full text-center'>
						Fetch Watchlist
					</Link>
				</TabsTrigger>
				<TabsTrigger value='sync'>
					<Link href='/tv-sync' className='w-full text-center'>
						Sync Watchlist
					</Link>
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}
