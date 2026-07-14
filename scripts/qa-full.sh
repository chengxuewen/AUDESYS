#!/usr/bin/env bash
# qa-full.sh — AUDESYS full QA gate (D30)
# Runs: qa-fast + criterion bench + coverage
# Usage: bash scripts/qa-full.sh
# Note: Phase 2+. Requires cargo-criterion and cargo-tarpaulin installed.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

echo "=== AUDESYS qa-full ==="
echo ""

# Step 1: Fast QA gate
echo "[1/3] qa-fast"
bash "${SCRIPT_DIR}/qa-fast.sh"
echo ""

# Step 2: Benchmarks (Phase 2+)
echo "[2/3] cargo bench --workspace (skipped — no benchmarks yet)"
# cargo bench --workspace
echo ""

# Step 3: Coverage (Phase 2+)
echo "[3/3] cargo tarpaulin --workspace --out Html --out Lcov (skipped — no source yet)"
# cargo tarpaulin --workspace --out Html --out Lcov
echo ""

echo "=== qa-full PASSED ==="
