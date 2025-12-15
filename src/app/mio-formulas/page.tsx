'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { useFormulaExtraction } from '@/hooks/useFormulaExtraction';
import { Badge } from '@/components/ui/badge';
import { UsageGuide } from '@/components/UsageGuide';
import { useToast } from '@/components/ui/toast';
import type { MIOFormula } from '@/types/formula';
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2, Trash2, Copy, ExternalLink, Download, RefreshCw, Plus, Edit } from 'lucide-react';
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
	AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

const MioFormulasPageContent: React.FC = () => {
	const router = useRouter();
	const { mioSessionAvailable, loading: sessionLoading } = useSessionAvailability();
	const showToast = useToast();
	const {
		formulas,
		loading,
		extracting,
		error,
		extractionErrors,
		extractFormulas,
		deleteFormula,
		copyToClipboard,
		copyAllApiUrls,
		exportFormulas,
	} = useFormulaExtraction();

	// Track which formula is being edited
	const [editingFormulaId, setEditingFormulaId] = React.useState<string | null>(null);

	// Handler to navigate to create page
	const handleCreateFormula = () => {
		router.push('/mio-formulas/editor?mode=create');
	};

	// Handler to navigate to edit page
	const handleEditFormula = async (formula: MIOFormula) => {
		setEditingFormulaId(formula.id);
		console.log('[MioFormulasPage] Edit clicked for:', formula.name);
		console.log('[MioFormulasPage] Formula text exists:', !!formula.formulaText);

		// If formula text doesn't exist, fetch it from the page URL
		if (!formula.formulaText && formula.pageUrl) {
			// Normalize URL: Remove list=1 parameter from old URLs
			let normalizedUrl = formula.pageUrl;
			if (normalizedUrl.includes('list=1')) {
				// Extract screen_id and reconstruct URL in correct format
				const screenIdMatch = normalizedUrl.match(/screen_id=(\d+)/);
				if (screenIdMatch) {
					normalizedUrl = `https://www.marketinout.com/stock-screener/stocks.php?f=1&screen_id=${screenIdMatch[1]}`;
					console.log('[MioFormulasPage] Normalized URL from:', formula.pageUrl);
					console.log('[MioFormulasPage] Normalized URL to:', normalizedUrl);
				}
			}

			console.log('[MioFormulasPage] Fetching formula text from:', normalizedUrl);

			try {
				const credentials = JSON.parse(localStorage.getItem('mio-tv-auth-credentials') || '{}');
				const params = new URLSearchParams({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					pageUrl: normalizedUrl,
				});

				const response = await fetch(`/api/mio-formulas/extract-text?${params}`);
				console.log('[MioFormulasPage] Response status:', response.status, response.ok);

				if (response.ok) {
					const data = await response.json();
					console.log('[MioFormulasPage] Response data:', {
						success: data.success,
						hasFormulaText: !!data.formulaText,
						formulaTextLength: data.formulaText?.length,
						hasApiUrl: !!data.apiUrl,
						error: data.error,
					});

					if (data.formulaText) {
						console.log('[MioFormulasPage] ✓ Extracted formula text:', data.formulaText.substring(0, 50));
						// Update formula object with extracted text
						formula = { ...formula, formulaText: data.formulaText };
					} else {
						console.warn('[MioFormulasPage] ✗ No formula text in response');
						showToast('Could not extract formula text from page', 'error');
					}
				} else {
					const errorData = await response.json().catch(() => ({}));
					console.error('[MioFormulasPage] Failed to extract formula text:', errorData);
					showToast(`Could not load formula text: ${errorData.error || 'Unknown error'}`, 'error');
				}
			} catch (error) {
				console.error('[MioFormulasPage] Error fetching formula text:', error);
				showToast('Error loading formula text', 'error');
			}
		}

		// Store formula data in session storage for the editor page
		sessionStorage.setItem(`formula-editor-data-${formula.screenId}`, JSON.stringify(formula));

		// Navigate to editor page
		router.push(`/mio-formulas/editor?mode=edit&screenId=${formula.screenId}`);
		
		// Clear loading state after navigation
		setEditingFormulaId(null);
	};

	const getStatusBadge = (formula: MIOFormula) => {
		switch (formula.extractionStatus) {
			case 'success':
				return <Badge variant='default'>Success</Badge>;
			case 'failed':
				return <Badge variant='destructive'>Failed</Badge>;
			case 'pending':
				return <Badge variant='secondary'>Pending</Badge>;
			default:
				return null;
		}
	};

	return (
		<div className='container mx-auto py-8 space-y-6'>
			{/* Header */}
			<div className='space-y-2'>
				<h1 className='text-3xl font-bold tracking-tight'>MIO Formula Manager</h1>
				<p className='text-muted-foreground'>
					Extract and manage your stock screener formulas from MarketInOut
				</p>
			</div>

			{/* Usage Guide */}
			<UsageGuide
				title="How to Use Formula Manager"
				steps={[
					'Ensure you have captured your MIO session using the browser extension',
					'Click "Create Formula" to build new formulas with autocomplete editor',
					'Click "Extract Formulas from MIO" to fetch all your existing formulas',
					'View formula details including screen ID, page URL, and API URL',
					'Edit formulas directly from the table using the edit button',
					'Copy individual API URLs or export all formulas as JSON',
					'Delete formulas you no longer need from your saved list'
				]}
			/>

			{/* Session Status Warning */}
			{!sessionLoading && !mioSessionAvailable && (
				<Alert>
					<AlertDescription>
						No active MIO session found. Please capture your MIO session using the browser extension to extract formulas.
					</AlertDescription>
				</Alert>
			)}

			{/* Error Display */}
			{error && (
				<Alert variant='destructive'>
					<AlertDescription>{error}</AlertDescription>
				</Alert>
			)}

			{/* Extraction Errors */}
			{extractionErrors.length > 0 && (
				<Alert variant='destructive'>
					<AlertDescription>
						<p className='font-semibold mb-2'>Some formulas failed to extract:</p>
						<ul className='list-disc list-inside space-y-1'>
							{extractionErrors.map((err, idx) => (
								<li key={idx}>
									<strong>{err.formulaName}:</strong> {err.error}
								</li>
							))}
						</ul>
					</AlertDescription>
				</Alert>
			)}

			{/* Action Buttons */}
			<div className='flex flex-wrap gap-3'>
				<Button
					onClick={handleCreateFormula}
					disabled={!mioSessionAvailable || sessionLoading}
					size='default'
				>
					<Plus className='h-4 w-4 mr-2' />
					Create Formula
				</Button>

				<Button
					onClick={extractFormulas}
					disabled={!mioSessionAvailable || sessionLoading || extracting}
					size='default'
					variant='outline'
				>
					{extracting ? (
						<>
							<Loader2 className='h-4 w-4 mr-2 animate-spin' />
							Extracting...
						</>
					) : (
						<>
							<RefreshCw className='h-4 w-4 mr-2' />
							Extract Formulas from MIO
						</>
					)}
				</Button>

				{formulas.length > 0 && (
					<>
						<Button onClick={copyAllApiUrls} variant='outline' size='default'>
							<Copy className='h-4 w-4 mr-2' />
							Copy All API URLs
						</Button>
						<Button onClick={exportFormulas} variant='outline' size='default'>
							<Download className='h-4 w-4 mr-2' />
							Export JSON
						</Button>
					</>
				)}
			</div>

			{/* Formulas Table */}
			{loading ? (
				<div className='flex items-center justify-center min-h-[300px]'>
					<div className='text-center space-y-4'>
						<Loader2 className='h-8 w-8 animate-spin mx-auto text-primary' />
						<p className='text-muted-foreground'>Loading formulas...</p>
					</div>
				</div>
			) : formulas.length === 0 ? (
				<Card>
					<CardHeader>
						<CardTitle>No Formulas Found</CardTitle>
						<CardDescription>
							Click &quot;Extract Formulas from MIO&quot; to fetch your formulas from MarketInOut
						</CardDescription>
					</CardHeader>
				</Card>
			) : (
				<Card>
					<CardHeader>
						<CardTitle>Your Formulas ({formulas.length})</CardTitle>
						<CardDescription>
							Manage your extracted formulas and their API URLs
						</CardDescription>
					</CardHeader>
					<CardContent>
						<div className='rounded-md border'>
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>Name</TableHead>
										<TableHead>Screen ID</TableHead>
										<TableHead>Page URL</TableHead>
										<TableHead>API URL</TableHead>
										<TableHead>Status</TableHead>
										<TableHead className='text-right'>Actions</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{formulas.map(formula => (
										<TableRow key={formula.id}>
											<TableCell className='font-medium'>{formula.name}</TableCell>
											<TableCell>
												<Badge variant='outline'>{formula.screenId}</Badge>
											</TableCell>
											<TableCell>
												<a
													href={formula.pageUrl}
													target='_blank'
													rel='noopener noreferrer'
													className='text-blue-600 hover:underline flex items-center gap-1'
												>
													View Page
													<ExternalLink className='h-3 w-3' />
												</a>
											</TableCell>
											<TableCell>
												{formula.apiUrl ? (
													<div className='flex items-center gap-2'>
														<a
															href={formula.apiUrl}
															target='_blank'
															rel='noopener noreferrer'
															className='text-blue-600 hover:underline flex items-center gap-1 truncate max-w-[200px]'
															title={formula.apiUrl}
														>
															{formula.apiUrl.substring(0, 40)}...
															<ExternalLink className='h-3 w-3' />
														</a>
														<Button
															size='sm'
															variant='ghost'
															onClick={() =>
																copyToClipboard(formula.apiUrl!, 'API URL')
															}
														>
															<Copy className='h-3 w-3' />
														</Button>
													</div>
												) : (
													<span className='text-muted-foreground text-sm'>
														{formula.extractionError || 'Not found'}
													</span>
												)}
											</TableCell>
											<TableCell>{getStatusBadge(formula)}</TableCell>
											<TableCell className='text-right'>
												<div className='flex items-center justify-end gap-1'>
													<Button
														size='sm'
														variant='ghost'
														onClick={() => handleEditFormula(formula)}
														title='Edit formula'
														disabled={editingFormulaId === formula.id}
													>
														{editingFormulaId === formula.id ? (
															<Loader2 className='h-4 w-4 animate-spin' />
														) : (
															<Edit className='h-4 w-4' />
														)}
													</Button>
													<AlertDialog>
														<AlertDialogTrigger asChild>
															<Button
																size='sm'
																variant='ghost'
																title='Delete formula'
															>
																<Trash2 className='h-4 w-4 text-destructive' />
															</Button>
														</AlertDialogTrigger>
														<AlertDialogContent>
															<AlertDialogHeader>
																<AlertDialogTitle>Delete Formula?</AlertDialogTitle>
																<AlertDialogDescription>
																	Are you sure you want to delete &quot;{formula.name}&quot;? This will remove it from both MIO and your local storage. This action cannot be undone.
																</AlertDialogDescription>
															</AlertDialogHeader>
															<AlertDialogFooter>
																<AlertDialogCancel>Cancel</AlertDialogCancel>
																<AlertDialogAction
																	onClick={() => deleteFormula(formula.id)}
																	className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
																>
																	Delete
																</AlertDialogAction>
															</AlertDialogFooter>
														</AlertDialogContent>
													</AlertDialog>
												</div>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						</div>
					</CardContent>
				</Card>
			)}
		</div>
	);
};

const MioFormulasPage: React.FC = () => {
	return (
		<DashboardLayout showHero={false} showSidebar={true}>
			<AuthGuard>
				<MioFormulasPageContent />
			</AuthGuard>
		</DashboardLayout>
	);
};

export default MioFormulasPage;
