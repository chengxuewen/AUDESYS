# P1 测试策略优化方案

> 创建日期：2026-07-21
> 关联文档：`docs/plans/p1-unified-plan.md`
> 状态：待审核

---

## 0. 问题诊断

### 0.1 审计发现的 7 项缺口

| # | 问题 | 严重性 | 根因 |
|---|------|:---:|------|
| 1 | Phase 2a/2b/3 零内联测试任务 | 🔴 | 所有测试集中到 Phase 4（50-70 天后才首次验证） |
| 2 | SDD 186 项规范零测试追溯 | 🔴 | 规范 ID（HMI-VAL-001 等）未映射到任何 #[test] |
| 3 | Playwright E2E 不在 CI 门禁 | 🔴 | qa-fast 和 qa-full 均不包含 playwright test |
| 4 | 无 Smoke 快速冒烟门禁 | 🔴 | PR 合并前无 2 分钟内可跑的冒烟检查 |
| 5 | 出口条件不可量化 | 🟠 | "LD 编辑器端到端可用"无法自动化判断 |
| 6 | qa-deep.sh 脚本不存在 | 🟠 | 附录 C 引用 `scripts/qa/qa-deep.sh` 但文件从未创建 |
| 7 | AI 生成代码无 QA gate | 🟡 | 无强制性 AI 代码审查或测试验证步骤 |

### 0.2 当前测试金字塔（倒置）

```
        ┌──────────┐
        │  E2E 15  │  ← Playwright（不在 CI）
        ├──────────┤
        │  Integ 0 │  ← 缺失层
        ├──────────┤
        │  Unit 754│  ← Rust 737 + vitest 17
        └──────────┘
        ────────────
        Smoke 1     ← 仅 1 个文件，不是门禁
```

---

## 1. 优化架构

### 1.1 目标金字塔

```
        ┌──────────┐
        │  E2E 15+ │  ← Phase 4 增量，纳入 qa-full
        ├──────────┤
        │ Accept N │  ← 可量化验收 checklists（每 Phase）
        ├──────────┤
        │  Integ N │  ← napi-rs + GLSP + IPC 跨模块
        ├──────────┤
        │  Unit N  │  ← 每任务产出即时单元测试
        └──────────┘
        ────────────
        Smoke 10   ← 2 分钟冒烟，纳入 qa-fast
```

### 1.2 四层门禁模型

```
git push
  │
  ├─→ [SMOKE] 必须先通过（2min / PR）
  │     ├─ Rust: cargo test --workspace -- --test-threads=4 关键模块
  │     ├─ Frontend: vitest run --reporter=dot（关键组件）
  │     └─ CLI: napi-rs smoke（compile_st 空程序→HalProgram 非空）
  │
  ├─→ [qa-fast] 每 commit（5min）
  │     ├─ cargo test --workspace（全量）
  │     ├─ cargo clippy + fmt + deny
  │     └─ unwrap-budget
  │
  ├─→ [qa-full] 每 PR（15min）
  │     ├─ qa-fast + cargo bench + llvm-cov + vitest + playwright
  │     └─ SDD→test 追溯矩阵验证（新增）
  │
  └─→ [qa-deep] Release 前（60min）
        ├─ Miri UB + loom concurrency + mutation testing
        └─ 仅运行一次，不做 PR 门禁
```

---

## 2. 每 Phase 内联测试任务

### 2.1 Phase 1 新增任务

| 新增任务ID | 任务 | 产出 | 估时 | 依赖 | 关联 SDD |
|------------|------|------|:---:|------|----------|
| **T1.1t** | Theia 启动 Smoke 测试 | `apps/studio-theia/smoke/startup.spec.ts`：骨架启动→窗口出现→Console 无错误 | 0.5 天 | T1.1 | — |
| **T1.2t** | napi-rs 单元测试 | 每函数 2+ 用例（正常+错误路径），参考 STH-BRIDGE 规范 | 2 天 | T1.2 | STH-BRIDGE-001~010 |
| **T1.3t** | worker_thread 集成测试 | 并行调用 5 个 napi-rs 函数验证无阻塞 | 1 天 | T1.3 | STH-BRIDGE-008 |
| **T1.4t** | Backend RBAC 测试 | 6 角色各 1 用例（允许+拒绝），JSON-RPC schema 验证 | 1 天 | T1.4 | STH-BACKEND-001~010 |

**总增量**：+4.5 天（Phase 1 从 4-5 周 → 5-6 周）

### 2.2 Phase 2a 新增任务

| 新增任务ID | 任务 | 产出 | 估时 | 依赖 | 关联 SDD |
|------------|------|------|:---:|------|----------|
| **T2a.1t** | LD GModel 单元测试 | GModel 类型序列化/反序列化、属性验证 | 0.5 天 | T2a.1 | STH-GLSP-001~003 |
| **T2a.2t** | LD GLSP Server 测试 | 15 种操作各 1 用例（编辑→GModel 输出验证） | 2 天 | T2a.2 | STH-GLSP-004~010 |
| **T2a.3t** | LD 编辑器 Smoke 集成测试 | 端到端：打开 LD 编辑器→添加 contact→添加 coil→连线→编译→HalProgram 非空 | 1 天 | T2a.2+T2a.3 | STH-GLSP-ALL |
| **T2a.4t** | 布局引擎测试 | Rust 侧：自动路由测试（连线不穿越、rung 编号正确） | 1 天 | T2a.4 | STH-GLSP-005 |
| **T2a.5t** | IEC 语义测试 | power flow 方向、EN/ENO 引脚、rung 求值顺序 | 1 天 | T2a.6 | STH-GLSP-007~008 |

**总增量**：+5.5 天（Phase 2a 从 6-10 周 → 7-11 周）

### 2.3 Phase 2b 新增任务

| 新增任务ID | 任务 | 产出 | 估时 | 依赖 | 关联 SDD |
|------------|------|------|:---:|------|----------|
| **T2b.1t** | FBD GModel 测试 | 5 种节点类型序列化/反序列化 + Pin 类型验证 | 0.5 天 | T2b.1 | STH-GLSP-001~003 |
| **T2b.2t** | FBD GLSP Server 测试 | 复用 LD 测试框架，CreateFB/ConnectPin 特定测试 | 1.5 天 | T2b.2 | STH-GLSP-004~010 |
| **T2b.3t** | ST Monaco 诊断测试 | Rust 编译器错误→Monaco marker 映射验证（每种错误类型 1 用例） | 1 天 | T2b.4 | STH-MONACO-001~005 |
| **T2b.4t** | SFC 结构化文本编译测试 | Step/Transition/SelectionBranch→HalProgram 输出验证 | 0.5 天 | T2b.7 | — |
| **T2b.5t** | 6 语言编译管线回归 | 每语言 1 个最小程序编译→HalProgram 验证（覆盖 STH-BRIDGE 全链路） | 1 天 | T2b.4-T2b.6 | STH-BRIDGE-001~003 |

**总增量**：+4.5 天（Phase 2b 从 6-8 周 → 7-9 周）

### 2.4 Phase 3 新增任务

| 新增任务ID | 任务 | 产出 | 估时 | 依赖 | 关联 SDD |
|------------|------|------|:---:|------|----------|
| **T3.1t** | Signal Browser 测试 | TreeView 节点渲染、信号值刷新、napi-rs 数据通路 | 0.5 天 | T3.1 | STH-BRIDGE-004 |
| **T3.2t** | Scope View Canvas 测试 | 多通道渲染、时间窗口滚动、缩放边界 | 0.5 天 | T3.2 | — |
| **T3.3t** | Debug Panel GLSP 测试 | 断点设置/命中/步进/变量查看（复用 DAP 12 命令） | 1 天 | T3.3 | — |
| **T3.5t** | HMI Designer ReactWidget 测试 | widget 渲染、拖拽坐标、信号绑定、YAML 往返 | 1 天 | T3.5 | HMI-VAL-001~008 |

**总增量**：+3 天（Phase 3 从 3-4 周 → 4-5 周）

### 2.5 任务数对比

| Phase | 原任务数 | 新增测试 | 总任务数 | 时间增量 |
|-------|:---:|:---:|:---:|:---:|
| Phase 1 | 7 | +4 | 11 | +4.5 天 |
| Phase 2a | 8 | +5 | 13 | +5.5 天 |
| Phase 2b | 7 | +5 | 12 | +4.5 天 |
| Phase 3 | 7 | +4 | 11 | +3 天 |
| Phase 4 | 7 | 0（已有） | 7 | 0 |
| **总计** | **36** | **+18** | **54** | **+3.5 周（25→28.5 周）** |

---

## 3. Smoke 测试套件

### 3.1 定义

Smoke 测试是 **2 分钟内可运行的快速冒烟门禁**，合并到 qa-fast.sh 的第一步。如果 Smoke 失败，CI 立即中止（不执行后续 test/clippy/fmt）。

### 3.2 冒烟测试清单

| ID | 测试 | 覆盖层 | 预期耗时 | 失败含义 |
|----|------|--------|:---:|------|
| S1 | Rust 核心 crate 快速测试 | `--test-threads=4` 仅 hal-core+hal-vm+runtime-engine+ipc-server | ~30s | Rust 核心编译或逻辑损坏 |
| S2 | napi-rs 关键函数冒烟 | compile_st("PROGRAM main END_PROGRAM") → HalProgram 非空 | ~5s | napi-rs 桥接断裂 |
| S3 | Theia 启动不崩溃 | Playwright: 打开 Theia → 等待 Shell 渲染 → 无 console.error | ~15s | Theia 骨架损坏 |
| S4 | vitest 关键组件 | vitest run --reporter=dot 仅 Studio 核心组件 | ~15s | 前端关键组件损坏 |
| S5 | CI 配置自检 | yamllint .github/workflows/*.yml + pixi.toml 格式验证 | ~5s | CI 配置语法错误 |
| S6 | Rust 编译检查 | cargo check --workspace（不跑 test，仅编译） | ~40s | Rust 编译错误（比 test 更快发现语法问题） |
| S7 | FlatBuffers schema 验证 | flatc --strict-json 检查所有 .fbs | ~5s | Schema 语法错误 |
| S8 | cargo deny security | cargo deny check advisories（仅 security，跳过 licenses） | ~5s | 已知 CVE 依赖引入 |

**总计：~120 秒**

### 3.3 实现

创建 `scripts/qa/smoke.sh`：

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
cd "$SCRIPT_DIR/../.."

echo "=== AUDESYS smoke ==="

# S1: Rust core fast tests
echo "[S1] cargo test core crates"
cargo test -p audesys-hal-core -p audesys-hal-vm -p audesys-runtime-engine -p audesys-ipc-server -- --test-threads=4 -q

# S2: napi-rs smoke (Phase 1 完成后激活)
# echo "[S2] napi-rs compile_st smoke" ...

# S3: Theia startup (Phase 1 完成后激活)
# echo "[S3] Theia startup smoke" ...

# S6: Rust compile check
echo "[S6] cargo check --workspace -q"
cargo check --workspace -q 2>&1

# S8: Security advisories
echo "[S8] cargo deny check advisories"
cargo deny check advisories 2>&1 || true  # non-blocking

echo "=== smoke PASSED ==="
```

qa-fast.sh 新增第一步：

```bash
echo "[0/5] smoke"
bash scripts/qa/smoke.sh || exit 1
```

---

## 4. SDD→测试追溯矩阵

### 4.1 当前状态

| 规范文件 | 项数 | 已追溯测试 | 覆盖率 |
|----------|:---:|:---:|:---:|
| `studio-theia-spec.md` | 50 | 0 | 0% |
| `hmi-spec.md` | 24 | 0 | 0% |
| `hal-type-system-spec.md` | 30 | 0 | 0% |
| `hal-protocol-spec.md` | 37 | 0 | 0% |
| `hal-qos-spec.md` | 30 | 0 | 0% |
| `config-barrier-spec.md` | 24 | 0 | 0% |
| `cnc-spec.md` | 41 | 0 | 0% |
| **合计** | **236** | **0** | **0%** |

### 4.2 追溯格式

每项 SDD 规范扩展为：

```markdown
### HMI-VAL-001: Widget 数量上限
- **前置条件**: HmiLayout 包含 >50 个 widget
- **操作**: 调用 validateHmiLayout(layout)
- **期望**: 返回 ValidationError { code: "TOO_MANY_WIDGETS", limit: 50 }
- **测试**: `apps/studio/src/__tests__/hmi-validator.test.ts::rejects_layout_with_51_widgets`
- **覆盖率**: ✅ 已覆盖
```

### 4.3 验证脚本

创建 `scripts/qa/verify-sdd-trace.sh`，在 qa-full.sh 中执行：

```bash
# 检查每个 SDD ID 在代码中是否被引用
for spec in openspec/specs/*.md; do
  ids=$(grep -oP '^\*\*[A-Z]+-\d+\*\*' "$spec" | sed 's/\*\*//g')
  for id in $ids; do
    if ! grep -rq "$id" crates/ apps/ --include="*.rs" --include="*.ts" --include="*.tsx"; then
      echo "UNTRACED: $id in $spec"
    fi
  done
done
```

成功标准：qa-full 通过时，SDD 追溯覆盖率 ≥ 80%。

### 4.4 渐进式覆盖目标

| 里程碑 | 目标覆盖率 | 触发条件 |
|--------|:---:|------|
| P1 开始 | ≥ 60%（现有 HAL 规范） | 补充现有 737 测试的追溯注释 |
| Phase 1 完成 | ≥ 80% STH-BRIDGE + STH-BACKEND | 新增 napi-rs 测试关联 |
| Phase 2a 完成 | ≥ 80% STH-GLSP | LD 编辑器测试关联 |
| Phase 2b 完成 | ≥ 80% STH-MONACO + 全语言 | FBD+文本编辑器测试关联 |
| P1 完成 | ≥ 80% 全部 7 份规范 | 全量追溯 |

---

## 5. 可量化出口条件

### 5.1 当前 vs 优化后

| Phase | 当前出口条件 | 优化后出口条件 |
|-------|-------------|---------------|
| **P1** | "napi-rs 5 核心函数通过 Rust 测试" | ① napi-rs 单元测试 10+ 通过（绿） ② 现有 737 Rust 测试零回归 ③ Theia 启动 Smoke 通过 |
| **P2a** | "ST Monaco 编辑器 + 编译管线可用" | ① LD GLSP 单元测试 15+ 通过 ② LD Smoke 集成测试通过（contact→coil→编译→非空 HalProgram） ③ napi-rs 延迟 ≤ 2× 基线 ④ 回归测试零失败 |
| **P2b** | "LD/FBD GLSP 编辑器可用 + 全 6 语言" | ① FBD GLSP 单元测试 12+ 通过 ② 6 语言编译管线回归 6/6 通过 ③ STH-MONACO 诊断映射 5/5 通过 ④ 回归测试零失败 |
| **P3** | "所有面板 + Debug 可用，E2E 15+ 通过" | ① 所有面板单元测试 12+ 通过 ② Debug 面板 12 命令全通过 ③ HMI VAL 8/8 通过 ④ Playwright E2E 15+ 通过（含新增 Theia E2E） |
| **P4** | "126+ 测试通过，Electron 打包可用" | ① 全量 150+ 测试通过（含新增 18 测试任务产出） ② Playwright E2E 20+ 通过（含 Theia 新增 5 场景） ③ SDD 追溯覆盖率 ≥ 80% ④ napi-rs ≤ 2× 基线 ⑤ Electron ≤ 250MB ⑥ Electron 三平台 Smoke 通过 |

### 5.2 门禁自动化程度

| 门禁 | Phase 1 | Phase 2a | Phase 2b | Phase 3 | Phase 4 |
|------|:---:|:---:|:---:|:---:|:---:|
| 单元测试数 | 10+ | 15+ | 12+ | 12+ | 150+ |
| Smoke 通过 | ✅ CI | ✅ CI | ✅ CI | ✅ CI | ✅ CI |
| E2E 通过 | — | — | — | 15+ CI | 20+ CI |
| SDD 追溯 | 80% CI | 80% CI | 80% CI | 80% CI | 80% CI |
| 性能基线 | — | ✅ CI | ✅ CI | ✅ CI | ✅ CI |
| Stakeholder 签收 | — | — | — | — | ✅ 手动 |

---

## 6. AI 代码验证策略

### 6.1 问题

AI 生成的 GLSP/FBD/LD/Monaco 编辑器代码质量不可预测。Phase 2a 的 5000-9000 行 GLSP 代码如果 50 天后才验证，bug 修复成本极高。

### 6.2 三层 AI 代码验证

```
AI 生成 PR
  │
  ├─→ [L1] 自动门禁（每 PR 强制）
  │     ├─ Rust: cargo test -p <crate> + clippy + fmt
  │     ├─ TypeScript: vitest + eslint + prettier
  │     └─ Smoke: bash scripts/qa/smoke.sh
  │
  ├─→ [L2] AI 代码审查（可选，复杂模块）
  │     ├─ review-work 技能启动 5 路并行审查
  │     └─ 仅当 PR 包含 GLSP GModel / IPC 协议 / 安全代码时触发
  │
  └─→ [L3] 人工审查（Phase 出口）
        ├─ 每 Phase 完成后 Stakeholder review（T4.7 模式）
        └─ 不阻塞 PR 合并，但阻塞 Phase 出口
```

### 6.3 代码审查触发规则

在 CI 中增加 `scripts/qa/ai-code-check.sh`：

```bash
# 检查 PR diff 是否包含 AI 高风险区域
if git diff origin/main...HEAD --name-only | grep -qE \
  'crates/audesys-theia-bridge|apps/studio-theia.*glsp|apps/studio-theia.*ipc'; then
  echo "⚠️ AI 高风险区域变更 — 建议触发 review-work"
fi
```

### 6.4 "禁止 AI 测试绕过"规则

新增到 `.agents/rules/common/testing.md`：

> AI 代理生成的代码必须在同一 PR 内包含对应测试。Phase 2a-3 每个开发任务完成后，对应测试任务（T*x*.t）必须同时完成。不允许 "先实现后补测试"。

---

## 7. 实施计划

### 7.1 立即执行（0 依赖）

| 任务 | 产出 | 估时 |
|------|------|:---:|
| 创建 Smoke 脚本 | `scripts/qa/smoke.sh` | 0.5 天 |
| 修改 qa-fast.sh（加入 Smoke 第一步） | `scripts/qa-fast.sh` 增加 Step 0 | 0.1 天 |
| 创建 SDD 验证脚本 | `scripts/qa/verify-sdd-trace.sh` | 0.5 天 |
| 修改 qa-full.sh（加入 SDD 追溯验证 + Playwright） | `scripts/qa-full.sh` 增加 Playwright + SDD trace | 0.2 天 |
| 创建 qa-deep.sh | `scripts/qa-deep.sh`（Miri + loom + mutation） | 0.5 天 |
| 为现有 737 测试添加 SDD 追溯注释 | 批量 `// SDD: S-SIG-001` 注释 | 1 天 |

### 7.2 与 P1 计划同步执行

| 任务 | 嵌入位置 | 估时 |
|------|---------|:---:|
| T1.1t~T1.4t（Phase 1 测试） | 插入 p1-unified-plan.md Phase 1 表格 | 纳入 Phase 1 4.5 天增量 |
| T2a.1t~T2a.5t（Phase 2a 测试） | 插入 p1-unified-plan.md Phase 2a 表格 | 纳入 Phase 2a 5.5 天增量 |
| T2b.1t~T2b.5t（Phase 2b 测试） | 插入 p1-unified-plan.md Phase 2b 表格 | 纳入 Phase 2b 4.5 天增量 |
| T3.1t~T3.5t（Phase 3 测试） | 插入 p1-unified-plan.md Phase 3 表格 | 纳入 Phase 3 3 天增量 |

### 7.3 文件变更清单

| 文件 | 操作 | 说明 |
|------|:--:|------|
| `scripts/qa/smoke.sh` | 新建 | 8 项 Smoke 测试（~120s） |
| `scripts/qa/verify-sdd-trace.sh` | 新建 | SDD 追溯覆盖率检查 |
| `scripts/qa-fast.sh` | 修改 | 新增 Step 0 Smoke |
| `scripts/qa-full.sh` | 修改 | 新增 Playwright + SDD trace |
| `scripts/qa-deep.sh` | 新建 | Miri + loom + mutation |
| `docs/plans/p1-unified-plan.md` | 修改 | 各 Phase 新增测试任务 |
| `.agents/rules/common/testing.md` | 修改 | 新增 AI 代码验证规则 |
| 现有测试文件 | 修改 | 添加 SDD 追溯注释（`// SDD: XXX-001`） |

---

## 8. 决策记录

| 编号 | 决定 | 理由 |
|:---:|------|------|
| D72 | Smoke 作为 qa-fast Step 0，2 分钟超时 | 快速反馈 + 阻止明显损坏进入 test 阶段 |
| D73 | SDD 追溯覆盖率 ≥ 80% 作为 Phase 出口条件 | 186→236 项规范必须可验证，免除"通过感觉判断" |
| D74 | 每 Phase 新增 4-5 个内联测试任务 | 50 天后才验证的成本远超 3-5.5 天增量的投入 |
| D75 | AI 生成代码必须同 PR 含测试 | 防止"先实现后补测试"的债务累积 |
| D76 | Phase 出口条件全部可自动化验证（除 P4 签收） | 消除"可用"的歧义，CI 判断替代人工判断 |
