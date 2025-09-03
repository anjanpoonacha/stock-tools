import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Textarea } from '@/components/ui/textarea';

// Mock the utils function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes) => classes.filter(Boolean).join(' ')),
}));

describe('Textarea', () => {
    it('should render with default attributes', () => {
        render(<Textarea data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toBeInTheDocument();
        expect(textarea.tagName).toBe('TEXTAREA');
    });

    it('should apply custom className', () => {
        render(<Textarea className='custom-textarea' data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveClass('custom-textarea');
    });

    it('should handle value changes', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Textarea onChange={onChange} data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        await user.type(textarea, 'Hello World');

        expect(onChange).toHaveBeenCalled();
        expect(textarea).toHaveValue('Hello World');
    });

    it('should be disabled when disabled prop is true', () => {
        render(<Textarea disabled data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toBeDisabled();
    });

    it('should forward ref correctly', () => {
        const ref = vi.fn();
        render(<Textarea ref={ref} />);

        expect(ref).toHaveBeenCalled();
    });

    it('should handle focus and blur events', async () => {
        const user = userEvent.setup();
        const onFocus = vi.fn();
        const onBlur = vi.fn();
        render(<Textarea onFocus={onFocus} onBlur={onBlur} data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        await user.click(textarea);
        expect(onFocus).toHaveBeenCalled();

        await user.tab();
        expect(onBlur).toHaveBeenCalled();
    });

    it('should support controlled textarea', async () => {
        const user = userEvent.setup();
        const onChange = vi.fn();
        render(<Textarea value='controlled value' onChange={onChange} data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveValue('controlled value');

        await user.clear(textarea);
        await user.type(textarea, 'new value');
        expect(onChange).toHaveBeenCalled();
    });

    it('should support uncontrolled textarea with defaultValue', () => {
        render(<Textarea defaultValue='default text' data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveValue('default text');
    });

    it('should handle placeholder text', () => {
        render(<Textarea placeholder='Enter your message' data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveAttribute('placeholder', 'Enter your message');
    });

    it('should handle rows attribute', () => {
        render(<Textarea rows={5} data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveAttribute('rows', '5');
    });

    it('should handle readonly attribute', () => {
        render(<Textarea readOnly data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveAttribute('readonly');
    });

    it('should pass through additional props', () => {
        render(<Textarea id='textarea-id' name='message' data-testid='test-textarea' />);

        const textarea = screen.getByTestId('test-textarea');
        expect(textarea).toHaveAttribute('id', 'textarea-id');
        expect(textarea).toHaveAttribute('name', 'message');
    });
});
