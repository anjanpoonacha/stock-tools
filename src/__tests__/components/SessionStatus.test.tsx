import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SessionStatus } from '@/components/SessionStatus';

// Mock the cn utility function
vi.mock('@/lib/utils', () => ({
    cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(' ')),
}));

describe('SessionStatus', () => {
    it('should not render when session is connected and no errors', () => {
        const { container } = render(
            <SessionStatus platform='TradingView' sessionId='test-session-id' loading={false} error={null} />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render loading state', () => {
        render(<SessionStatus platform='TradingView' sessionId={null} loading={true} error={null} />);

        expect(screen.getByText('TradingView Session')).toBeInTheDocument();
        expect(screen.getByText('Checking...')).toBeInTheDocument();
        expect(screen.getByText('Checking for active session...')).toBeInTheDocument();
    });

    it('should render error state for TradingView', () => {
        render(<SessionStatus platform='TradingView' sessionId={null} loading={false} error='Session expired' />);

        expect(screen.getByText('TradingView Session')).toBeInTheDocument();
        expect(screen.getByText('Not connected')).toBeInTheDocument();
        expect(screen.getByText('Session expired')).toBeInTheDocument();
    });

    it('should render error state for MarketInOut', () => {
        render(<SessionStatus platform='MarketInOut' sessionId={null} loading={false} error='Authentication failed' />);

        expect(screen.getByText('MarketInOut Session')).toBeInTheDocument();
        expect(screen.getByText('Not connected')).toBeInTheDocument();
        expect(screen.getByText('Authentication failed')).toBeInTheDocument();
    });

    it('should not render when session is connected (sessionId provided with no errors)', () => {
        const { container } = render(
            <SessionStatus platform='TradingView' sessionId='test-session-123' loading={false} error={null} />
        );

        expect(container.firstChild).toBeNull();
    });

    it('should render not connected state without session ID or error', () => {
        render(<SessionStatus platform='TradingView' sessionId={null} loading={false} error={null} />);

        expect(screen.getByText('TradingView Session')).toBeInTheDocument();
        expect(screen.getByText('Not connected')).toBeInTheDocument();
        expect(
            screen.getByText('Visit TradingView and log in to automatically capture your session')
        ).toBeInTheDocument();
    });

    it('should apply custom className', () => {
        render(
            <SessionStatus
                platform='TradingView'
                sessionId={null}
                loading={true}
                error={null}
                className='custom-class'
            />
        );

        const alert = screen.getByRole('alert');
        expect(alert).toBeInTheDocument();
    });

    it('should show different messages for different platforms', () => {
        const { rerender } = render(
            <SessionStatus platform='TradingView' sessionId={null} loading={false} error={null} />
        );

        expect(
            screen.getByText('Visit TradingView and log in to automatically capture your session')
        ).toBeInTheDocument();

        rerender(<SessionStatus platform='MarketInOut' sessionId={null} loading={false} error={null} />);

        expect(
            screen.getByText('Visit MarketInOut and log in to automatically capture your session')
        ).toBeInTheDocument();
    });

    it('should show loading spinner when loading', () => {
        render(<SessionStatus platform='TradingView' sessionId={null} loading={true} error={null} />);

        // Check for the loading spinner (Loader2 icon)
        const loadingIcon = document.querySelector('.animate-spin');
        expect(loadingIcon).toBeInTheDocument();
    });

    it('should show attention indicator when needs attention', () => {
        render(<SessionStatus platform='TradingView' sessionId={null} loading={false} error='Connection failed' />);

        // Check for the attention indicator (pulsing dot)
        const attentionIndicator = document.querySelector('.animate-ping');
        expect(attentionIndicator).toBeInTheDocument();
    });
});
