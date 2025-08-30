import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import ShortlistFetcherClient from './ShortlistFetcherClient';

export const metadata = {
    title: 'TradingView Shortlist Fetcher – Stock Tools',
    description: 'Download watchlists from TradingView. Mobile-first, fast, and easy.',
};

export default function Page() {
    return (
        <DashboardLayout showHero={false} showSidebar={true}>
            <div className='max-w-7xl mx-auto'>
                <ShortlistFetcherClient />
            </div>
        </DashboardLayout>
    );
}
