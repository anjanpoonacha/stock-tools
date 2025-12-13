'use client';
import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/toast';
import { useSessionAvailability } from '@/hooks/useSessionAvailability';
import { Badge } from '@/components/ui/badge';
import { UsageGuide } from '@/components/UsageGuide';
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
import { Loader2, Trash2, Copy, ExternalLink, Download, RefreshCw } from 'lucide-react';

const MioFormulasPageContent: React.FC = () => {
	const [formulas, setFormulas] = useState<MIOFormula[]>([]);
	const [loading, setLoading] = useState(false);
	const [extracting, setExtracting] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [extractionErrors, setExtractionErrors] = useState<Array<{ formulaName: string; error: string }>>([]);
	const { mioSessionAvailable, loading: sessionLoading } = useSessionAvailability();
	const showToast = useToast();

	// Fetch formulas on mount
	useEffect(() => {
		loadFormulas();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadFormulas = async () => {
		setLoading(true);
		setError(null);

		try {
			// Get stored credentials from localStorage (set by AuthContext)
			const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
			if (!storedCredentials) {
				setError('Authentication required. Please log in first.');
				return;
			}

			let credentials;
			try {
				credentials = JSON.parse(storedCredentials);
			} catch {
				setError('Invalid authentication data. Please log in again.');
				return;
			}

			const params = new URLSearchParams({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
			});

			const res = await fetch(`/api/mio-formulas?${params}`);

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to load formulas');
			}

			const data = await res.json();
			setFormulas(data.formulas || []);
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load formulas';
			setError(errorMessage);
			showToast(errorMessage, 'error');
		} finally {
			setLoading(false);
		}
	};

	const extractFormulas = async () => {
		setExtracting(true);
		setError(null);
		setExtractionErrors([]);

		try {
			// Get stored credentials from localStorage (set by AuthContext)
			const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
			if (!storedCredentials) {
				throw new Error('Authentication required. Please log in first.');
			}

			let credentials;
			try {
				credentials = JSON.parse(storedCredentials);
			} catch {
				throw new Error('Invalid authentication data. Please log in again.');
			}

			const res = await fetch('/api/mio-formulas', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: credentials.userEmail,
					userPassword: credentials.userPassword,
					forceRefresh: true,
				}),
			});

			if (!res.ok) {
				const errorData = await res.json();
				if (errorData.sessionError) {
					throw new Error(
						'No valid MIO session found. Please capture your MIO session using the browser extension.'
					);
				}
				throw new Error(errorData.error || 'Failed to extract formulas');
			}

			const data = await res.json();
			setFormulas(data.formulas || []);
			setExtractionErrors(data.errors || []);

			if (data.success) {
				showToast(
					`Successfully extracted ${data.extracted} formula${data.extracted !== 1 ? 's' : ''}!`,
					'success'
				);
			} else {
				showToast(
					`Extracted ${data.extracted} formula${data.extracted !== 1 ? 's' : ''}, but ${data.failed} failed`,
					'error'
				);
			}
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to extract formulas';
			setError(errorMessage);
			showToast(errorMessage, 'error');
		} finally {
			setExtracting(false);
		}
	};

	const deleteFormula = async (formulaId: string) => {
		try {
			// Get stored credentials from localStorage (set by AuthContext)
			const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');
			if (!storedCredentials) {
				throw new Error('Authentication required. Please log in first.');
			}

			let credentials;
			try {
				credentials = JSON.parse(storedCredentials);
			} catch {
				throw new Error('Invalid authentication data. Please log in again.');
			}

			const params = new URLSearchParams({
				userEmail: credentials.userEmail,
				userPassword: credentials.userPassword,
				id: formulaId,
			});

			const res = await fetch(`/api/mio-formulas?${params}`, {
				method: 'DELETE',
			});

			if (!res.ok) {
				const errorData = await res.json();
				throw new Error(errorData.error || 'Failed to delete formula');
			}

			setFormulas(prevFormulas => prevFormulas.filter(f => f.id !== formulaId));
			showToast('Formula deleted successfully', 'success');
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to delete formula';
			showToast(errorMessage, 'error');
		}
	};

	const copyToClipboard = async (text: string, label: string) => {
		try {
			await navigator.clipboard.writeText(text);
			showToast(`${label} copied to clipboard`, 'success');
		} catch {
			showToast('Failed to copy to clipboard', 'error');
		}
	};

	const copyAllApiUrls = async () => {
		const apiUrls = formulas.filter(f => f.apiUrl).map(f => f.apiUrl);
		if (apiUrls.length === 0) {
			showToast('No API URLs to copy', 'info');
			return;
		}

		const text = apiUrls.join('\n');
		await copyToClipboard(text, 'All API URLs');
	};

	const exportFormulas = () => {
		try {
			const data = JSON.stringify(formulas, null, 2);
			const blob = new Blob([data], { type: 'application/json' });
			const url = URL.createObjectURL(blob);
			const a = document.createElement('a');
			a.href = url;
			a.download = `mio-formulas-${new Date().toISOString().split('T')[0]}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			showToast('Formulas exported successfully', 'success');
		} catch {
			showToast('Failed to export formulas', 'error');
		}
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
					'Click "Extract Formulas from MIO" to fetch all your formulas',
					'View formula details including screen ID, page URL, and API URL',
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
					onClick={extractFormulas}
					disabled={!mioSessionAvailable || sessionLoading || extracting}
					size='default'
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
												<Button
													size='sm'
													variant='ghost'
													onClick={() => deleteFormula(formula.id)}
												>
													<Trash2 className='h-4 w-4 text-destructive' />
												</Button>
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
