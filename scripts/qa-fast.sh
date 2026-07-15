#!/usr/bin/env bash
# qa-fast.sh — AUDESYS Phase 0 fast QA gate (D30/D36)
# Runs: cargo test + cargo clippy + cargo fmt check + cargo deny + unwrap-budget
# Usage: bash scripts/qa-fast.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

echo "=== AUDESYS qa-fast ==="
echo ""

echo "[1/5] cargo test --workspace"
cargo test --workspace
echo ""

echo "[2/5] cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -- -D warnings
echo ""

echo "[3/5] cargo fmt --all -- --check"
cargo fmt --all -- --check
echo ""

echo "[4/5] cargo deny check"
if command -v cargo-deny &>/dev/null; then
    cargo deny check
else
    echo "cargo-deny not installed — SKIPPED (CI gate only)"
fi
echo ""
echo "[5/5] unwrap-budget check"
bash scripts/qa/unwrap-budget.sh

echo "=== qa-fast PASSED ==="
