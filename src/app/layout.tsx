'use client';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import Link from 'next/link';
// import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { usePathname } from 'next/navigation';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const manifest: Metadata = {
	title: 'Stock Format Converter – MarketInOut & TradingView',
	description: 'Convert stock symbol lists between MarketInOut and TradingView formats. Mobile-first, fast, and easy.',
};

// Tab navigation component
function TabNav() {
	const pathname = usePathname();
	let value: string = 'converter';
	if (pathname.startsWith('/shortlist-fetcher')) value = 'fetch';
	else if (pathname.startsWith('/csv-watchlist')) value = 'csv';

	return (
		<Tabs value={value} className='w-full max-w-md'>
			<TabsList className='w-full'>
				<TabsTrigger value='converter' asChild>
					<Link href='/' className='w-full text-center'>
						Stock Format Converter
					</Link>
				</TabsTrigger>
				<TabsTrigger value='csv' asChild>
					<Link href='/csv-watchlist' className='w-full text-center'>
						CSV Watchlist
					</Link>
				</TabsTrigger>
				<TabsTrigger value='fetch' asChild>
					<Link href='/shortlist-fetcher' className='w-full text-center'>
						Fetch Watchlist
					</Link>
				</TabsTrigger>
			</TabsList>
		</Tabs>
	);
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html lang='en' suppressHydrationWarning>
			<body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
				<ThemeProvider>
					{/* Desktop nav */}
					<nav className='hidden md:flex w-full items-center py-3 gap-4 bg-card border-b mb-4 sticky top-0 z-40'>
						<Link href='/' className='font-bold text-lg mr-6'>
							Stock Tools
						</Link>
						{/* Theme toggle for desktop only */}
						<div className='ml-auto flex items-center'>
							<div className='hidden md:block'>
								<ThemeToggle />
							</div>
						</div>
					</nav>
					{/* Mobile nav */}
					{/* <MobileNav /> */}
					<div className='w-full flex justify-center pt-4'>
						<TabNav />
					</div>
					<main className='pt-4'>{children}</main>
				</ThemeProvider>
			</body>
		</html>
	);
}
