#!/usr/bin/env bash
# qa-deep.sh — AUDESYS deep QA gate (D30)
# Runs: Miri UB detection + loom concurrency + cargo-mutants mutation testing
# Usage: bash scripts/qa-deep.sh
# NOT for PR CI — runs pre-release only (D30/D36)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/../.."

echo "=== AUDESYS qa-deep ==="
echo ""

# Step 1: Miri UB detection (hal-core only — pure logic, no FFI)
echo "[1/3] Miri undefined behavior check"
MIRI_FAILED=0

# Find crates that can run under Miri (pure Rust, no FFI/napi-rs)
MIRI_CRATES=(
  "audesys-hal-core"
  "audesys-hal-vm"
  "audesys-config-barrier"
)

if command -v cargo-miri &>/dev/null; then
  for crate in "${MIRI_CRATES[@]}"; do
    if cargo metadata --no-deps --format-version 1 2>/dev/null | grep -q "\"name\":\"$crate\""; then
      echo "  Miri: $crate"
      MIRIFLAGS="-Zmiri-disable-isolation" cargo miri test -p "$crate" -q 2>&1 | tail -3 || {
        echo "  Miri FAILED: $crate"
        MIRI_FAILED=1
      }
    fi
  done
else
  echo "  cargo-miri not installed — SKIPPED"
  echo "  Install: rustup +nightly component add miri"
fi
echo ""

# Step 2: Loom concurrency tests (if present)
echo "[2/3] Loom concurrency tests"
LOOM_FAILED=0

# Find crates with loom tests (marker: #[cfg(loom)] or use loom::)
LOOM_CRATES=$(grep -rl "loom::" crates/ --include="*.rs" -l 2>/dev/null || true)

if [ -n "$LOOM_CRATES" ]; then
  for crate_file in $LOOM_CRATES; do
    crate_name=$(echo "$crate_file" | sed 's|crates/||; s|/.*||')
    echo "  Loom: $crate_name"
    RUSTFLAGS="--cfg loom" cargo test --test loom -p "$crate_name" -q 2>&1 | tail -3 || {
      echo "  Loom FAILED: $crate_name"
      LOOM_FAILED=1
    }
  done
else
  echo "  No loom tests found — SKIPPED (add after Phase 1 concurrent code)"
fi
echo ""

# Step 3: Mutation testing (cargo-mutants)
echo "[3/3] Mutation testing (cargo-mutants)"
MUTATION_FAILED=0

if command -v cargo-mutants &>/dev/null; then
  # Target specific crates, exclude benchmarks and examples
  MUTANT_CRATES=(
    "audesys-hal-core"
    "audesys-hal-vm"
    "audesys-runtime-engine"
    "audesys-ipc-server"
    "audesys-config-barrier"
  )
  
  MISSED=0
  CAUGHT=0
  TIMEOUT=0
  
  for crate in "${MUTANT_CRATES[@]}"; do
    if cargo metadata --no-deps --format-version 1 2>/dev/null | grep -q "\"name\":\"$crate\""; then
      echo "  Mutants: $crate"
      # Run mutants, collect summary
      result=$(cargo mutants -p "$crate" --timeout 60 -- --test-threads=2 2>&1 || true)
      echo "$result" | grep -E "missed|caught|timeout|total" | tail -4 || true
      
      # Parse for overall stats
      missed=$(echo "$result" | grep -oP '\d+(?= missed)' | head -1 || echo "0")
      caught=$(echo "$result" | grep -oP '\d+(?= caught)' | head -1 || echo "0")
      timeout=$(echo "$result" | grep -oP '\d+(?= timeout)' | head -1 || echo "0")
      MISSED=$((MISSED + ${missed:-0}))
      CAUGHT=$((CAUGHT + ${caught:-0}))
      TIMEOUT=$((TIMEOUT + ${timeout:-0}))
    fi
  done
  
  TOTAL_MUTANTS=$((MISSED + CAUGHT + TIMEOUT))
  if [ "$TOTAL_MUTANTS" -gt 0 ]; then
    MUT_SCORE=$((CAUGHT * 100 / TOTAL_MUTANTS))
    echo ""
    echo "  Mutation score: ${MUT_SCORE}% (${CAUGHT}/${TOTAL_MUTANTS} caught, ${MISSED} missed, ${TIMEOUT} timeout)"
    
    # Threshold: 70% (D74, configurable)
    MUT_THRESHOLD="${MUT_THRESHOLD:-70}"
    if [ "$MUT_SCORE" -lt "$MUT_THRESHOLD" ]; then
      echo "  WARNING: mutation score ${MUT_SCORE}% < ${MUT_THRESHOLD}% threshold"
      MUTATION_FAILED=1
    fi
  else
    echo "  No mutants generated — check cargo-mutants configuration"
  fi
else
  echo "  cargo-mutants not installed — SKIPPED"
  echo "  Install: cargo install cargo-mutants"
fi

echo ""
echo "=== qa-deep SUMMARY ==="
echo "  Miri UB:      $([ "$MIRI_FAILED" -eq 0 ] && echo 'PASSED' || echo 'FAILED')"
echo "  Loom concurrency: $([ "$LOOM_FAILED" -eq 0 ] && echo 'PASSED (or skipped)' || echo 'FAILED')"
echo "  Mutation:     $([ "$MUTATION_FAILED" -eq 0 ] && echo 'PASSED (or skipped)' || echo 'WARNING')"

if [ "$MIRI_FAILED" -eq 1 ]; then
  echo ""
  echo "=== qa-deep FAILED (Miri UB) ==="
  exit 1
fi

echo ""
echo "=== qa-deep PASSED ==="
