#!/usr/bin/env bash
# smoke.sh — AUDESYS smoke test suite (D72)
# Runs in <120s. MUST pass before qa-fast.
# Usage: bash scripts/qa/smoke.sh
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/../.."

echo "=== AUDESYS smoke ==="
echo ""

# S1: Rust core crate fast tests (hal-core + hal-vm + runtime-engine + ipc-server)
echo "[S1] cargo test core crates"
cargo test -p audesys-hal-core -p audesys-runtime-common -p audesys-controller -p audesys-supervisor \
  -- --test-threads=4 -q 2>&1 | tail -3
echo ""

# S2: napi-rs compile_st smoke (Phase 1 完成后激活)
# Uncomment after Phase 1 napi-rs bridge is ready:
# echo "[S2] napi-rs compile_st smoke"
# node -e "
# const { compile_st } = require('./crates/audesys-theia-bridge');
# const result = compile_st('PROGRAM main END_PROGRAM');
# if (!result || !result.instructions || result.instructions.length === 0) {
#   process.exit(1);
# }
# " || { echo "S2 FAILED"; exit 1; }
echo "[S2] napi-rs compile_st smoke — SKIPPED (Phase 1 not started)"
echo ""

# S3: Theia startup smoke (Phase 1 完成后激活)
# echo "[S3] Theia startup smoke"
# npx playwright test apps/studio-theia/e2e/smoke/startup.spec.ts --reporter=dot || { echo "S3 FAILED"; exit 1; }
echo "[S3] Theia startup smoke — SKIPPED (Phase 1 not started)"
echo ""

# S4: vitest critical components
echo "[S4] vitest critical components"
if [ -f apps/studio/package.json ]; then
  npx --prefix apps/studio vitest run --reporter=dot 2>&1 | tail -5
else
  echo "  vitest not available — SKIPPED"
fi
echo ""

# S5: pixi.toml  + CI workflow 格式验证 (if available)
echo "[S5] CI config validation"
if command -v pixi &>/dev/null && [ -f pixi.toml ]; then
  pixi info --silent 2>&1 | head -1 || true
else
  echo "  pixi not available — SKIPPED"
fi
echo ""

# S6: Rust compile check (faster than full test)
echo "[S6] cargo check --workspace"
cargo check --workspace -q 2>&1 | tail -3
echo ""

# S7: FlatBuffers schema validation (if .fbs files exist)
echo "[S7] flatc schema validation"
FBS_COUNT=$(find . -name "*.fbs" -not -path "*/target/*" -not -path "*/node_modules/*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$FBS_COUNT" -gt 0 ] && command -v flatc &>/dev/null; then
  find . -name "*.fbs" -not -path "*/target/*" -not -path "*/node_modules/*" -exec flatc --strict-json {} \; 2>&1 | tail -3
  echo "  $FBS_COUNT schema(s) validated"
else
  echo "  No .fbs files or flatc not available — SKIPPED"
fi
echo ""

# S8: cargo deny security advisories (non-blocking)
echo "[S8] cargo deny check advisories"
if command -v cargo-deny &>/dev/null; then
  cargo deny check advisories 2>&1 | tail -5 || true
else
  echo "  cargo-deny not installed — SKIPPED"
fi

echo ""
echo "=== smoke PASSED ==="
