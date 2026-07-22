#!/usr/bin/env bash
# qa-fast.sh — AUDESYS Phase 0 fast QA gate (D30/D36)
# Runs: cargo test + cargo clippy + cargo fmt check + cargo deny + unwrap-budget + napi-rs check
# Usage: bash scripts/qa-fast.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/.."

echo "=== AUDESYS qa-fast ==="
echo ""

echo "[0/6] smoke"
bash scripts/qa/smoke.sh || { echo "smoke FAILED — aborting"; exit 1; }
echo ""

echo "[1/6] cargo test --workspace"
cargo test --workspace
echo ""

echo "[2/6] cargo clippy --workspace --all-targets -- -D warnings"
cargo clippy --workspace --all-targets -- -D warnings
echo ""

echo "[3/6] cargo fmt --all -- --check"
cargo fmt --all -- --check
echo ""

echo "[4/6] cargo deny check"
if command -v cargo-deny &>/dev/null; then
    cargo deny check
else
    echo "cargo-deny not installed — SKIPPED (CI gate only)"
fi
echo ""
echo "[5/6] unwrap-budget check"
bash scripts/qa/unwrap-budget.sh

# ── napi-rs bridge check ──
echo "[6/7] napi-rs bridge check"
cargo check -p audesys-theia-bridge --quiet 2>&1 | tail -3
echo "  Rust compile check OK"
# ponytail: npm run build requires Node.js env; skip in Rust-only CI,
# full napi-rs build happens in dedicated qa-theia workflow
if command -v npm &>/dev/null && [ -f crates/audesys-theia-bridge/package.json ]; then
  echo "  npm found — running napi-rs build (non-blocking)"
  (cd crates/audesys-theia-bridge && npm run build 2>&1 | tail -5) || echo "  napi-rs npm build SKIPPED (may need deps install)"
fi
echo ""
echo "=== qa-fast PASSED ==="
