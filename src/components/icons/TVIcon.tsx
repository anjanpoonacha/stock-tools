'use client';

import React from 'react';
import { useTheme } from 'next-themes';

interface TVIconProps {
    className?: string;
}

export function TVIcon({ className = 'w-6 h-6' }: TVIconProps) {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    if (isDark) {
        // White short TradingView logo for dark theme - optimized viewBox for better visibility
        return (
            <svg className={className} viewBox='20 50 140 85' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <path
                    fillRule='evenodd'
                    clipRule='evenodd'
                    d='M115.055 72.5C115.055 79.8638 109.086 85.8333 101.722 85.8333C94.3583 85.8333 88.3888 79.8638 88.3888 72.5C88.3888 65.1362 94.3583 59.1667 101.722 59.1667C109.086 59.1667 115.055 65.1362 115.055 72.5ZM81.9999 59.7778H28.6667L28.6665 86.4444H55.3332V125.556H81.9999V59.7778ZM128.755 59.7778H159.333L131.778 125.556H101.111L128.755 59.7778Z'
                    fill='white'
                />
            </svg>
        );
    }

    // Black short TradingView logo for light theme - optimized viewBox for better visibility
    return (
        <svg className={className} viewBox='20 50 140 85' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <path
                fillRule='evenodd'
                clipRule='evenodd'
                d='M115.055 72.5C115.055 79.8638 109.086 85.8333 101.722 85.8333C94.3583 85.8333 88.3888 79.8638 88.3888 72.5C88.3888 65.1362 94.3583 59.1667 101.722 59.1667C109.086 59.1667 115.055 65.1362 115.055 72.5ZM81.9999 59.7778H28.6667L28.6665 86.4444H55.3332V125.556H81.9999V59.7778ZM128.755 59.7778H159.333L131.778 125.556H101.111L128.755 59.7778Z'
                fill='black'
            />
        </svg>
    );
}
