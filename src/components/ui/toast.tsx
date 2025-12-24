// src/components/ui/toast.tsx
// shadcn/ui toast utility - production-grade implementation

'use client';
import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastType = 'success' | 'error' | 'info';

type ToastAction = {
    label: string;
    onClick: () => void;
};

type Toast = {
    id: number;
    message: string;
    type: ToastType;
    action?: ToastAction;
    duration?: number;
};

type ToastContextType = {
    toasts: Toast[];
    showToast: (message: string, type?: ToastType, options?: { action?: ToastAction; duration?: number }) => void;
};

const ToastContext = React.createContext<ToastContextType | undefined>(undefined);

let toastId = 0;

// Toast variant styles using theme variables
const toastVariants = cva(
    'flex items-start gap-3 rounded-lg border border-l-4 bg-card px-4 py-3 text-sm text-card-foreground shadow-lg max-w-md animate-in slide-in-from-right-full fade-in duration-300',
    {
        variants: {
            variant: {
                success:
                    'border-green-500/50 border-l-green-600 dark:border-green-500/30 dark:border-l-green-400 [&>svg]:text-green-600 dark:[&>svg]:text-green-400',
                error: 'border-destructive/50 border-l-destructive [&>svg]:text-destructive',
                info: 'border-blue-500/50 border-l-blue-600 dark:border-blue-500/30 dark:border-l-blue-400 [&>svg]:text-blue-600 dark:[&>svg]:text-blue-400',
            },
        },
        defaultVariants: {
            variant: 'info',
        },
    }
);

interface ToastItemProps extends VariantProps<typeof toastVariants> {
    message: string;
    action?: ToastAction;
    onDismiss: () => void;
}

function ToastItem({ variant, message, action, onDismiss }: ToastItemProps) {
    const icons = {
        success: CheckCircle2,
        error: XCircle,
        info: Info,
    };

    const Icon = icons[variant!];

    return (
        <div
            className={cn(toastVariants({ variant }))}
            role={variant === 'error' ? 'alert' : 'status'}
            aria-live={variant === 'error' ? 'assertive' : 'polite'}
            aria-atomic='true'
        >
            <Icon className='h-5 w-5 shrink-0' />

            <p className='flex-1 leading-relaxed'>{message}</p>

            {action && (
                <button
                    onClick={() => {
                        action.onClick();
                        onDismiss();
                    }}
                    className='shrink-0 rounded-md px-3 py-1 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                    aria-label={action.label}
                >
                    {action.label}
                </button>
            )}

            <button
                onClick={onDismiss}
                className='ml-2 shrink-0 rounded-sm opacity-70 hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2'
                aria-label='Close notification'
            >
                <X className='h-4 w-4' />
                <span className='sr-only'>Close</span>
            </button>
        </div>
    );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<Toast[]>([]);
    const timeoutRefs = React.useRef<Map<number, NodeJS.Timeout>>(new Map());

    const showToast = React.useCallback((
        message: string, 
        type: ToastType = 'info',
        options?: { action?: ToastAction; duration?: number }
    ) => {
        const id = ++toastId;
        const toast: Toast = { 
            id, 
            message, 
            type,
            action: options?.action,
            duration: options?.duration
        };
        
        setToasts((prev) => [...prev, toast]);
        
        // Auto-dismiss: custom duration or default (5s for info/success, 7s for errors)
        const duration = options?.duration ?? (type === 'error' ? 7000 : 5000);
        const timeout = setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
            timeoutRefs.current.delete(id);
        }, duration);
        
        timeoutRefs.current.set(id, timeout);
    }, []);

    const dismissToast = React.useCallback((id: number) => {
        // Clear timeout if exists
        const timeout = timeoutRefs.current.get(id);
        if (timeout) {
            clearTimeout(timeout);
            timeoutRefs.current.delete(id);
        }
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    // Cleanup timeouts on unmount
    React.useEffect(() => {
        return () => {
            timeoutRefs.current.forEach((timeout) => clearTimeout(timeout));
            timeoutRefs.current.clear();
        };
    }, []);

    return (
        <ToastContext.Provider value={{ toasts, showToast }}>
            {children}
            <div className='fixed bottom-4 right-4 z-50 flex flex-col gap-2'>
                {toasts.map((toast) => (
                    <ToastItem
                        key={toast.id}
                        variant={toast.type}
                        message={toast.message}
                        action={toast.action}
                        onDismiss={() => dismissToast(toast.id)}
                    />
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
