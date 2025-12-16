// src/app/mio-formulas/editor/page.tsx

import React from 'react';
import { DashboardLayout } from '@/components/dashboard/DashboardLayout';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { FormulaEditorPage } from '@/components/formula-editor/FormulaEditorPage';

const EditorPageWrapper: React.FC = () => {
	return (
		<DashboardLayout showHero={false} showSidebar={true}>
			<AuthGuard>
				<FormulaEditorPage />
			</AuthGuard>
		</DashboardLayout>
	);
};

export default EditorPageWrapper;
