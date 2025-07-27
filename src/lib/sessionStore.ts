// src/lib/sessionStore.ts

import { randomBytes } from 'crypto';
import { existsSync, readFileSync, writeFileSync } from 'fs';

export type PlatformSessionData = {
	sessionId: string;
	// Add more fields as needed per platform
	[key: string]: string;
};

export type SessionData = {
	[platform: string]: PlatformSessionData;
};

const SESSION_FILE = '/tmp/sessions.json'; // Use a temp file for simplicity, adjust as needed

function loadSessions(): Record<string, SessionData> {
	if (!existsSync(SESSION_FILE)) return {};
	try {
		const raw = readFileSync(SESSION_FILE, 'utf-8');
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

function saveSessions(sessions: Record<string, SessionData>) {
	writeFileSync(SESSION_FILE, JSON.stringify(sessions, null, 2), 'utf-8');
}

/**
 * Save or update a session for a specific platform under an internal session ID.
 */
export function savePlatformSession(internalId: string, platform: string, data: PlatformSessionData) {
	const sessions = loadSessions();
	const existing = sessions[internalId] || {};
	sessions[internalId] = { ...existing, [platform]: data };
	saveSessions(sessions);
}

/**
 * Get session data for a specific platform under an internal session ID.
 */
export function getPlatformSession(internalId: string, platform: string): PlatformSessionData | undefined {
	const sessions = loadSessions();
	const session = sessions[internalId];
	return session ? session[platform] : undefined;
}

/**
 * Delete session data for a specific platform under an internal session ID.
 */
export function deletePlatformSession(internalId: string, platform: string) {
	const sessions = loadSessions();
	const session = sessions[internalId];
	if (session && session[platform]) {
		delete session[platform];
		sessions[internalId] = session;
		saveSessions(sessions);
	}
}

/**
 * Delete the entire session for an internal session ID.
 */
export function deleteSession(internalId: string) {
	const sessions = loadSessions();
	delete sessions[internalId];
	saveSessions(sessions);
}

/**
 * Get all session data for an internal session ID.
 */
export function getSession(internalId: string): SessionData | undefined {
	const sessions = loadSessions();
	return sessions[internalId];
}

/**
 * Generate a secure random internal session ID.
 */
export function generateSessionId(): string {
	return randomBytes(32).toString('hex');
}
