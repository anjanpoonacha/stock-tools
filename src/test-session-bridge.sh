#!/bin/bash

# Script to open the test page in a browser

echo "Opening test page for useSessionBridge fix..."

# Determine the operating system
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    open src/test-session-bridge.html
elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
    # Linux
    xdg-open src/test-session-bridge.html
elif [[ "$OSTYPE" == "msys" || "$OSTYPE" == "win32" ]]; then
    # Windows
    start src/test-session-bridge.html
else
    echo "Unsupported operating system. Please open src/test-session-bridge.html manually."
    exit 1
fi

echo "Test page opened. Follow the instructions on the page to test the fix."
echo "1. Enter user credentials (default: \"anjan\" / \"password123\")"
echo "2. Click \"Save to localStorage\""
echo "3. Click \"Test TradingView Session\""
echo "4. Check the log for a successful response with a session ID"
