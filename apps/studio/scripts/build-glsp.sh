#!/bin/bash
set -euo pipefail

# GLSP Build — two-step: dedup Symbols, then restore for server
# D103: extension symlinks cause esbuild to duplicate @theia/core modules.
# Build without them, verify Symbol uniqueness, then restore for GLSP server.

echo "=== GLSP Build (two-step Symbol dedup) ==="

# Step 1: Remove extension symlinks
echo "[1/3] Removing extension node_modules symlinks..."
for ext in theia-extensions/*/; do
  if [ -L "${ext}node_modules" ]; then
    rm -f "${ext}node_modules"
    echo "  Removed ${ext}node_modules"
  fi
done

# Step 2: Build
echo "[2/3] Building..."
npm run build

# Step 3: Verify Symbols
echo "[3/3] Verifying Symbol uniqueness..."
FAIL=0
for s in OpenHandler FrontendApplicationContribution OpenerService WidgetFactory; do
  count=$(grep -c "Symbol(\"$s\")" lib/frontend/bundle.js 2>/dev/null || echo 0)
  if [ "$count" != "1" ]; then
    echo "  FAIL: Symbol($s) = $count (must be 1)" >&2
    FAIL=1
  else
    echo "  OK: Symbol($s) = 1"
  fi
done

# Restore symlinks for GLSP server
echo "Restoring extension node_modules symlinks..."
for ext in theia-extensions/*/; do
  if [ ! -e "${ext}node_modules" ]; then
    ln -sf "../../apps/studio/node_modules" "${ext}node_modules" 2>/dev/null || true
    echo "  Restored ${ext}node_modules"
  fi
done

if [ "$FAIL" = "1" ]; then
  echo "Symbol verification FAILED. Do not deploy!" >&2
  exit 1
fi

echo "=== Build complete, all Symbols = 1 ==="
