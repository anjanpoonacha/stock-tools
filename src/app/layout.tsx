import { ThemeProvider } from '@/components/ThemeProvider';
import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';
// regroup-watchlist is deprecated and will be removed
// import { MobileNav } from '@/components/MobileNav';
import { ThemeToggle } from '@/components/ThemeToggle';
import { ToastProvider } from '../components/ui/toast';

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
    description:
        'Convert stock symbol lists between MarketInOut and TradingView formats. Mobile-first, fast, and easy.',
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
                    <ToastProvider>
                        {/* Modern Desktop Navigation */}
                        <nav className='hidden md:flex w-full items-center px-6 py-4 bg-card/95 backdrop-blur-sm border-b shadow-sm mb-6 sticky top-0 z-50'>
                            <div className='flex items-center gap-3'>
                                <div className='w-8 h-8 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center'>
                                    <svg
                                        className='w-5 h-5 text-white'
                                        viewBox='0 0 24 24'
                                        fill='none'
                                        stroke='currentColor'
                                        strokeWidth='2'
                                    >
                                        <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
                                    </svg>
                                </div>
                                <Link
                                    href='/'
                                    className='font-bold text-xl text-foreground hover:text-primary transition-colors'
                                >
                                    Stock Tools
                                </Link>
                                <div className='hidden lg:block w-px h-6 bg-border mx-2' />
                                <span className='hidden lg:block text-sm text-muted-foreground'>
                                    MarketInOut & TradingView Integration
                                </span>
                            </div>
                            <div className='ml-auto flex items-center gap-4'>
                                <div className='flex items-center gap-2 text-sm text-muted-foreground'>
                                    <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                                    <span className='hidden sm:block'>Ready</span>
                                </div>
                                <ThemeToggle />
                            </div>
                        </nav>

                        {/* Mobile Navigation */}
                        <div className='md:hidden bg-card/95 backdrop-blur-sm border-b shadow-sm sticky top-0 z-50 mb-4'>
                            <div className='flex items-center justify-between px-4 py-3'>
                                <div className='flex items-center gap-2'>
                                    <div className='w-7 h-7 bg-gradient-to-br from-blue-600 to-blue-700 rounded-md flex items-center justify-center'>
                                        <svg
                                            className='w-4 h-4 text-white'
                                            viewBox='0 0 24 24'
                                            fill='none'
                                            stroke='currentColor'
                                            strokeWidth='2'
                                        >
                                            <path d='M13 2L3 14h9l-1 8 10-12h-9l1-8z' />
                                        </svg>
                                    </div>
                                    <Link href='/' className='font-bold text-lg text-foreground'>
                                        Stock Tools
                                    </Link>
                                </div>
                                <div className='flex items-center gap-3'>
                                    <div className='w-2 h-2 bg-green-500 rounded-full animate-pulse' />
                                    <ThemeToggle />
                                </div>
                            </div>
                        </div>

                        {/* Tab Navigation */}
                        <div className='w-full flex justify-center px-4 mb-6'>
                            <TabNav />
                        </div>

                        <main className='px-4'>{children}</main>
                    </ToastProvider>
                </ThemeProvider>
            </body>
        </html>
    );
}
