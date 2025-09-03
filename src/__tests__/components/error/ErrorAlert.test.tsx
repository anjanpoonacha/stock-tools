import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorAlert } from '@/components/error/ErrorAlert';
import { SessionError, SessionErrorType, ErrorSeverity, Platform } from '@/lib/sessionErrors';

// Mock the icon utils
vi.mock('@/lib/iconUtils', () => {
    const MockSeverityIcon = () => <div data-testid='severity-icon' />;
    MockSeverityIcon.displayName = 'MockSeverityIcon';
    
    return {
        getSeverityIcon: vi.fn(() => MockSeverityIcon),
        getPlatformConfig: vi.fn(() => ({ name: 'Test Platform' })),
    };
});

// Mock the child components
vi.mock('@/components/error/RecoveryActions', () => {
    const MockRecoveryActions = ({ error, onRetry }: { error: SessionError; onRetry?: () => void }) => (
        <div data-testid='recovery-actions'>
            Recovery Actions for {error.type}
            {onRetry && <button onClick={onRetry}>Retry</button>}
        </div>
    );
    MockRecoveryActions.displayName = 'MockRecoveryActions';
    
    return {
        RecoveryActions: MockRecoveryActions,
    };
});

vi.mock('@/components/error/TechnicalDetails', () => ({
    TechnicalDetails: ({ error }: { error: SessionError }) => (
        <div data-testid='technical-details'>Technical Details: {error.technicalMessage}</div>
    ),
}));

describe('ErrorAlert', () => {
    let mockError: SessionError;
    const mockOnRetry = vi.fn();
    const mockOnDismiss = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();

        // Create a mock SessionError
        mockError = new SessionError(
            SessionErrorType.SESSION_EXPIRED,
            'Your session has expired. Please log in again.',
            'Session expired during operation test',
            {
                platform: Platform.TRADINGVIEW,
                operation: 'test-operation',
                timestamp: new Date(),
            },
            ErrorSeverity.WARNING,
            []
        );
    });

    it('should render error alert with basic information', () => {
        render(<ErrorAlert error={mockError} />);

        // Check if error title is rendered
        expect(screen.getByText('Error in Test Platform')).toBeInTheDocument();

        // Check if severity badge is rendered
        expect(screen.getByText('WARNING')).toBeInTheDocument();

        // Check if error message is rendered
        expect(screen.getByText('Your session has expired. Please log in again.')).toBeInTheDocument();

        // Check if recovery actions are rendered
        expect(screen.getByTestId('recovery-actions')).toBeInTheDocument();
    });

    it('should render dismiss button when onDismiss is provided', () => {
        render(<ErrorAlert error={mockError} onDismiss={mockOnDismiss} />);

        const dismissButton = screen.getByText('×');
        expect(dismissButton).toBeInTheDocument();

        fireEvent.click(dismissButton);
        expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('should not render dismiss button when onDismiss is not provided', () => {
        render(<ErrorAlert error={mockError} />);

        const dismissButton = screen.queryByText('×');
        expect(dismissButton).not.toBeInTheDocument();
    });

    it('should render technical details when showTechnicalDetails is true', () => {
        render(<ErrorAlert error={mockError} showTechnicalDetails={true} />);

        const technicalDetails = screen.getByTestId('technical-details');
        expect(technicalDetails).toBeInTheDocument();
        expect(technicalDetails).toHaveTextContent('Technical Details: Session expired during operation test');
    });

    it('should not render technical details when showTechnicalDetails is false', () => {
        render(<ErrorAlert error={mockError} showTechnicalDetails={false} />);

        const technicalDetails = screen.queryByTestId('technical-details');
        expect(technicalDetails).not.toBeInTheDocument();
    });

    it('should pass onRetry to RecoveryActions component', () => {
        render(<ErrorAlert error={mockError} onRetry={mockOnRetry} />);

        const retryButton = screen.getByText('Retry');
        fireEvent.click(retryButton);

        expect(mockOnRetry).toHaveBeenCalledTimes(1);
    });

    it('should apply custom className', () => {
        const { container } = render(<ErrorAlert error={mockError} className='custom-class' />);

        const alertElement = container.querySelector('[role="alert"]');
        expect(alertElement).toHaveClass('custom-class');
    });
});
