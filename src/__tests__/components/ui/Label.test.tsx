import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Label } from '@/components/ui/label';

// Mock the utils function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

describe('Label', () => {
    it('should render with default classes', () => {
        render(<Label>Test Label</Label>);

        const label = screen.getByText('Test Label');
        expect(label).toBeInTheDocument();
        expect(label.tagName).toBe('LABEL');
    });

    it('should apply custom className', () => {
        render(<Label className='custom-label'>Custom Label</Label>);

        const label = screen.getByText('Custom Label');
        expect(label).toHaveClass('custom-label');
    });

    it('should forward ref correctly', () => {
        const ref = vi.fn();
        render(<Label ref={ref}>Label with ref</Label>);

        expect(ref).toHaveBeenCalled();
    });

    it('should pass through additional props', () => {
        render(
            <Label htmlFor='input-id' data-testid='test-label'>
                Label for input
            </Label>
        );

        const label = screen.getByTestId('test-label');
        expect(label).toBeInTheDocument();
        expect(label).toHaveAttribute('for', 'input-id');
    });

    it('should render children correctly', () => {
        render(
            <Label>
                <span>Icon</span>
                Label Text
            </Label>
        );

        expect(screen.getByText('Icon')).toBeInTheDocument();
        expect(screen.getByText('Label Text')).toBeInTheDocument();
    });

    it('should handle empty content', () => {
        render(<Label data-testid='empty-label'></Label>);

        const label = screen.getByTestId('empty-label');
        expect(label).toBeInTheDocument();
        expect(label).toBeEmptyDOMElement();
    });
});
