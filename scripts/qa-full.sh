#!/usr/bin/env bash
# qa-full.sh — AUDESYS full QA gate (D30)
# Runs: qa-fast + criterion bench + llvm-cov coverage + frontend tests
# Usage: bash scripts/qa-full.sh
# Note: Requires cargo-llvm-cov installed (cargo install cargo-llvm-cov)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

echo "=== AUDESYS qa-full ==="
echo ""

# Step 1: Fast QA gate
echo "[1/4] qa-fast"
bash "${SCRIPT_DIR}/qa-fast.sh"
echo ""

# Step 2: Criterion benchmarks
echo "[2/4] cargo bench --workspace"
cargo bench --workspace
echo ""

# Step 3: Code coverage (llvm-cov — stable Rust compatible)
echo "[3/4] cargo llvm-cov --workspace --lcov --output-path target/lcov.info"
if command -v cargo-llvm-cov &>/dev/null; then
    cargo llvm-cov --workspace --lcov --output-path target/lcov.info
else
    echo "cargo-llvm-cov not installed — run: cargo install cargo-llvm-cov"
    echo "SKIPPED"
fi
echo ""

# Step 4: Frontend tests
echo "[4/4] vitest run"
npx --prefix apps/studio vitest run
echo ""

echo "=== qa-full PASSED ==="
