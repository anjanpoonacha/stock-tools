#!/bin/bash
# Test all SWR POC migrations

echo "🧪 Testing All SWR POC Migrations"
echo "=================================="
echo ""

# Check if dev server is running
if ! curl -s http://localhost:3000 > /dev/null; then
  echo "❌ Dev server is not running on http://localhost:3000"
  echo "   Please start it with: pnpm dev"
  exit 1
fi

echo "✅ Dev server is running"
echo ""

# Get credentials
if [ -z "$1" ] || [ -z "$2" ]; then
  echo "Usage: $0 <userEmail> <userPassword>"
  echo ""
  echo "Example:"
  echo "  $0 user@example.com password"
  exit 1
fi

USER_EMAIL="$1"
USER_PASSWORD="$2"

echo "👤 Testing with user: $USER_EMAIL"
echo ""

# Test results
TESTS_PASSED=0
TESTS_FAILED=0

# Test POC 1
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 1: POC 1 - Basic SWR Fetch"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if tsx --env-file=.env scripts/migrated/swr/poc-1-basic-swr-fetch.ts "$USER_EMAIL" "$USER_PASSWORD"; then
  echo ""
  echo "✅ POC 1: PASSED"
  ((TESTS_PASSED++))
else
  echo ""
  echo "❌ POC 1: FAILED"
  ((TESTS_FAILED++))
fi

echo ""
echo ""

# Test POC 2
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 2: POC 2 - SWR with Auth"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if tsx --env-file=.env scripts/migrated/swr/poc-2-swr-with-auth.ts "$USER_EMAIL" "$USER_PASSWORD"; then
  echo ""
  echo "✅ POC 2: PASSED"
  ((TESTS_PASSED++))
else
  echo ""
  echo "❌ POC 2: FAILED"
  ((TESTS_FAILED++))
fi

echo ""
echo ""

# Test POC 3
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "TEST 3: POC 3 - SWR Mutations"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if tsx --env-file=.env scripts/migrated/swr/poc-3-swr-mutation.ts "$USER_EMAIL" "$USER_PASSWORD"; then
  echo ""
  echo "✅ POC 3: PASSED"
  ((TESTS_PASSED++))
else
  echo ""
  echo "❌ POC 3: FAILED"
  ((TESTS_FAILED++))
fi

echo ""
echo ""

# Summary
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "FINAL SUMMARY"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Total Tests:  3"
echo "✅ Passed:    $TESTS_PASSED"
echo "❌ Failed:    $TESTS_FAILED"
echo ""

# Check output files
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "OUTPUT FILES"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

if [ -f "scripts/_output/swr-basic-fetch/poc-1-results.json" ]; then
  echo "✅ POC 1 output: scripts/_output/swr-basic-fetch/poc-1-results.json"
else
  echo "❌ POC 1 output: Not found"
fi

if [ -f "scripts/_output/swr-with-auth/poc-2-results.json" ]; then
  echo "✅ POC 2 output: scripts/_output/swr-with-auth/poc-2-results.json"
else
  echo "❌ POC 2 output: Not found"
fi

if [ -f "scripts/_output/swr-mutations/poc-3-results.json" ]; then
  echo "✅ POC 3 output: scripts/_output/swr-mutations/poc-3-results.json"
else
  echo "❌ POC 3 output: Not found"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Exit with appropriate code
if [ $TESTS_FAILED -eq 0 ]; then
  echo "🎉 All tests passed!"
  exit 0
else
  echo "❌ Some tests failed"
  exit 1
fi
