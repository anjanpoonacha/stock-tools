import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';

describe('LoginForm', () => {
    const defaultProps = {
        userEmail: '',
        userPassword: '',
        showPassword: false,
        isLoading: false,
        onEmailChange: vi.fn(),
        onPasswordChange: vi.fn(),
        onTogglePassword: vi.fn(),
        onSubmit: vi.fn(),
        onKeyDown: vi.fn(),
    };

    it('should render all form fields correctly', () => {
        render(<LoginForm {...defaultProps} />);

        // Check if email input is rendered
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('your@email.com')).toBeInTheDocument();

        // Check if password input is rendered
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
        expect(screen.getByPlaceholderText('Your password')).toBeInTheDocument();

        // Check if submit button is rendered
        expect(screen.getByRole('button', { name: /access my sessions/i })).toBeInTheDocument();

        // Check if password toggle button is rendered
        expect(screen.getByRole('button', { name: '' })).toBeInTheDocument(); // Eye icon button

        // Check if help text is rendered
        expect(
            screen.getByText(/this will only show sessions captured with these exact credentials/i)
        ).toBeInTheDocument();
    });

    it('should handle email input changes', () => {
        const mockOnEmailChange = vi.fn();
        const props = { ...defaultProps, onEmailChange: mockOnEmailChange };

        render(<LoginForm {...props} />);

        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });

        expect(mockOnEmailChange).toHaveBeenCalledWith('test@example.com');
    });

    it('should handle password input changes', () => {
        const mockOnPasswordChange = vi.fn();
        const props = { ...defaultProps, onPasswordChange: mockOnPasswordChange };

        render(<LoginForm {...props} />);

        const passwordInput = screen.getByLabelText(/password/i);
        fireEvent.change(passwordInput, { target: { value: 'mypassword123' } });

        expect(mockOnPasswordChange).toHaveBeenCalledWith('mypassword123');
    });

    it('should toggle password visibility', () => {
        const mockOnTogglePassword = vi.fn();
        const props = { ...defaultProps, onTogglePassword: mockOnTogglePassword };

        render(<LoginForm {...props} />);

        const toggleButton = screen.getByRole('button', { name: '' }); // Eye icon button
        fireEvent.click(toggleButton);

        expect(mockOnTogglePassword).toHaveBeenCalled();
    });

    it('should disable submit button when form is invalid', () => {
        const props = { ...defaultProps, userEmail: '', userPassword: '' };

        render(<LoginForm {...props} />);

        const submitButton = screen.getByRole('button', { name: /access my sessions/i });
        expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when form is valid', () => {
        const props = { ...defaultProps, userEmail: 'test@example.com', userPassword: 'password123' };

        render(<LoginForm {...props} />);

        const submitButton = screen.getByRole('button', { name: /access my sessions/i });
        expect(submitButton).not.toBeDisabled();
    });
});
