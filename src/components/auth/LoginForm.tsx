/**
 * LoginForm Component
 *
 * Handles the login form UI and validation.
 * Extracted from UserCredentials for better separation of concerns.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CommonIcons } from '@/lib/iconUtils';

interface LoginFormProps {
    userEmail: string;
    userPassword: string;
    showPassword: boolean;
    isLoading: boolean;
    onEmailChange: (email: string) => void;
    onPasswordChange: (password: string) => void;
    onTogglePassword: () => void;
    onSubmit: () => void;
    onKeyDown?: (event: React.KeyboardEvent) => void;
}

export function LoginForm({
    userEmail,
    userPassword,
    showPassword,
    isLoading,
    onEmailChange,
    onPasswordChange,
    onTogglePassword,
    onSubmit,
    onKeyDown,
}: LoginFormProps) {
    const isFormValid = userEmail && userPassword;

    return (
        <div className='space-y-4'>
            <div className='space-y-2'>
                <Label htmlFor='userEmail'>Email</Label>
                <Input
                    id='userEmail'
                    type='email'
                    placeholder='your@email.com'
                    value={userEmail}
                    onChange={(e) => onEmailChange(e.target.value)}
                    disabled={isLoading}
                />
            </div>

            <div className='space-y-2'>
                <Label htmlFor='userPassword'>Password</Label>
                <div className='relative'>
                    <Input
                        id='userPassword'
                        type={showPassword ? 'text' : 'password'}
                        placeholder='Your password'
                        value={userPassword}
                        onChange={(e) => onPasswordChange(e.target.value)}
                        disabled={isLoading}
                        onKeyDown={onKeyDown}
                    />
                    <Button
                        type='button'
                        variant='ghost'
                        size='sm'
                        className='absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent'
                        onClick={onTogglePassword}
                        disabled={isLoading}
                    >
                        {showPassword ? (
                            <CommonIcons.eyeOff className='h-4 w-4' />
                        ) : (
                            <CommonIcons.eye className='h-4 w-4' />
                        )}
                    </Button>
                </div>
            </div>

            <Button onClick={onSubmit} disabled={isLoading || !isFormValid} className='w-full'>
                {isLoading ? (
                    <>
                        <div className='animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2' />
                        Checking Sessions...
                    </>
                ) : (
                    <>
                        <CommonIcons.lock className='h-4 w-4 mr-2' />
                        Access My Sessions
                    </>
                )}
            </Button>

            <div className='text-xs text-muted-foreground text-center'>
                This will only show sessions captured with these exact credentials
            </div>
        </div>
    );
}
