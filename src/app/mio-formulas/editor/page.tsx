// src/app/mio-formulas/editor/page.tsx

import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { FormulaEditorPage } from '@/components/formula-editor/FormulaEditorPage';

const EditorPageWrapper: React.FC = () => {
	return (
		<AuthGuard>
			<DashboardLayout showHero={false} showSidebar={true} fullPage={true}>
				<FormulaEditorPage />
			</DashboardLayout>
		</AuthGuard>
	);
};

export default EditorPageWrapper;
