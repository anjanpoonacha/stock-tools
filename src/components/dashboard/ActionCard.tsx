'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import {
    ArrowLeftRight,
    FileSpreadsheet,
    Download,
    RefreshCw,
    Upload,
    List,
    UserCheck,
    TestTube,
    ArrowRight,
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
} as const;

export interface Tool {
    id: string;
    title: string;
    description: string;
    href: string;
    icon: keyof typeof iconMap;
    category: string;
    featured?: boolean;
    keywords: string[];
}

interface ActionCardProps {
    tool: Tool;
    featured?: boolean;
    compact?: boolean;
    className?: string;
}

export function ActionCard({ tool, featured = false, compact = false, className }: ActionCardProps) {
    const router = useRouter();
    const IconComponent = iconMap[tool.icon];

    const handleClick = () => {
        router.push(tool.href);
    };

    if (featured) {
        return (
            <Card
                className={cn(
                    'group hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-primary/30 bg-card/80 backdrop-blur-sm',
                    className
                )}
                onClick={handleClick}
            >
                <CardHeader className='pb-3'>
                    <div className='flex items-center gap-3 mb-2'>
                        <div className='w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/30 transition-all duration-300'>
                            <IconComponent className='w-6 h-6 text-primary' />
                        </div>
                        <Badge variant='outline' className='text-xs'>
                            {tool.category}
                        </Badge>
                    </div>
                    <CardTitle className='text-lg group-hover:text-primary transition-colors'>{tool.title}</CardTitle>
                </CardHeader>
                <CardContent className='pt-0'>
                    <CardDescription className='text-sm mb-4 line-clamp-2'>{tool.description}</CardDescription>
                    <Button
                        variant='ghost'
                        size='sm'
                        className='w-full justify-between group-hover:bg-primary/10 transition-all duration-200'
                        onClick={(e) => {
                            e.stopPropagation();
                            handleClick();
                        }}
                    >
                        <span>Open Tool</span>
                        <ArrowRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
                    </Button>
                </CardContent>
            </Card>
        );
    }

    if (compact) {
        return (
            <Card
                className={cn(
                    'group hover:shadow-md transition-all duration-200 cursor-pointer hover:border-primary/30 bg-card/50 backdrop-blur-sm',
                    className
                )}
                onClick={handleClick}
            >
                <CardContent className='p-4'>
                    <div className='flex items-center gap-3'>
                        <div className='w-10 h-10 bg-gradient-to-br from-muted to-muted/80 rounded-lg flex items-center justify-center group-hover:from-primary/10 group-hover:to-primary/20 transition-all duration-200'>
                            <IconComponent className='w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors' />
                        </div>
                        <div className='flex-1 min-w-0'>
                            <h4 className='font-medium text-sm group-hover:text-primary transition-colors truncate'>
                                {tool.title}
                            </h4>
                            <p className='text-xs text-muted-foreground truncate'>{tool.description}</p>
                        </div>
                        <ArrowRight className='w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all duration-200' />
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card
            className={cn(
                'group hover:shadow-lg transition-all duration-300 cursor-pointer hover:border-primary/30 bg-card/80 backdrop-blur-sm',
                className
            )}
            onClick={handleClick}
        >
            <CardHeader className='pb-3'>
                <div className='flex items-center gap-3 mb-2'>
                    <div className='w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/20 rounded-xl flex items-center justify-center group-hover:from-primary/20 group-hover:to-primary/30 transition-all duration-300'>
                        <IconComponent className='w-6 h-6 text-primary' />
                    </div>
                    <Badge variant='outline' className='text-xs'>
                        {tool.category}
                    </Badge>
                </div>
                <CardTitle className='text-lg group-hover:text-primary transition-colors'>{tool.title}</CardTitle>
            </CardHeader>
            <CardContent className='pt-0'>
                <CardDescription className='text-sm mb-4 line-clamp-2'>{tool.description}</CardDescription>
                <Button
                    variant='ghost'
                    size='sm'
                    className='w-full justify-between group-hover:bg-primary/10 transition-all duration-200'
                    onClick={(e) => {
                        e.stopPropagation();
                        handleClick();
                    }}
                >
                    <span>Open Tool</span>
                    <ArrowRight className='w-4 h-4 group-hover:translate-x-1 transition-transform' />
                </Button>
            </CardContent>
        </Card>
    );
}
