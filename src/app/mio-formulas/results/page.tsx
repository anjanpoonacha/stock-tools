import { redirect } from 'next/navigation';

export default function FormulaResultsPage() {
	redirect('/stocks?tab=formulas');
}
