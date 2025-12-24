import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import StocksContent from './StocksContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Stocks – Stock Tools',
	description: 'Formula screener and watchlist manager',
};

export default function StocksPage() {
	return (
		<DashboardLayout showHero={false} showSidebar={true} fullPage={true}>
			<AuthGuard>
				<StocksContent />
			</AuthGuard>
		</DashboardLayout>
	);
}
