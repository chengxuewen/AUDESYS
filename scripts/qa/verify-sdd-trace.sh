#!/usr/bin/env bash
# verify-sdd-trace.sh — SDD→Test traceability verification (D73)
# Checks that every SDD spec ID has at least one reference in test files.
# Usage: bash scripts/qa/verify-sdd-trace.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/../.."

echo "=== SDD→Test traceability check ==="
echo ""

UNTRAED=0
TOTAL=0

# Phase-aware: skip Theia specs before Phase 1, skip CNC before Phase 2
THEIA_PHASE="${THEIA_PHASE:-0}"  # set to 1 after Phase 1 starts
CNC_PHASE="${CNC_PHASE:-1}"      # CNC is already implemented

for spec in openspec/specs/*.md; do
  spec_name=$(basename "$spec" .md)
  
  # Phase gating
  if [ "$spec_name" = "studio-theia-spec" ] && [ "$THEIA_PHASE" -eq 0 ]; then
    echo "[SKIP] $spec_name (Theia not started — set THEIA_PHASE=1 to include)"
    continue
  fi
  if [ "$spec_name" = "cnc-spec" ] && [ "$CNC_PHASE" -eq 0 ]; then
    echo "[SKIP] $spec_name (CNC Phase not active)"
    continue
  fi

  # Extract spec IDs: patterns like HMI-VAL-001, S-TYPE-001, CNC-LEX-01, STH-BRIDGE-001
  ids=$(grep -oP '\b(?:HMI-VAL|S-TYPE|S-SIG|S-QOS|S-CFG|CNC-LEX|CNC-PARSE|CNC-MOTION|CNC-AXIS|STH-BRIDGE|STH-BACKEND|STH-GLSP|STH-MONACO|STH-BUILD)-\d+\b' "$spec" 2>/dev/null | sort -u || true)
  
  if [ -z "$ids" ]; then
    echo "[WARN] $spec_name: no spec IDs found"
    continue
  fi

  spec_total=$(echo "$ids" | wc -l | tr -d ' ')
  spec_untraced=0

  for id in $ids; do
    TOTAL=$((TOTAL + 1))
    # Search in Rust tests, TypeScript tests, and Playwright E2E
    if grep -rq "$id" crates/ --include="*.rs" 2>/dev/null; then
      :
    elif grep -rq "$id" apps/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
      :
    else
      echo "  UNTRACED: $id ($spec_name)"
      spec_untraced=$((spec_untraced + 1))
      UNTRACED=$((UNTRACED + 1))
    fi
  done
  
  spec_covered=$((spec_total - spec_untraced))
  pct=0
  if [ "$spec_total" -gt 0 ]; then
    pct=$((spec_covered * 100 / spec_total))
  fi
  echo "  $spec_name: $spec_covered/$spec_total traced ($pct%)"
done

echo ""
echo "Total: $((TOTAL - UNTRACED))/$TOTAL traced ($(( (TOTAL - UNTRACED) * 100 / (TOTAL > 0 ? TOTAL : 1) ))%)"

# Threshold: 80% (configurable via SDD_TRACE_THRESHOLD env var)
THRESHOLD="${SDD_TRACE_THRESHOLD:-80}"
if [ "$TOTAL" -gt 0 ]; then
  COVERAGE=$(( (TOTAL - UNTRACED) * 100 / TOTAL ))
  if [ "$COVERAGE" -lt "$THRESHOLD" ]; then
    echo ""
    echo "FAIL: SDD trace coverage $COVERAGE% < $THRESHOLD% threshold"
    echo "  Untraced: $UNTRACED item(s). Add SDD ID comments to test files."
    exit 1
  fi
fi

echo ""
echo "=== SDD traceability PASSED ==="
