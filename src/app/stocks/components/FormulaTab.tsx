'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useFormulaResults } from '@/hooks/useFormulaResults';
import { FormulaManager } from '@/components/formula/FormulaManager';
import { StockResultsView } from '@/components/stocks/StockResultsView';

export default function FormulaTab() {
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const formulaId = searchParams.get('formulaId');

	// Fetch formula data
	const { stocks, formulaName, loading, error, refetch } = useFormulaResults(formulaId);

	// Show formula manager if no formulaId is selected
	if (!formulaId) {
		return <FormulaManager />;
	}

	// Navigate back to manager
	const handleBack = () => {
		const params = new URLSearchParams(searchParams.toString());
		params.delete('formulaId');
		router.replace(`${pathname}?${params.toString()}`);
	};

	return (
		<StockResultsView
			stocks={stocks}
			title='Formula Results'
			subtitle={formulaName && stocks.length > 0 ? `${formulaName} • ${stocks.length} stocks` : undefined}
			loading={loading}
			error={error || undefined}
			onRefresh={refetch}
			onBack={handleBack}
			entityId={formulaId}
			entityType='formula'
		/>
	);
}
