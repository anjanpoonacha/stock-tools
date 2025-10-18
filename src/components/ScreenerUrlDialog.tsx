import React, { useState, useEffect } from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { validateScreenerUrl, validateScreenerUrlName } from '@/lib/urlValidation';
import { UserScreenerUrl } from '@/app/api/screener-urls/route';

interface ScreenerUrlDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSave: (name: string, url: string) => Promise<boolean>;
	editingUrl?: UserScreenerUrl | null;
	title?: string;
	description?: string;
}

export function ScreenerUrlDialog({
	open,
	onOpenChange,
	onSave,
	editingUrl = null,
	title,
	description,
}: ScreenerUrlDialogProps) {
	const [name, setName] = useState('');
	const [url, setUrl] = useState('');
	const [nameError, setNameError] = useState('');
	const [urlError, setUrlError] = useState('');
	const [saving, setSaving] = useState(false);

	const isEditing = !!editingUrl;
	const dialogTitle = title || (isEditing ? 'Edit Screener URL' : 'Add Screener URL');
	const dialogDescription = description || (isEditing 
		? 'Update the name and URL for your screener.' 
		: 'Add a new screener URL to your collection.'
	);

	// Reset form when dialog opens/closes or editing URL changes
	useEffect(() => {
		if (open) {
			if (editingUrl) {
				setName(editingUrl.name);
				setUrl(editingUrl.url);
			} else {
				setName('');
				setUrl('');
			}
			setNameError('');
			setUrlError('');
		}
	}, [open, editingUrl]);

	// Validate name in real-time
	const handleNameChange = (value: string) => {
		setName(value);
		const validation = validateScreenerUrlName(value);
		setNameError(validation.isValid ? '' : validation.error || '');
	};

	// Validate URL in real-time
	const handleUrlChange = (value: string) => {
		setUrl(value);
		const validation = validateScreenerUrl(value);
		setUrlError(validation.isValid ? '' : validation.error || '');
	};

	// Handle form submission
	const handleSave = async () => {
		// Final validation
		const nameValidation = validateScreenerUrlName(name);
		const urlValidation = validateScreenerUrl(url);

		if (!nameValidation.isValid) {
			setNameError(nameValidation.error || '');
			return;
		}

		if (!urlValidation.isValid) {
			setUrlError(urlValidation.error || '');
			return;
		}

		setSaving(true);

		try {
			const success = await onSave(name.trim(), url.trim());
			if (success) {
				onOpenChange(false);
			}
		} catch (error) {
			console.error('Error saving screener URL:', error);
		} finally {
			setSaving(false);
		}
	};

	// Handle Enter key in form
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !saving && !nameError && !urlError && name && url) {
			e.preventDefault();
			handleSave();
		}
	};

	const canSave = !saving && !nameError && !urlError && name.trim() && url.trim();

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-md sm:max-w-lg'>
				<DialogHeader>
					<DialogTitle>{dialogTitle}</DialogTitle>
					<DialogDescription>{dialogDescription}</DialogDescription>
				</DialogHeader>
				
				<div className='grid gap-4 py-4'>
					<div className='grid gap-2'>
						<Label htmlFor='screener-name'>Name</Label>
						<Input
							id='screener-name'
							placeholder='e.g., High Volume Breakouts'
							value={name}
							onChange={(e) => handleNameChange(e.target.value)}
							onKeyDown={handleKeyDown}
							className={nameError ? 'border-red-500' : ''}
						/>
						{nameError && (
							<p className='text-sm text-red-500'>{nameError}</p>
						)}
					</div>
					
					<div className='grid gap-2'>
						<Label htmlFor='screener-url'>URL</Label>
						<Input
							id='screener-url'
							placeholder='https://api.marketinout.com/run/screen?key=...'
							value={url}
							onChange={(e) => handleUrlChange(e.target.value)}
							onKeyDown={handleKeyDown}
							className={urlError ? 'border-red-500' : ''}
						/>
						{urlError && (
							<p className='text-sm text-red-500'>{urlError}</p>
						)}
					</div>
				</div>
				
				<DialogFooter>
					<Button
						variant='outline'
						onClick={() => onOpenChange(false)}
						disabled={saving}
					>
						Cancel
					</Button>
					<Button
						onClick={handleSave}
						disabled={!canSave}
					>
						{saving ? 'Saving...' : (isEditing ? 'Update' : 'Add')}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
