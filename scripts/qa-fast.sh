#!/usr/bin/env bash
# qa-fast.sh — AUDESYS Phase 0 fast QA gate (D30)
# Runs: cargo test + cargo clippy + cargo fmt check + cargo deny
# Usage: bash scripts/qa-fast.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

echo "=== AUDESYS qa-fast ==="
echo ""

echo "[1/4] cargo test --workspace"
cargo test --workspace
echo ""

echo "[2/4] cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -- -D warnings
echo ""

echo "[3/4] cargo fmt --all -- --check"
cargo fmt --all -- --check
echo ""

echo "[4/4] cargo deny check"
cargo deny check
echo ""

echo "=== qa-fast PASSED ==="
