'use client';

import { useState, useEffect, useRef } from 'react';
import { useSessionState } from './useSessionState';
import type { AuthCredentials, SessionStats } from '@/types/session';

interface UseAuthSessionProps {
	onCredentialsChange: (credentials: AuthCredentials | null) => void;
}

interface UseAuthSessionReturn {
	userEmail: string;
	userPassword: string;
	showPassword: boolean;
	isLoading: boolean;
	sessionStats: SessionStats | null;
	error: string | null;
	isLoggedIn: boolean;
	setUserEmail: (email: string) => void;
	setUserPassword: (password: string) => void;
	setShowPassword: (show: boolean) => void;
	handleLogin: (email?: string, password?: string) => Promise<void>;
	handleLogout: () => void;
	handleUserSelect: (selectedEmail: string) => void;
}

export function useAuthSession({ onCredentialsChange }: UseAuthSessionProps): UseAuthSessionReturn {
	const [userEmail, setUserEmail] = useState('');
	const [userPassword, setUserPassword] = useState('');
	const [showPassword, setShowPassword] = useState(false);
	const hasAutoLoginAttempted = useRef(false);

	// Use unified session state
	const {
		sessionStats,
		isLoading,
		error,
		credentials,
		isLoggedIn,
		login,
		logout,
		autoLogin,
	} = useSessionState();

	// Sync local form state with global credentials
	useEffect(() => {
		if (credentials) {
			setUserEmail(credentials.userEmail);
			setUserPassword(credentials.userPassword);
		}
	}, [credentials]);

	// Notify parent component when login state changes
	useEffect(() => {
		onCredentialsChange(credentials);
	}, [credentials, onCredentialsChange]);

	// Auto-login with saved credentials on component mount
	useEffect(() => {
		// Prevent multiple auto-login attempts
		if (hasAutoLoginAttempted.current) {
			return;
		}

		hasAutoLoginAttempted.current = true;
		autoLogin();
	}, [autoLogin]);

	const handleLogin = async (email?: string, password?: string) => {
		const emailToUse = email || userEmail;
		const passwordToUse = password || userPassword;

		if (!emailToUse || !passwordToUse) {
			console.error('Please enter both email and password');
			return;
		}

		// Prevent multiple simultaneous requests
		if (isLoading) {
			return;
		}

		// Update local form state
		setUserEmail(emailToUse);
		setUserPassword(passwordToUse);

		// Use unified session state login
		await login({ userEmail: emailToUse, userPassword: passwordToUse });
	};

	const handleLogout = () => {
		// Use unified session state logout
		logout();

		// Clear local form state
		setUserEmail('');
		setUserPassword('');
	};

	const handleUserSelect = (selectedEmail: string) => {
		setUserEmail(selectedEmail);
		setUserPassword(''); // Clear password when switching users
	};

	return {
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
	};
}
