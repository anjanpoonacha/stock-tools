import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LoginForm } from '@/components/auth/LoginForm';
import { UserSelector } from '@/components/auth/UserSelector';
import { ErrorAlert } from '@/components/error/ErrorAlert';
import { SessionError, SessionErrorType, ErrorSeverity, Platform } from '@/lib/sessionErrors';

// Mock the icon utils for ErrorAlert and LoginForm
vi.mock('@/lib/iconUtils', () => {
    const MockSeverityIcon = () => <div data-testid='severity-icon' />;
    MockSeverityIcon.displayName = 'MockSeverityIcon';
    
    const MockEyeIcon = () => <div data-testid='eye-icon' />;
    MockEyeIcon.displayName = 'MockEyeIcon';
    
    const MockEyeOffIcon = () => <div data-testid='eye-off-icon' />;
    MockEyeOffIcon.displayName = 'MockEyeOffIcon';
    
    const MockLockIcon = () => <div data-testid='lock-icon' />;
    MockLockIcon.displayName = 'MockLockIcon';
    
    return {
        getSeverityIcon: vi.fn(() => MockSeverityIcon),
        getPlatformConfig: vi.fn(() => ({ name: 'Test Platform' })),
        CommonIcons: {
            eye: MockEyeIcon,
            eyeOff: MockEyeOffIcon,
            lock: MockLockIcon,
        },
    };
});

// Mock the child components for ErrorAlert
vi.mock('@/components/error/RecoveryActions', () => ({
    RecoveryActions: ({ error, onRetry }: { error: SessionError; onRetry?: () => void }) => (
        <div data-testid='recovery-actions'>
            Recovery Actions for {error.type}
            {onRetry && <button onClick={onRetry}>Retry</button>}
        </div>
    ),
}));

vi.mock('@/components/error/TechnicalDetails', () => ({
    TechnicalDetails: ({ error }: { error: SessionError }) => (
        <div data-testid='technical-details'>Technical Details: {error.technicalMessage}</div>
    ),
}));

describe('Authentication Flow Integration', () => {
    const mockUsers = ['user1@example.com', 'user2@example.com'];
    let mockError: SessionError;

    beforeEach(() => {
        vi.clearAllMocks();

        mockError = new SessionError(
            SessionErrorType.INVALID_CREDENTIALS,
            'Invalid credentials provided',
            'Authentication failed during login',
            {
                platform: Platform.TRADINGVIEW,
                operation: 'login',
                timestamp: new Date(),
            },
            ErrorSeverity.ERROR,
            []
        );
    });

    it('should handle complete authentication flow with user selection', async () => {
        const mockOnUserSelect = vi.fn();
        const mockOnEmailChange = vi.fn();
        const mockOnPasswordChange = vi.fn();
        const mockOnSubmit = vi.fn();

        const AuthenticationComponent = () => (
            <div>
                <h1>Authentication</h1>
                <UserSelector availableUsers={mockUsers} onUserSelect={mockOnUserSelect} />
                <LoginForm
                    userEmail=''
                    userPassword=''
                    showPassword={false}
                    isLoading={false}
                    onEmailChange={mockOnEmailChange}
                    onPasswordChange={mockOnPasswordChange}
                    onTogglePassword={() => {}}
                    onSubmit={mockOnSubmit}
                />
            </div>
        );
        AuthenticationComponent.displayName = 'AuthenticationComponent';

        render(<AuthenticationComponent />);

        // Verify both components are rendered
        expect(screen.getByText('Authentication')).toBeInTheDocument();
        expect(screen.getByText('Available Users')).toBeInTheDocument();
        expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/password/i)).toBeInTheDocument();

        // Test user selection
        const userButton = screen.getByRole('button', { name: mockUsers[0] });
        fireEvent.click(userButton);
        expect(mockOnUserSelect).toHaveBeenCalledWith(mockUsers[0]);

        // Test form interaction
        const emailInput = screen.getByLabelText(/email/i);
        const passwordInput = screen.getByLabelText(/password/i);

        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        expect(mockOnEmailChange).toHaveBeenCalledWith('test@example.com');
        expect(mockOnPasswordChange).toHaveBeenCalledWith('password123');
    });

    it('should handle authentication error flow', async () => {
        const mockOnRetry = vi.fn();
        const mockOnDismiss = vi.fn();

        const ErrorFlowComponent = () => (
            <div>
                <h1>Authentication Error</h1>
                <ErrorAlert
                    error={mockError}
                    onRetry={mockOnRetry}
                    onDismiss={mockOnDismiss}
                    showTechnicalDetails={true}
                />
            </div>
        );

        render(<ErrorFlowComponent />);

        // Verify error is displayed
        expect(screen.getByText('Authentication Error')).toBeInTheDocument();
        expect(screen.getByText('Error in Test Platform')).toBeInTheDocument();
        expect(screen.getByText('Invalid credentials provided')).toBeInTheDocument();
        expect(screen.getByText('ERROR')).toBeInTheDocument();

        // Test error interactions
        const retryButton = screen.getByText('Retry');
        const dismissButton = screen.getByText('×');

        fireEvent.click(retryButton);
        expect(mockOnRetry).toHaveBeenCalledTimes(1);

        fireEvent.click(dismissButton);
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);

        // Verify technical details are shown
        expect(screen.getByTestId('technical-details')).toBeInTheDocument();
    });

    it('should handle form validation in complete flow', () => {
        const mockOnSubmit = vi.fn();

        const ValidationFlowComponent = () => {
            const [email, setEmail] = React.useState('');
            const [password, setPassword] = React.useState('');

            return (
                <div>
                    <h1>Form Validation</h1>
                    <LoginForm
                        userEmail={email}
                        userPassword={password}
                        showPassword={false}
                        isLoading={false}
                        onEmailChange={setEmail}
                        onPasswordChange={setPassword}
                        onTogglePassword={() => {}}
                        onSubmit={mockOnSubmit}
                    />
                </div>
            );
        };

        render(<ValidationFlowComponent />);

        const submitButton = screen.getByRole('button', { name: /access my sessions/i });

        // Initially disabled (empty form)
        expect(submitButton).toBeDisabled();

        // Fill in email only
        const emailInput = screen.getByLabelText(/email/i);
        fireEvent.change(emailInput, { target: { value: 'test@example.com' } });
        expect(submitButton).toBeDisabled(); // Still disabled without password

        // Fill in password
        const passwordInput = screen.getByLabelText(/password/i);
        fireEvent.change(passwordInput, { target: { value: 'password123' } });

        // Now should be enabled
        expect(submitButton).not.toBeDisabled();
    });

    it('should handle loading states across components', () => {
        const LoadingFlowComponent = () => (
            <div>
                <h1>Loading States</h1>
                <UserSelector availableUsers={mockUsers} onUserSelect={() => {}} disabled={true} />
                <LoginForm
                    userEmail='test@example.com'
                    userPassword='password123'
                    showPassword={false}
                    isLoading={true}
                    onEmailChange={() => {}}
                    onPasswordChange={() => {}}
                    onTogglePassword={() => {}}
                    onSubmit={() => {}}
                />
            </div>
        );

        render(<LoadingFlowComponent />);

        // Check loading states
        expect(screen.getByText('Checking Sessions...')).toBeInTheDocument();

        // User selector buttons should be disabled
        mockUsers.forEach((user) => {
            const button = screen.getByRole('button', { name: user });
            expect(button).toBeDisabled();
        });

        // Form inputs should be disabled
        expect(screen.getByLabelText(/email/i)).toBeDisabled();
        expect(screen.getByLabelText(/password/i)).toBeDisabled();
    });
});
