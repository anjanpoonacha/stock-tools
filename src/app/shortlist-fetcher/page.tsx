import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import ShortlistFetcherClient from './ShortlistFetcherClient';

export const metadata = {
    title: 'TradingView Shortlist Fetcher – Stock Tools',
    description: 'Download watchlists from TradingView. Mobile-first, fast, and easy.',
};

export default function Page() {
    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <AuthGuard>
                <div className='max-w-7xl mx-auto'>
                    <ShortlistFetcherClient />
                </div>
            </AuthGuard>
        </DashboardLayout>
    );
}
