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
    console.log(`Testing useSessionBridge for platform: ${platform}`);

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

        console.log(`Using credentials for user: ${credentials.userEmail}`);

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

        console.log('Response data:', data);

        if (data.hasSession && data.sessionId) {
            console.log(`Session ID found: ${data.sessionId}`);
            return data.sessionId;
        } else {
            console.log('No session ID found');
            return null;
        }
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error(`Error: ${errorMessage}`);
        return null;
    }
}

// Run the test
console.log('Starting useSessionBridge test...');
testSessionBridgeFetch('tradingview')
    .then((sessionId) => {
        console.log(`Test completed. Session ID: ${sessionId || 'None'}`);
    })
    .catch((error) => {
        console.error('Test failed:', error);
    });

// Instructions for manual testing:
// 1. Open browser console
// 2. Make sure you're logged in with user "anjan"
// 3. Navigate to a page that uses useSessionBridge (e.g., /tv-sync)
// 4. Check the network tab for a POST request to /api/session/current
// 5. Verify that the request includes user credentials
// 6. Verify that the sessionId is correctly extracted from the response
