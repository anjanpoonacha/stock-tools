import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Button } from '@/components/ui/button';

describe('Button', () => {
    it('should render button with default variant and size', () => {
        render(<Button>Click me</Button>);

        const button = screen.getByRole('button', { name: 'Click me' });
        expect(button).toBeInTheDocument();
        expect(button).toHaveAttribute('data-slot', 'button');
    });

    it('should handle click events', () => {
        const handleClick = vi.fn();
        render(<Button onClick={handleClick}>Click me</Button>);

        const button = screen.getByRole('button', { name: 'Click me' });
        fireEvent.click(button);

        expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should be disabled when disabled prop is true', () => {
        render(<Button disabled>Disabled button</Button>);

        const button = screen.getByRole('button', { name: 'Disabled button' });
        expect(button).toBeDisabled();
    });

    it('should render different variants correctly', () => {
        const { rerender } = render(<Button variant='destructive'>Destructive</Button>);
        let button = screen.getByRole('button', { name: 'Destructive' });
        expect(button).toBeInTheDocument();

        rerender(<Button variant='outline'>Outline</Button>);
        button = screen.getByRole('button', { name: 'Outline' });
        expect(button).toBeInTheDocument();

        rerender(<Button variant='secondary'>Secondary</Button>);
        button = screen.getByRole('button', { name: 'Secondary' });
        expect(button).toBeInTheDocument();

        rerender(<Button variant='ghost'>Ghost</Button>);
        button = screen.getByRole('button', { name: 'Ghost' });
        expect(button).toBeInTheDocument();
    });
});
