#!/bin/bash

# Helper script to extract TradingView session ID from console logs
# Usage: ./extract-session-from-logs.sh <log-file-or-paste-text>

echo "🔍 Extracting TradingView Session ID from logs..."
echo ""

if [ -f "$1" ]; then
  # Read from file
  SESSION_ID=$(grep -o "sessionId: '[^']*'" "$1" | head -1 | cut -d"'" -f2)
else
  # Read from clipboard or stdin
  echo "Paste your console logs (press Ctrl+D when done):"
  SESSION_ID=$(cat | grep -o "sessionId: '[^']*'" | head -1 | cut -d"'" -f2)
fi

if [ -z "$SESSION_ID" ]; then
  echo "❌ No session ID found in the input"
  echo ""
  echo "Expected format in logs:"
  echo "  [useSessionBridge] tradingview session resolved: {sessionId: 'c21wcqky...', ...}"
  exit 1
fi

echo "✅ Found Session ID:"
echo ""
echo "  $SESSION_ID"
echo ""
echo "📋 Next steps:"
echo "  1. Copy the session ID above"
echo "  2. Edit scripts/poc-tradingview/poc-config.ts"
echo "  3. Set: sessionId: '$SESSION_ID'"
echo "  4. Run: npx tsx scripts/poc-tradingview/poc-test-watchlist-formats.ts"
echo ""
