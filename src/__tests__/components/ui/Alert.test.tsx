import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

// Mock the utils function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

// Mock class-variance-authority
vi.mock('class-variance-authority', () => ({
    cva: vi.fn(() => vi.fn(() => 'mocked-alert-classes')),
}));

describe('Alert Components', () => {
    describe('Alert', () => {
        it('should render with default variant', () => {
            render(<Alert data-testid='test-alert'>Alert content</Alert>);

            const alert = screen.getByTestId('test-alert');
            expect(alert).toBeInTheDocument();
            expect(alert.tagName).toBe('DIV');
            expect(alert).toHaveClass('mocked-alert-classes');
        });

        it('should render with destructive variant', () => {
            render(
                <Alert variant='destructive' data-testid='test-alert'>
                    Destructive alert
                </Alert>
            );

            const alert = screen.getByTestId('test-alert');
            expect(alert).toBeInTheDocument();
            expect(alert).toHaveClass('mocked-alert-classes');
        });

        it('should apply custom className', () => {
            render(
                <Alert className='custom-alert' data-testid='test-alert'>
                    Custom alert
                </Alert>
            );

            const alert = screen.getByTestId('test-alert');
            expect(alert).toHaveClass('custom-alert');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<Alert ref={ref}>Alert with ref</Alert>);

            expect(ref).toHaveBeenCalled();
        });

        it('should pass through additional props', () => {
            render(
                <Alert role='alert' data-testid='test-alert'>
                    Alert with role
                </Alert>
            );

            const alert = screen.getByTestId('test-alert');
            expect(alert).toHaveAttribute('role', 'alert');
        });

        it('should render children correctly', () => {
            render(
                <Alert>
                    <span>Icon</span>
                    Alert content
                </Alert>
            );

            expect(screen.getByText('Icon')).toBeInTheDocument();
            expect(screen.getByText('Alert content')).toBeInTheDocument();
        });
    });

    describe('AlertTitle', () => {
        it('should render as h5 with default classes', () => {
            render(<AlertTitle>Alert Title</AlertTitle>);

            const title = screen.getByRole('heading', { level: 5 });
            expect(title).toBeInTheDocument();
            expect(title).toHaveTextContent('Alert Title');
        });

        it('should apply custom className', () => {
            render(<AlertTitle className='custom-title'>Custom Title</AlertTitle>);

            const title = screen.getByRole('heading', { level: 5 });
            expect(title).toHaveClass('custom-title');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<AlertTitle ref={ref}>Title with ref</AlertTitle>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('AlertDescription', () => {
        it('should render as div with default classes', () => {
            render(<AlertDescription data-testid='alert-desc'>Alert description</AlertDescription>);

            const description = screen.getByTestId('alert-desc');
            expect(description).toBeInTheDocument();
            expect(description.tagName).toBe('DIV');
            expect(description).toHaveTextContent('Alert description');
        });

        it('should apply custom className', () => {
            render(
                <AlertDescription className='custom-desc' data-testid='alert-desc'>
                    Custom description
                </AlertDescription>
            );

            const description = screen.getByTestId('alert-desc');
            expect(description).toHaveClass('custom-desc');
        });

        it('should forward ref correctly', () => {
            const ref = vi.fn();
            render(<AlertDescription ref={ref}>Description with ref</AlertDescription>);

            expect(ref).toHaveBeenCalled();
        });
    });

    describe('Complete Alert Structure', () => {
        it('should render complete alert with all components', () => {
            render(
                <Alert data-testid='complete-alert'>
                    <AlertTitle>Warning</AlertTitle>
                    <AlertDescription>This is a warning message</AlertDescription>
                </Alert>
            );

            expect(screen.getByTestId('complete-alert')).toBeInTheDocument();
            expect(screen.getByRole('heading', { level: 5 })).toHaveTextContent('Warning');
            expect(screen.getByText('This is a warning message')).toBeInTheDocument();
        });

        it('should render destructive alert with icon', () => {
            render(
                <Alert variant='destructive' data-testid='destructive-alert'>
                    <span data-testid='alert-icon'>⚠️</span>
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>Something went wrong</AlertDescription>
                </Alert>
            );

            expect(screen.getByTestId('destructive-alert')).toBeInTheDocument();
            expect(screen.getByTestId('alert-icon')).toBeInTheDocument();
            expect(screen.getByText('Error')).toBeInTheDocument();
            expect(screen.getByText('Something went wrong')).toBeInTheDocument();
        });
    });
});
