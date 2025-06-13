import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { ThemeProvider } from '@/components/ThemeProvider';
import Link from 'next/link';
import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';

const geistSans = Geist({
	variable: '--font-geist-sans',
	subsets: ['latin'],
});

const geistMono = Geist_Mono({
	variable: '--font-geist-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	title: 'Stock Format Converter – MarketInOut & TradingView',
	description: 'Convert stock symbol lists between MarketInOut and TradingView formats. Mobile-first, fast, and easy.',
};

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
						<Link href='/' className='font-semibold px-3 py-1 rounded hover:bg-muted transition-colors'>
							Stock Converter
						</Link>
						<Link href='/csv-watchlist' className='font-semibold px-3 py-1 rounded hover:bg-muted transition-colors'>
							CSV Watchlist
						</Link>
						<Link
							href='/regroup-watchlist'
							className='font-semibold px-3 py-1 rounded hover:bg-muted transition-colors'
						>
							Regroup TV Watchlist
						</Link>
						{/* Theme toggle for desktop only */}
						<div className='ml-auto flex items-center'>
							<div className='hidden md:block'>
								<ThemeToggle />
							</div>
						</div>
					</nav>
					{/* Mobile nav */}
					<MobileNav />
					{children}
				</ThemeProvider>
			</body>
		</html>
	);
}
