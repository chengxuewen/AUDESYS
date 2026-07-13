# P0-2: AUDESYS Phase 0 启动计划

**决策**: D32 — CI 先行（2026-07-13）
**状态**: ✅ 已确认
**前置**: 无（Phase 0 是第一步）
**产出**: Cargo workspace + CI/CD + 测试框架骨架

---

## 1. 概述

在 Phase 1 的任何代码编写之前，先搭建完整的基础设施。
遵循 D30 三层 QA 策略（qa-fast/qa-full/qa-deep），Phase 0 先实现 qa-fast。

---

## 2. 任务分解

### 2.1 Cargo Workspace 骨架

**文件**:

```
AUDESYS/
├── Cargo.toml              # 虚拟 workspace manifest
├── rust-toolchain.toml     # 锁定 Rust 版本
├── clippy.toml             # Clippy 配置（禁止 unwrap/expect 等）
├── deny.toml               # cargo-deny 配置
├── crates/
│   ├── audesys-hal-core/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── lib.rs      # 初始 crate（空）
│   ├── audesys-hal-flatbuffers/
│   │   ├── Cargo.toml
│   │   └── src/
│   │       └── lib.rs
│   └── audesys-amw-inproc/
│       ├── Cargo.toml
│       └── src/
│           └── lib.rs
├── apps/
│   └── studio/             # pnpm workspace + Tauri（与 HAL 并行启动，D38）
├── tests/
│   └── integration/
│       ├── Cargo.toml
│       └── tests/
│           └── health.rs   # placeholder
├── scripts/
│   └── qa/
│       ├── all.sh          # 入口脚本
│       ├── fast.sh         # qa-fast: fmt + clippy + test + audit
│       ├── full.sh         # qa-full: + coverage + mutants + semver
│       └── deep.sh         # qa-deep: + miri + proptest
├── specs/                  # 直接 TDD 测试场景提取（见 P0-3 计划）
├── .gitignore              # 排除 target/, .DS_Store
├── .github/
│   └── workflows/
│       └── qa.yml          # CI/CD 流水线
└── docs/                   # 不变
```

**`Cargo.toml` (workspace manifest)**:
```toml
[workspace]
resolver = "2"
members = [
    "crates/audesys-hal-core",
    "crates/audesys-hal-flatbuffers",
    "crates/audesys-amw-inproc",
    "tests/integration",
]

[workspace.package]
version = "0.0.0"           # Phase 1 无正式版本号
edition = "2024"
license = "Apache-2.0"

[workspace.dependencies]
# Phase 0 初始依赖（后续随模块增加）
thiserror = "2"
```

**`rust-toolchain.toml`**:
```toml
[toolchain]
channel = "stable"
components = ["rustfmt", "clippy", "rust-analyzer"]
targets = ["x86_64-unknown-linux-gnu", "aarch64-apple-darwin"]
```

**`clippy.toml`**:
```toml
# AUDESYS Clippy 配置
# 禁止项与 .agents/rules/ 通用规则对齐

# 禁止 unwrap/expect（需显式错误处理）
disallowed-methods = [
    "std::option::Option::unwrap",
    "std::result::Result::unwrap",
    "std::option::Option::expect",
    "std::result::Result::expect",
]

# 禁止 console 输出
disallowed-macros = ["println", "eprintln", "dbg"]
```

**`deny.toml` (cargo-deny 最小配置)**:
```toml
[advisories]
vulnerability = "deny"
unmaintained = "warn"
unsound = "deny"

[bans]
multiple-versions = "deny"
wildcards = "deny"

[licenses]
unlicensed = "deny"
allow = ["Apache-2.0", "MIT"]
copyleft = "deny"
default = "deny"
```

**`.gitignore` (workspace 最小排除)**:
```
/target/
.unwrap-budget
.DS_Store
*.swp
*.swo
```

---

### 2.2 CI/CD 流水线（qa-fast，Phase 0）

**`scripts/qa/all.sh`**:
```bash
#!/usr/bin/env bash
set -euo pipefail

MODE="${1:-fast}"

case "$MODE" in
    fast)   scripts/qa/fast.sh ;;
    full)   scripts/qa/fast.sh && scripts/qa/full.sh ;;
    deep)   scripts/qa/fast.sh && scripts/qa/full.sh && scripts/qa/deep.sh ;;
    *)      echo "Usage: $0 {fast|full|deep}" >&2; exit 1 ;;
esac
```

**`scripts/qa/fast.sh`** (qa-fast — PR gate):
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "=== AUDESYS qa-fast ==="

# 1. 格式检查
cargo fmt --workspace -- --check

# 2. Clippy (deny warnings)
cargo clippy --all-targets --all-features -- -D warnings

# 3. 单元测试 (all crates)
cargo test --all-features

# 4. 依赖审计
cargo deny check advisories
cargo deny check bans licenses sources

# 5. Unwrap budget ratchet
scripts/qa/unwrap-budget.sh

# 6. 拼写检查
typos

echo "qa-fast: PASS"
```

**`.github/workflows/qa.yml`**:
```yaml
name: QA

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  qa-fast:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest]  # Phase 2 加 windows-latest
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v4
      - uses: actions-rust-lang/setup-rust-toolchain@v1
        with:
          components: rustfmt, clippy
      - uses: Swatinem/rust-cache@v2
      - name: Install system dependencies (Linux)
        run: |
          sudo apt-get update && sudo apt-get install -y ripgrep
          curl -sSL https://github.com/google/flatbuffers/releases/download/v25.2.10/Linux.flatc.binary.clang++-18.zip -o /tmp/flatc.zip
          sudo unzip -q /tmp/flatc.zip -d /usr/local/bin/
          sudo chmod +x /usr/local/bin/flatc
        if: runner.os == 'Linux'
      - name: Install system dependencies (macOS)
        run: |
          brew install ripgrep flatbuffers
        if: runner.os == 'macOS'
      - uses: taiki-e/install-action@v2
        with:
          tool: cargo-deny,typos
      - run: scripts/qa/fast.sh
```

---

### 2.3 Unwrap Budget Ratchet

**`scripts/qa/unwrap-budget.sh`**:
```bash
#!/usr/bin/env bash
set -euo pipefail

BUDGET_FILE=".unwrap-budget"
CURRENT=$(rg -o '\.unwrap\(\)|\.expect\(' crates/ --type rust 2>/dev/null | wc -l | tr -d ' ')
CURRENT=${CURRENT:-0}

if [ ! -f "$BUDGET_FILE" ]; then
    echo "$CURRENT" > "$BUDGET_FILE"
    echo "unwrap-budget: initialized at $CURRENT"
    exit 0
fi

PREVIOUS=$(cat "$BUDGET_FILE")
if [ "$CURRENT" -gt "$PREVIOUS" ]; then
    echo "unwrap-budget: FAILED — budget increased from $PREVIOUS to $CURRENT"
    exit 1
fi

echo "$CURRENT" > "$BUDGET_FILE"
echo "unwrap-budget: OK ($CURRENT, down from $PREVIOUS)"
```

---

### 2.4 测试框架骨架

Phase 0 仅搭建框架，不写业务测试。测试场景提取见 P0-3 直接 TDD 计划。

`tests/integration/Cargo.toml`:
```toml
[package]
name = "audesys-integration-tests"
version.workspace = true
edition.workspace = true

[dependencies]
audesys-hal-core = { path = "../../crates/audesys-hal-core" }
audesys-hal-flatbuffers = { path = "../../crates/audesys-hal-flatbuffers" }
audesys-amw-inproc = { path = "../../crates/audesys-amw-inproc" }
```

`tests/integration/tests/health.rs`:
```rust
use audesys_hal_core;
use audesys_hal_flatbuffers;
use audesys_amw_inproc;

/// 基础设施自检：确保 Cargo workspace 正确链接
#[test]
fn all_crates_compile() {
    // 每个 crate 通过 use 引入——仅验证编译链接
    let core_ok = std::mem::size_of::<i32>() > 0;
    assert!(core_ok, "hal-core linked");
}

/// 自检：FlatBuffers 工具链可用
#[test]
fn flatc_is_available() {
    let output = std::process::Command::new("flatc")
        .arg("--version")
        .output();
    match output {
        Ok(o) => assert!(o.status.success(), "flatc exited with error"),
        Err(_) => panic!("flatc not found — install FlatBuffers compiler"),
    }
}
```

---

## 3. 执行顺序

```
Step 1: mkdir 目录结构
Step 2: 写入 Cargo.toml, rust-toolchain.toml, clippy.toml, deny.toml
Step 3: cargo init crates/audesys-hal-core --lib
         cargo init crates/audesys-hal-flatbuffers --lib
         cargo init crates/audesys-amw-inproc --lib
         cargo init tests/integration
Step 4: 写入 scripts/qa/*.sh + .github/workflows/qa.yml
Step 5: 写入 .unwrap-budget（初始化为 0）
Step 6: cargo check --workspace（验证编译）
Step 7: scripts/qa/fast.sh（全门禁通过）
```

---

## 4. 验收标准

- [ ] `cargo check --workspace` 编译通过
- [ ] `cargo fmt --workspace -- --check` 零差异
- [ ] `cargo clippy --all-targets -- -D warnings` 零警告
- [ ] `cargo-deny check` 通过（零 CVE、零 license 违规）
- [ ] `.unwrap-budget` 初始化（当前计数 = 0）
- [ ] `.github/workflows/qa.yml` 在 PR 时运行且通过
- [ ] `grep -ri modacs` 零残留

---

## 5. 估时与依赖

| 步骤 | 估时 | 依赖 |
|------|:---:|------|
| 目录结构与 workspace | 0.5 天 | Rust 工具链已安装 |
| CI/CD 脚本 | 1 天 | GitHub Actions 可用 |
| 测试框架骨架 | 1 天 | P0-3 直接 TDD 计划 |
| **总计** | **3-4 天** | — |

---

## 6. 参考

- Rust Book §14.3: Cargo Workspaces
- dora-rs `scripts/qa/` 目录结构（qa-runbook.md）
- dora-rs `unwrap-budget` ratchet 模式（qa-poc-report-2026-04-09）
- rust-template workspace 骨架（github.com/itscheems/rust-template）
