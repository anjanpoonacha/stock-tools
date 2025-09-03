import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from '@/app/dashboard/page';

// Mock the DashboardLayout component
vi.mock('@/components/dashboard/DashboardLayout', () => ({
    DashboardLayout: ({ children, showHero }: { children: React.ReactNode; showHero: boolean }) => (
        <div data-testid='dashboard-layout' data-show-hero={showHero}>
            <div data-testid='dashboard-content'>{children}</div>
        </div>
    ),
}));

describe('DashboardPage', () => {
    it('should render DashboardLayout with showHero prop set to true', () => {
        render(<DashboardPage />);

        const dashboardLayout = screen.getByTestId('dashboard-layout');
        expect(dashboardLayout).toBeInTheDocument();
        expect(dashboardLayout).toHaveAttribute('data-show-hero', 'true');
    });
});
