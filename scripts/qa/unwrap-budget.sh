#!/usr/bin/env bash
# unwrap-budget.sh — AUDESYS unwrap/expect/println ratchet (D36)
# Phase 0: budget = 0 (zero tolerance)
# Phase 1+: ratchet decreases over time
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/../.."  # project root

BUDGET="${UNWRAP_BUDGET:-524}"

count_unwrap() {
    # ponytail: { rg || true } avoids pipefail + rg exit code 1 conflict (pitfalls.md)
    { rg -o '\.unwrap\b' crates/ --type rust 2>/dev/null || true; } | wc -l | tr -d ' '
}
count_expect() {
    { rg -o '\.expect\b' crates/ --type rust 2>/dev/null || true; } | wc -l | tr -d ' '
}
count_println() {
    { rg -o 'println!' crates/ --type rust 2>/dev/null || true; } | wc -l | tr -d ' '
}

unwrap=$(count_unwrap)
expect=$(count_expect)
println=$(count_println)
total=$((unwrap + expect + println))

echo "=== Unwrap Budget Audit ==="
echo "Budget: $BUDGET"
echo "unwrap:   $unwrap"
echo "expect:   $expect"
echo "println!: $println"
echo "Total:    $total / $BUDGET"

if [ "$total" -gt "$BUDGET" ]; then
    echo ""
    echo "FAIL: total ($total) exceeds budget ($BUDGET)"
    echo "Ratchet: budget must NOT increase. Remove unwrap/expect/println."
    exit 1
fi

echo "=== Unwrap Budget PASSED ==="
