// Test script for useSessionBridge fix
// This script simulates the behavior of the useSessionBridge hook
// to verify that it correctly sends user credentials with the POST request

// Mock user credentials in localStorage
const mockCredentials = {
    userEmail: 'anjan',
    userPassword: 'password123',
};

// Store mock credentials in localStorage
localStorage.setItem('mio-tv-auth-credentials', JSON.stringify(mockCredentials));

// Function to simulate the fetch request made by useSessionBridge
async function testSessionBridgeFetch(platform) {
    try {
        // Get stored credentials from localStorage
        const storedCredentials = localStorage.getItem('mio-tv-auth-credentials');

        if (!storedCredentials) {
            throw new Error('Authentication required. Please log in first.');
        }

        let credentials;
        try {
            credentials = JSON.parse(storedCredentials);
        } catch {
            throw new Error('Invalid authentication data. Please log in again.');
        }

        // Use POST with user credentials
        const response = await fetch(`/api/session/current`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                platform,
                userEmail: credentials.userEmail,
                userPassword: credentials.userPassword,
            }),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch session: ${response.status}`);
        }

        const data = await response.json();

        if (data.hasSession && data.sessionId) {
            return data.sessionId;
        } else {
            return null;
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        return null;
    }
}

// Run the test
testSessionBridgeFetch('tradingview')
    .then((sessionId) => {
    })
    .catch((error) => {
    });

// Instructions for manual testing:
// 1. Open browser console
// 2. Make sure you're logged in with user "anjan"
// 3. Navigate to a page that uses useSessionBridge (e.g., /tv-sync)
// 4. Check the network tab for a POST request to /api/session/current
// 5. Verify that the request includes user credentials
// 6. Verify that the sessionId is correctly extracted from the response
