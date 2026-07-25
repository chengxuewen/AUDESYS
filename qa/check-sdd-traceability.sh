#!/usr/bin/env bash
# check-sdd-traceability.sh — Verify SDD spec→test traceability rate ≥80%
# Scans #[test] annotations for "// SDD:" comments and compares against
# total spec items in openspec/specs/

set -euo pipefail

SPEC_DIR="openspec/specs"
TRACE_RATE_THRESHOLD=80

# Count total SDD spec items (lines matching numbered items like "### SP-xxx" or "- SDD:")
total_specs=$(grep -rhE '^### (SP-|HAL-|CNC-|HMI-|ST-|QOS-|CB-|TS-)' "$SPEC_DIR" 2>/dev/null | wc -l | tr -d ' ')
# Fallback: count "### " headings if no SP- prefix convention
if [ "$total_specs" -eq 0 ]; then
    total_specs=$(grep -rhE '^### ' "$SPEC_DIR" 2>/dev/null | wc -l | tr -d ' ')
fi

# Count unique SDD references in tests
traced_specs=$(grep -rhE '//.*SDD:' crates/ --include='*.rs' 2>/dev/null | \
    sed 's/.*SDD: *//' | sed 's/[^a-zA-Z0-9_-].*//' | sort -u | wc -l | tr -d ' ')

echo "SDD Traceability Report"
echo "======================="
echo "Total SDD spec items:  $total_specs"
echo "Traced in tests:       $traced_specs"

if [ "$total_specs" -eq 0 ]; then
    echo "WARNING: No SDD spec items found. Is openspec/specs/ populated?"
    echo "SKIP: cannot compute rate"
    exit 0
fi

rate=$((traced_specs * 100 / total_specs))
echo "Traceability rate:     ${rate}%"

if [ "$rate" -ge "$TRACE_RATE_THRESHOLD" ]; then
    echo "PASS: >= ${TRACE_RATE_THRESHOLD}%"
    exit 0
else
    echo "FAIL: < ${TRACE_RATE_THRESHOLD}%. Add // SDD: <spec-id> comments to tests."
    exit 1
fi
