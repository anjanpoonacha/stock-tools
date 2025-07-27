// src/app/mio-auth/page.tsx

'use client';

import { useState } from 'react';
import { useSessionBridge } from '@/lib/useSessionBridge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

export default function MioAuthPage() {
	const [sessionKey, setSessionKey] = useState('ASPSESSIONIDCWAACASS');
	const [sessionValue, setSessionValue] = useState('');
	const { bridgeSession, loading, error, success } = useSessionBridge();

	return (
		<div className='max-w-md mx-auto my-8 p-6 border rounded-xl bg-background shadow-md'>
			<h2 className='font-semibold text-2xl mb-5'>MIO Session Bridge</h2>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					bridgeSession(sessionKey, sessionValue);
				}}
				className='flex flex-col gap-4'
			>
				<div>
					<Label htmlFor='sessionKey'>Session Key</Label>
					<Input
						id='sessionKey'
						value={sessionKey}
						onChange={(e) => setSessionKey(e.target.value)}
						placeholder='e.g. ASPSESSIONIDCWAACASS'
						autoComplete='off'
						className='mt-1'
					/>
				</div>
				<div>
					<Label htmlFor='sessionValue'>Session Value</Label>
					<Input
						id='sessionValue'
						value={sessionValue}
						onChange={(e) => setSessionValue(e.target.value)}
						placeholder='Paste session value'
						autoComplete='off'
						className='mt-1'
					/>
				</div>
				<Button type='submit' disabled={loading || !sessionKey || !sessionValue} className='mt-2'>
					{loading ? 'Bridging...' : 'Bridge Session'}
				</Button>
			</form>
			{error && <div className='text-destructive bg-destructive/10 rounded-md px-3 py-2 mt-4 text-base'>{error}</div>}
			{success && (
				<div className='text-success bg-success/10 rounded-md px-3 py-2 mt-4 text-base'>
					Session bridged! You are authenticated.
				</div>
			)}
		</div>
	);
}
