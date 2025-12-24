'use client';
import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { FormulaManager } from '@/components/formula/FormulaManager';

const MioFormulasPage: React.FC = () => {
	return (
		<DashboardLayout showHero={false} showSidebar={true}>
			<AuthGuard>
				<FormulaManager />
			</AuthGuard>
		</DashboardLayout>
	);
};

export default MioFormulasPage;
