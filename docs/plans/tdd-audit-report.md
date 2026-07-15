# AUDESYS TDD 就绪度审计报告 v2

**审计日期**: 2026-07-15
**审计范围**: SDD 121 项规范 (openspec/specs/4 份) vs. 测试计划 (p0-sdd-tdd-ludwig.md) vs. 现有测试基建
**现有代码**: lib.rs (27行) + mock_transport.rs (116行, 含4个单元测试) + health.rs (14行, 1个编译链接测试) + test_helpers/mod.rs (32行, 3个构造器)
**交叉引用**: p0-mvp-acceptance.md, decisions.md D30/D33/D36/D50, .agents/rules/common/testing.md

---

## 0. 执行摘要

**TDD 就绪度: 🔴 未就绪** — 3 个 CRITICAL 缺口阻断 Phase 1 M0.3 启动。

| 维度 | 状态 | 关键数字 |
|------|:----:|---------|
| SDD 规范完备度 | ✅ 就绪 | 121 项规范，可追溯至 4 份设计文档 |
| 现有测试数 | 🔴 严重不足 | 5 个（均为 Phase 0 基建，零 SDD 映射） |
| 计划测试数 | 🟠 不足 | ~78 计划 vs. ~130 需求（41% 缺口） |
| Priority A 映射 | 🔴 严重不足 | ~32 计划 vs. ~84 需求（62% 缺口） |
| Mock 基础设施 | 🟠 部分就绪 | mockall 0.13 dev-dep 存在，但 StubValue 仅 3 种类型 |
| CI/CD 门禁 | ✅ 就绪 | qa-fast 5 门禁全绿 |

---

## 1. 测试计数汇总

### 1.1 SDD 规范项 → 测试映射

| 优先级 | SDD 规范文件 | 规范项数 | 计划测试数 | 最低需求 | 缺口 |
|:------:|-------------|:-------:|:---------:|:-------:|:---:|
| **A** | hal-type-system-spec.md | 30 | ~15 | ~26 | **-11** |
| **A** | hal-qos-spec.md | 30 | ~12 | ~24 | **-12** |
| **A** | config-barrier-spec.md | 24 | ~5 | ~18 | **-13** |
| **A 小计** | | **84** | **~32** | **~68** | **-36** |
| **B** | hal-protocol-spec.md (Signal) | 11 | ~12 | ~11 | +1 |
| **B** | hal-protocol-spec.md (StreamChannel) | 10 | ~10 | ~18 | **-8** |
| **B** | hal-protocol-spec.md (RPC) | 9 | ~15 | ~9 | +6 |
| **B** | hal-protocol-spec.md (AMW/Cross) | 7 | — | ~5 | **-5** |
| **B 小计** | | **37** | **~37** | **~43** | **-6** |
| **C** | Scan Barrier + 线程调度 | — | ~9 | ~9 | 0 |
| **总计** | | **121** | **~78** | **~120** | **-42** |

> 计划数字来源: p0-sdd-tdd-ludwig.md §3 表 + p0-mvp-acceptance.md §4 表
> 最低需求: 考虑每个规范项的独立可测性，减少合并后的合理最低估算

### 1.2 现有测试（Phase 0 当前）

| 测试 | 文件 | 类型 | SDD 映射 |
|------|------|------|:--------:|
| `workspace_compiles_and_links` | tests/health.rs | 编译链接 | ❌ 基建 |
| `write_and_read_signal` | src/mock_transport.rs#75 | 单元测试 | ❌ 基建 |
| `missing_signal_returns_none` | src/mock_transport.rs#83 | 单元测试 | ❌ 基建 |
| `signal_count_tracks_writes` | src/mock_transport.rs#89 | 单元测试 | ❌ 基建 |
| `write_overwrites_existing_signal` | src/mock_transport.rs#102 | 单元测试 | ❌ 基建 |
| **总计 5 个** | | | **0/121 映射** |

---

## 2. 发现明细

### 🔴 CRITICAL（阻断 M0.3 启动）

#### C1: Priority A 测试严重不足 — ~32 计划 vs. ~84 规范项

**详情**: p0-sdd-tdd-ludwig.md §3 表声称优先级 A "~32 个测试"覆盖类型系统 + HalQoS + Config Barrier。实际 SDD 规范定义 84 个独立可测规范项，合并后最低需要 ~68 个测试。

**三个子缺口**:

| 子缺口 | 规范项 | 计划 | 最低需求 | 关键缺失 |
|--------|:-----:|:---:|:-------:|---------|
| 类型系统 P0 验证项 | S-TYPE-015~019 | 5个合并 | 5个独立 | Blob 长度校验(015)、Array 类型校验(016)、UTF-8 校验(017)、未知 union(018)、嵌套深度(019) — 每个验证不同错误码，不可合并 |
| 类型系统 P1 边界项 | S-TYPE-024~027,029 | 5个合并 | 5个独立 | Bool 窄化(024)、零拷贝指针(025)、大数组边界(026)、字符串边界(027)、标量重标记(029) — 场景根本不同 |
| Config Barrier 全表 | S-CFG-001~063 | ~5 | ~18 | 7 个分类(状态机4 + 批处理4 + 队列3 + 拒绝3 + generation3 + 回滚3 + supervisor4)，每类至少 2-3 个测试 |

**影响**: 优先级 A 是 D33 直接 TDD 的核心路径。按当前计划启动，会发现大量规范项无测试覆盖，需边写边补。预估 M0.3→M1 延期 2-3 天。

**推荐**: 将类型系统 P0 验证项 (S-TYPE-015~019) 从 P1 升级到 P0，增加至少 5 个独立测试。Config Barrier 从 ~5 增加到 ~18（每类 2-3 个）。修订后的优先级 A 总数为 ~68 测试。

---

#### C2: StreamChannel QueuePolicy 测试覆盖不足 — ~10 计划 vs. 最低 ~18

**详情**: S-CH-004 定义 3 种 QueuePolicy (DropOldest/Backpressure/DropNewest)，S-CH-005 定义 3 种 ErrorPolicy (Block/Drop/Notify)。每种策略需独立验证至少 2 个场景（正常路径 + 边界触发）。

**当前计划仅 ~10 个测试，最少需要**:
- DropOldest: 满队列写入 + 空队列写入 + 读取顺序验证 (3)
- Backpressure: 满队列阻塞 + 释放后恢复 + 超时处理 (3)
- DropNewest: 满队列丢弃 + 空队列写入 (2)
- ErrorPolicy × QueuePolicy 组合: 至少 3 组交叉 (3)
- 熔断器 (S-CH-006): 开启/半开/关闭状态转换 (3)
- 基础读写 (S-CH-001~003): 多写多读 + 有序性 + 深度配置 (4)
= **最低 18 个**

**影响**: StreamChannel 是 M3 验收的核心（"10MB/s 无丢帧"）。QueuePolicy 实现错误直接导致验收失败。

**推荐**: 拆分为 18-20 个测试。将 QueuePolicy 测试单独分组（`hal_stream_queue_policy.rs`）。

---

#### C3: StubValue 不足以支持类型系统测试 — 仅 3/14 类型

**详情**: mock_transport.rs 的 `StubValue` 枚举只定义了 3 种类型 (Bool/S32/F64)，但 hal-type-system-spec.md 定义 14 种类型:
```rust
// 当前: 3 种
pub enum StubValue { Bool(bool), S32(i32), F64(f64) }

// 需求: 14 种
// Bool, S8(i8), U8(u8), S16(i16), U16(u16), S32(i32), U32(u32),
// S64(i64), U64(u64), F32(f32), F64(f64), Blob(Vec<u8>),
// Array<T>(Vec<T>), String(String)
```

**构造器也只覆盖 3 种** (val_i32/val_f64/val_bool)，缺少 val_s8/val_u8/val_s16/val_u16/val_u32/val_s64/val_u64/val_f32/val_blob/val_array/val_string。

**影响**: 优先级 A 的 14 个类型往返测试（S-TYPE-001~014）无法在当前 mock 框架上编写。需要先扩展 StubValue 或直接定义真正的 HalValue 枚举。

**推荐**: 在 M0.3 启动前将 StubValue 扩展为 14 种类型，或跳过 StubValue 直接定义 `HalValue` 枚举（见 C5 编译依赖）。

---

### 🟠 HIGH（应在 M0.3 启动前修复）

#### H1: Config Barrier 状态机测试严重低估 — ~5 计划 vs. 最低 ~18

**详情**: config-barrier-spec.md 定义 24 个规范项，覆盖 7 个独立子系统。当前计划仅 ~5 个测试。具体缺失:

| 子系统 | 规范项 | 最低测试 | 测试内容 |
|--------|:-----:|:-------:|---------|
| LockLevel 状态机 | S-CFG-001~004 | 5 | 枚举定义 + 单向递增 + 降级路径 + All 不可逆 |
| 周期边界应用 | S-CFG-010~013 | 3 | 应用时序 + Arc 原子替换 + HalConfig clone |
| Queue FIFO | S-CFG-020~022 | 3 | bounded channel + FIFO 顺序 + 空队列零开销 |
| Run 级别拒绝 | S-CFG-030~032 | 3 | 立即拒绝 + Run 拒绝范围 + Params 有限允许 |
| Generation 确认 | S-CFG-040~042 | 2 | 递增 + Signal 确认时序 |
| 回滚 | S-CFG-050~052 | 1 (P1) | 回滚原子性 |
| Supervisor 接口 | S-CFG-060~063 | 1 (P1) | submit_config 接口签名 |
| **合计** | | **18** | |

**影响**: Config Barrier 是 RT 系统配置安全的唯一保障。LockLevel 状态机错误会导致运行时配置泄露或拒绝服务。

**推荐**: 增加至 ~18 个测试。优先级最高的 5 个 (S-CFG-001~004 状态机 + S-CFG-010 周期边界时序) 必须在 M1 前完成。

---

#### H2: HalQoS 安全域通配匹配和状态转换测试缺失

**详情**: hal-qos-spec.md 30 个规范项，计划只有 ~12 个测试。关键缺失:

| 缺失场景 | 规范项 | 重要性 |
|---------|:-----:|:------:|
| 层级化通配匹配 `l1.*` | S-QOS-013 | IEC 62443 合规 |
| 位掩码编译验证 | S-QOS-014 | 零 RT 开销核心机制 |
| 安全域隔离效果 (端到端) | S-QOS-015 | 安全域设计目标 |
| Liveliness Alive→Missing 状态转换 | S-QOS-009 | 心跳核心语义 |
| Liveliness 恢复 Missing→Alive | S-QOS-010 | 故障恢复路径 |
| Deadline 回调 panic 安全 | S-QOS-028 | RT tick 循环健壮性 |
| Security domain 格式校验 | S-QOS-027 | 输入验证 |

**影响**: 层级化通配匹配未测试 → IEC 62443 安全隔离无法验证。Liveliness 状态转换不完整 → 心跳机制不可靠。

**推荐**: 增加至 ~24 个测试。优先级最高的 7 个缺失场景（上表）必须在 M1 前补充。

---

#### H3: 直接 TDD 的编译依赖路径未建模

**详情**: p0-sdd-tdd-ludwig.md Step 2 说 "RED — 所有测试 `todo!()` 桩"，Step 3 说 "cargo test → RED (todo!() panics)"。但测试文件引用 `Bool`、`FlatBuffersSerde`、`HalQoS`、`HalConfig` 等类型——这些类型在 Phase 0 不存在。

**关键依赖链**:
```
健康检查 test (health.rs)
  ← 需要 HalCoreLinked struct      ← ✅ 已存在 (lib.rs)

类型往返 test (hal_types.rs)
  ← 需要 HalValue enum (14 types)  ← ❌ 不存在（StubValue 仅 3 种）
  ← 需要 FlatBuffersSerde trait   ← ❌ 不存在
  ← 需要 hal-flatbuffers crate    ← ❌ 不存在

HalQoS test (hal_qos.rs)
  ← 需要 HalQoS trait             ← ❌ 不存在
  ← 需要 SecurityDomain 解析      ← ❌ 不存在

Config Barrier test (hal_config_barrier.rs)
  ← 需要 HalConfig struct         ← ❌ 不存在
  ← 需要 ConfigCommand enum       ← ❌ 不存在
  ← 需要 ConfigBarrier trait      ← ❌ 不存在
```

**影响**: 如果直接按计划启动，开发者需要先创建所有类型和 trait 的最小编译桩才能让测试文件编译通过。计划未建模此步骤，实际 start-up 时间被低估。

**推荐**: 在 M0.3 启动前创建 "编译桩清单"：列出每个测试文件依赖的外层类型/trait，标注其最小定义。作为 TDD 工作流的 Step 0。

---

#### H4: `tests/` 目录结构不存在

**详情**: p0-mvp-acceptance.md §2 和 p0-sdd-tdd-ludwig.md §2.2 定义的 `tests/integration/` 目录不存在。当前 `crates/audesys-hal-core/tests/` 仅有 `health.rs` 和 `test_helpers/mod.rs`。

**计划目录 vs. 实际**:
| 计划路径 | 是否存在 | 备注 |
|---------|:------:|------|
| `tests/integration/` | ❌ | 计划定义为 workspace 级集成测试目录 |
| `tests/integration/Cargo.toml` | ❌ | 计划要求包含 mockall 依赖 |
| `tests/integration/src/lib.rs` | ❌ | 计划要求包含 mock 示例 |
| `crates/audesys-hal-core/tests/` | ✅ | 仅含 health.rs + test_helpers/ |
| `crates/audesys-hal-core/tests/hal_types.rs` | ❌ | 计划定义的优先级 A 测试文件 |
| `crates/audesys-hal-core/tests/hal_qos.rs` | ❌ | 计划定义的优先级 A 测试文件 |

**推荐**: 创建 `tests/integration/` 目录及 Cargo.toml，或修订计划统一将测试放 `crates/audesys-hal-core/tests/`。

---

### 🟡 MEDIUM（Phase 1 早期修复）

#### M1: AAA 模式标记不一致

**详情**: 现有 4 个 mock_transport 测试无 `// Arrange` `// Act` `// Assert` 标记。AAA 模式仅在计划文档中以示例形式出现，未在代码中强制执行。

```rust
// 当前 (mock_transport.rs:75):
#[test]
fn write_and_read_signal() {
    let mut transport = MockHalTransport::new();     // 无 Arrange 标记
    transport.write_signal("test.value", ...).unwrap(); // 无 Act 标记
    assert_eq!(...);                                    // 无 Assert 标记
}
```

**推荐**: 为现有测试添加 AAA 标记，纳入 code review checklist。

---

#### M2: proptest 和 criterion 未规划

**详情**: D30 三层 QA 要求 qa-full 包含 criterion benchmarks + proptest property-based testing。TDD 计划和 Cargo.toml 均未提及。

**关键适用场景**:
- F32/F64 往返 (S-TYPE-010~011,028): NaN/signaling NaN/subnormal — 人类手工枚举易遗漏
- 类型往返全部 14 种 (S-TYPE-001~014): proptest 自动生成任意值验证往返一致性
- Array 大数组边界 (S-TYPE-026): proptest 随机大小/内容验证内存安全
- String UTF-8 校验 (S-TYPE-017): proptest 生成合法/非法 UTF-8 序列
- Deadline 精度 (S-QOS-004): criterion 测量回调触发延迟

**推荐**: 在 Cargo.toml dev-dependencies 添加 `proptest` 和 `criterion`。Phase 1 M4 开始为 F32/F64 往返测试引入 proptest。

---

#### M3: 测试辅助函数 `test_helpers/mod.rs` 未充分使用

**详情**: test_helpers/mod.rs 定义了 `val_i32`/`val_f64`/`val_bool` 三个构造器，但 mock_transport.rs 的 4 个测试中均未使用它们（直接写 `StubValue::S32(42)`）。此外，缺少其他 11 种类型的构造器。

**推荐**: 扩展 test_helpers 覆盖全部 14 种类型，更新现有测试使用辅助函数。

---

#### M4: 错误路径测试未规划

**详情**: SDD 规范包含 8 个显式的错误/验证测试项，但 TDD 计划未明确将它们从正常路径中分离:

| 规范项 | 测试内容 | 计划是否覆盖 |
|--------|---------|:----------:|
| S-TYPE-015 | Blob 长度字段校验 → Err | ❌ 未标明 |
| S-TYPE-016 | Array 元素类型校验 → Err | ❌ 未标明 |
| S-TYPE-017 | String UTF-8 编码校验 → Err | ❌ P1 标注 |
| S-TYPE-018 | 未知 union 类型拒绝 → Err | ❌ P0 但未单独计数 |
| S-TYPE-019 | 嵌套深度限制 → Err | ❌ P1 标注 |
| S-QOS-025 | Deadline interval=0 → Err | ❌ 未标明 |
| S-QOS-026 | Liveliness period=0 → Err | ❌ 未标明 |
| S-QOS-027 | Security domain 格式校验 → Err | ❌ 未标明 |

**推荐**: 在测试清单中明确标注错误路径测试，使用 `_rejects`/`_invalid` 后缀命名约定。

---

### 🔵 LOW（改进建议）

#### L1: 命名约定不统一

当前 mock_transport 测试使用 `write_and_read_signal` 风格，但 SDD 规范映射使用 `test_type_01_bool_roundtrip` 风格。建议统一为 `<模块>_<操作>_<条件>_<预期>` 格式。

#### L2: 缺少 rust-analyzer 测试配置

`.vscode/settings.json` 或项目级 `rust-analyzer` 配置未包含测试运行器设置。开发者可能无法一键运行单个测试。

#### L3: CI 未运行覆盖率报告

D30 规定 Phase 1 M5+ 启用 tarpaulin 覆盖率门禁。当前 `.github/workflows/qa.yml` 的 qa-fast 步骤未包含覆盖率上传。建议在 qa-fast 中增加 `--no-fail` 的覆盖率生成（仅报告不阻断），为后续门禁做准备。

#### L4: 文档内部不一致 — S-CFG 索引与实际计数

`config-barrier-spec.md` 附录 A 列出 24 项 (S-CFG-001 到 S-CFG-063)，但编号跳跃（001-004, 010-013, 020-022, 030-032, 040-042, 050-052, 060-063 = 24项）。`p0-mvp-acceptance.md` §4 表记为 "24"，正确但易混淆。

---

## 3. 覆盖率策略评估

### 3.1 80% 覆盖率目标冲突（已在上报告 §3.1 中识别，仍存在）

| 来源 | 声明 | 冲突 |
|------|------|:---:|
| `.agents/rules/common/testing.md` L2 | "Minimum Test Coverage: 80%" | 无 phase 限定词 |
| `decisions.md` D30 | "Phase 1 不要求 80% 覆盖率" | 与规则矛盾 |
| `p0-mvp-acceptance.md` §5 | Phase 1 M5+ 才启用 80% | 与规则矛盾 |

**状态**: 未修复。上报告已识别（C3），但 testing.md 仍未修订。

### 3.2 ~78 测试能否达到 80%？

**不能**。预计代码量估算:
- 14 种类型 + FlatBuffers serde ≈ 800-1200 LOC
- Signal/StreamChannel/RPC trait + impl ≈ 600-1000 LOC
- HalQoS trait + 位掩码 ≈ 200-400 LOC
- Config Barrier 状态机 ≈ 200-400 LOC

总计 ~1800-3000 LOC。78 个测试覆盖此规模，典型覆盖率 ~55-70%。达到 80% 需 ~110-130 个测试，与本报告 §1.1 的最低需求估算 (~120) 一致。

---

## 4. 依赖顺序验证

```
M0 (Phase 0):  Cargo workspace + CI/CD + 测试目录骨架 + health.rs
    │
    ├── 🔴 缺失: HalValue enum + trait 编译桩（阻塞 M0.3 TDD 启动）
    │
    v
M0.3 (TDD 启动):  RED → GREEN 循环
    │
    ├── 🔴 阻塞: 类型系统测试需 HalValue 14 种类型
    ├── 🔴 阻塞: HalQoS 测试需 HalQoS trait
    ├── 🔴 阻塞: Config Barrier 测试需 HalConfig + ConfigCommand
    │
    v
M1:  类型系统 + FlatBuffers schema + amw triplet traits 定义
    │
    ├── 此时 Priority A 测试才可编译并执行
    │
    v
M2:  Signal/StreamChannel/RPC trait + mock 实现
    │
    ├── 此时 Priority B 测试开始
    │
    v
M3:  StreamChannel 性能测试 (Priority B+)
```

**结论**: 编译依赖链是正确的分层设计，但计划未明确 M0 和 M0.3 之间需要 "编译桩阶段" (Step 0)。详见 H3。

---

## 5. Mock 基础设施评估

| 组件 | 状态 | 评估 |
|------|:----:|------|
| mockall 0.13 dev-dep | ✅ | Cargo.toml 已声明 |
| MockHalTransport struct | 🟡 | 仅支持 Signal 读写，无 StreamChannel/RPC/Discovery |
| StubValue enum | 🔴 | 仅 3/14 种类型，无法支持类型系统测试 |
| test_helpers 构造器 | 🟡 | 3 个构造器，未在测试中使用 |
| HalTransport trait | ❌ | 未定义（计划 M1 定义） |
| `#[automock]` | ❌ | mockall 需要真实 trait 定义才能生成 mock |

**结论**: mock 基础设施是一个骨架。在 Priority A 测试（纯逻辑，无需 mock）可绕过，但 Priority B 测试需要等 HalTransport trait 定义后才能生成 mock。

---

## 6. 裁决与行动项

### TDD 就绪度: 🔴 未就绪

**阻断项** (必须在 M0.3 启动前解决):
1. **修订 Priority A 测试计数**: ~32 → ~68，按本报告 C1 拆分明细
2. **扩展 StubValue → HalValue 14 种类型** (C3)，或直接定义 HalValue enum
3. **创建编译桩清单** (H3): 每个测试文件所需的最小 trait/type 定义
4. **创建 tests/integration/ 目录** (H4)，或修订计划统一路径

**高优先级** (Phase 1 M1 前解决):
5. 增加 Config Barrier 测试至 ~18 (H1)
6. 增加 HalQoS 测试至 ~24，补充通配匹配/状态转换/错误路径 (H2)
7. 修订 `.agents/rules/common/testing.md` 第 2 行: 添加 Phase 限定词

**中优先级** (Phase 1 M2-M3):
8. 添加 proptest + criterion dev-dep (M2)
9. 为现有测试添加 AAA 标记 (M1)
10. 补充错误路径测试清单 (M4)

**修复估时**: 文档修订 0.5 天 + StubValue 扩展 0.5 天 + tests/ 目录创建 0.5 天 = **1.5 天**

---

## 附录 A: 更新后的优先级 A 测试清单

| 序号 | 规范项 | 测试函数名 | 类别 |
|:---:|--------|-----------|------|
| 1 | S-TYPE-001 | test_type_01_bool_roundtrip | 序列化往返 |
| 2 | S-TYPE-002 | test_type_02_s8_roundtrip | 序列化往返 |
| 3 | S-TYPE-003 | test_type_03_u8_roundtrip | 序列化往返 |
| 4 | S-TYPE-004 | test_type_04_s16_roundtrip | 序列化往返 |
| 5 | S-TYPE-005 | test_type_05_u16_roundtrip | 序列化往返 |
| 6 | S-TYPE-006 | test_type_06_s32_roundtrip | 序列化往返 |
| 7 | S-TYPE-007 | test_type_07_u32_roundtrip | 序列化往返 |
| 8 | S-TYPE-008 | test_type_08_s64_roundtrip | 序列化往返 |
| 9 | S-TYPE-009 | test_type_09_u64_roundtrip | 序列化往返 |
| 10 | S-TYPE-010 | test_type_10_f32_roundtrip | 序列化往返 |
| 11 | S-TYPE-011 | test_type_11_f64_roundtrip | 序列化往返 |
| 12 | S-TYPE-012 | test_type_12_blob_roundtrip | 序列化往返 |
| 13 | S-TYPE-013 | test_type_13_array_roundtrip | 序列化往返 |
| 14 | S-TYPE-014 | test_type_14_string_roundtrip | 序列化往返 |
| 15 | S-TYPE-015 | test_type_15_blob_length_validation | 验证 (REJECT) |
| 16 | S-TYPE-016 | test_type_16_array_element_type_check | 验证 (REJECT) |
| 17 | S-TYPE-017 | test_type_17_string_utf8_validation | 验证 (REJECT) |
| 18 | S-TYPE-018 | test_type_18_unknown_union_type_reject | 验证 (REJECT) |
| 19 | S-TYPE-020 | test_type_20_time_s32_boundary | 边界 |
| 20 | S-TYPE-021 | test_type_21_date_u32_boundary | 边界 |
| 21 | S-TYPE-022 | test_type_22_tod_u32_boundary | 边界 |
| 22 | S-TYPE-023 | test_type_23_dt_u64_boundary | 边界 |
| 23 | S-TYPE-028 | test_type_28_fp_special_values | 边界 |
| 24 | S-TYPE-030 | test_type_30_bitstring_preservation | 边界 |
| — | S-QOS-001 | test_qos_001_trait_surface | Trait 定义 |
| — | S-QOS-002 | test_qos_002_deadline_handle_drop | Deadline |
| — | S-QOS-003 | test_qos_003_callback_context | Deadline |
| — | S-QOS-004 | test_qos_004_deadline_triggers | Deadline |
| — | S-QOS-005 | test_qos_005_deadline_reset | Deadline |
| — | S-QOS-006 | test_qos_006_multiple_signals | Deadline |
| — | S-QOS-007 | test_qos_007_liveliness_status_enum | Liveliness |
| — | S-QOS-008 | test_qos_008_enable_heartbeat | Liveliness |
| — | S-QOS-009 | test_qos_009_alive_to_missing | Liveliness |
| — | S-QOS-010 | test_qos_010_recovery_from_missing | Liveliness |
| — | S-QOS-011 | test_qos_011_security_domain_set | Security Domain |
| — | S-QOS-012 | test_qos_012_hierarchical_format | Security Domain |
| — | S-QOS-013 | test_qos_013_wildcard_matching | Security Domain |
| — | S-QOS-014 | test_qos_014_bitmask_compilation | Security Domain |
| — | S-QOS-016 | test_qos_016_amw_inproc_deadline | amw 差异 |
| — | S-QOS-017 | test_qos_017_amw_inproc_liveliness | amw 差异 |
| — | S-QOS-018 | test_qos_018_amw_inproc_security | amw 差异 |
| — | S-QOS-025 | test_qos_025_deadline_interval_invalid | 错误路径 |
| — | S-QOS-026 | test_qos_026_liveliness_period_invalid | 错误路径 |
| — | S-QOS-027 | test_qos_027_security_domain_format_invalid | 错误路径 |
| — | S-QOS-028 | test_qos_028_callback_panic_safety | 错误路径 |
| — | S-QOS-029 | test_qos_029_trait_consistency | 跨实现 |
| — | S-QOS-030 | test_qos_030_send_sync | 编译期 |
| — | S-CFG-001 | test_cfg_001_locklevel_enum | LockLevel |
| — | S-CFG-002 | test_cfg_002_locklevel_monotonic_increase | LockLevel |
| — | S-CFG-003 | test_cfg_003_locklevel_downgrade | LockLevel |
| — | S-CFG-004 | test_cfg_004_locklevel_all_irreversible | LockLevel |
| — | S-CFG-010 | test_cfg_010_cycle_boundary_apply | 批处理 |
| — | S-CFG-011 | test_cfg_011_arc_read_only | 批处理 |
| — | S-CFG-012 | test_cfg_012_apply_pending_config | 批处理 |
| — | S-CFG-020 | test_cfg_020_bounded_channel | 队列 |
| — | S-CFG-021 | test_cfg_021_fifo_order | 队列 |
| — | S-CFG-022 | test_cfg_022_empty_queue_noop | 队列 |
| — | S-CFG-030 | test_cfg_030_run_level_rejects_all | 拒绝 |
| — | S-CFG-031 | test_cfg_031_run_reject_scope | 拒绝 |
| — | S-CFG-032 | test_cfg_032_params_level_partial_allow | 拒绝 |
| — | S-CFG-040 | test_cfg_040_generation_increment | Generation |
| — | S-CFG-041 | test_cfg_041_signal_acknowledgment | Generation |
| — | S-CFG-060 | test_cfg_060_submit_config_signature | Supervisor |
| **合计** | **~68 测试** | | |

*此表替代 p0-sdd-tdd-ludwig.md §3 中优先级 A 行（序号 1,5,6），原估算 ~32。*

---

*审计报告 v2 完成。建议将此报告作为 M0.3 TDD 启动的前置检查清单。*
