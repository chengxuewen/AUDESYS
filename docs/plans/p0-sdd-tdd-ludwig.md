# P0-3: AUDESYS SDD→TDD 过渡 — 直接 TDD 方案

**决策**: D33 — 采用直接 TDD（2026-07-13，修订自原 Ludwig 方案）
**状态**: ✅ 已确认（经 4 方团队审核后修订）
**前置**: Phase 0 Cargo workspace 就绪
**目标**: 从现有设计规范直接提取测试场景，按 AAA 模式编写 Rust 测试

---

## 1. 概述

AUDESYS 当前处于纯文档驱动阶段（architecture.md 1666 行 + hal-detailed-design.md 3386 行）。

**方法**：直接从 `hal-detailed-design.md` 提取可测试行为，编写带 Given/When/Then 注释的普通 Rust 测试，按 Arrange-Act-Assert (AAA) 模式组织。

```
hal-detailed-design.md（设计规范）
    │
    ├── 人工提取测试场景（30 分钟/节）
    │
    ├── 按 AAA 模式编写 #[test]（RED）
    │
    ├── 实现代码（GREEN）
    │
    └── 重构（REFACTOR）
```

**为什么不用 Ludwig**：Ludwig v0.1 alpha（19 commits、1 维护者、无 crates.io 发布、无属性测试生成）不满足生产级工具链要求。规范驱动开发增加开销，TDD 提供价值——不等待未成熟工具兑现承诺。

---

## 2. 测试结构与命名约定

### 2.1 AAA 模式

```rust
/// HAL 类型系统：Bool 类型序列化往返
///
/// 来源: docs/hal-detailed-design.md §4
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

### 2.2 测试文件组织

```
crates/audesys-hal-core/
├── src/
│   ├── primitives.rs       # 14 种类型实现
│   ├── signal.rs           # Signal trait
│   ├── stream_channel.rs   # StreamChannel trait
│   └── rpc.rs              # RPC trait
└── tests/
    ├── hal_types.rs        # §4 类型系统测试（~15 个）
    ├── hal_signal.rs       # §1 Signal 协议测试（~12 个）
    ├── hal_stream.rs       # §1 StreamChannel 测试（~10 个）
    ├── hal_rpc.rs          # §1 RPC 测试（~8 个）
    ├── hal_qos.rs          # §3 HalQoS 测试（~6 个）
    ├── hal_thread.rs       # §5 线程调度测试（~5 个）
    ├── hal_config_barrier.rs # §7 Config Barrier 测试（~5 个）
    └── hal_scan_barrier.rs # §6 Scan Barrier 测试（~4 个）
```

### 2.3 命名约定

- 文件名：`hal_<module>.rs`（小写蛇形命名，按 hal-detailed-design.md 节次排序）
- 测试函数：`<操作>_<条件>_<预期结果>`（如 `bool_roundtrip_preserves_value`）
- 每个测试顶部的文档注释：包含 `来源: docs/hal-detailed-design.md §N` 追溯

---

## 3. 测试场景提取清单

从 hal-detailed-design.md 提取的测试场景（按优先级排序）：

| 序号 | 源章节 | 测试文件 | 估计测试数 | 可测试性 |
|:---:|--------|----------|:---:|:---:|
| 1 | §4 类型系统 | `hal_types.rs` | ~15 | ✅ 完全可测（纯逻辑，无依赖） |
| 2 | §1 Signal 协议 | `hal_signal.rs` | ~12 | ⚠️ 需 HalTransport trait（mock） |
| 3 | §1 StreamChannel 协议 | `hal_stream.rs` | ~10 | ⚠️ 需 HalTransport trait（mock） |
| 4 | §1 RPC 协议 | `hal_rpc.rs` | ~8 | ⚠️ 需 HalTransport trait（mock） |
| 5 | §3 HalQoS | `hal_qos.rs` | ~6 | ✅ 纯逻辑（标签匹配、位掩码展开） |
| 6 | §7 Config Barrier | `hal_config_barrier.rs` | ~5 | ✅ 纯逻辑（状态机转换） |
| 7 | §6 Scan Barrier | `hal_scan_barrier.rs` | ~4 | ⚠️ 需 mock 线程上下文 |
| 8 | §5 线程调度 | `hal_thread.rs` | ~5 | ⚠️ Phase 1 仅测试周期倍数约束逻辑 |
| **总计** | | **8 份测试文件** | **~65 个测试** | |

**测试依赖层次**：
- **优先级 A（Phase 1 立即可测）**：类型系统 + HalQoS + Config Barrier（~26 个测试，纯逻辑）
- **优先级 B（HalTransport trait 定义后）**：Signal + StreamChannel + RPC 协议（~30 个测试，需 mock transport）
- **优先级 C（Phase 2+）**：Scan Barrier + 线程调度完整版（~9 个测试，需 RT 上下文）

---

## 4. 实施步骤

### Step 1: 从类型系统开始（优先级 A）

`hal-detailed-design.md` §4 定义 14 种类型。提取测试场景：

```rust
// crates/audesys-hal-core/tests/hal_types.rs

/// 来源: docs/hal-detailed-design.md §4 — Bool 类型
#[test]
fn bool_roundtrip_preserves_value() { /* ... */ }

/// 来源: docs/hal-detailed-design.md §4 — F64 零值精度
#[test]
fn f64_zero_roundtrip_is_identity() { /* ... */ }

/// 来源: docs/hal-detailed-design.md §4 — 所有标量类型往返
#[test]
fn all_scalars_roundtrip_identity() { /* parameterized test over 11 types */ }

/// 来源: docs/hal-detailed-design.md §4 — String 类型（UTF-8 only）
#[test]
fn string_roundtrip_preserves_unicode() { /* ... */ }

/// 来源: docs/hal-detailed-design.md §4 — Array<T> 嵌套
#[test]
fn array_i32_roundtrip_preserves_order() { /* ... */ }

/// 来源: docs/hal-detailed-design.md §4 — Blob 不进类型推导
#[test]
fn blob_is_opaque_no_type_inference() { /* 验证 Blob 被类型系统视为不透明 */ }
```

### Step 2: RED — 所有测试 `todo!()` 桩

```bash
cargo test  # 全部 RED (todo!() panics)
```

### Step 3: GREEN — 逐个实现

从最简单的测试开始（`bool_roundtrip_preserves_value`）：

1. 实现 `Bool` 类型 + FlatBuffers 序列化
2. `cargo test bool_roundtrip_preserves_value` → GREEN
3. 继续下一个测试

### Step 4: REFACTOR — 提取公共模式

当 3+ 个测试共享类似的序列化/反序列化模式时：
- 提取公共 fixture（如 `roundtrip<T: HalType>(value: T)` 辅助函数）
- 泛型化参数测试（`#[test]` → 测试表驱动模式）

### Step 5: 迭代到其他优先级

优先级 A 全部 GREEN 后，进入优先级 B（需先定义 HalTransport trait + mock 实现），然后优先级 C（Phase 2）。

---

## 5. TDD 工作流

```
┌──────────────────────────────────────────────────────┐
│                   直接 TDD 循环                        │
│                                                      │
│  1. 阅读 hal-detailed-design.md §N                   │
│     ↓                                                │
│  2. 编写测试（RED）                                   │
│     ├── Arrange: 设置测试数据                         │
│     ├── Act: 调用被测代码                             │
│     └── Assert: 验证预期结果                          │
│     ↓                                                │
│  3. cargo test → RED（确认测试失败）                   │
│     ↓                                                │
│  4. 编写最小实现（GREEN）                              │
│     ↓                                                │
│  5. cargo test → GREEN                               │
│     ↓                                                │
│  6. 重构（REFACTOR）                                  │
│     ↓                                                │
│  7. cargo test → 仍 GREEN                            │
│     ↓                                                │
│  8. 下一个测试场景                                    │
└──────────────────────────────────────────────────────┘
```

---

## 6. 验收标准

- [ ] `crates/audesys-hal-core/tests/` 包含至少 4 份测试文件（类型系统 + HalQoS + Config Barrier 优先）
- [ ] 优先级 A 测试（~26 个）至少 80% GREEN（非 `todo!()`）
- [ ] 每个测试顶部有 `来源: docs/hal-detailed-design.md §N` 追溯注释
- [ ] `cargo test` 输出无 panic、无 ignore
- [ ] CI/CD qa-fast 门禁全绿

---

## 7. 优点（对比 Ludwig 方案）

| 维度 | Ludwig 方案 | 直接 TDD |
|------|------------|----------|
| 工具依赖 | v0.1 alpha（单维护者，bus factor=1） | 无额外工具依赖 |
| 设置成本 | git clone + cargo install + MCP 集成（1-2 天） | 零 |
| 中间产物 | 9 份 .md 规范文件（3-5 人天维护） | 无 |
| 测试生成 | 自动（但属性测试延期、判断验证需人机协同） | 手工（但品质可控） |
| 漂移检测 | ludwig diff（v0.1 可用性待验证） | 测试追溯注释 + Code Review |
| 学习曲线 | 1-2 天 | 无（标准 Rust 测试） |
| 长期维护成本 | 规范 + 源码 + 标记 三件套 | 源码 + 测试 两件套 |

---

## 8. 参考

- `.agents/rules/common/testing.md` — AUDESYS 测试要求（80% 覆盖率、AAA 模式、TDD 工作流）
- `docs/hal-detailed-design.md` — HAL 详细设计规范（17 章，3386 行）
- SDD 分类学 (arxiv.org/abs/2602.00180) — Spec-first 模式适合 AUDESYS 绿场开发
- 欧洲 XFEL PLC 验证 (ICALEPCS 2013) — 虚拟 PLC 验证模式，Phase 2 参考
