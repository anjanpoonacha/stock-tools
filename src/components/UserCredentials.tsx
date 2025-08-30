'use client';

import { SessionDisplay, UserSelector } from '@/components/auth';
import { LoginForm } from '@/components/auth/LoginForm';
import { useAuthSession } from '@/hooks/useAuthSession';

interface UserCredentialsProps {
    onCredentialsChange: (credentials: { userEmail: string; userPassword: string } | null) => void;
    availableUsers?: string[];
}

export function UserCredentials({ onCredentialsChange, availableUsers = [] }: UserCredentialsProps) {
    const {
        userEmail,
        userPassword,
        showPassword,
        isLoading,
        sessionStats,
        error,
        isLoggedIn,
        setUserEmail,
        setUserPassword,
        setShowPassword,
        handleLogin,
        handleLogout,
        handleUserSelect,
    } = useAuthSession({ onCredentialsChange });

    if (isLoggedIn && sessionStats) {
        return <SessionDisplay sessionStats={sessionStats} onLogout={handleLogout} />;
    }

    return (
        <div className='w-full max-w-md'>
            <div className='bg-card text-card-foreground rounded-lg border shadow-sm'>
                <div className='p-6 pb-4'>
                    <div className='flex items-center gap-2 text-lg font-semibold'>
                        <svg className='h-5 w-5' fill='none' stroke='currentColor' viewBox='0 0 24 24'>
                            <path
                                strokeLinecap='round'
                                strokeLinejoin='round'
                                strokeWidth={2}
                                d='M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1'
                            />
                        </svg>
                        Enter Your Credentials
                    </div>
                    <p className='text-sm text-muted-foreground mt-1'>
                        Enter the same email and password you configured in the browser extension
                    </p>
                </div>
                <div className='p-6 pt-0 space-y-4'>
                    <UserSelector
                        availableUsers={availableUsers}
                        onUserSelect={handleUserSelect}
                        disabled={isLoading}
                    />

                    <LoginForm
                        userEmail={userEmail}
                        userPassword={userPassword}
                        showPassword={showPassword}
                        isLoading={isLoading}
                        onEmailChange={setUserEmail}
                        onPasswordChange={setUserPassword}
                        onTogglePassword={() => setShowPassword(!showPassword)}
                        onSubmit={() => handleLogin()}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleLogin();
                            }
                        }}
                    />

                    {error && (
                        <div className='rounded-lg border border-destructive/50 text-destructive bg-destructive/10 p-3'>
                            <p className='text-sm'>{error}</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
