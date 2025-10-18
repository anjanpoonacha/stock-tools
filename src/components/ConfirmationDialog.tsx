import React from 'react';
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onConfirm: () => void;
	title?: string;
	description?: string;
	confirmText?: string;
	cancelText?: string;
	variant?: 'default' | 'destructive';
	loading?: boolean;
}

export function ConfirmationDialog({
	open,
	onOpenChange,
	onConfirm,
	title = 'Confirm Action',
	description = 'Are you sure you want to proceed?',
	confirmText = 'Confirm',
	cancelText = 'Cancel',
	variant = 'default',
	loading = false,
}: ConfirmationDialogProps) {
	const handleConfirm = () => {
		onConfirm();
		onOpenChange(false);
	};

	const handleCancel = () => {
		onOpenChange(false);
	};

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className='max-w-xs sm:max-w-sm'>
				<DialogHeader>
					<div className='flex items-center gap-3'>
						{variant === 'destructive' && (
							<AlertTriangle className='h-5 w-5 text-red-500' />
						)}
						<DialogTitle>{title}</DialogTitle>
					</div>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				
				<DialogFooter>
					<Button
						variant='outline'
						onClick={handleCancel}
						disabled={loading}
					>
						{cancelText}
					</Button>
					<Button
						variant={variant === 'destructive' ? 'destructive' : 'default'}
						onClick={handleConfirm}
						disabled={loading}
					>
						{loading ? 'Processing...' : confirmText}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
