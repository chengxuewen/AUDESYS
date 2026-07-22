#!/usr/bin/env bash
# qa-full.sh — AUDESYS full QA gate (D30/D73)
# Runs: smoke + qa-fast + criterion bench + llvm-cov coverage + vitest + playwright + SDD trace
# Usage: bash scripts/qa-full.sh
# Note: Requires cargo-llvm-cov installed (cargo install cargo-llvm-cov)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

echo "=== AUDESYS qa-full ==="
echo ""

# Step 0: Smoke (D72)
echo "[0/7] smoke"
bash scripts/qa/smoke.sh || { echo "smoke FAILED"; exit 1; }
echo ""

# Step 1: Fast QA gate
echo "[1/7] qa-fast"
bash "${SCRIPT_DIR}/qa-fast.sh"
echo ""

# Step 2: Criterion benchmarks
echo "[2/7] cargo bench --workspace"
cargo bench --workspace
echo ""

# Step 3: Code coverage (llvm-cov)
echo "[3/7] cargo llvm-cov --workspace --lcov --output-path target/lcov.info"
if command -v cargo-llvm-cov &>/dev/null; then
    cargo llvm-cov --workspace --lcov --output-path target/lcov.info
else
    echo "cargo-llvm-cov not installed — run: cargo install cargo-llvm-cov"
    echo "SKIPPED"
fi
echo ""

# Step 4: Frontend tests (vitest)
echo "[4/7] vitest run"
if [ -f apps/studio/package.json ]; then
  npx --prefix apps/studio vitest run
else
  echo "apps/studio not found — SKIPPED"
fi
echo ""

# Step 5: Playwright E2E (D73)
echo "[5/7] playwright test"
if [ -f apps/studio/package.json ] && npx --prefix apps/studio playwright --version &>/dev/null; then
  npx --prefix apps/studio playwright test --reporter=dot
else
  echo "playwright not available — SKIPPED"
fi
echo ""

# Step 6: SDD traceability verification (D73)
echo "[6/7] SDD traceability check"
bash scripts/qa/verify-sdd-trace.sh || echo "SDD trace check FAILED (non-blocking)"
echo ""

echo "=== qa-full PASSED ==="
