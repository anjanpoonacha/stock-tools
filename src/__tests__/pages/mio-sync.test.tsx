import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import MioSyncPage from '@/app/mio-sync/page';

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

vi.mock('@/components/ui/toast', () => ({
    useToast: vi.fn(() => vi.fn()),
}));

vi.mock('@/lib/utils', () => ({
    regroupTVWatchlist: vi.fn((symbols: string) => symbols),
    cn: vi.fn((...classes: string[]) => classes.filter(Boolean).join(' ')),
}));

vi.mock('@/lib/useSessionBridge', () => ({
    useSessionBridge: vi.fn(() => ['test-session-id', false, null]),
}));

// Mock localStorage
const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', {
    value: localStorageMock,
});

// Mock fetch globally
global.fetch = vi.fn();

describe('MioSyncPage', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        localStorageMock.getItem.mockReturnValue(null);
        (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ watchlists: [] }),
        });
    });

    it('should render DashboardLayout with correct props', () => {
        render(<MioSyncPage />);

        const dashboardLayout = screen.getByTestId('dashboard-layout');
        expect(dashboardLayout).toBeInTheDocument();
        expect(dashboardLayout).toHaveAttribute('data-show-hero', 'false');
        expect(dashboardLayout).toHaveAttribute('data-show-sidebar', 'true');
    });

    it('should render AuthGuard wrapper', () => {
        render(<MioSyncPage />);

        const authGuard = screen.getByTestId('auth-guard');
        expect(authGuard).toBeInTheDocument();
    });

    it('should render the main heading', () => {
        render(<MioSyncPage />);

        const heading = screen.getByRole('heading', { name: /mio sync/i });
        expect(heading).toBeInTheDocument();
    });

    it('should render usage guide', () => {
        render(<MioSyncPage />);

        expect(screen.getByText(/how to sync tradingview watchlists to mio/i)).toBeInTheDocument();
    });

    it('should render form elements', () => {
        render(<MioSyncPage />);

        expect(screen.getByLabelText(/tradingview watchlist/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/mio watchlist/i)).toBeInTheDocument();
        expect(screen.getByLabelText(/group by/i)).toBeInTheDocument();
    });

    it('should render sync button', () => {
        render(<MioSyncPage />);

        const syncButton = screen.getByRole('button', { name: /syncing/i });
        expect(syncButton).toBeInTheDocument();
        expect(syncButton).toBeDisabled(); // Should be disabled initially
    });

    it('should render save combination button', () => {
        render(<MioSyncPage />);

        const saveButton = screen.getByRole('button', { name: /save combination/i });
        expect(saveButton).toBeInTheDocument();
    });
});
