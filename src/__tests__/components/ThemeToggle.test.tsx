import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeToggle } from '@/components/ThemeToggle';

// Mock next-themes
const mockSetTheme = vi.fn();
const mockUseTheme = vi.fn();

vi.mock('next-themes', () => ({
    useTheme: () => mockUseTheme(),
}));

describe('ThemeToggle', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockSetTheme.mockClear();
    });

    it('should render theme toggle button', () => {
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        // Component should render (mounting behavior is handled internally)
        expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
    });

    it('should render light theme button after mounting', async () => {
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        // Should show Moon icon for light theme
        expect(document.querySelector('.lucide-moon')).toBeInTheDocument();
        expect(document.querySelector('.lucide-sun')).not.toBeInTheDocument();
    });

    it('should render dark theme button after mounting', async () => {
        mockUseTheme.mockReturnValue({
            theme: 'dark',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        // Should show Sun icon for dark theme
        expect(document.querySelector('.lucide-sun')).toBeInTheDocument();
        expect(document.querySelector('.lucide-moon')).not.toBeInTheDocument();
    });

    it('should toggle from light to dark theme when clicked', async () => {
        const user = userEvent.setup();
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        const toggleButton = screen.getByLabelText('Toggle theme');
        await user.click(toggleButton);

        expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should toggle from dark to light theme when clicked', async () => {
        const user = userEvent.setup();
        mockUseTheme.mockReturnValue({
            theme: 'dark',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        const toggleButton = screen.getByLabelText('Toggle theme');
        await user.click(toggleButton);

        expect(mockSetTheme).toHaveBeenCalledWith('light');
    });

    it('should handle undefined theme', async () => {
        mockUseTheme.mockReturnValue({
            theme: undefined,
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        // Should show Moon icon when theme is undefined (defaults to light behavior)
        expect(document.querySelector('.lucide-moon')).toBeInTheDocument();
    });

    it('should handle system theme', async () => {
        const user = userEvent.setup();
        mockUseTheme.mockReturnValue({
            theme: 'system',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            expect(screen.getByLabelText('Toggle theme')).toBeInTheDocument();
        });

        const toggleButton = screen.getByLabelText('Toggle theme');
        await user.click(toggleButton);

        // Should toggle to dark when current theme is not 'dark'
        expect(mockSetTheme).toHaveBeenCalledWith('dark');
    });

    it('should render as a button with correct attributes', async () => {
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            const button = screen.getByLabelText('Toggle theme');
            expect(button).toBeInTheDocument();
            expect(button.tagName).toBe('BUTTON');
            expect(button).toHaveAttribute('aria-label', 'Toggle theme');
        });
    });

    it('should have correct icon sizes', async () => {
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            const moonIcon = document.querySelector('.lucide-moon');
            expect(moonIcon).toHaveClass('w-5', 'h-5');
        });
    });

    it('should be clickable and not disabled', async () => {
        mockUseTheme.mockReturnValue({
            theme: 'light',
            setTheme: mockSetTheme,
        });

        render(<ThemeToggle />);

        await waitFor(() => {
            const button = screen.getByLabelText('Toggle theme');
            expect(button).not.toBeDisabled();
            expect(button).toBeEnabled();
        });
    });
});
