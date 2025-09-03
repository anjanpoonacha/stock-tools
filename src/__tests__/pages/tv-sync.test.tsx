import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import TvSyncPage from '@/app/tv-sync/page';

// Mock all the dependencies
vi.mock('@/components/dashboard/DashboardLayout', () => ({
    DashboardLayout: ({
        children,
        showHero,
        showSidebar,
    }: {
        children: React.ReactNode;
        showHero: boolean;
        showSidebar: boolean;
    }) => (
        <div data-testid='dashboard-layout' data-show-hero={showHero} data-show-sidebar={showSidebar}>
            {children}
        </div>
    ),
}));

vi.mock('@/components/auth/AuthGuard', () => ({
    AuthGuard: ({ children }: { children: React.ReactNode }) => <div data-testid='auth-guard'>{children}</div>,
}));

vi.mock('@/contexts/AuthContext', () => ({
    useAuth: vi.fn(() => ({
        user: { id: '1', name: 'Test User' },
        isAuthenticated: true,
    })),
}));

vi.mock('../../lib/useSessionBridge', () => ({
    useSessionBridge: vi.fn(() => ['test-session-id', false, null]),
}));

vi.mock('../../components/ui/toast', () => ({
    useToast: vi.fn(() => vi.fn()),
}));

vi.mock('../../all_nse.json', () => ({
    default: [
        { Symbol: 'RELIANCE.NS', Industry: 'Oil & Gas', Sector: 'Energy' },
        { Symbol: 'TCS.NS', Industry: 'IT Services', Sector: 'Technology' },
    ],
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('TvSyncPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ data: [] }),
        });
    });

    it('should render DashboardLayout with correct props', () => {
        render(<TvSyncPage />);

        const dashboardLayout = screen.getByTestId('dashboard-layout');
        expect(dashboardLayout).toBeInTheDocument();
        expect(dashboardLayout).toHaveAttribute('data-show-hero', 'false');
        expect(dashboardLayout).toHaveAttribute('data-show-sidebar', 'true');
    });

    it('should render AuthGuard wrapper', () => {
        render(<TvSyncPage />);

        const authGuard = screen.getByTestId('auth-guard');
        expect(authGuard).toBeInTheDocument();
    });

    it('should render the main heading', () => {
        render(<TvSyncPage />);

        const heading = screen.getByRole('heading', { name: /tradingview screener sync/i });
        expect(heading).toBeInTheDocument();
    });

    it('should render usage guide', () => {
        render(<TvSyncPage />);

        // Check for usage guide content
        expect(screen.getByText(/how to sync mio screeners to tradingview/i)).toBeInTheDocument();
    });

    it('should render watchlist selector', () => {
        render(<TvSyncPage />);

        const watchlistLabel = screen.getByText(/tradingview watchlist/i);
        expect(watchlistLabel).toBeInTheDocument();
    });
});
