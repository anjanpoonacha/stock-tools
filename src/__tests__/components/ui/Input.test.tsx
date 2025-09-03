import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Input } from '@/components/ui/input';

describe('Input', () => {
    it('should render input with default attributes', () => {
        render(<Input placeholder='Enter text' />);

        const input = screen.getByPlaceholderText('Enter text') as HTMLInputElement;
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute('data-slot', 'input');
        // Input element defaults to text type when no type is specified
        expect(input.type).toBe('text');
    });

    it('should handle different input types', () => {
        const { rerender } = render(<Input type='email' placeholder='Email' />);
        let input = screen.getByPlaceholderText('Email');
        expect(input).toHaveAttribute('type', 'email');

        rerender(<Input type='password' placeholder='Password' />);
        input = screen.getByPlaceholderText('Password');
        expect(input).toHaveAttribute('type', 'password');

        rerender(<Input type='number' placeholder='Number' />);
        input = screen.getByPlaceholderText('Number');
        expect(input).toHaveAttribute('type', 'number');
    });

    it('should handle value changes', () => {
        const handleChange = vi.fn();
        render(<Input onChange={handleChange} placeholder='Test input' />);

        const input = screen.getByPlaceholderText('Test input');
        fireEvent.change(input, { target: { value: 'test value' } });

        expect(handleChange).toHaveBeenCalledTimes(1);
        expect(input).toHaveValue('test value');
    });

    it('should be disabled when disabled prop is true', () => {
        render(<Input disabled placeholder='Disabled input' />);

        const input = screen.getByPlaceholderText('Disabled input');
        expect(input).toBeDisabled();
    });

    it('should apply custom className', () => {
        render(<Input className='custom-input' placeholder='Custom input' />);

        const input = screen.getByPlaceholderText('Custom input');
        expect(input).toHaveClass('custom-input');
    });

    it('should handle focus and blur events', () => {
        const handleFocus = vi.fn();
        const handleBlur = vi.fn();
        render(<Input onFocus={handleFocus} onBlur={handleBlur} placeholder='Focus test' />);

        const input = screen.getByPlaceholderText('Focus test');

        fireEvent.focus(input);
        expect(handleFocus).toHaveBeenCalledTimes(1);

        fireEvent.blur(input);
        expect(handleBlur).toHaveBeenCalledTimes(1);
    });

    it('should handle keyboard events', () => {
        const handleKeyDown = vi.fn();
        render(<Input onKeyDown={handleKeyDown} placeholder='Keyboard test' />);

        const input = screen.getByPlaceholderText('Keyboard test');
        fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

        expect(handleKeyDown).toHaveBeenCalledTimes(1);
    });

    it('should support controlled input', () => {
        const { rerender } = render(<Input value='initial' onChange={() => {}} placeholder='Controlled' />);

        let input = screen.getByPlaceholderText('Controlled');
        expect(input).toHaveValue('initial');

        rerender(<Input value='updated' onChange={() => {}} placeholder='Controlled' />);
        input = screen.getByPlaceholderText('Controlled');
        expect(input).toHaveValue('updated');
    });

    it('should support uncontrolled input with defaultValue', () => {
        render(<Input defaultValue='default text' placeholder='Uncontrolled' />);

        const input = screen.getByPlaceholderText('Uncontrolled');
        expect(input).toHaveValue('default text');
    });
});
