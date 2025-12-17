import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import ResultsContent from './ResultsContent';
import type { Metadata } from 'next';

export const metadata: Metadata = {
	title: 'Formula Results – Stock Tools',
	description: 'View and analyze stocks from MarketInOut formula results',
};

export default function FormulaResultsPage() {
	return (
		<DashboardLayout showHero={false} showSidebar={true} fullPage={true}>
			<AuthGuard>
				<ResultsContent />
			</AuthGuard>
		</DashboardLayout>
	);
}
