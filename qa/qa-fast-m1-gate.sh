#!/usr/bin/env bash
# qa-fast-m1-gate.sh — M1.6 收尾阶段扩展门禁
# Usage: bash qa/qa-fast-m1-gate.sh
# Exit 0 = all gates pass, Exit 1 = gate failure

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

PASS=0
FAIL=0

gate() {
    local name="$1"
    shift
    echo -n "  [$name] "
    if "$@" > /dev/null 2>&1; then
        echo -e "${GREEN}PASS${NC}"
        PASS=$((PASS + 1))
    else
        echo -e "${RED}FAIL${NC}"
        FAIL=$((FAIL + 1))
    fi
}

echo "=== M1.6 qa-fast Gate Check ==="
echo ""

# ─── Step 0: Smoke ───
echo "Step 0: Smoke Tests (2min timeout)"
gate "Smoke" timeout 120 cargo test --workspace -- smoke

# ─── Step 1: Full Test Suite ───
echo ""
echo "Step 1: Full Test Suite"
gate "cargo test --workspace" cargo test --workspace --no-fail-fast

# ─── Step 2: Clippy ───
echo ""
echo "Step 2: Clippy"
gate "cargo clippy" cargo clippy --workspace -- -D warnings

# ─── Step 3: Fmt ───
echo ""
echo "Step 3: Format"
gate "cargo fmt" cargo fmt --all -- --check

# ─── Step 4: Deny ───
echo ""
echo "Step 4: cargo deny"
gate "cargo deny" cargo deny check

# ─── Step 5: Unwrap Budget ───
echo ""
echo "Step 5: Unwrap Budget"
gate "unwrap budget" bash qa/check-unwrap-budget.sh

# ─── Step 6: E2E Integration ───
echo ""
echo "Step 6: E2E Integration Tests"
gate "E2E tests" cargo test -p audesys-controller --test integration_e2e_test

# ─── Step 7: Fault Injection ───
echo ""
echo "Step 7: Fault Injection Tests"
gate "Fault tests" cargo test -p audesys-controller -- fault

# ─── Step 8: MCAP (if crate exists) ───
echo ""
echo "Step 8: MCAP Tests"
if grep -q '"audesys-agent"' Cargo.toml 2>/dev/null; then
    gate "MCAP tests" cargo test -p audesys-agent -- mcap
else
    echo -e "  [MCAP tests] ${YELLOW}SKIP (audesys-agent not yet created)${NC}"
fi

# ─── Step 9: SDD Traceability ───
echo ""
echo "Step 9: SDD Traceability"
if [ -f qa/check-sdd-traceability.sh ]; then
    gate "SDD trace >=80%" bash qa/check-sdd-traceability.sh
else
    echo -e "  [SDD trace] ${YELLOW}SKIP (script not found)${NC}"
fi

# ─── Step 10: Bench Regression ───
echo ""
echo "Step 10: Criterion Benchmarks"
gate "Criterion bench" cargo bench --bench signal_throughput -- --quick

# ─── Step 11: MODACS Audit ───
echo ""
echo "Step 11: MODACS Audit"
gate "MODACS zero" bash -c '! grep -ri modacs . --exclude-dir=.git --exclude-dir=.sisyphus --exclude-dir=target'

# ─── Summary ───
echo ""
echo "================================="
echo -e "Results: ${GREEN}${PASS} passed${NC}, ${RED}${FAIL} failed${NC}"
echo "================================="

if [ "$FAIL" -gt 0 ]; then
    exit 1
fi
exit 0
