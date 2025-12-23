#!/bin/bash

# Run CVD Settings Test in Parallel Batches
# 240 total combinations, 30 per batch = 8 batches

USER_EMAIL="${1:-anjan}"
USER_PASSWORD="${2:-1234}"
BATCH_SIZE=30
TOTAL_COMBINATIONS=240

if [ -z "$USER_EMAIL" ] || [ -z "$USER_PASSWORD" ]; then
  echo "❌ Usage: ./run-cvd-parallel.sh <userEmail> <userPassword>"
  echo "Example: ./run-cvd-parallel.sh anjan 1234"
  exit 1
fi

echo "🚀 Running CVD Settings Test in Parallel"
echo "Total combinations: $TOTAL_COMBINATIONS"
echo "Batch size: $BATCH_SIZE"
echo "Total batches: $((TOTAL_COMBINATIONS / BATCH_SIZE))"
echo ""

# Calculate batches
BATCHES=()
for ((i=0; i<TOTAL_COMBINATIONS; i+=BATCH_SIZE)); do
  END=$((i + BATCH_SIZE))
  if [ $END -gt $TOTAL_COMBINATIONS ]; then
    END=$TOTAL_COMBINATIONS
  fi
  BATCHES+=("$i:$END")
done

echo "📊 Batches to run:"
for batch in "${BATCHES[@]}"; do
  IFS=':' read -r start end <<< "$batch"
  echo "  • Batch $start-$end ($(($end - $start)) combinations)"
done
echo ""

# Run all batches in parallel
echo "🔥 Starting parallel execution..."
echo ""

PIDS=()
for batch in "${BATCHES[@]}"; do
  IFS=':' read -r start end <<< "$batch"
  
  echo "▶️  Launching batch $start-$end..."
  
  tsx --env-file=.env scripts/migrated/tests/test-cvd-settings-combinations.ts "$USER_EMAIL" "$USER_PASSWORD" "$start" "$end" > "batch-$start-$end.log" 2>&1 &
  
  PIDS+=($!)
  
  # Small delay to stagger connection creation
  sleep 0.5
done

echo ""
echo "⏳ Waiting for all batches to complete..."
echo "   PIDs: ${PIDS[@]}"
echo ""

# Wait for all background processes
FAILED=0
for pid in "${PIDS[@]}"; do
  if wait "$pid"; then
    echo "✅ Process $pid completed successfully"
  else
    echo "❌ Process $pid failed"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
if [ $FAILED -eq 0 ]; then
  echo "🎉 All batches completed successfully!"
else
  echo "⚠️  $FAILED batch(es) failed"
fi
echo ""

# Show batch logs
echo "📄 Batch logs:"
for batch in "${BATCHES[@]}"; do
  IFS=':' read -r start end <<< "$batch"
  LOG_FILE="batch-$start-$end.log"
  if [ -f "$LOG_FILE" ]; then
    echo "  • $LOG_FILE ($(wc -l < "$LOG_FILE") lines)"
  fi
done
echo ""

echo "💡 To view individual batch results:"
echo "   cat batch-0-30.log"
echo "   cat batch-30-60.log"
echo "   etc."
echo ""

exit $FAILED
