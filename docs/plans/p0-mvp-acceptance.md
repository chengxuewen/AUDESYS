# P0 MVP 验收标准

> 定义 "AUDESYS P0 MVP 完成" 的精确含义。合并自 `p0-milestone-roadmap.md`（D31）、`p0-phase0-bootstrap.md`（D32）、`p0-sdd-tdd-ludwig.md`（D33），经 4 方团队审查 + 50 项文档审计修复。
>
> 用途：CI 门禁检查清单 + 利益相关方签字验收参考。

---

## 0. 概述

**P0 范围**：CI 基础设施 + 测试骨架 + Cargo workspace。零运行时代码。

**P0 完成条件**：所有 Phase 0 门禁通过（§1）+ 所有 M0.3 前置条件就绪（§3-§4）。

| 决策 | 内容 | 体现位置 |
|:---:|------|----------|
| D32 | CI 先行 — 代码编写前先搭基础设施 | §1 全部门禁 |
| D33 | 直接 TDD — 从设计规范提取测试，不依赖未成熟工具链 | §4 SDD + AAA |
| D35 | Cargo workspace 标准布局 — 虚拟 workspace + crates/ + apps/ | §2 目录树 |
| D36 | 渐进式三层 QA — qa-fast/qa-full/qa-deep 分阶段启用 | §1 + §5 |
| D37 | 分阶段测试 — Phase 1 仅测试纯逻辑层，RT 测试延后 | §4.2 |
| D41 | 沿用现有开发规则 + D30 CI 门禁 | §2.3 clippy.toml |

---

## 1. CI/CD 门禁（MUST PASS）

所有门禁在 macOS + Linux 双平台通过，方为 P0 完成。

| 门禁 | 命令 | 通过标准 | 优先级 |
|------|------|----------|:------:|
| 格式检查 | `cargo fmt --check` | 零 diff | P0 |
| Lint | `cargo clippy -- -D warnings` | 零 warning | P0 |
| 编译 | `cargo build --workspace` | 零错误 | P0 |
| 测试骨架 | `cargo test --workspace` | `health.rs` 通过 | P0 |
| 依赖审计 | `cargo deny check` | 零漏洞、零许可证违规 | P0 |
| Unwrap 预算 | `scripts/qa/unwrap-budget.sh` | ≤0 unwrap（ratchet） | P0 |
| OS 矩阵 | macOS + Linux | 所有门禁在两个 OS 均通过 | P0 |

**说明**:
- unwrap-budget 初始化为 0（`echo 0 > .unwrap-budget`），每新增一个 `unwrap()`/`expect()` 导致门禁 fail
- Phase 0 无覆盖率门禁（见 §5 覆盖策略）
- CI 工作流定义于 `.github/workflows/qa.yml`，在 push/PR 到 `main` 时触发
- 本地验证入口：`scripts/qa/qa-fast.sh`（与 CI 执行相同的门禁集合）

---

## 2. Workspace 结构（MUST EXIST）

```
AUDESYS/
├── Cargo.toml              # 虚拟 workspace manifest
├── rust-toolchain.toml     # stable + edition 2024
├── clippy.toml             # 禁止 unwrap/expect/println/dbg
├── deny.toml               # cargo-deny 最小配置
├── .unwrap-budget          # 初始值 = 0
├── .gitignore              # 排除 target/, .DS_Store
├── crates/
│   ├── audesys-hal-core/       # 14 类型 + Signal/StreamChannel/RPC trait
│   ├── audesys-hal-flatbuffers/ # FlatBuffers schema + 生成代码
│   └── audesys-amw-inproc/     # Phase 1 同进程 transport
├── apps/
│   └── studio/             # pnpm + Tauri（P0 占位）
├── tests/
│   └── integration/        # workspace 级集成测试（含 health.rs）
├── scripts/
│       ├── qa-fast.sh          # 执行所有 P0 门禁（CI 等效）
│       └── unwrap-budget.sh    # 扫描 unwrap 数量
├── specs/                  # SDD 测试场景提取
├── docs/                   # modules/hal(18) + modules/runtime(4) + specs(4) + plans(3)
├── .github/
│   └── workflows/
│       └── qa.yml              # CI 工作流（macOS + Linux 矩阵）
└── pixi.toml               # pixi workspace 管理（可选）
```

**Workspace Cargo.toml**：`resolver = "2"`，`members` 包含 3 个 crate + integration tests，`[workspace.package]` 设 edition=2024 / license=Apache-2.0。

**Clippy.toml**：`disallowed-methods` 含 `unwrap`/`expect`，`disallowed-macros` 含 `println`/`eprintln`/`dbg`（对齐 .agents/rules/ 不可变优先 + 禁止 unwrap 原则）。

---

## 3. 测试基础设施（MUST EXIST）

### 3.1 `health.rs` — 编译链接验证

- 位置: `crates/audesys-hal-core/src/tests/health.rs`
- 作用: 验证 hal-core 可编译、链接、可测试
- 内容: 至少包含一个 `#[test] fn hal_core_compiles()` 占位测试
- **通过条件**: `cargo test -p audesys-hal-core` 输出 `test result: ok`

### 3.2 Mock trait 框架

- 基于 `mockall` crate
- 位置: `tests/integration/src/lib.rs`
- 用途: Phase 1 M0.3 起，为 hal-core trait 提供 mock 实现
- **验证条件**: `tests/integration/Cargo.toml` 包含 `mockall` 依赖，`lib.rs` 包含 mock 示例

### 3.3 测试结构约定

| 测试类型 | 位置 | 工具 |
|----------|------|------|
| 模块级单元测试 | `crates/*/src/**/mod.rs` 内 `#[cfg(test)]` 块 | `cargo test -p <crate>` |
| 工作空间集成测试 | `tests/integration/src/` | `cargo test --workspace` |
| RT 确定性测试 (Phase 2) | `tests/rt/` (预留) | PREEMPT_RT runner (D37) |

---

## 4. SDD 规范就绪（MUST EXIST）

从 4 份 HAL 设计文档提取 121 项 SDD 规范，每项规范包含 ID、前置条件、操作、期望结果、边界条件、测试映射：

| 规范文档 | 设计来源 | 规范项数 | 可直接转写为测试数 |
|----------|----------|:--------:|:------------------:|
| `openspec/specs/hal-type-system-spec.md` | iec-type-system-design.md | 30 | ~15 |
| `openspec/specs/hal-qos-spec.md` | industrial-qos-design.md | 30 | ~12 |
| `openspec/specs/config-barrier-spec.md` | config-barrier-design.md | 24 | ~5 |
| `openspec/specs/hal-protocol-spec.md` | hal-protocol-design.md | 37 | ~37 |
| **总计** | | **121** | **~69** |

| 优先级 | 范围 | 估计测试数 | 依赖条件 | 时间窗口 |
|:------:|------|:----------:|----------|----------|
| A | 类型系统 + HalQoS + Config Barrier | ~32 | 无（纯逻辑，立即可测） | M0.3 – M1 |
| B | Signal/StreamChannel/RPC 协议 | ~37 | HalTransport trait + mock | M1 – M2 |
| C | Scan Barrier + 线程调度完整版 | ~9 | RT 上下文模拟 | Phase 2+ |

### 4.3 AAA 模式示例

```rust
/// HAL 类型系统：Bool 类型序列化往返
///
/// 来源: openspec/specs/hal-type-system-spec.md
#[test]
fn bool_roundtrip_preserves_value() {
    // Arrange
    let original = Bool(true);

    // Act
    let serialized = FlatBuffersSerde::serialize(&original);
    let deserialized: Bool = FlatBuffersSerde::deserialize(&serialized);

    // Assert
    assert_eq!(original, deserialized);
}
```

### 4.4 测试追溯

每个测试顶部必须包含 `来源:` 注释指向对应的 SDD 规范文档。Code Review 时验证追溯完整性。

**验证方式**: `grep -c '# SDD-' openspec/specs/*.md` → 总计 121 项。

---

## 5. 覆盖策略（MUST BE DOCUMENTED）

统一覆盖政策，单一权威来源：

| 阶段 | 覆盖门禁 | 说明 |
|:----:|:--------:|------|
| Phase 0（M0） | 无 | qa-fast 仅通过 fmt + clippy + test + audit + unwrap-budget |
| Phase 1 M0.3–M4 | 优先级 A 测试编写完成，无 % 门禁 | 优先覆盖核心逻辑路径 |
| Phase 1 M5+ | 优先级 A+B 测试 >= 80% | tarpaulin 覆盖率门禁启用 |
| Phase 2+ | 全部测试 >= 80% | 纳入 qa-full 流水线 |

**参考**：D30（dora-rs 三层 QA）、D36（渐进式门禁）、.agents/rules/common/testing.md（80% 覆盖率要求延后到 Phase 1 M5+ 强制执行）。

---

## 6. 设计文档就绪度

| 文档 | 状态 | 需要 P0 完成？ |
|------|:----:|:--------------:|
| `docs/architecture.md` — 系统架构概览 | ✅ | Phase 0 |
| `docs/modules/hal/` — 18 份 HAL 子文档 | ✅ | Phase 0 |
| `docs/modules/runtime/` — 4 份 Runtime 设计文档 | ✅ | Phase 0 |
| `openspec/specs/` — 4 份 SDD 规范文档（121 项） | ✅ | Phase 0 |
| `docs/plans/` — 3 份 P0 计划文档 | ✅ | Phase 0 |

P0 完成时所有设计文档已存在（50 项审计修复已完成）。P0 不要求新增设计文档。

---

## 7. 环境与工具链

| 工具 | 版本/要求 | 用途 | 安装方式 |
|------|-----------|------|----------|
| Rust 工具链 | stable, edition 2024 | 编译 + 测试 | rustup |
| cargo-deny | latest | 依赖审计 | `taiki-e/install-action` |
| flatc | v25.2.10+ | FlatBuffers 编译 | Linux: 二进制 / macOS: brew |
| ripgrep | latest | unwrap-budget + MODACS 残留 | Linux: apt / macOS: brew |
| typos | latest | 拼写检查 | `taiki-e/install-action` |
| pixi | latest（可选） | workspace 管理 | 独立安装 |
| GitHub Actions | — | CI runner | SaaS |

**CI runner**：ubuntu-latest + macos-latest（双平台，D30/D36）。**Caching**：`Swatinem/rust-cache@v2` 加速构建。

---

## 8. 估时

| 子任务 | 估时 |
|--------|:----:|
| 目录结构 + workspace manifest 配置 | 0.5 天 |
| CI/CD 流水线（qa-fast 脚本 + GitHub Actions） | 1 天 |
| CI 脚本调试 + 工具链缓存优化 | 1 天 |
| 测试框架骨架（health.rs + 目录） | 1 天 |
| 工具链安装 + 环境验证 | 1 天 |
| 缓冲（CI 跨平台差异、GitHub Actions runner 问题） | 1-2 天 |
| **总计** | **5-7 天** |

来源：p0-milestone-roadmap.md §4.1 与 p0-phase0-bootstrap.md §5 一致。

---

## 9. 签字检查清单

### CI 门禁

- [ ] `cargo fmt --check` 通过（macOS + Linux）
- [ ] `cargo clippy -- -D warnings` 通过（macOS + Linux）
- [ ] `cargo build --workspace` 通过（macOS + Linux）
- [ ] `cargo test --workspace` 通过（macOS + Linux），`health.rs` 输出 `ok`
- [ ] `cargo deny check` 通过（零漏洞 + 零许可证违规）
- [ ] `scripts/qa/unwrap-budget.sh` 输出 ≤0（macOS + Linux）
- [ ] `scripts/qa/qa-fast.sh` 本地通过（单命令验证入口）

### Workspace 与编译

- [ ] `cargo check --workspace` 编译通过
- [ ] 虚拟 workspace 包含 3 个 crate + integration tests 成员
- [ ] `clippy.toml` 已禁止 unwrap/expect/println/dbg
- [ ] `deny.toml` 已配置（unlicensed=deny, Apache-2.0/MIT only）
- [ ] `.github/workflows/qa.yml` 在 push/PR 到 main 时触发

### 测试基础设施

- [ ] health.rs 编译链接自检通过
- [ ] 测试目录结构完善（crate 级 `#[cfg(test)]` + workspace 级 `tests/integration/`）
- [ ] Mock 策略文档化（mockall 为首选方案）

### SDD 就绪

- [ ] 4 份 SDD 规范文档已审查（type-system / hal-qos / config-barrier / protocol）
- [ ] 121 项规范可追溯到对应设计文档
- [ ] 优先级 A 测试场景列表已确认（~32 个纯逻辑测试）
- [ ] AAA 测试模式已确认（Arrange-Act-Assert）

### 文档

- [ ] 18 份 HAL 子文档存在
- [ ] 4 份 Runtime 设计文档存在
- [ ] 覆盖策略文档化（§5）
- [ ] 3 份 P0 计划文档存在

### 环境复现

- [ ] 另一位开发者从零开始按指引成功运行 `scripts/qa/qa-fast.sh`

---

## 10. 验证脚本汇总

```bash
# P0 完整验证（开发者的 5 分钟检查）
cargo fmt --check
cargo clippy -- -D warnings
cargo build --workspace
cargo test --workspace
cargo deny check
./scripts/qa/unwrap-budget.sh

# 单命令执行（CI 等效）
./scripts/qa/qa-fast.sh
```

## 附录 B: 文件验证清单

```bash
# Workspace 结构验证
ls Cargo.toml
ls crates/audesys-hal-core/src/lib.rs
ls tests/integration/Cargo.toml
ls scripts/qa/qa-fast.sh scripts/qa/unwrap-budget.sh
ls .github/workflows/qa.yml

# 设计文档计数
find docs/ -name '*.md' | wc -l  # 预期 ≥ 68

# SDD 规范计数
grep -c '# SDD-' openspec/specs/*.md  # 预期总计 121
```