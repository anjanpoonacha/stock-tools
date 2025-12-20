'use client';

import { useState, useEffect } from 'react';
import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Button } from '@/components/ui/button';
import { Search, Zap, Menu, TrendingUp } from 'lucide-react';
import { ActionCard, Tool } from './ActionCard';
import { MobileSidebar } from './MobileSidebar';
import { DesktopSidebar } from './DesktopSidebar';
import { ThemeToggle } from '../ThemeToggle';
import { useRouter, usePathname } from 'next/navigation';

const TOOLS: Tool[] = [
    {
        id: 'sync',
        title: 'Screener → TV',
        description: 'Sync screener results to TradingView',
        href: '/tv-sync',
        icon: 'TVIcon' as const,
        category: 'Sync Operations',
        featured: true,
        keywords: ['sync', 'screener', 'tradingview'],
    },
    {
        id: 'mio',
        title: 'TV → MIO',
        description: 'Sync TradingView watchlists to MarketInOut',
        href: '/mio-sync',
        icon: 'MIOIcon' as const,
        category: 'Sync Operations',
        featured: true,
        keywords: ['sync', 'tradingview', 'mio', 'marketinout'],
    },
    {
        id: 'csv',
        title: 'CSV → TradingView',
        description: 'Import CSV watchlists directly to TradingView',
        href: '/csv-watchlist',
        icon: 'FileSpreadsheet' as const,
        category: 'Import/Export',
        keywords: ['csv', 'import', 'watchlist', 'tradingview'],
    },
    {
        id: 'fetch',
        title: 'TV Shortlist Fetcher',
        description: 'Download watchlists from TradingView',
        href: '/shortlist-fetcher',
        icon: 'Download' as const,
        category: 'Import/Export',
        keywords: ['fetch', 'download', 'watchlist', 'tradingview', 'shortlist'],
    },
    {
        id: 'converter',
        title: 'Symbol Converter',
        description: 'Convert stock symbols between MarketInOut and TradingView formats',
        href: '/converter',
        icon: 'ArrowLeftRight' as const,
        category: 'Core Tools',
        keywords: ['convert', 'symbol', 'format', 'mio', 'tv', 'tradingview'],
    },
    {
        id: 'miowatchlist',
        title: 'Manage MIO Lists',
        description: 'Create and manage MarketInOut watchlists',
        href: '/mio-watchlist',
        icon: 'List' as const,
        category: 'Management',
        featured: true,
        keywords: ['manage', 'watchlist', 'mio', 'marketinout'],
    },
    {
        id: 'mioformulas',
        title: 'MIO Formula Manager',
        description: 'Extract and manage stock screener formulas from MarketInOut',
        href: '/mio-formulas',
        icon: 'FileCode' as const,
        category: 'Management',
        featured: true,
        keywords: ['formula', 'screener', 'mio', 'marketinout', 'api'],
    },
    {
        id: 'userauth',
        title: 'User Authentication',
        description: 'User authentication and sessions',
        href: '/user-authentication',
        icon: 'UserCheck' as const,
        category: 'Testing',
        featured: true,
        keywords: ['auth', 'test', 'user', 'session'],
    },
    {
        id: 'sessiontest',
        title: 'Session Tests',
        description: 'Debug and test session management',
        href: '/test-session-flow',
        icon: 'TestTube' as const,
        category: 'Testing',
        keywords: ['session', 'test', 'debug'],
    },
    {
        id: 'systemanalyzer',
        title: 'System Analyzer',
        description: 'Calculate expectancy and performance metrics for trading systems',
        href: '/system-analyzer',
        icon: 'TrendingUp' as const,
        category: 'Calculators',
        featured: true,
        keywords: ['calculator', 'expectancy', 'system', 'performance', 'r-multiple', 'champion'],
    },
];

interface DashboardLayoutProps {
    children?: React.ReactNode;
    showHero?: boolean;
    showSidebar?: boolean;
    pageTitle?: string;
    fullPage?: boolean;
}

export function DashboardLayout({ children, showHero = true, showSidebar = true, fullPage = false }: DashboardLayoutProps) {
    const [commandOpen, setCommandOpen] = useState(false);
    const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
    const router = useRouter();
    const pathname = usePathname();

    // Get current tool info for dynamic header
    const currentTool = TOOLS.find((tool) => tool.href === pathname);
    const fullTitle = currentTool ? currentTool.title : 'Stock Tools';

    // Command palette keyboard shortcut
    useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setCommandOpen((open) => !open);
            }
        };
        document.addEventListener('keydown', down);
        return () => document.removeEventListener('keydown', down);
    }, []);

    const handleToolSelect = (href: string) => {
        setCommandOpen(false);
        router.push(href);
    };

    const featuredTools = TOOLS.filter((tool) => tool.featured);
    const quickTools = TOOLS.filter((tool) => !tool.featured && tool.category === 'Sync Operations');
    const allToolsByCategory = TOOLS.reduce((acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push(tool);
        return acc;
    }, {} as Record<string, typeof TOOLS>);

    return (
        <div className='h-screen bg-gradient-to-br from-background via-background to-muted/20 flex overflow-hidden'>
            {/* Desktop Sidebar */}
            {showSidebar && (
                <div className='hidden md:block'>
                    <DesktopSidebar tools={TOOLS} />
                </div>
            )}

            {/* Main Content Area */}
            <div className='flex-1 min-h-0 flex flex-col overflow-hidden'>
                {/* Compact Header for Full Page Mode, Regular Header Otherwise */}
                {!fullPage && (
                    <header className='sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60'>
                        <div className='flex h-16 items-center justify-between px-4 md:px-6 lg:px-8'>
                            <div className='flex items-center gap-3'>
                                {/* Mobile Menu Button */}
                                <Button
                                    variant='outline'
                                    size='sm'
                                    className='md:hidden'
                                    onClick={() => setMobileSidebarOpen(true)}
                                >
                                    <Menu className='w-4 h-4' />
                                </Button>

                                <div className='w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center md:hidden'>
                                    <Zap className='w-5 h-5 text-primary-foreground' />
                                </div>

                                <div>
                                    <h1 className='font-bold text-lg md:text-xl'>{fullTitle}</h1>
                                    <p className='text-xs text-muted-foreground hidden sm:block md:hidden'>
                                        MarketInOut & TradingView Integration
                                    </p>
                                </div>
                            </div>

                            <div className='flex items-center gap-4'>
                                <ThemeToggle />

                                {/* Command Palette Trigger - Hidden on desktop with sidebar */}
                                <Button
                                    variant='outline'
                                    size='sm'
                                    className='hidden sm:flex md:hidden items-center gap-2 text-muted-foreground'
                                    onClick={() => setCommandOpen(true)}
                                >
                                    <Search className='w-4 h-4' />
                                    <span className='hidden sm:inline'>Search tools...</span>
                                    <kbd className='pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100'>
                                        <span className='text-xs'>⌘</span>K
                                    </kbd>
                                </Button>
                            </div>
                        </div>
                    </header>
                )}

                {/* Full Page Mode - Direct Children Rendering */}
                {fullPage ? (
                    <div className='flex-1 min-h-0 overflow-hidden'>
                        {children}
                    </div>
                ) : (
                    /* Scrollable Main Content */
                    <main className='flex-1 overflow-y-auto overflow-x-hidden'>
                        <div className='container py-6 md:py-8 px-4 md:px-6 lg:px-8 max-w-none xl:max-w-7xl 2xl:max-w-screen-xl mx-auto'>
                            {showHero && featuredTools.length > 0 && (
                                <>
                                    {/* Hero Section */}
                                    <section className='mb-8 md:mb-12'>
                                        <div className='text-center mb-6 md:mb-8'>
                                            <h2 className='text-2xl md:text-3xl font-bold tracking-tight mb-2'>
                                                Professional Stock Trading Tools
                                            </h2>
                                            <p className='text-muted-foreground text-base md:text-lg max-w-2xl mx-auto'>
                                                Seamlessly convert, sync, and manage your stock symbols between MarketInOut
                                                and TradingView platforms
                                            </p>
                                        </div>

                                        <div className='max-w-6xl mx-auto'>
                                            <div className='grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-6 md:mb-8'>
                                                {featuredTools.map((tool) => (
                                                    <ActionCard key={tool.id} tool={tool} featured />
                                                ))}
                                            </div>
                                        </div>
                                    </section>

                                    {/* Sync Operations */}
                                    <section className='mb-8 md:mb-12'>
                                        <h3 className='text-lg md:text-xl font-semibold mb-4 md:mb-6'>Sync Operations</h3>
                                        <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
                                            {quickTools.map((tool) => (
                                                <ActionCard key={tool.id} tool={tool} />
                                            ))}
                                        </div>
                                    </section>

                                    {/* All Tools by Category */}
                                    <section>
                                        <h3 className='text-lg md:text-xl font-semibold mb-4 md:mb-6'>All Tools</h3>
                                        {Object.entries(allToolsByCategory).map(([category, tools]) => (
                                            <div key={category} className='mb-6 md:mb-8'>
                                                <h4 className='text-base md:text-lg font-medium mb-3 md:mb-4 text-muted-foreground'>
                                                    {category}
                                                </h4>
                                                <div className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'>
                                                    {tools.map((tool) => (
                                                        <ActionCard key={tool.id} tool={tool} compact />
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </section>
                                </>
                            )}

                            {/* Page Content */}
                            {children}
                        </div>
                    </main>
                )}
            </div>

            {/* Command Palette */}
            <CommandDialog open={commandOpen} onOpenChange={setCommandOpen}>
                <CommandInput placeholder='Search tools...' />
                <CommandList>
                    <CommandEmpty>No tools found.</CommandEmpty>
                    {Object.entries(allToolsByCategory).map(([category, tools]) => (
                        <CommandGroup key={category} heading={category}>
                            {tools.map((tool) => (
                                <CommandItem
                                    key={tool.id}
                                    value={`${tool.title} ${tool.description} ${tool.keywords.join(' ')}`}
                                    onSelect={() => handleToolSelect(tool.href)}
                                    className='cursor-pointer'
                                >
                                    <span>{tool.title}</span>
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    ))}
                </CommandList>
            </CommandDialog>

            {/* Mobile Sidebar */}
            <MobileSidebar
                open={mobileSidebarOpen}
                onOpenChange={setMobileSidebarOpen}
                tools={TOOLS}
                onToolSelect={handleToolSelect}
            />
        </div>
    );
}
