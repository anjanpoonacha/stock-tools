/**
 * MIO Formulas Connection Context
 * 
 * SIMPLIFIED: Signals that we're in the mio-formulas section.
 * The actual persistent connection management happens SERVER-SIDE in API routes.
 * This context just tracks lifecycle for proper cleanup.
 * 
 * Usage:
 * ```tsx
 * // Automatically wrapped via layout.tsx
 * const { isInMioFormulasSection } = useMioFormulasConnection();
 * ```
 */

'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';

interface MioFormulasConnectionContextValue {
	isInMioFormulasSection: boolean;
	mountTime: number;
}

const MioFormulasConnectionContext = createContext<MioFormulasConnectionContextValue | undefined>(
	undefined
);

interface MioFormulasConnectionProviderProps {
	children: React.ReactNode;
}

export function MioFormulasConnectionProvider({ children }: MioFormulasConnectionProviderProps) {
	const [mountTime] = useState(() => Date.now());

	/**
	 * Signal mount/unmount to server-side via sessionStorage
	 * Server-side API routes can check this to determine if persistent mode should be used
	 */
	useEffect(() => {
		console.log('[MioFormulasConnection] Entered mio-formulas section');
		
		// Set flag in sessionStorage (available to server-side via cookies/headers)
		sessionStorage.setItem('mio-formulas-active', 'true');
		sessionStorage.setItem('mio-formulas-mount-time', String(mountTime));

		// Cleanup on unmount
		return () => {
			console.log('[MioFormulasConnection] Left mio-formulas section');
			sessionStorage.removeItem('mio-formulas-active');
			sessionStorage.removeItem('mio-formulas-mount-time');
		};
	}, [mountTime]);

	const value: MioFormulasConnectionContextValue = {
		isInMioFormulasSection: true,
		mountTime,
	};

	return (
		<MioFormulasConnectionContext.Provider value={value}>
			{children}
		</MioFormulasConnectionContext.Provider>
	);
}

/**
 * Hook to access MIO Formulas connection context
 */
export function useMioFormulasConnection(): MioFormulasConnectionContextValue {
	const context = useContext(MioFormulasConnectionContext);
	if (context === undefined) {
		throw new Error('useMioFormulasConnection must be used within MioFormulasConnectionProvider');
	}
	return context;
}
