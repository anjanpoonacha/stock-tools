/**
 * MIO Formulas Layout
 * 
 * Wraps all /mio-formulas/** pages with the persistent connection provider.
 * This ensures WebSocket connections are maintained while navigating between
 * different mio-formulas pages.
 */

'use client';

import { MioFormulasConnectionProvider } from '@/contexts/MioFormulasConnectionContext';

export default function MioFormulasLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<MioFormulasConnectionProvider>
			{children}
		</MioFormulasConnectionProvider>
	);
}
