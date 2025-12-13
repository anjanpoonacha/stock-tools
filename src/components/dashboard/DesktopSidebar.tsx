'use client';

import { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
    ArrowLeftRight,
    FileSpreadsheet,
    Download,
    RefreshCw,
    Upload,
    List,
    UserCheck,
    TestTube,
    Search,
    Zap,
    Home,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    FileCode,
} from 'lucide-react';
import { MIOIcon } from '../icons/MIOIcon';
import { TVIcon } from '../icons/TVIcon';

const iconMap = {
    ArrowLeftRight,
    FileSpreadsheet,
    Download,
    RefreshCw,
    Upload,
    List,
    UserCheck,
    TestTube,
    MIOIcon,
    TVIcon,
    FileCode,
};

interface Tool {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: keyof typeof iconMap;
    category: string;
    featured?: boolean;
    keywords: string[];
}

interface DesktopSidebarProps {
    tools: Tool[];
    defaultCollapsed?: boolean;
}

// Hook for localStorage persistence
function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
    const [storedValue, setStoredValue] = useState<T>(initialValue);

    useEffect(() => {
        try {
            const item = window.localStorage.getItem(key);
            if (item) {
                setStoredValue(JSON.parse(item));
            }
        } catch (error) {
            console.warn(`Error reading localStorage key "${key}":`, error);
        }
    }, [key]);

    const setValue = (value: T) => {
        try {
            setStoredValue(value);
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn(`Error setting localStorage key "${key}":`, error);
        }
    };

    return [storedValue, setValue];
}

export function DesktopSidebar({ tools, defaultCollapsed = false }: DesktopSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', defaultCollapsed);
    const [isHovered] = useState(false);
    const pathname = usePathname();
    const router = useRouter();

    // Responsive breakpoint detection
    const [screenSize, setScreenSize] = useState<'mobile' | 'tablet' | 'desktop' | 'large'>('desktop');

    useEffect(() => {
        const updateScreenSize = () => {
            const width = window.innerWidth;
            if (width < 768) {
                setScreenSize('mobile');
            } else if (width < 1024) {
                setScreenSize('tablet');
                setIsCollapsed(true); // Auto-collapse on tablet
            } else if (width < 1440) {
                setScreenSize('desktop');
            } else {
                setScreenSize('large');
            }
        };

        updateScreenSize();
        window.addEventListener('resize', updateScreenSize);
        return () => window.removeEventListener('resize', updateScreenSize);
    }, [setIsCollapsed]);

    // Computed state for expansion - NO HOVER EXPANSION
    const isExpanded = !isCollapsed;

    // No hover expansion - only tooltips
    const handleMouseEnter = () => {
        // Do nothing - no hover expansion
    };

    const handleMouseLeave = () => {
        // Do nothing - no hover expansion
    };

    // Toggle collapse state
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    const filteredTools = tools.filter((tool) => {
        if (!searchQuery) return true;
        const query = searchQuery.toLowerCase();
        return (
            tool.title.toLowerCase().includes(query) ||
            tool.description.toLowerCase().includes(query) ||
            tool.category.toLowerCase().includes(query) ||
            tool.keywords.some((keyword) => keyword.toLowerCase().includes(query))
        );
    });

    const groupedTools = filteredTools.reduce((acc, tool) => {
        if (!acc[tool.category]) acc[tool.category] = [];
        acc[tool.category].push(tool);
        return acc;
    }, {} as Record<string, Tool[]>);

    const featuredTools = tools.filter((tool) => tool.featured);

    // Responsive width calculation
    const getWidth = () => {
        if (!isExpanded) return 'w-16';

        switch (screenSize) {
            case 'large':
                return 'w-80 xl:w-80 2xl:w-96'; // 320px on 2xl screens
            case 'desktop':
                return 'w-72 lg:w-72 xl:w-80'; // 280px standard, 320px on xl
            case 'tablet':
                return 'w-64 md:w-64 lg:w-72'; // Smaller on tablet
            default:
                return 'w-72';
        }
    };

    return (
        <TooltipProvider>
            <div
                className={cn(
                    'border-r bg-card/50 backdrop-blur supports-[backdrop-filter]:bg-card/50 transition-all duration-300 ease-in-out flex flex-col h-screen',
                    getWidth(),
                    isHovered && 'shadow-lg shadow-primary/10'
                )}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
            >
                {/* Sticky Header */}
                <div
                    className={cn(
                        'sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/95 border-b transition-all duration-300',
                        isExpanded ? 'p-6 pb-4' : 'p-3'
                    )}
                >
                    <div className={cn('flex items-center mb-4', isExpanded ? 'gap-3' : 'justify-center')}>
                        {/* Toggle Button */}
                        <Button
                            variant='ghost'
                            size='sm'
                            onClick={toggleCollapse}
                            className='h-8 w-8 p-0 hover:bg-muted/50 flex-shrink-0'
                        >
                            {isCollapsed ? (
                                <PanelLeftOpen className='w-4 h-4' />
                            ) : (
                                <PanelLeftClose className='w-4 h-4' />
                            )}
                        </Button>
                        {isExpanded && (
                            <div className='transition-opacity duration-200 opacity-100'>
                                <div className='font-bold text-lg'>Stock Tools</div>
                                <div className='text-xs text-muted-foreground'>MarketInOut & TradingView</div>
                            </div>
                        )}
                    </div>

                    {/* Search */}
                    {isExpanded && (
                        <div className='relative transition-opacity duration-200 opacity-100'>
                            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                            <Input
                                placeholder='Search tools...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className='pl-10 h-9'
                            />
                        </div>
                    )}
                </div>

                {/* Quick Navigation */}
                <div className={cn('border-b transition-all duration-300', isExpanded ? 'p-4' : 'p-2')}>
                    {isExpanded ? (
                        <Button
                            variant={pathname === '/' ? 'secondary' : 'ghost'}
                            className={cn(
                                'w-full justify-start gap-3 h-10 transition-all duration-200',
                                pathname === '/'
                                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 dark:ring-primary/30 border-primary/30 hover:bg-primary/90'
                                    : 'hover:bg-muted/50'
                            )}
                            onClick={() => router.push('/')}
                        >
                            <Home className='w-4 h-4 flex-shrink-0' />
                            <span>Dashboard</span>
                            {pathname === '/' && <ChevronRight className='w-4 h-4 ml-auto flex-shrink-0' />}
                        </Button>
                    ) : (
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant={pathname === '/' ? 'secondary' : 'ghost'}
                                    className={cn(
                                        'w-full h-10 p-0 justify-center transition-all duration-200',
                                        pathname === '/'
                                            ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 dark:ring-primary/30 scale-105 hover:bg-primary/90'
                                            : 'hover:bg-muted/50'
                                    )}
                                    onClick={() => router.push('/')}
                                >
                                    <Home className='w-4 h-4' />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side='right'>
                                <p>Dashboard</p>
                            </TooltipContent>
                        </Tooltip>
                    )}
                </div>

                {/* Scrollable Content */}
                <ScrollArea className='flex-1'>
                    <div className={cn('space-y-6', isExpanded ? 'p-4' : 'p-2')}>
                        {isExpanded ? (
                            <>
                                {/* Featured Tools - Expanded */}
                                {featuredTools.length > 0 && !searchQuery && (
                                    <>
                                        <div>
                                            <div className='flex items-center gap-2 mb-3'>
                                                <Zap className='w-4 h-4 text-primary' />
                                                <h3 className='font-semibold text-sm'>Featured</h3>
                                            </div>
                                            <div className='space-y-2'>
                                                {featuredTools.map((tool) => {
                                                    const IconComponent = iconMap[tool.icon];
                                                    const isActive = pathname === tool.href;
                                                    return (
                                                        <Button
                                                            key={tool.id}
                                                            variant={isActive ? 'secondary' : 'ghost'}
                                                            className={cn(
                                                                'w-full h-auto p-3 justify-start rounded-lg transition-all duration-200',
                                                                isActive
                                                                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 dark:ring-primary/30 border-primary/30 hover:bg-primary/90'
                                                                    : 'hover:bg-muted/50'
                                                            )}
                                                            onClick={() => router.push(tool.href)}
                                                        >
                                                            <div className='flex items-center gap-3 w-full'>
                                                                <div className='w-7 h-7 bg-gradient-to-br from-muted to-muted/80 rounded-md flex items-center justify-center flex-shrink-0'>
                                                                    <IconComponent className='w-4 h-4 text-muted-foreground' />
                                                                </div>
                                                                <div className='flex-1 text-left'>
                                                                    <div className='font-medium text-sm'>
                                                                        {tool.title}
                                                                    </div>
                                                                </div>
                                                                {isActive && (
                                                                    <ChevronRight className='w-4 h-4 flex-shrink-0' />
                                                                )}
                                                            </div>
                                                        </Button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        <Separator />
                                    </>
                                )}

                                {/* Tool Categories - Expanded */}
                                {Object.entries(groupedTools).map(([category, categoryTools]) => (
                                    <div key={category}>
                                        <div className='flex items-center gap-2 mb-3'>
                                            <h3 className='font-semibold text-sm text-muted-foreground'>{category}</h3>
                                            <Badge variant='secondary' className='text-xs h-5'>
                                                {categoryTools.length}
                                            </Badge>
                                        </div>
                                        <div className='space-y-1'>
                                            {categoryTools.map((tool) => {
                                                const IconComponent = iconMap[tool.icon];
                                                const isActive = pathname === tool.href;
                                                return (
                                                    <Button
                                                        key={tool.id}
                                                        variant={isActive ? 'secondary' : 'ghost'}
                                                        className={cn(
                                                            'w-full h-auto p-3 justify-start rounded-lg transition-all duration-200',
                                                            isActive
                                                                ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 dark:ring-primary/30 border-primary/30 hover:bg-primary/90'
                                                                : 'hover:bg-muted/50'
                                                        )}
                                                        onClick={() => router.push(tool.href)}
                                                    >
                                                        <div className='flex items-center gap-3 w-full'>
                                                            <div className='w-7 h-7 bg-gradient-to-br from-muted to-muted/80 rounded-md flex items-center justify-center flex-shrink-0'>
                                                                <IconComponent className='w-4 h-4 text-muted-foreground' />
                                                            </div>
                                                            <div className='flex-1 text-left'>
                                                                <div className='font-medium text-sm'>{tool.title}</div>
                                                            </div>
                                                            {isActive && (
                                                                <ChevronRight className='w-4 h-4 flex-shrink-0' />
                                                            )}
                                                        </div>
                                                    </Button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}

                                {/* No Results - Expanded */}
                                {searchQuery && filteredTools.length === 0 && (
                                    <div className='text-center py-8'>
                                        <Search className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
                                        <h3 className='font-medium mb-2'>No tools found</h3>
                                        <p className='text-sm text-muted-foreground'>
                                            Try searching with different keywords
                                        </p>
                                    </div>
                                )}
                            </>
                        ) : (
                            <>
                                {/* Featured Tools - Collapsed */}
                                {featuredTools.length > 0 && (
                                    <div className='space-y-2'>
                                        {featuredTools.map((tool) => {
                                            const IconComponent = iconMap[tool.icon];
                                            const isActive = pathname === tool.href;
                                            return (
                                                <Tooltip key={tool.id}>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant={isActive ? 'secondary' : 'ghost'}
                                                            className={cn(
                                                                'w-full h-10 p-0 justify-center transition-all duration-200',
                                                                isActive
                                                                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 dark:ring-primary/30 scale-105 hover:bg-primary/90'
                                                                    : 'hover:bg-muted/50'
                                                            )}
                                                            onClick={() => router.push(tool.href)}
                                                        >
                                                            <div className='w-6 h-6 bg-gradient-to-br from-primary to-primary/80 rounded-md flex items-center justify-center'>
                                                                <IconComponent className='w-4 h-4 text-primary-foreground' />
                                                            </div>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side='right'>
                                                        <p className='font-medium'>{tool.title}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Separator for collapsed view */}
                                {featuredTools.length > 0 && tools.filter((t) => !t.featured).length > 0 && (
                                    <div className='border-t mx-2' />
                                )}

                                {/* All Tools - Collapsed (Icon Only) */}
                                <div className='space-y-1'>
                                    {tools
                                        .filter((tool) => !tool.featured)
                                        .map((tool) => {
                                            const IconComponent = iconMap[tool.icon];
                                            const isActive = pathname === tool.href;
                                            return (
                                                <Tooltip key={tool.id}>
                                                    <TooltipTrigger asChild>
                                                        <Button
                                                            variant={isActive ? 'secondary' : 'ghost'}
                                                            className={cn(
                                                                'w-full h-10 p-0 justify-center transition-all duration-200',
                                                                isActive
                                                                    ? 'bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20 dark:ring-primary/30 scale-105 hover:bg-primary/90'
                                                                    : 'hover:bg-muted/50'
                                                            )}
                                                            onClick={() => router.push(tool.href)}
                                                        >
                                                            <div className='w-6 h-6 flex items-center justify-center'>
                                                                <IconComponent className='w-4 h-4 text-muted-foreground' />
                                                            </div>
                                                        </Button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side='right'>
                                                        <p className='font-medium'>{tool.title}</p>
                                                    </TooltipContent>
                                                </Tooltip>
                                            );
                                        })}
                                </div>
                            </>
                        )}
                    </div>
                </ScrollArea>

                {/* Footer */}
                <div className='p-4 border-t bg-muted/20'>
                    {isExpanded ? (
                        <div className='text-xs text-muted-foreground text-center'>{tools.length} tools available</div>
                    ) : (
                        <div className='text-xs text-muted-foreground text-center'>{tools.length}</div>
                    )}
                </div>
            </div>
        </TooltipProvider>
    );
}
