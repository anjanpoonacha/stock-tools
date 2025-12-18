'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';

export default function TestSSEStream() {
	const [output, setOutput] = useState<string>('');
	const [status, setStatus] = useState<string>('Ready');

	const clearCache = () => {
		localStorage.removeItem('formula-results-with-charts:formula_1765713255534_0h1zja4dd');
		localStorage.removeItem('mio-tv-auth-credentials');
		setStatus('✅ Cache cleared!');
		setOutput('');
	};

	const checkCache = () => {
		let result = '=== CACHE CHECK ===\n\n';
		
		// Check formula cache
		const formulaCache = localStorage.getItem('formula-results-with-charts:formula_1765713255534_0h1zja4dd');
		result += '📦 Formula Cache:\n';
		result += formulaCache ? `Found (${formulaCache.length} chars)\n${formulaCache.substring(0, 200)}...\n\n` : 'Not found\n\n';
		
		// Check credentials
		const creds = localStorage.getItem('mio-tv-auth-credentials');
		result += '🔐 Credentials:\n';
		result += creds ? `${creds}\n\n` : 'Not found\n\n';
		
		// List all formula-related keys
		result += '📋 All Formula Keys:\n';
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key && key.includes('formula')) {
				result += `- ${key}\n`;
			}
		}
		
		setOutput(result);
		setStatus('Cache checked');
	};

	const setCredentials = () => {
		localStorage.setItem('mio-tv-auth-credentials', JSON.stringify({
			userEmail: 'anjan',
			userPassword: '1234'
		}));
		setStatus('✅ Credentials set!');
	};

	const startStream = async () => {
		setOutput('');
		setStatus('🚀 Starting stream...');

		try {
			const response = await fetch('/api/formula-results-with-charts', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
				},
				body: JSON.stringify({
					userEmail: 'anjan',
					userPassword: '1234',
					formulaId: 'formula_1765713255534_0h1zja4dd',
					resolutions: ['1W', '1D'],
					barsCount: 300
				})
			});

			if (!response.ok) {
				throw new Error(`HTTP ${response.status}: ${await response.text()}`);
			}

			setStatus('✅ Connected! Receiving data...');

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error('No response body');
			}

			const decoder = new TextDecoder();
			let buffer = '';
			const messages: string[] = [];

			while (true) {
				const { done, value } = await reader.read();
				
				if (done) {
					setStatus('✅ Stream complete!');
					break;
				}

				buffer += decoder.decode(value, { stream: true });
				const parts = buffer.split('\n\n');
				buffer = parts.pop() || '';

				for (const part of parts) {
					if (part.startsWith('data: ')) {
						try {
							const data = JSON.parse(part.substring(6));
							const preview = JSON.stringify(data.data).substring(0, 100);
							messages.push(`[${data.type}] ${preview}...`);
							setOutput(messages.join('\n'));
						} catch (e) {
							messages.push(`[ERROR] Failed to parse: ${part.substring(0, 50)}`);
						}
					}
				}
			}
		} catch (error) {
			setStatus('❌ Error: ' + (error instanceof Error ? error.message : 'Unknown'));
			setOutput(prev => prev + '\n\nERROR:\n' + (error instanceof Error ? error.stack : String(error)));
		}
	};

	return (
		<div className='p-8 max-w-4xl mx-auto'>
			<h1 className='text-3xl font-bold mb-6'>SSE Streaming Test</h1>
			
			<div className='space-y-4 mb-6'>
				<div className='flex gap-2'>
					<Button onClick={setCredentials} variant='outline'>Set Credentials</Button>
					<Button onClick={checkCache} variant='outline'>Check Cache</Button>
					<Button onClick={clearCache} variant='destructive'>Clear Cache</Button>
				</div>
				
				<div className='flex gap-2'>
					<Button onClick={startStream} className='bg-blue-600 hover:bg-blue-700'>
						Start Stream
					</Button>
				</div>
			</div>

			<div className='mb-4 p-4 bg-muted rounded-lg'>
				<div className='font-semibold'>Status:</div>
				<div>{status}</div>
			</div>

			<div className='p-4 bg-muted rounded-lg'>
				<div className='font-semibold mb-2'>Output:</div>
				<pre className='text-xs overflow-auto max-h-96 whitespace-pre-wrap'>{output || 'No output yet...'}</pre>
			</div>

			<div className='mt-6 p-4 bg-yellow-100 dark:bg-yellow-900 rounded-lg text-sm'>
				<div className='font-semibold mb-2'>💡 Instructions:</div>
				<ol className='list-decimal list-inside space-y-1'>
					<li>Click &quot;Set Credentials&quot; to save user credentials to localStorage</li>
					<li>Click &quot;Check Cache&quot; to see what&apos;s cached</li>
					<li>Click &quot;Clear Cache&quot; to remove cached data</li>
					<li>Click &quot;Start Stream&quot; to test the SSE endpoint directly</li>
					<li>Open browser DevTools Console to see all logs</li>
				</ol>
			</div>
		</div>
	);
}
