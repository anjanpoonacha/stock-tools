'use client';

import { useState, useEffect } from 'react';

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
            // Error reading localStorage
        }
    }, [key]);

    const setValue = (value: T) => {
        try {
            setStoredValue(value);
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            // Error setting localStorage
        }
    };

    return [storedValue, setValue];
}

type ScreenSize = 'mobile' | 'tablet' | 'desktop' | 'large';

interface UseSidebarOptions {
    defaultCollapsed?: boolean;
}

interface UseSidebarReturn {
    isCollapsed: boolean;
    isExpanded: boolean;
    screenSize: ScreenSize;
    toggleCollapse: () => void;
    getWidth: () => string;
    handleMouseEnter: () => void;
    handleMouseLeave: () => void;
}

export function useSidebar({ defaultCollapsed = false }: UseSidebarOptions = {}): UseSidebarReturn {
    const [isCollapsed, setIsCollapsed] = useLocalStorage('sidebar-collapsed', defaultCollapsed);
    const [screenSize, setScreenSize] = useState<ScreenSize>('desktop');

    // Responsive breakpoint detection
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

    // Toggle collapse state
    const toggleCollapse = () => {
        setIsCollapsed(!isCollapsed);
    };

    // No hover expansion - only tooltips
    const handleMouseEnter = () => {
        // Do nothing - no hover expansion
    };

    const handleMouseLeave = () => {
        // Do nothing - no hover expansion
    };

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

    return {
        isCollapsed,
        isExpanded,
        screenSize,
        toggleCollapse,
        getWidth,
        handleMouseEnter,
        handleMouseLeave,
    };
}
