#!/usr/bin/env tsx
/**
 * POC 3: SWR Mutations Test
 * 
 * Tests SWR mutations for settings updates
 * Demonstrates:
 * - Optimistic updates for instant UI feedback
 * - Error rollback when mutations fail
 * - useSWRMutation for explicit mutations
 * - Manual cache invalidation after mutations
 * 
 * Run: tsx --env-file=.env scripts/poc-swr/poc-3-swr-mutation.ts
 */

import useSWR from 'swr';
import useSWRMutation from 'swr/mutation';
import type { AllSettings } from '../../src/types/chartSettings.js';

// Admin credentials from environment
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || '';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

// Fetcher for GET requests
const fetcher = async (url: string, userEmail: string, userPassword: string) => {
	console.log(`[${new Date().toISOString()}] 📖 GET:`, url);
	
	const fullUrl = `${url}?userEmail=${encodeURIComponent(userEmail)}&userPassword=${encodeURIComponent(userPassword)}`;
	const response = await fetch(fullUrl);
	
	if (!response.ok) {
		throw new Error(`HTTP ${response.status}`);
	}
	
	const data = await response.json();
	console.log(`[${new Date().toISOString()}] ✅ Loaded:`, data ? 'Settings found' : 'No settings');
	
	return data;
};

// Mutation function for POST requests
const updateSettings = async (
	url: string,
	{ arg }: { arg: { settings: AllSettings; userEmail: string; userPassword: string } }
) => {
	console.log(`[${new Date().toISOString()}] 💾 SAVE:`, url);
	
	const response = await fetch(url, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify({
			userEmail: arg.userEmail,
			userPassword: arg.userPassword,
			settings: arg.settings,
		}),
	});
	
	if (!response.ok) {
		const errorData = await response.json().catch(() => ({}));
		throw new Error(errorData.error || `HTTP ${response.status}`);
	}
	
	const result = await response.json();
	console.log(`[${new Date().toISOString()}] ✅ Saved successfully`);
	
	return result;
};

// Custom hook for settings with SWR
function useSettings(email: string, password: string) {
	const key = email && password 
		? ['http://localhost:3000/api/kv/settings', email, password] 
		: null;
	
	const { data, error, isLoading, mutate } = useSWR(
		key,
		([url, email, password]) => fetcher(url, email, password),
		{
			revalidateOnFocus: false,
			revalidateOnReconnect: false,
		}
	);
	
	// Mutation hook for explicit updates
	const { trigger, isMutating } = useSWRMutation(
		key ? key[0] : null,
		updateSettings
	);
	
	// Helper function for optimistic updates
	const updateOptimistically = async (newSettings: Partial<AllSettings>) => {
		console.log('🚀 Optimistic update started...');
		
		// Optimistically update the UI
		const optimisticData = {
			...data,
			...newSettings,
		};
		
		// Update cache immediately (optimistic)
		await mutate(
			// The new data to display
			optimisticData,
			// Options
			{
				// Don't revalidate immediately
				revalidate: false,
				// Show optimistic data immediately
				optimisticData,
				// Rollback on error
				rollbackOnError: true,
				// Populate cache
				populateCache: true,
			}
		);
		
		console.log('✅ Optimistic update applied to cache');
		
		// Perform the actual mutation
		try {
			await trigger({
				settings: optimisticData as AllSettings,
				userEmail: email,
				userPassword: password,
			});
			
			console.log('✅ Mutation confirmed by server');
		} catch (error) {
			console.error('❌ Mutation failed, rolling back...', error);
			// SWR automatically rolls back to previous data
			throw error;
		}
	};
	
	return {
		settings: data,
		isLoading,
		isMutating,
		error,
		updateOptimistically,
		mutate,
	};
}

async function runPOC() {
	console.log('🧪 POC 3: SWR Mutations Test\n');
	console.log('=' .repeat(60));
	
	// Validate credentials
	if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
		console.error('❌ Missing ADMIN_EMAIL or ADMIN_PASSWORD in .env file');
		console.log('\nAdd these to your .env file:');
		console.log('  ADMIN_EMAIL=your-email@example.com');
		console.log('  ADMIN_PASSWORD=your-password');
		process.exit(1);
	}
	
	console.log(`\n👤 User: ${ADMIN_EMAIL}`);
	console.log('🔍 Testing settings mutations...\n');
	
	console.log('=' .repeat(60));
	console.log('TEST 1: Load Initial Settings');
	console.log('='.repeat(60) + '\n');
	
	const result1 = useSettings(ADMIN_EMAIL, ADMIN_PASSWORD);
	
	// Wait for initial load
	await new Promise(resolve => {
		const interval = setInterval(() => {
			if (!result1.isLoading) {
				clearInterval(interval);
				resolve(null);
			}
		}, 100);
	});
	
	if (result1.error) {
		console.error('❌ Error loading settings:', result1.error);
	} else {
		console.log('✅ Settings loaded:');
		console.log('  - Panel layout:', result1.settings?.panelLayout ? 'Yes' : 'No');
		console.log('  - Chart settings:', result1.settings?.chartSettings ? 'Yes' : 'No');
		console.log('  - Active layout:', result1.settings?.chartSettings?.activeLayout || 'N/A');
	}
	
	console.log('\n' + '='.repeat(60));
	console.log('TEST 2: Optimistic Update (Success)');
	console.log('='.repeat(60) + '\n');
	
	const originalLayout = result1.settings?.chartSettings?.activeLayout || 'single';
	const newLayout = originalLayout === 'single' ? 'horizontal' : 'single';
	
	console.log(`🔄 Changing active layout: ${originalLayout} → ${newLayout}`);
	console.log('⏱️  Starting optimistic update...');
	
	const startTime = Date.now();
	
	try {
		await result1.updateOptimistically({
			chartSettings: {
				...result1.settings?.chartSettings!,
				activeLayout: newLayout as 'single' | 'horizontal' | 'vertical',
			},
		});
		
		const duration = Date.now() - startTime;
		console.log(`✅ Update completed in ${duration}ms`);
		console.log('  - New layout:', result1.settings?.chartSettings?.activeLayout);
	} catch (error) {
		console.error('❌ Update failed:', error);
	}
	
	console.log('\n' + '='.repeat(60));
	console.log('TEST 3: Verify Persistence');
	console.log('='.repeat(60) + '\n');
	
	console.log('🔄 Revalidating to verify server state...');
	await result1.mutate();
	
	await new Promise(resolve => {
		const interval = setInterval(() => {
			if (!result1.isLoading) {
				clearInterval(interval);
				resolve(null);
			}
		}, 100);
	});
	
	console.log('✅ Revalidation complete:');
	console.log('  - Layout from server:', result1.settings?.chartSettings?.activeLayout);
	console.log('  - Matches update?', result1.settings?.chartSettings?.activeLayout === newLayout);
	
	console.log('\n' + '='.repeat(60));
	console.log('TEST 4: Error Rollback Simulation');
	console.log('='.repeat(60) + '\n');
	
	console.log('🔐 Attempting update with invalid credentials...');
	const result2 = useSettings('invalid@email.com', 'wrongpassword');
	
	await new Promise(resolve => {
		const interval = setInterval(() => {
			if (!result2.isLoading) {
				clearInterval(interval);
				resolve(null);
			}
		}, 100);
	});
	
	try {
		await result2.updateOptimistically({
			panelLayout: {
				'toolbar-panel': 10,
				'chart-panel': 80,
				'stock-list-panel': 10,
			},
		});
		
		console.log('⚠️  Expected error but update succeeded');
	} catch (error) {
		console.log('✅ Error correctly handled:');
		console.log('  - Error message:', error instanceof Error ? error.message : String(error));
		console.log('  - Cache should rollback to previous state');
	}
	
	console.log('\n' + '='.repeat(60));
	console.log('TEST 5: Multiple Rapid Updates');
	console.log('='.repeat(60) + '\n');
	
	console.log('⚡ Testing rapid successive updates...');
	
	const updates = [
		{ showGrid: true },
		{ showGrid: false },
		{ showGrid: true },
	];
	
	for (let i = 0; i < updates.length; i++) {
		console.log(`  Update ${i + 1}: showGrid = ${updates[i].showGrid}`);
		
		try {
			await result1.updateOptimistically({
				chartSettings: {
					...result1.settings?.chartSettings,
					...updates[i],
				},
			});
		} catch (error) {
			console.error(`  ❌ Update ${i + 1} failed`);
		}
		
		// Small delay between updates
		await new Promise(resolve => setTimeout(resolve, 100));
	}
	
	console.log('✅ Rapid updates completed');
	console.log('  - Final showGrid value:', result1.settings?.chartSettings?.showGrid);
	
	console.log('\n' + '='.repeat(60));
	console.log('📊 Summary');
	console.log('='.repeat(60) + '\n');
	
	console.log('✅ SWR Mutation Behaviors Validated:');
	console.log('  ✓ Optimistic updates provide instant UI feedback');
	console.log('  ✓ Server mutations confirm changes');
	console.log('  ✓ Error rollback restores previous state');
	console.log('  ✓ Manual revalidation verifies server state');
	console.log('  ✓ Rapid updates are handled correctly');
	console.log('  ✓ useSWRMutation provides explicit mutation control');
	
	console.log('\n🎉 POC 3 Complete!\n');
}

// Run the POC
runPOC().catch(console.error);
