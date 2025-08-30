import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import CsvWatchlistPage from '../csv-watchlist';

export default function CsvWatchlistRoute() {
    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <CsvWatchlistPage />
        </DashboardLayout>
    );
}
