// src/app/mio-auth/page.tsx

'use client';

import { UsageGuide } from '@/components/UsageGuide';

export default function MioAuthPage() {
    return (
        <div className='max-w-md mx-auto my-8 p-6 border rounded-xl bg-background shadow-md'>
            <h2 className='font-semibold text-2xl mb-5'>MIO Session Management</h2>
            <UsageGuide
                title='Automatic Session Management'
                steps={[
                    'Install the browser extension from the mio-session-extractor folder',
                    'Visit marketinout.com and log in to your account',
                    'The extension automatically captures your session in the background',
                    'All MIO tools will work automatically - no manual setup needed!',
                    'When your session expires, just visit MIO website again',
                ]}
                tips={[
                    'No more manual session bridging required',
                    'Sessions are automatically managed server-side',
                    'The extension runs silently in the background',
                    'Multiple sessions are supported with automatic selection',
                ]}
                className='mb-5'
            />
            <div className='text-success bg-success/10 rounded-md px-3 py-2 mt-4 text-base'>
                ✅ Session management is now fully automatic! Just install the extension and visit MIO.
            </div>
        </div>
    );
}
