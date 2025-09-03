import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Card, CardHeader, CardFooter, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

// Mock the utils function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

describe('Card Components', () => {
    describe('Card', () => {
        it('should render with default classes', () => {
            render(<Card data-testid='card'>Card content</Card>);

            const card = screen.getByTestId('card');
            expect(card).toBeInTheDocument();
            expect(card).toHaveClass('rounded-lg', 'border', 'bg-card', 'text-card-foreground', 'shadow-sm');
        });

        it('should apply custom className', () => {
            render(
                <Card className='custom-class' data-testid='card'>
                    Card content
                </Card>
            );

            const card = screen.getByTestId('card');
            expect(card).toHaveClass('custom-class');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<Card ref={ref}>Card content</Card>);

            expect(ref).toHaveBeenCalled();
        });

        it('should render children correctly', () => {
            render(<Card>Test card content</Card>);

            expect(screen.getByText('Test card content')).toBeInTheDocument();
        });
    });

    describe('CardHeader', () => {
        it('should render with default classes', () => {
            render(<CardHeader data-testid='card-header'>Header content</CardHeader>);

            const header = screen.getByTestId('card-header');
            expect(header).toBeInTheDocument();
            expect(header).toHaveClass('flex', 'flex-col', 'space-y-1.5', 'p-6');
        });

        it('should apply custom className', () => {
            render(
                <CardHeader className='custom-header' data-testid='card-header'>
                    Header
                </CardHeader>
            );

            const header = screen.getByTestId('card-header');
            expect(header).toHaveClass('custom-header');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<CardHeader ref={ref}>Header content</CardHeader>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('CardTitle', () => {
        it('should render as h3 with default classes', () => {
            render(<CardTitle>Card Title</CardTitle>);

            const title = screen.getByRole('heading', { level: 3 });
            expect(title).toBeInTheDocument();
            expect(title).toHaveClass('text-2xl', 'font-semibold', 'leading-none', 'tracking-tight');
            expect(title).toHaveTextContent('Card Title');
        });

        it('should apply custom className', () => {
            render(<CardTitle className='custom-title'>Title</CardTitle>);

            const title = screen.getByRole('heading', { level: 3 });
            expect(title).toHaveClass('custom-title');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<CardTitle ref={ref}>Title</CardTitle>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('CardDescription', () => {
        it('should render as paragraph with default classes', () => {
            render(<CardDescription>Card description text</CardDescription>);

            const description = screen.getByText('Card description text');
            expect(description).toBeInTheDocument();
            expect(description.tagName).toBe('P');
            expect(description).toHaveClass('text-sm', 'text-muted-foreground');
        });

        it('should apply custom className', () => {
            render(<CardDescription className='custom-desc'>Description</CardDescription>);

            const description = screen.getByText('Description');
            expect(description).toHaveClass('custom-desc');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<CardDescription ref={ref}>Description</CardDescription>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('CardContent', () => {
        it('should render with default classes', () => {
            render(<CardContent data-testid='card-content'>Content here</CardContent>);

            const content = screen.getByTestId('card-content');
            expect(content).toBeInTheDocument();
            expect(content).toHaveClass('p-6', 'pt-0');
        });

        it('should apply custom className', () => {
            render(
                <CardContent className='custom-content' data-testid='card-content'>
                    Content
                </CardContent>
            );

            const content = screen.getByTestId('card-content');
            expect(content).toHaveClass('custom-content');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<CardContent ref={ref}>Content</CardContent>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('CardFooter', () => {
        it('should render with default classes', () => {
            render(<CardFooter data-testid='card-footer'>Footer content</CardFooter>);

            const footer = screen.getByTestId('card-footer');
            expect(footer).toBeInTheDocument();
            expect(footer).toHaveClass('flex', 'items-center', 'p-6', 'pt-0');
        });

        it('should apply custom className', () => {
            render(
                <CardFooter className='custom-footer' data-testid='card-footer'>
                    Footer
                </CardFooter>
            );

            const footer = screen.getByTestId('card-footer');
            expect(footer).toHaveClass('custom-footer');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<CardFooter ref={ref}>Footer</CardFooter>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('Complete Card Structure', () => {
        it('should render complete card with all components', () => {
            render(
                <Card data-testid='complete-card'>
                    <CardHeader>
                        <CardTitle>Test Title</CardTitle>
                        <CardDescription>Test description</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <p>Main content goes here</p>
                    </CardContent>
                    <CardFooter>
                        <button>Action Button</button>
                    </CardFooter>
                </Card>
            );

            expect(screen.getByTestId('complete-card')).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Test Title');
            expect(screen.getByText('Test description')).toBeInTheDocument();
            expect(screen.getByText('Main content goes here')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument();
        });
    });
});
