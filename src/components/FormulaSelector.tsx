import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import type { MIOFormula } from '@/types/formula';

interface FormulaSelectorProps {
	formulas: MIOFormula[];
	loading: boolean;
	error: string | null;
	selectedFormulaId: string | null;
	onFormulaSelect: (formula: MIOFormula | null) => void;
	placeholder?: string;
	disabled?: boolean;
}

export function FormulaSelector({
	formulas,
	loading,
	error,
	selectedFormulaId,
	onFormulaSelect,
	placeholder = 'Select a formula...',
	disabled = false,
}: FormulaSelectorProps) {
	if (loading) {
		return (
			<div className='flex items-center gap-2 p-3 border rounded-lg bg-muted/20'>
				<Loader2 className='h-4 w-4 animate-spin' />
				<span className='text-sm text-muted-foreground'>Loading formulas...</span>
			</div>
		);
	}

	if (error) {
		return (
			<Alert variant='destructive'>
				<AlertDescription>{error}</AlertDescription>
			</Alert>
		);
	}

	if (formulas.length === 0) {
		return (
			<Alert>
				<AlertDescription>
					No formulas found. Visit the{' '}
					<a href='/mio-formulas' className='underline font-medium'>
						Formula Manager
					</a>{' '}
					to extract your formulas from MIO.
				</AlertDescription>
			</Alert>
		);
	}

	return (
		<div className='space-y-2'>
			<div className='flex items-center gap-2'>
				<Zap className='h-4 w-4 text-primary' />
				<label className='text-sm font-medium'>Select Formula</label>
				<Badge variant='secondary' className='text-xs'>
					{formulas.length} available
				</Badge>
			</div>
			<Select
				value={selectedFormulaId || ''}
				onValueChange={(value) => {
					if (value === '') {
						onFormulaSelect(null);
					} else {
						const formula = formulas.find((f) => f.id === value);
						onFormulaSelect(formula || null);
					}
				}}
				disabled={disabled}
			>
				<SelectTrigger className='w-full'>
					<SelectValue placeholder={placeholder} />
				</SelectTrigger>
				<SelectContent>
					<SelectItem value=''>None (Manual Entry)</SelectItem>
					{formulas.map((formula) => (
						<SelectItem key={formula.id} value={formula.id}>
							<div className='flex items-center gap-2'>
								<span>{formula.name}</span>
								<Badge variant='outline' className='text-xs'>
									{formula.screenId}
								</Badge>
							</div>
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		</div>
	);
}
