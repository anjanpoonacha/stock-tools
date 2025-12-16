'use client';

// src/components/formula-editor/FormulaEditorPage.tsx

import React, { useEffect, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { MonacoFormulaEditor } from './MonacoFormulaEditor';
import { CriteriaReferencePanel } from './CriteriaReferencePanel';
import { useFormulaEditor } from '@/hooks/useFormulaEditor';
import { useEditorContext } from '@/hooks/useEditorContext';
import { Loader2, ArrowLeft, Save } from 'lucide-react';
import type { FormulaEditorMode } from '@/types/formulaEditor';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';

/**
 * Full-Page Formula Editor Component
 * Provides a dedicated page for creating or editing formulas with a large Monaco Editor
 */
export function FormulaEditorPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const mode = searchParams.get('mode') || 'create';
	const screenId = searchParams.get('screenId');

	// Memoize editor mode to prevent infinite re-renders
	const editorMode = useMemo((): FormulaEditorMode => {
		if (mode === 'edit' && screenId) {
			const storedData = sessionStorage.getItem(`formula-editor-data-${screenId}`);
			if (storedData) {
				try {
					const formula = JSON.parse(storedData);
					return { mode: 'edit', formula };
				} catch (err) {
					console.error('[FormulaEditorPage] Failed to parse stored formula data:', err);
				}
			}
			// If no stored data, return basic edit mode with screenId
			return {
				mode: 'edit',
				formula: {
					id: screenId,
					screenId,
					name: '',
					formulaText: '',
					pageUrl: '',
					apiUrl: null,
					extractionStatus: 'pending',
					createdAt: new Date().toISOString(),
					updatedAt: new Date().toISOString(),
				},
			};
		}
		return { mode: 'create' };
	}, [mode, screenId]);

	const handleSuccess = () => {
		// Clean up session storage
		if (screenId) {
			sessionStorage.removeItem(`formula-editor-data-${screenId}`);
		}
		// Navigate back to formula list
		router.push('/mio-formulas');
	};

	const handleCancel = () => {
		// Clean up session storage
		if (screenId) {
			sessionStorage.removeItem(`formula-editor-data-${screenId}`);
		}
		// Navigate back to formula list
		router.back();
	};

	const { formData, setFormData, indicators, samples, loading, saving, error, handleSubmit } =
		useFormulaEditor(editorMode, handleSuccess);

	// Reference panel context detection
	const { context, handleCursorChange } = useEditorContext([]);

	// Show error if navigated without proper data
	useEffect(() => {
		if (mode === 'edit' && !screenId) {
			console.error('[FormulaEditorPage] Edit mode requires screenId parameter');
		}
	}, [mode, screenId]);

	// Warn user before leaving with unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (formData.formula && !saving) {
				e.preventDefault();
				e.returnValue = '';
			}
		};

		window.addEventListener('beforeunload', handleBeforeUnload);
		return () => window.removeEventListener('beforeunload', handleBeforeUnload);
	}, [formData.formula, saving]);

	if (mode === 'edit' && !screenId) {
		return (
			<div className='container mx-auto py-8'>
				<Alert variant='destructive'>
					<AlertDescription>
						Invalid editor mode. Screen ID is required for editing.
					</AlertDescription>
				</Alert>
				<Button onClick={() => router.push('/mio-formulas')} className='mt-4'>
					<ArrowLeft className='h-4 w-4 mr-2' />
					Back to Formulas
				</Button>
			</div>
		);
	}

	return (
		<div className='h-screen flex flex-col'>
			{/* Header */}
			<div className='border-b bg-background'>
				<div className='container mx-auto py-4 px-4'>
					<div className='flex items-center justify-between'>
						<div className='space-y-1'>
							<div className='flex items-center gap-3'>
								<Button
									variant='ghost'
									size='sm'
									onClick={handleCancel}
									disabled={saving}
								>
									<ArrowLeft className='h-4 w-4 mr-2' />
									Back
								</Button>
								<div>
									<h1 className='text-2xl font-bold tracking-tight'>
										{mode === 'create'
											? 'Create New Formula'
											: `Edit Formula`}
									</h1>
									<p className='text-sm text-muted-foreground'>
										{mode === 'create'
											? 'Create a new stock screener formula on MarketInOut'
											: 'Edit your existing formula on MarketInOut'}
									</p>
								</div>
							</div>
						</div>
						<div className='flex items-center gap-2'>
							<Button
								variant='outline'
								onClick={handleCancel}
								disabled={saving}
							>
								Cancel
							</Button>
							<Button
								onClick={(e: React.MouseEvent<HTMLButtonElement>) => handleSubmit(e as unknown as React.FormEvent)}
								disabled={saving || !formData.name.trim() || !formData.formula.trim()}
							>
								{saving ? (
									<>
										<Loader2 className='h-4 w-4 mr-2 animate-spin' />
										{mode === 'create' ? 'Creating...' : 'Saving...'}
									</>
								) : (
									<>
										<Save className='h-4 w-4 mr-2' />
										{mode === 'create' ? 'Create Formula' : 'Save Changes'}
									</>
								)}
							</Button>
						</div>
					</div>
				</div>
			</div>

			{/* Editor Content */}
			<div className='flex-1 overflow-hidden'>
				{loading ? (
					<div className='flex items-center justify-center h-full'>
						<div className='text-center space-y-4'>
							<Loader2 className='h-8 w-8 animate-spin mx-auto text-primary' />
							<p className='text-muted-foreground'>Loading editor data...</p>
						</div>
					</div>
				) : (
					<div className='container mx-auto h-full py-6 px-4'>
						<form onSubmit={handleSubmit} className='h-full flex flex-col gap-4'>
							{/* Error Display */}
							{error && (
								<Alert variant='destructive'>
									<AlertDescription>{error}</AlertDescription>
								</Alert>
							)}

							{/* Autocomplete Status */}
							{!loading && indicators.length === 0 && samples.length === 0 && (
								<Alert>
									<AlertDescription>
										No autocomplete data loaded. You can still write formulas manually.
									</AlertDescription>
								</Alert>
							)}

							{/* Formula Name */}
							<Card>
								<CardContent className='pt-6'>
									<div className='space-y-2'>
										<Label htmlFor='formula-name'>Formula Name *</Label>
										<Input
											id='formula-name'
											value={formData.name}
											onChange={(e) => setFormData({ ...formData, name: e.target.value })}
											placeholder='My Stock Screener'
											required
											disabled={saving}
											className='text-lg'
										/>
										<p className='text-xs text-muted-foreground'>
											Give your formula a descriptive name
										</p>
									</div>
								</CardContent>
							</Card>

							{/* Formula Editor with Reference Panel */}
							<Card className='flex-1 flex flex-col overflow-hidden'>
								<CardContent className='pt-6 pb-4 flex-1 flex flex-col min-h-0'>
									<Label htmlFor='formula-editor' className='mb-2'>Formula *</Label>
									
									<div className='flex-1 flex gap-0 min-h-0 overflow-hidden'>
										{/* Editor (70% width) */}
										<div className='flex-[7] flex flex-col min-w-0'>
											<div className='flex-1 min-h-0'>
												<MonacoFormulaEditor
													value={formData.formula}
													onChange={(value) => setFormData({ ...formData, formula: value })}
													indicators={indicators}
													samples={samples}
													readOnly={saving}
													height='calc(100vh - 400px)'
													onCursorChange={handleCursorChange}
												/>
											</div>
											<p className='text-xs text-muted-foreground mt-2'>
												Start typing to see autocomplete suggestions. Press{' '}
												<kbd className='px-1 py-0.5 text-xs border rounded bg-muted'>
													Ctrl+Space
												</kbd>{' '}
												for manual trigger. Hover over functions for documentation.
											</p>
										</div>
										
										{/* Reference Panel (30% width) */}
										<div className='flex-[3] flex flex-col min-h-0'>
											<CriteriaReferencePanel editorContext={context} />
										</div>
									</div>
								</CardContent>
							</Card>
						</form>
					</div>
				)}
			</div>
		</div>
	);
}
