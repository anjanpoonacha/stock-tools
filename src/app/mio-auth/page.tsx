// src/app/mio-auth/page.tsx

'use client';

import { useState } from 'react';
import { useSessionBridge } from '@/lib/useSessionBridge';
export default function MioAuthPage() {
	const [aspSessionId, setAspSessionId] = useState('');
	const { bridgeSession, loading, error, success } = useSessionBridge();

	return (
		<div style={{ maxWidth: 400, margin: '2rem auto', padding: 24, border: '1px solid #ccc', borderRadius: 8 }}>
			<h2>MIO Session Bridge Test</h2>
			<label>
				ASPSESSIONIDCWAACASS:
				<input
					type='text'
					value={aspSessionId}
					onChange={(e) => setAspSessionId(e.target.value)}
					style={{ width: '100%', marginTop: 8, marginBottom: 16 }}
				/>
			</label>
			<button
				onClick={() => bridgeSession(aspSessionId)}
				disabled={loading || !aspSessionId}
				style={{ width: '100%', padding: 8 }}
			>
				{loading ? 'Bridging...' : 'Bridge Session'}
			</button>
			{error && <div style={{ color: 'red', marginTop: 12 }}>{error}</div>}
			{success && <div style={{ color: 'green', marginTop: 12 }}>Session bridged! You are authenticated.</div>}
		</div>
	);
}
