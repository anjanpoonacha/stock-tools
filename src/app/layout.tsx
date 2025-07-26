import { ThemeProvider } from '@/components/ThemeProvider';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
// regroup-watchlist is deprecated and will be removed
// import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';

// Move TabNav to its own file or mark it as a client component if it uses usePathname
import TabNav from '@/components/TabNav';

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
