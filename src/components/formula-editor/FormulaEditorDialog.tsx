'use client';

// src/components/formula-editor/FormulaEditorDialog.tsx

import React from 'react';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogFooter,
	DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MonacoFormulaEditor } from './MonacoFormulaEditor';
import { useFormulaEditor } from '@/hooks/useFormulaEditor';
import { Loader2 } from 'lucide-react';
import type { FormulaEditorMode } from '@/types/formulaEditor';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface FormulaEditorDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	mode: FormulaEditorMode;
	onSuccess: () => void;
}

/**
 * Formula Editor Dialog Component
 * Provides a modal dialog for creating or editing formulas with Monaco Editor
 */
export function FormulaEditorDialog({
	open,
	onOpenChange,
	mode,
	onSuccess,
}: FormulaEditorDialogProps) {
	const { formData, setFormData, indicators, samples, loading, saving, error, handleSubmit } =
		useFormulaEditor(mode, onSuccess);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
				<DialogHeader>
					<DialogTitle>
						{mode.mode === 'create'
							? 'Create New Formula'
							: `Edit Formula: ${mode.formula?.name}`}
					</DialogTitle>
					<DialogDescription>
						{mode.mode === 'create'
							? 'Create a new stock screener formula on MarketInOut'
							: 'Edit your existing formula on MarketInOut'}
					</DialogDescription>
				</DialogHeader>

				{loading ? (
					<div className="flex items-center justify-center py-12">
						<div className="text-center space-y-4">
							<Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
							<p className="text-muted-foreground">Loading editor data...</p>
						</div>
					</div>
				) : (
					<form onSubmit={handleSubmit} className="space-y-6">
						{/* Formula Name */}
						<div className="space-y-2">
							<Label htmlFor="formula-name">Formula Name *</Label>
							<Input
								id="formula-name"
								value={formData.name}
								onChange={(e) => setFormData({ ...formData, name: e.target.value })}
								placeholder="My Stock Screener"
								required
								disabled={saving}
							/>
							<p className="text-xs text-muted-foreground">
								Give your formula a descriptive name
							</p>
						</div>

						{/* Formula Editor */}
						<div className="space-y-2">
							<Label htmlFor="formula-editor">Formula *</Label>
							<MonacoFormulaEditor
								value={formData.formula}
								onChange={(value) => setFormData({ ...formData, formula: value })}
								indicators={indicators}
								samples={samples}
								readOnly={saving}
								height="350px"
							/>
							<p className="text-xs text-muted-foreground">
								Start typing to see autocomplete suggestions. Press <kbd className="px-1 py-0.5 text-xs border rounded bg-muted">Ctrl+Space</kbd> for manual trigger.
								Hover over functions for documentation.
							</p>
						</div>

						{/* Autocomplete Status */}
						{!loading && indicators.length === 0 && samples.length === 0 && (
							<Alert>
								<AlertDescription>
									No autocomplete data loaded. You can still write formulas manually.
								</AlertDescription>
							</Alert>
						)}

						{/* Error Display */}
						{error && (
							<Alert variant="destructive">
								<AlertDescription>{error}</AlertDescription>
							</Alert>
						)}

						{/* Footer Actions */}
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={saving}
							>
								Cancel
							</Button>
							<Button
								type="submit"
								disabled={saving || !formData.name.trim() || !formData.formula.trim()}
							>
								{saving ? (
									<>
										<Loader2 className="h-4 w-4 mr-2 animate-spin" />
										{mode.mode === 'create' ? 'Creating...' : 'Saving...'}
									</>
								) : mode.mode === 'create' ? (
									'Create Formula'
								) : (
									'Save Changes'
								)}
							</Button>
						</DialogFooter>
					</form>
				)}
			</DialogContent>
		</Dialog>
	);
}
