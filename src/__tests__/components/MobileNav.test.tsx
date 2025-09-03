import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileNav } from '@/components/MobileNav';

// Mock Next.js Link component
vi.mock('next/link', () => ({
    default: vi.fn(({ children, href, className, ...props }) => (
        <a href={href} className={className} {...props}>
            {children}
        </a>
    )),
}));

// Mock the UI components
vi.mock('@/components/ui/dropdown-menu', () => ({
    DropdownMenu: vi.fn(({ children }) => <div data-testid='dropdown-menu'>{children}</div>),
    DropdownMenuTrigger: vi.fn(({ children }) => <div data-testid='dropdown-menu-trigger'>{children}</div>),
    DropdownMenuContent: vi.fn(({ children, align, className }) => (
        <div data-testid='dropdown-menu-content' data-align={align} className={className}>
            {children}
        </div>
    )),
    DropdownMenuItem: vi.fn(({ children }) => <div data-testid='dropdown-menu-item'>{children}</div>),
}));

vi.mock('@/components/ui/button', () => ({
    Button: vi.fn(({ children, variant, size, className, ...props }) => (
        <button data-testid='button' data-variant={variant} data-size={size} className={className} {...props}>
            {children}
        </button>
    )),
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Menu: vi.fn(({ className, ...props }) => <svg data-testid='menu-icon' className={className} {...props} />),
}));

// Mock ThemeToggle component
vi.mock('@/components/ThemeToggle', () => ({
    ThemeToggle: vi.fn(() => <div data-testid='theme-toggle'>Theme Toggle</div>),
}));

describe('MobileNav', () => {
    it('should render mobile navigation with correct structure', () => {
        render(<MobileNav />);

        // Check main nav element
        const nav = screen.getByRole('navigation');
        expect(nav).toBeInTheDocument();
        expect(nav).toHaveClass('md:hidden', 'w-full', 'border-b', 'bg-card', 'z-50', 'sticky', 'top-0');
    });

    it('should render Stock Tools brand link', () => {
        render(<MobileNav />);

        const brandLink = screen.getByRole('link', { name: /stock tools/i });
        expect(brandLink).toBeInTheDocument();
        expect(brandLink).toHaveAttribute('href', '/');
        expect(brandLink).toHaveClass('font-bold', 'text-lg');
    });

    it('should render dropdown menu with trigger button', () => {
        render(<MobileNav />);

        // Check dropdown menu structure
        expect(screen.getByTestId('dropdown-menu')).toBeInTheDocument();
        expect(screen.getByTestId('dropdown-menu-trigger')).toBeInTheDocument();
        expect(screen.getByTestId('dropdown-menu-content')).toBeInTheDocument();

        // Check trigger button
        const menuButton = screen.getByTestId('button');
        expect(menuButton).toBeInTheDocument();
        expect(menuButton).toHaveAttribute('data-variant', 'ghost');
        expect(menuButton).toHaveAttribute('data-size', 'icon');
        expect(menuButton).toHaveAttribute('aria-label', 'Open menu');
    });

    it('should render menu icon in trigger button', () => {
        render(<MobileNav />);

        const menuIcon = screen.getByTestId('menu-icon');
        expect(menuIcon).toBeInTheDocument();
        expect(menuIcon).toHaveClass('w-6', 'h-6');
    });

    it('should render dropdown menu content with correct alignment and styling', () => {
        render(<MobileNav />);

        const dropdownContent = screen.getByTestId('dropdown-menu-content');
        expect(dropdownContent).toHaveAttribute('data-align', 'end');
        expect(dropdownContent).toHaveClass('w-48');
    });

    it('should render all navigation menu items', () => {
        render(<MobileNav />);

        const menuItems = screen.getAllByTestId('dropdown-menu-item');
        expect(menuItems).toHaveLength(4);

        // Check Stock Converter link
        const stockConverterLink = screen.getByRole('link', { name: /stock converter/i });
        expect(stockConverterLink).toBeInTheDocument();
        expect(stockConverterLink).toHaveAttribute('href', '/');

        // Check CSV Watchlist link
        const csvWatchlistLink = screen.getByRole('link', { name: /csv watchlist/i });
        expect(csvWatchlistLink).toBeInTheDocument();
        expect(csvWatchlistLink).toHaveAttribute('href', '/csv-watchlist');

        // Check Regroup TV Watchlist link
        const regroupWatchlistLink = screen.getByRole('link', { name: /regroup tv watchlist/i });
        expect(regroupWatchlistLink).toBeInTheDocument();
        expect(regroupWatchlistLink).toHaveAttribute('href', '/regroup-watchlist');

        // Check MIO Watchlist link
        const mioWatchlistLink = screen.getByRole('link', { name: /mio watchlist/i });
        expect(mioWatchlistLink).toBeInTheDocument();
        expect(mioWatchlistLink).toHaveAttribute('href', '/mio-watchlist');
    });

    it('should render theme toggle component', () => {
        render(<MobileNav />);

        const themeToggle = screen.getByTestId('theme-toggle');
        expect(themeToggle).toBeInTheDocument();
        expect(themeToggle).toHaveTextContent('Theme Toggle');
    });

    it('should have correct container layout classes', () => {
        render(<MobileNav />);

        const container = screen.getByRole('navigation').firstChild;
        expect(container).toHaveClass('flex', 'items-center', 'justify-between', 'px-4', 'py-3');
    });

    it('should have correct actions container layout', () => {
        render(<MobileNav />);

        // Find the container with theme toggle and dropdown
        const actionsContainer = screen.getByTestId('theme-toggle').parentElement;
        expect(actionsContainer).toHaveClass('flex', 'items-center', 'gap-2');
    });

    it('should handle menu button click', () => {
        render(<MobileNav />);

        const menuButton = screen.getByTestId('button');

        // Simulate click event
        fireEvent.click(menuButton);

        // Button should still be in the document after click
        expect(menuButton).toBeInTheDocument();
    });

    it('should render all links with correct href attributes', () => {
        render(<MobileNav />);

        const links = screen.getAllByRole('link');

        // Brand link
        expect(links[0]).toHaveAttribute('href', '/');

        // Menu item links
        expect(links[1]).toHaveAttribute('href', '/');
        expect(links[2]).toHaveAttribute('href', '/csv-watchlist');
        expect(links[3]).toHaveAttribute('href', '/regroup-watchlist');
        expect(links[4]).toHaveAttribute('href', '/mio-watchlist');
    });

    it('should be accessible with proper ARIA labels', () => {
        render(<MobileNav />);

        const menuButton = screen.getByTestId('button');
        expect(menuButton).toHaveAttribute('aria-label', 'Open menu');
    });

    it('should render with mobile-specific classes', () => {
        render(<MobileNav />);

        const nav = screen.getByRole('navigation');
        expect(nav).toHaveClass('md:hidden'); // Hidden on medium screens and up
    });

    it('should have sticky positioning', () => {
        render(<MobileNav />);

        const nav = screen.getByRole('navigation');
        expect(nav).toHaveClass('sticky', 'top-0', 'z-50');
    });
});
