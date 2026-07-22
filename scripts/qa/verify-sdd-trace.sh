#!/usr/bin/env bash
# verify-sdd-trace.sh — SDD→Test traceability verification (D73)
# Checks that every SDD spec ID has at least one reference in test files.
# Usage: bash scripts/qa/verify-sdd-trace.sh
set -eo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/../.."

echo "=== SDD→Test traceability check ==="
echo ""

# macOS: BSD grep lacks -P; use perl for regex extraction
extract_ids() {
  perl -nle 'while (/(?:HMI-VAL|S-TYPE|S-SIG|S-QOS|S-CFG|CNC-LEX|CNC-PARSE|CNC-MOTION|CNC-AXIS|STH-BRIDGE|STH-BACKEND|STH-GLSP|STH-MONACO|STH-BUILD|STH-GRP|STH-LC|STH-SVC|STH-DEP|STH-CLI|STH-TEST)-\d{2,4}\b/g) { print $&; }' "$1" 2>/dev/null
}

# Search for SDD ID in test files (Rust, TS/TSX, e2e)
check_traced() {
  local id="$1"
  # Rust test files in crates/
  if grep -rq "$id" crates/ --include="*.rs" 2>/dev/null; then
    return 0
  fi
  # TypeScript/TSX in apps/
  if grep -rq "$id" apps/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
    return 0
  fi
  # TypeScript/TSX in theia-extensions/
  if [ -d "theia-extensions" ]; then
    if grep -rq "$id" theia-extensions/ --include="*.ts" --include="*.tsx" 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

UNTRAED=0
TOTAL=0

# Phase-aware: skip Theia specs before Phase 1, skip CNC before Phase 2
THEIA_PHASE="${THEIA_PHASE:-0}"
CNC_PHASE="${CNC_PHASE:-1}"

for spec in openspec/specs/*.md; do
  [ -f "$spec" ] || continue
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

  ids=$(extract_ids "$spec" | sort -u)
  
  if [ -z "$ids" ]; then
    echo "[WARN] $spec_name: no spec IDs found"
    continue
  fi

  spec_total=$(echo "$ids" | wc -l | tr -d ' ')
  spec_untraced=0

  for id in $ids; do
    TOTAL=$((TOTAL + 1))
    if check_traced "$id"; then
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

if [ "$TOTAL" -eq 0 ]; then
  echo "Total: 0/0 traced (N/A — no spec IDs found)"
  echo ""
  echo "=== SDD traceability SKIPPED (no IDs to check) ==="
  exit 0
fi

echo "Total: $((TOTAL - UNTRACED))/$TOTAL traced ($(( (TOTAL - UNTRACED) * 100 / TOTAL ))%)"

# Threshold: 80% (configurable via SDD_TRACE_THRESHOLD env var)
THRESHOLD="${SDD_TRACE_THRESHOLD:-80}"
COVERAGE=$(( (TOTAL - UNTRACED) * 100 / TOTAL ))
if [ "$COVERAGE" -lt "$THRESHOLD" ]; then
  echo ""
  echo "FAIL: SDD trace coverage $COVERAGE% < $THRESHOLD% threshold"
  echo "  Untraced: $UNTRACED item(s). Add SDD ID comments to test files."
  exit 1
fi

echo ""
echo "=== SDD traceability PASSED ==="
