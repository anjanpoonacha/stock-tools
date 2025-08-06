// src/components/ui/toast.tsx
// shadcn/ui toast utility (basic implementation)

'use client';
import * as React from 'react';

type ToastType = 'success' | 'error' | 'info';

type Toast = {
	id: number;
	message: string;
	type: ToastType;
};

type ToastContextType = {
	toasts: Toast[];
	showToast: (message: string, type?: ToastType) => void;
};

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

export function ToastProvider({ children }: { children: React.ReactNode }) {
	const [toasts, setToasts] = React.useState<Toast[]>([]);

	const showToast = React.useCallback((message: string, type: ToastType = 'info') => {
		const id = ++toastId;
		setToasts((prev) => [...prev, { id, message, type }]);
		setTimeout(() => {
			setToasts((prev) => prev.filter((t) => t.id !== id));
		}, 3500);
	}, []);

	return (
		<ToastContext.Provider value={{ toasts, showToast }}>
			{children}
			<div className='fixed bottom-4 right-4 z-50 flex flex-col gap-2'>
				{toasts.map((toast) => (
					<div
						key={toast.id}
						className={`rounded px-4 py-2 shadow text-white ${
							toast.type === 'success' ? 'bg-green-600' : toast.type === 'error' ? 'bg-red-600' : 'bg-zinc-800'
						}`}
					>
						{toast.message}
					</div>
				))}
			</div>
		</ToastContext.Provider>
	);
}

export function useToast() {
	const ctx = React.useContext(ToastContext);
	if (!ctx) throw new Error('useToast must be used within a ToastProvider');
	return ctx.showToast;
}
