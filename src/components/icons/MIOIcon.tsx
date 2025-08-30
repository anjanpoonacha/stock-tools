'use client';

import React from 'react';
import { useTheme } from 'next-themes';

interface MIOIconProps {
    className?: string;
}

export function MIOIcon({ className = 'w-6 h-6' }: MIOIconProps) {
    const { theme, resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    if (isDark) {
        // White MIO logo for dark theme (MIO-white.svg)
        return (
            <svg className={className} viewBox='0 0 64 64' fill='none' xmlns='http://www.w3.org/2000/svg'>
                <g transform='translate(0,64) scale(0.1,-0.1)' fill='white'>
                    <path
                        d='M201 568 c-92 -45 -151 -133 -154 -231 -2 -71 19 -139 58 -184 30
-35 33 -36 39 -16 5 14 -1 33 -19 59 -33 49 -38 71 -33 147 3 49 10 71 35 107
34 51 113 100 159 100 16 0 43 9 59 20 l30 20 -65 -1 c-45 0 -78 -6 -109 -21z'
                    />
                    <path
                        d='M373 504 c-105 -81 -133 -109 -133 -129 0 -7 18 -35 40 -61 22 -27
40 -53 40 -58 0 -5 -34 -51 -76 -104 -42 -52 -72 -93 -67 -91 27 11 213 167
222 187 9 20 6 28 -29 66 -22 24 -40 49 -40 56 0 7 34 57 76 111 41 55 73 99
71 99 -3 0 -49 -34 -104 -76z'
                    />
                    <path
                        d='M500 500 c0 -13 12 -47 26 -77 23 -47 26 -62 21 -120 -4 -51 -11 -75
-34 -106 -37 -53 -98 -96 -148 -104 -22 -3 -51 -15 -65 -26 l-25 -20 68 6 c51
4 79 12 115 34 57 35 108 99 123 156 23 87 -5 211 -60 261 -21 19 -21 19 -21
-4z'
                    />
                </g>
            </svg>
        );
    }

    // Black MIO logo for light theme (MIO.svg)
    return (
        <svg className={className} viewBox='0 0 64 64' fill='none' xmlns='http://www.w3.org/2000/svg'>
            <g transform='translate(0,64) scale(0.1,-0.1)' fill='currentColor'>
                <path
                    d='M201 568 c-92 -45 -151 -133 -154 -231 -2 -71 19 -139 58 -184 30
-35 33 -36 39 -16 5 14 -1 33 -19 59 -33 49 -38 71 -33 147 3 49 10 71 35 107
34 51 113 100 159 100 16 0 43 9 59 20 l30 20 -65 -1 c-45 0 -78 -6 -109 -21z'
                />
                <path
                    d='M373 504 c-105 -81 -133 -109 -133 -129 0 -7 18 -35 40 -61 22 -27
40 -53 40 -58 0 -5 -34 -51 -76 -104 -42 -52 -72 -93 -67 -91 27 11 213 167
222 187 9 20 6 28 -29 66 -22 24 -40 49 -40 56 0 7 34 57 76 111 41 55 73 99
71 99 -3 0 -49 -34 -104 -76z'
                />
                <path
                    d='M500 500 c0 -13 12 -47 26 -77 23 -47 26 -62 21 -120 -4 -51 -11 -75
-34 -106 -37 -53 -98 -96 -148 -104 -22 -3 -51 -15 -65 -26 l-25 -20 68 6 c51
4 79 12 115 34 57 35 108 99 123 156 23 87 -5 211 -60 261 -21 19 -21 19 -21
-4z'
                />
            </g>
        </svg>
    );
}
