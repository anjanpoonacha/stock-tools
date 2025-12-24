'use client';

import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
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
    ArrowRight,
    Zap,
    Home,
    FileCode,
    TrendingUp,
    BarChart3,
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
    TrendingUp,
    BarChart3,
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

interface MobileSidebarProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    tools: Tool[];
    onToolSelect: (href: string) => void;
}

export function MobileSidebar({ open, onOpenChange, tools, onToolSelect }: MobileSidebarProps) {
    const [searchQuery, setSearchQuery] = useState('');

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

    const handleToolClick = (href: string) => {
        onToolSelect(href);
        onOpenChange(false);
    };

    const featuredTool = tools.find((tool) => tool.featured);

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side='left' className='w-80 p-0'>
                <div className='flex flex-col h-full'>
                    {/* Header */}
                    <SheetHeader className='p-6 pb-4 border-b'>
                        <SheetTitle className='flex items-center gap-3 text-left'>
                            <div className='w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center'>
                                <Zap className='w-5 h-5 text-primary-foreground' />
                            </div>
                            <div>
                                <div className='font-bold text-lg'>Stock Tools</div>
                                <div className='text-xs text-muted-foreground font-normal'>
                                    MarketInOut & TradingView
                                </div>
                            </div>
                        </SheetTitle>
                    </SheetHeader>

                    {/* Quick Navigation */}
                    <div className='p-4 border-b'>
                        <Button
                            variant='ghost'
                            className='w-full justify-start gap-3 h-10'
                            onClick={() => handleToolClick('/')}
                        >
                            <Home className='w-4 h-4' />
                            Dashboard
                        </Button>
                    </div>

                    {/* Search */}
                    <div className='p-4 border-b'>
                        <div className='relative'>
                            <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground' />
                            <Input
                                placeholder='Search tools...'
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className='pl-10 h-9'
                            />
                        </div>
                    </div>

                    {/* Content */}
                    <ScrollArea className='flex-1'>
                        <div className='p-4 space-y-6'>
                            {/* Featured Tool */}
                            {featuredTool && !searchQuery && (
                                <>
                                    <div>
                                        <div className='flex items-center gap-2 mb-3'>
                                            <Zap className='w-4 h-4 text-primary' />
                                            <h3 className='font-semibold text-sm'>Featured</h3>
                                        </div>
                                        <Button
                                            variant='outline'
                                            className='w-full h-auto p-3 justify-start border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/20'
                                            onClick={() => handleToolClick(featuredTool.href)}
                                        >
                                            <div className='flex items-center gap-3 w-full'>
                                                <div className='w-8 h-8 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0'>
                                                    {(() => {
                                                        const IconComponent = iconMap[featuredTool.icon];
                                                        return (
                                                            <IconComponent className='w-4 h-4 text-primary-foreground' />
                                                        );
                                                    })()}
                                                </div>
                                                <div className='flex-1 text-left'>
                                                    <div className='font-medium text-sm'>{featuredTool.title}</div>
                                                    <div className='text-xs text-muted-foreground line-clamp-1'>
                                                        {featuredTool.description}
                                                    </div>
                                                </div>
                                                <ArrowRight className='w-4 h-4 text-muted-foreground flex-shrink-0' />
                                            </div>
                                        </Button>
                                    </div>
                                    <Separator />
                                </>
                            )}

                            {/* Tool Categories */}
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
                                            return (
                                                <Button
                                                    key={tool.id}
                                                    variant='ghost'
                                                    className='w-full h-auto p-3 justify-start hover:bg-muted/50 rounded-lg'
                                                    onClick={() => handleToolClick(tool.href)}
                                                >
                                                    <div className='flex items-center gap-3 w-full'>
                                                        <div className='w-7 h-7 bg-gradient-to-br from-muted to-muted/80 rounded-md flex items-center justify-center flex-shrink-0'>
                                                            <IconComponent className='w-4 h-4 text-muted-foreground' />
                                                        </div>
                                                        <div className='flex-1 text-left'>
                                                            <div className='font-medium text-sm'>{tool.title}</div>
                                                            <div className='text-xs text-muted-foreground line-clamp-1'>
                                                                {tool.description}
                                                            </div>
                                                        </div>
                                                        <ArrowRight className='w-3 h-3 text-muted-foreground flex-shrink-0' />
                                                    </div>
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}

                            {/* No Results */}
                            {searchQuery && filteredTools.length === 0 && (
                                <div className='text-center py-8'>
                                    <Search className='w-12 h-12 text-muted-foreground mx-auto mb-4' />
                                    <h3 className='font-medium mb-2'>No tools found</h3>
                                    <p className='text-sm text-muted-foreground'>
                                        Try searching with different keywords
                                    </p>
                                </div>
                            )}
                        </div>
                    </ScrollArea>

                    {/* Footer */}
                    <div className='p-4 border-t bg-muted/20'>
                        <div className='text-xs text-muted-foreground text-center'>{tools.length} tools available</div>
                    </div>
                </div>
            </SheetContent>
        </Sheet>
    );
}
