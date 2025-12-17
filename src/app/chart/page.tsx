import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import ChartPageContent from './ChartPageContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'TradingView Chart Analysis – Stock Tools',
	description: 'Analyze stock charts with real-time data from TradingView. Interactive charting tools for NSE stocks.',
};

export default function ChartPage() {
	return (
		<DashboardLayout showHero={false} showSidebar={true}>
			<div className='max-w-7xl mx-auto'>
				<ChartPageContent />
			</div>
		</DashboardLayout>
	);
}
