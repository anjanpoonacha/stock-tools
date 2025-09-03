import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

// Mock the utils function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

// Mock class-variance-authority
vi.mock('class-variance-authority', () => ({
    cva: vi.fn(() => vi.fn(() => 'mocked-badge-classes')),
}));

// Mock Radix UI Slot
vi.mock('@radix-ui/react-slot', () => ({
    Slot: ({ children, ...props }: { children: React.ReactNode; [key: string]: unknown }) => <div {...props}>{children}</div>,
}));

describe('Badge', () => {
    it('should render with default variant', () => {
        render(<Badge>Default Badge</Badge>);

        const badge = screen.getByText('Default Badge');
        expect(badge).toBeInTheDocument();
        expect(badge.tagName).toBe('SPAN');
        expect(badge).toHaveAttribute('data-slot', 'badge');
    });

    it('should render with secondary variant', () => {
        render(<Badge variant='secondary'>Secondary Badge</Badge>);

        const badge = screen.getByText('Secondary Badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('mocked-badge-classes');
    });

    it('should render with destructive variant', () => {
        render(<Badge variant='destructive'>Destructive Badge</Badge>);

        const badge = screen.getByText('Destructive Badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('mocked-badge-classes');
    });

    it('should render with outline variant', () => {
        render(<Badge variant='outline'>Outline Badge</Badge>);

        const badge = screen.getByText('Outline Badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveClass('mocked-badge-classes');
    });

    it('should apply custom className', () => {
        render(<Badge className='custom-badge'>Custom Badge</Badge>);

        const badge = screen.getByText('Custom Badge');
        expect(badge).toHaveClass('custom-badge');
    });

    it('should render as child component when asChild is true', () => {
        render(
            <Badge asChild>
                <button>Button Badge</button>
            </Badge>
        );

        const badge = screen.getByRole('button', { name: 'Button Badge' });
        expect(badge).toBeInTheDocument();
        expect(badge.tagName).toBe('BUTTON'); // Slot renders the actual child element
    });

    it('should render as span when asChild is false', () => {
        render(<Badge asChild={false}>Span Badge</Badge>);

        const badge = screen.getByText('Span Badge');
        expect(badge).toBeInTheDocument();
        expect(badge.tagName).toBe('SPAN');
    });

    it('should pass through additional props', () => {
        render(
            <Badge data-testid='test-badge' id='badge-id'>
                Badge with Props
            </Badge>
        );

        const badge = screen.getByTestId('test-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute('id', 'badge-id');
    });

    it('should render children correctly', () => {
        render(
            <Badge>
                <span>Icon</span>
                Badge Text
            </Badge>
        );

        expect(screen.getByText('Icon')).toBeInTheDocument();
        expect(screen.getByText('Badge Text')).toBeInTheDocument();
    });

    it('should handle empty content', () => {
        render(<Badge data-testid='empty-badge'></Badge>);

        const badge = screen.getByTestId('empty-badge');
        expect(badge).toBeInTheDocument();
        expect(badge).toBeEmptyDOMElement();
    });

    it('should combine variant classes with custom className', () => {
        render(
            <Badge variant='secondary' className='extra-class'>
                Combined Classes
            </Badge>
        );

        const badge = screen.getByText('Combined Classes');
        expect(badge).toHaveClass('mocked-badge-classes', 'extra-class');
    });

    it('should render with all variants', () => {
        const variants = ['default', 'secondary', 'destructive', 'outline'] as const;

        variants.forEach((variant) => {
            render(<Badge variant={variant}>{variant} badge</Badge>);
            expect(screen.getByText(`${variant} badge`)).toBeInTheDocument();
        });
    });
});
