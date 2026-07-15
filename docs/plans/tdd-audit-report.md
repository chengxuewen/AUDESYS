# AUDESYS TDD 测试计划审计报告

**审计日期**: 2026-07-15  
**审计范围**: p0-sdd-tdd-ludwig.md (TDD计划) vs. 架构要求  
**交叉引用**: p0-milestone-roadmap.md, p0-phase0-bootstrap.md, docs/modules/hal/ (18份子文档)  
**当前状态**: 零 HAL 测试文件（仅 book-to-skill 含 Python 测试，与 HAL 无关）

---

## 1. 测试用例覆盖度评估

### 1.1 HAL 原语覆盖矩阵

| HAL 原语 | 计划测试数 | 覆盖度评估 | 缺口 |
|----------|:---------:|-----------|------|
| **Signal** | ~12 | ⚠️ 部分覆盖 | 缺少：写者独占性验证、读者订阅计数、push/pull语义差异、命名规范验证、旧值覆盖行为 |
| **StreamChannel** | ~10 | ❌ 不足 | 3种 QueuePolicy（drop-oldest/drop-newest/block）各需 2-3 个场景，当前 ~10 个测试不足以覆盖全部策略组合。缺少：反压机制、缓冲耗尽、零长度消息 |
| **RPC** | ~8 | ❌ 不足 | 缺少：超时恢复（M4里程碑要求但未列入）、幂等键去重、并发RPC、大负载RPC（>1KB）、错误响应变体 |
| **类型系统** | ~15 | ⚠️ 基本覆盖 | 缺少：size/alignment 验证、溢出/下溢边界、Array\<Array\<T\>\>嵌套、空字符串和最大长度字符串 |
| **HalQoS** | ~6 | ❌ 不足 | 缺少：安全域层级通配匹配（`l1.*`）、Deadline 回调在正确线程上下文调用、Liveliness Alive→Suspect→Dead 状态转换、畸形标签拒绝 |
| **Config Barrier** | ~5 | ❌ 不足 | LockLevel 状态机（3级 × 每级2-3场景 = 6-9个测试），当前~5个不足。缺少：配置队列FIFO语义、并发配置请求、配置应用失败回滚 |
| **Scan Barrier** | ~4 | ❌ 不足 | 缺少：OUT Signal 原子发布、PLC扫描期间I/O映像一致性、周期中突变检测 |
| **线程调度** | ~5 | ⚠️ 可接受（Phase 1限逻辑层） | Phase 1 仅测试周期倍数约束逻辑，完整调度测试延后至 Phase 2——此决策合理 |

**总计**: ~65 个测试，实际需要约 **110-130 个** 才能覆盖所有原语和边界条件。

### 1.2 未覆盖的设计文档

以下 `docs/modules/hal/` 子文档中的测试场景未纳入计划：

| 文档 | 缺失的测试场景 |
|------|-------------|
| `amw-middleware-design.md` | HalTransport mock 实现测试、HalDiscovery 注册/查找测试（当前计划将 Signal/StreamChannel/RPC 标记为 "需 HalTransport trait mock" 但未规划 mock 实现的测试） |
| `functional-safety-design.md` | 安全完整性等级验证测试（Phase 2+ 合理延后，但应标注） |
| `io-mapping-design.md` | I/O 映射配置解析、Modbus 地址→Signal 绑定验证 |
| `rt-memory-and-scheduling.md` | 共享内存布局测试、无锁数据结构测试 |
| `multi-language-strategy.md` | FlatBuffers schema 跨语言兼容性测试（M1要求但未规划） |

---

## 2. AAA 模式完整性

### 2.1 现有 AAA 示例

计划提供 **1 个完整的 AAA 示例**（`bool_roundtrip_preserves_value`），结构正确：

```rust
// Arrange → Act → Assert
let original = Bool(true);
let serialized = FlatBuffersSerde::serialize(&original);
let deserialized: Bool = FlatBuffersSerde::deserialize(&serialized);
assert_eq!(original, deserialized);
```

### 2.2 缺口

| 问题 | 影响 |
|------|------|
| 仅有 1 个 AAA 示例，其他测试仅列函数签名 | 开发者对复杂场景（状态机、异步、mock）缺少 AAA 模式参考 |
| 无 mock-dependent 测试的 AAA 指南 | Priority B 测试（Signal/StreamChannel/RPC）全部依赖 HalTransport mock，计划未说明 mock 的 Arrange 模式 |
| 无状态机测试的 AAA 指南 | Config Barrier（3 LockLevels + 队列）和 Scan Barrier 是状态机，Act 阶段需多步操作，未说明如何组织 |
| 无参数化测试的 AAA 指南 | `all_scalars_roundtrip_identity` 提到 "parameterized test over 11 types" 但 Rust 标准测试框架无原生参数化支持——需指定实现方式（`#[test_case]` macro 或表驱动） |

**建议**: 为每个优先级类别提供至少一个完整的 AAA 示例（纯逻辑、mock-dependent、状态机各一）。

---

## 3. 覆盖率目标评估

### 3.1 目标冲突

存在 **三处矛盾**：

| 来源 | 声明的覆盖率目标 | 上下文 |
|------|-----------------|--------|
| `.agents/rules/common/testing.md` | **80% 最低测试覆盖率** | 规则层面，无条件约束 |
| `p0-sdd-tdd-ludwig.md` §6 | "优先级 A 测试（~26 个）至少 80% GREEN（非 `todo!()`）" | 指 80% 测试通过，**非代码覆盖率** |
| `p0-milestone-roadmap.md` M1 | "FlatBuffers 序列化/反序列化单测 ≥ 80% 覆盖" | 范围仅限于 FlatBuffers 序列化 |
| `decisions.md` D30 | "Phase 1 不要求 80% 覆盖率（代码驱动阶段再要求）" | 决策层面，明确豁免 |

**结论**: D30 的 "Phase 1 豁免 80% 覆盖率" 与 testing.md 的强制 80% 规则矛盾。TDD 计划应明确：Phase 1 以测试通过率为质量标准，代码覆盖率目标延后至代码稳定后（D30一致）。规则文件需同步修订。

### 3.2 ~65 个测试能否达到 80% 代码覆盖率？

**不能。** 粗略估算：

- 14 种类型 + FlatBuffers 序列化 ≈ 500-800 LOC
- Signal/StreamChannel/RPC trait 定义 + 文档 ≈ 400-600 LOC
- HalQoS trait + 位掩码展开 ≈ 200-300 LOC
- Config Barrier 状态机 ≈ 200-300 LOC
- 线程调度逻辑 ≈ 150-250 LOC

估计总代码量 ~1,500-2,200 LOC。65 个单元测试覆盖此规模代码库，典型覆盖率约 45-60%（取决于分支密度）。要达到 80% 需约 110-150 个测试。

---

## 4. 测试优先级排序

### 4.1 排序正确性

优先级 A → B → C 的分层是**正确的**：

- ✅ 类型系统（纯逻辑，独立可测）→ 正确首选项
- ✅ HalQoS 标签匹配/位掩码展开（纯逻辑）→ 正确置于 A
- ✅ Config Barrier 状态机（纯逻辑）→ 正确置于 A
- ✅ Signal/StreamChannel/RPC 需 HalTransport mock → 正确置于 B
- ✅ Scan Barrier + 线程调度完整测试需 RT 上下文 → 正确置于 C

### 4.2 隐藏依赖

| 优先级 | 声称依赖 | 实际隐藏依赖 |
|:------:|---------|------------|
| A | 无 | HalQoS trait 定义需在 M1 完成（属于 amw triplet），测试需 `HalQoS` trait 存在才能编译 |
| A | 无 | 类型系统测试需 `FlatBuffersSerde::serialize/deserialize` ——此结构在 `audesys-hal-flatbuffers` crate 中，而该 crate 依赖 hal-core 的类型定义 |
| B | HalTransport trait | HalTransport + HalDiscovery + HalQoS 是 amw triplet ——三者需同时定义（都在 M1），但 M2 才实现 Signal。B 级测试可在 M1 后立即开始 |

### 4.3 优先级内部排序缺失

计划未指定优先级 A 内部 26 个测试的执行顺序。建议：

1. 类型标量往返（11 个，最简）
2. String/Blob/Array 复杂类型（4 个，依赖标量基础）
3. HalQoS 标签匹配（3 个，纯字符串逻辑）
4. HalQoS 位掩码展开（3 个，纯位运算）
5. Config Barrier 状态机（5 个，最复杂）

---

## 5. 依赖顺序问题

### 5.1 CI/TDD 启动顺序，✅ 正确

```
M0 Phase 0:  Cargo workspace + CI/CD + 测试目录骨架  (0.3: TDD 启动)
     ↓
M1 Phase 1:  类型系统 + FlatBuffers schema + 首批测试
```

M0 在 TDD 之前搭建基础设施——正确。

### 5.2 TDD RED 阶段的编译依赖

TDD 计划说 "Step 2: RED — 所有测试 `todo!()` 桩"，Step 3 说 "cargo test → RED (todo!() panics)"。

**实际执行中的问题**：`todo!()` 宏使测试 panic，但测试文件还需要**编译通过**才能运行。例如 `bool_roundtrip_preserves_value` 测试引用了 `Bool`、`FlatBuffersSerde`——这些类型在 M0 不存在。

**解决方案**（计划未提及）：需要在 M0 或 M1 初期创建类型和 trait 的**最小编译桩**（空 struct/enum + 占位 impl），使测试文件可编译。这是标准的 TDD 实践但计划未明确说明。

### 5.3 文档引用路径过期

TDD 计划的测试追溯注释使用 `来源: docs/hal-detailed-design.md §N`，但该文件已于 2026-07-15 拆分为 18 份子文档。计划附录已提供映射表，但 **所有测试示例中的来源注释仍指向旧路径**。

### 5.4 `specs/` 目录未落实

Phase 0 计划提到 `specs/` 目录用于 "直接 TDD 测试场景提取"，但 TDD 计划中测试文件直接放 `crates/audesys-hal-core/tests/`。两者关系未说明。

---

## 6. 缺口汇总

### CRITICAL（阻塞性）

| # | 缺口 | 影响 | 建议 |
|---|------|------|------|
| C1 | StreamChannel 测试数量不足：10个测试无法覆盖 3种 QueuePolicy × 多场景 | M3 验收标准 "10MB/s 无丢帧" 需要 QueuePolicy 正确实现，当前测试规划无法保证 | 将 StreamChannel 测试拆分为 ~18 个（3种策略 × 6场景） |
| C2 | RPC 超时/幂等性测试缺失 | M4 验收标准明确要求 "含超时恢复"，但 TDD 计划未列入 | 增加 4 个 RPC 测试：超时触发、幂等键去重、并发请求、错误响应 |
| C3 | 覆盖率定义不明确：80% GREEN ≠ 80% 代码覆盖率 | 验收标准模糊，CI 门禁无法客观判定 | 明确 Phase 1 以测试通过率（非代码覆盖率）为门禁，与 D30 对齐；同步修订 testing.md 规则 |

### HIGH（高风险）

| # | 缺口 | 影响 | 建议 |
|---|------|------|------|
| H1 | Config Barrier 测试不足以覆盖 3 级 LockLevel 状态机 | 配置安全是 RT 系统核心保障，LockLevel 错误可能导致运行时崩溃 | 增加至 8-10 个测试，覆盖每级转换 + 拒绝 + FIFO队列 |
| H2 | HalQoS 测试缺少通配匹配和状态转换 | 安全域隔离是 IEC 62443 合规基础 | 增加：`l1.*` 通配匹配、Liveliness 状态转换、畸形标签拒绝 |
| H3 | 无 mock-dependent 测试的 AAA 模式指南 | Priority B 全部 30 个测试依赖 mock，缺少指导将导致实现不一致 | 为 mock-based 测试提供完整的 Arrange-Mock-Act-Assert-Verify 示例 |
| H4 | TDD 计划的 RED 阶段忽略编译依赖 | 类型/trait 不存在时测试文件无法编译，`todo!()` 不可达 | 明确说明 M1 初期需创建类型/trait 的最小编译桩 |

### MEDIUM（应修复）

| # | 缺口 | 影响 | 建议 |
|---|------|------|------|
| M1 | 5 份 HAL 设计文档的测试场景未纳入计划 | `amw-middleware-design.md`、`io-mapping-design.md`、`rt-memory-and-scheduling.md`、`functional-safety-design.md`、`multi-language-strategy.md` | 标注这些文档的测试阶段归属（Phase 1/2/3） |
| M2 | 文档路径过期：`hal-detailed-design.md §N` 应改为子文档引用 | 追溯注释指向已不存在的文件 | grep 所有测试文件中的旧路径并替换为 `docs/modules/hal/<子文档>.md §N` |
| M3 | 缺少参数化测试的实现指导 | `all_scalars_roundtrip_identity` 需要 11 种类型的参数化测试 | 指定使用 `rstest` crate 或表驱动模式 |
| M4 | `specs/` 目录与 `crates/audesys-hal-core/tests/` 关系未定义 | Phase 0 和 TDD 计划使用不同目录结构 | 统一：`specs/` 为测试场景提取工作目录（可 gitignore），`tests/` 为正式测试代码 |

### LOW（改进建议）

| # | 缺口 | 影响 | 建议 |
|---|------|------|------|
| L1 | 优先级 A 内部无执行顺序指导 | 开发者可能从复杂的 Config Barrier 开始，延迟快速反馈循环 | 建议顺序：标量类型 → 复杂类型 → HalQoS 标签 → HalQoS 位掩码 → Config Barrier |
| L2 | 未提及 property-based testing（D30 提及 proptest） | 类型系统往返测试非常适合 proptest，手工边界枚举易遗漏 | Phase 1 中期引入 `proptest` 用于类型系统测试（D30 qa-full 门禁要求） |
| L3 | 测试命名仅覆盖 "成功路径" | 错误路径测试（无效输入、超时、格式错误）未在命名中体现 | 增加 `_error` / `_rejects` / `_timeout` 后缀的测试命名约定 |
| L4 | M0 的健康检查测试 (`health.rs`) 仅做编译链接验证 | `flatc_is_available` 依赖外部命令，CI 环境可能未安装 | 将 flatc 检查移到 CI setup 步骤，测试中仅验证编译链接 |

---

## 7. 裁决

**TDD 就绪度: ⚠️ 条件就绪**

计划基本方向正确（直接 TDD 优于 Ludwig），优先级分层合理，AAA 模式有示范。但存在 3 个 CRITICAL 缺口（StreamChannel/RPC 测试不足、覆盖率定义模糊）和 4 个 HIGH 缺口（Config Barrier/HalQoS/mock 指南/编译依赖）需要在上游修复后再启动 TDD。

**建议**: 
1. 修复 C1-C3（测试数量补充 + 覆盖率定义明确）
2. 修复 H1-H4（状态机测试 + mock 指南 + 编译桩说明）
3. 修订 `.agents/rules/common/testing.md` 第 1 行：在 Phase 1 期间将 80% 覆盖率要求标记为 "Phase 2+ 适用（D30）"

预计修复工作量：**0.5 天**（文档修订 + 测试场景补充）。
