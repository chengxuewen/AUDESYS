# P1 执行细化 — AI Agent 可执行子步骤

> 关联文档：`docs/plans/p1-unified-plan.md`
> 创建日期：2026-07-21
> 由 plan-surgery 团队（5 路 ultrabrain 并行）产出

本文档为 `p1-unified-plan.md` 中 54 个任务提供 AI Agent 可执行的子步骤。每个任务包含：Goal（目标）、Input Files（输入文件）、Execution Steps（执行步骤）、Output Files（产出文件）、Acceptance Criteria（验收标准）。直接交给 `deep` 或 `unspecified-high` agent 执行。

---

## Phase 1: 基础设施（11 任务）

### T1.1: Theia 应用骨架搭建（3 天）

- **Goal**: 创建可启动的 Eclipse Theia 应用骨架，含 Electron 安全配置
- **Input**:
  - `docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md` §1 架构概览、§11.1
  - `openspec/specs/studio-theia-spec.md` STH-BUILD (044, 046, 049)
- **Steps**:
  1. 用 `@theia/cli` generator 初始化 `apps/studio-theia/`
  2. 配置 `electron-builder.yml`（targets=dmg/nsis/AppImage）
  3. `electron-main.js` 设 contextIsolation:true, nodeIntegration:false, sandbox:true, webSecurity:true
  4. 创建 `theia-extensions/audesys-core/` 空 extension 骨架
  5. 配置 package.json scripts：start/build/package
  6. 验证 `npm start` 启动成功，窗口显示 Theia workbench
- **Output**: `apps/studio-theia/` + `theia-extensions/audesys-core/`
- **Acceptance**: ① `npm start` 10s 内启动 ② workbench 可见 ③ `window.require` 为 undefined ④ `npm run build` 无 TS 错误 ⑤ 无 console.error
- **LOC**: 50-100 手写 + ~500 generator
- **Blockers**: 无 — 并行 T1.2、T1.6

### T1.2: napi-rs 绑定层（5 天）

- **Goal**: 创建 `crates/audesys-theia-bridge/`，25 个 napi-rs 函数桥接到 Rust 编译器/Runtime
- **Input**:
  - `apps/studio/src-tauri/src/lib.rs`（审计 34 个 Tauri 命令签名）
  - `openspec/specs/studio-theia-spec.md` STH-BRIDGE (001-010)
  - 现有 crate：`audesys-hal-binding-gen/`、`audesys-gecode-compiler/` 等公开 API
- **Steps**:
  1. `napi new` 创建 bridge crate
  2. 审计 34 Tauri 命令 → 确定 ~25 个 napi-rs 函数签名
  3. 实现核心 6 函数：compile_st, compile_il, read_signal, signal_snapshot, deploy_program, health_query
  4. 实现辅助 5 函数：compile_ld, compile_fbd, compile_sfc, compile_gcode, deploy_hmi_layout
  5. 每函数：解析 napi-rs 参数 → 调用现有 Rust crate → 序列化返回
  6. 配置三平台 `.node` 二进制构建
  7. 验证 737 Rust 测试零回归
- **Output**: `crates/audesys-theia-bridge/`（~500-1000 行 Rust）
- **Acceptance**: ① 6 核心函数编译通过 ② `compile_st('PROGRAM main END_PROGRAM')` 返回 HalProgram JSON ③ 737 测试零回归 ④ 三平台 .node 生成
- **LOC**: 500-1000 Rust
- **Blockers**: 无 — 并行 T1.1、T1.6

### T1.3: worker_thread 架构验证（1 周）

- **Goal**: 验证 napi-rs 在 worker_threads 池中不阻塞主事件循环
- **Steps**:
  1. 实现 Worker 线程管理（池大小默认 4）
  2. 并行调用 5 编译函数各 100 次 benchmark
  3. 验证主线程响应性：worker 运行期间 setInterval 偏差 <10ms
  4. 验证并发隔离：compile_st(10MB) + signal_snapshot() 互不阻塞
  5. 验证 AbortController 取消 Worker
  6. 验证 1000 次迭代无内存泄漏（heapUsed <50MB）
- **Output**: `crates/audesys-theia-bridge/test-worker/`（~280 行 JS）
- **Acceptance**: ① 5 并行编译 <30s ② 主线程偏差 <20ms ③ Abort 5s 内生效 ④ 无内存泄漏
- **Blockers**: T1.2

### T1.4: Theia Backend Service（3 天）

- **Goal**: JSON-RPC 代理桥接 napi-rs，含 JSON Schema 校验、RBAC 中间件、rate limiting、审计日志
- **Steps**:
  1. 创建 `theia-extensions/audesys-backend/`
  2. 实现 AudesysBackendService：require napi-rs → 包装为 async wrapper
  3. 实现 JSON-RPC 代理（ajv/zod Schema 校验）
  4. 实现 RBAC 中间件（复用 HMAC + 6 角色）
  5. 实现 rate limiting（compile_*=10/min, signal_read=1000/min）
  6. 实现审计日志（winston 结构化 JSON）
  7. 实现 session 管理（connect/heartbeat/disconnect/reconnect）
- **Output**: `theia-extensions/audesys-backend/`（~550 行 TS）
- **Acceptance**: ① compile_st with invalid role → -32000 ② 4 次/10s compile → rate limit ③ 审计日志有格式化记录 ④ source >1MB → schema 拒绝
- **Blockers**: T1.2 — 并行 T1.3

### T1.5: CI/CD 适配（3 天→2 周）

- **Goal**: 三平台 Electron 构建 + napi-rs 交叉编译，维持 Tauri CI 绿色（双轨）
- **Steps**:
  1. 创建 `scripts/qa-theia.sh`
  2. 修改 qa-fast.sh 追加 napi-rs check
  3. 创建 `.github/workflows/qa-theia.yml`（macOS+Ubuntu+Windows 矩阵）
  4. 添加 napi-rs 交叉编译 job + Electron 打包 job
  5. 配置 CI 缓存：.node 二进制 key=os+Cargo.lock hash
  6. 验证双轨：push 同时触发 qa-fast + qa-theia
- **Output**: `.github/workflows/qa-theia.yml` + `scripts/qa-theia.sh`
- **Acceptance**: ① macOS job 通过 ② 三平台 .node 上传 artifact ③ Tauri CI 仍绿 ④ DMG/NSIS/AppImage 生成
- **Blockers**: T1.1、T1.2 — 可并行 T1.6

### T1.6: Theia 学习 workshop（1 周）

- **Goal**: 团队掌握 inversify DI、Contribution 体系、GLSP 架构、Monaco 自定义
- **Steps**:
  1. Day 1-2: inversify DI 基础、ContainerModule/Bind
  2. Day 2-3: CommandContribution、MenuContribution、WidgetFactory
  3. Day 3-4: GLSP GModel→Operation→LayoutEngine 数据流（参考 Neuron 开源）
  4. Day 4-5: Monarch tokenizer 编写、CompletionItemProvider
  5. Day 5: 综合练习——创建自定义 "AUDESYS Config Editor" extension
- **Output**: `docs/plans/theia-workshop-notes.md`
- **Acceptance**: ① 能创建并激活 extension ② 能编写 ~100 行 Monarch tokenizer ③ 理解 GLSP 数据流 ④ 笔记记录 inversify 绑定规则
- **Blockers**: 无 — 完全并行

### T1.7: Open VSX 安全配置（2 天）

- **Goal**: 锁定 Plugin Host 安全——白名单空、沙箱隔离、FS 只读
- **Steps**:
  1. 配置 pluginWhitelist: []（Phase 1 零第三方）
  2. 禁用 Open VSX 在线安装（plugin.autoDownload: false）
  3. 配置 Plugin Host sandbox（子进程隔离）
  4. FS 限制：Plugin Host 工作目录只读
  5. 禁用子进程 nodeIntegration
  6. 审计日志 hook：PluginDeployer.onDidDeploy
  7. 删除 `@theia/vsx-registry` 扩展
- **Acceptance**: ① Plugin Host `require('fs')` → undefined ② Open VSX 查询返回空 ③ 无扩展安装事件
- **Blockers**: T1.1

### T1.1t: Theia 启动 Smoke 测试（0.5 天）

- **Goal**: Playwright 测试验证 Theia 启动成功
- **Steps**: 5 个 Playwright 测试：workbench 可见、Activity Bar 3+ 图标、Status Bar 渲染、Console 无 error、启动 <15s
- **Output**: `apps/studio-theia/e2e/smoke/startup.spec.ts`（~120 行）
- **Acceptance**: 5 测试全通过、60s 内完成、连续 3 次无 flaky
- **Blockers**: T1.1

### T1.2t: napi-rs 编译单元测试（2 天）

- **Goal**: 每函数 2+ 用例，覆盖 STH-BRIDGE 001-010
- **Steps**: 创建 10 个 vitest 文件（compile-st/il/ld/fbd/sfc/gcode + read-signal + signal-snapshot + deploy-program + health-query），每函数 happy+error 路径
- **Output**: `crates/audesys-theia-bridge/__tests__/`（10 文件，~340 行）
- **Acceptance**: 10+ test files、20+ test cases、全部通过、<30s
- **Blockers**: T1.2

### T1.3t: worker_thread 集成测试（1 天）

- **Goal**: 验证 worker_thread 池并行/隔离/取消/稳定性
- **Steps**: 4 个测试：并行编译、隔离（读不被编译阻塞）、取消、100 次稳定性
- **Output**: `crates/audesys-theia-bridge/__tests__/worker-thread-pool.test.ts`（~100 行）
- **Blockers**: T1.3

### T1.4t: Backend RBAC + Schema 测试（1 天）

- **Goal**: 验证 RBAC、Schema 校验、rate limiting、审计日志
- **Steps**: 4 个 vitest 文件：rbac（6 角色 allow+deny）、schema-validation（5 种错误）、rate-limiting（限制/恢复）、audit-log（记录验证）
- **Output**: `theia-extensions/audesys-backend/__tests__/`（~260 行）
- **Blockers**: T1.4

### Phase 1 并行策略

```
Week 1-2: T1.1 + T1.2 + T1.6 并行
Week 2-3: T1.1t + T1.5 + T1.7 ∥ T1.3 + T1.4（T1.1/T1.2 完成后）
Week 3-4: T1.3t + T1.4t ∥ T1.2t（T1.2/T1.3/T1.4 完成后）
Week 4-6: 全面验证 + 出口条件检查（5-6 周）
```

---

## Phase 2a: GLSP LD 编辑器（13 任务）

> 完整细化见：`.sisyphus/plans/p1-theia-migration/phase2a-task-refinement.md`（644 行）
> 核心路径：GModel 定义 → GLSP Server → Tool Palette → Layout Engine → Property View → IEC Semantics → GLSP Integration
> 回退方案：T2a.8 @xyflow/react fallback（GLSP >12 周时激活）

### T2a.1: LD GModel 定义（1-2 周）

- **Goal**: 定义 LD 梯形图 8-12 种图形类型的 GLSP GModel（ContactNode、CoilNode、PowerRail、WireConnection、Rung）
- **Output**: `theia-extensions/audesys-ld-glsp/src/gmodel/`（~800-1500 行 TS）
- **Key**: GModel JSON 序列化/反序列化往返验证
- **Blockers**: T1.1

### T2a.2: LD GLSP Server（2-3 周）

- **Goal**: 实现 ~15 种 GLSP 操作处理器（CreateContact、DeleteElement、ReconnectWire、MoveRung 等）
- **Architecture**: GLSP Server (Node.js) → napi-rs worker_thread → Rust Layout Engine → Rust LD Compiler
- **Output**: `theia-extensions/audesys-ld-glsp/src/server/`（~1200-2000 行 TS）
- **Blockers**: T2a.1

### T2a.3: LD Tool Palette（1 周）

- **Goal**: 左侧可拖拽工具箱（NO/NC contact、coil、FB placeholder、水平/垂直线 ~15 项）
- **Output**: `theia-extensions/audesys-ld-glsp/src/tool-palette/`（~400-600 行 TS）
- **Blockers**: T2a.1

### T2a.4: LD Layout Engine（1-2 周）

- **Goal**: Rust napi-rs 实现（power rails 对齐、rung 自动编号、连线自动路由）
- **7 个子函数**: layout_rungs、layout_contacts、layout_coils、route_wires、auto_number_rungs、validate_connectivity
- **Output**: `crates/audesys-ld-layout/`（~1000-2000 行 Rust）
- **Blockers**: T2a.1

### T2a.5: LD Property View（1 周）

- **Goal**: 变量名编辑器、注释、取反标志属性面板
- **Blockers**: T2a.2

### T2a.6: LD IEC 61131-3 Specifics（1 周）

- **Goal**: EN/ENO 引脚、power flow 语义（左→右）、rung 求值顺序
- **新建 crate**: `crates/audesys-ld-semantics/`
- **Blockers**: T2a.2

### T2a.7: Theia GLSP Integration（1 周）

- **Goal**: Diagram configuration、CSS 主题适配、toolbar 贡献点
- **Blockers**: T2a.2

### T2a.8: @xyflow/react Fallback（1-2 周）

- **Goal**: 备选方案——GLSP >12 周时将现有 xyflow LD 编辑器通过 ReactWidget 迁移到 Theia
- **Trigger**: Phase 2a 超过 12 周

### T2a.1t-T2a.5t: 测试任务（~5.5 天）

- T2a.1t: GModel 序列化往返测试（80 行，STH-GLSP-001~003）
- T2a.2t: 15 种操作各 1 用例（150 行，STH-GLSP-004~010）
- T2a.3t: LD 编辑器 Smoke 集成测试（打开→添加 contact→coil→连线→编译→HalProgram 非空）
- T2a.4t: 布局引擎 Rust 测试（连线不穿越、rung 编号正确）
- T2a.5t: IEC 语义测试（power flow 方向、EN/ENO 验证）

### Phase 2a 并行策略

```
3 人团队：
  Person A: T2a.1→T2a.2→T2a.5→T2a.6（GModel→Server→Property→IEC）
  Person B: T2a.3→T2a.7 ∥ T2a.4（Palette+Integration ∥ Layout Eng 独立）
  Person C: T2a.8（@xyflow/react fallback 探索 — 仅 1-2 周投入，成功则压缩 P2a）
压缩后：5-7 周（而非 7-11 周）
```

---

## Phase 2b: FBD + 文本编辑器（12 任务）

### T2b.1: FBD GModel 定义（1-2 周）

- **Goal**: 5 种布尔运算节点 + FunctionBlockNode + Pin 连接点（Input/Output/Bidi）
- **Output**: `theia-extensions/audesys-fbd-glsp/src/gmodel/`（800-1500 行 TS）
- **Blockers**: T2a.1（复用 LD GModel 模式）

### T2b.2: FBD GLSP Server（1-2 周）

- **Goal**: 复用 LD ~60% 代码，新增 CreateFB、ConnectPin（含方向/类型验证）、反馈回路检测
- **Output**: `theia-extensions/audesys-fbd-glsp/src/server/`（1200-2000 行，净增 500-800）
- **Blockers**: T2b.1 + T2a.2

### T2b.3: FBD Tool Palette（1 周）

- **Goal**: AND/OR/XOR/NOT/MUX + 比较器 + FB 实例库 ~12+ 项
- **可并行 T2b.2**

### T2b.4: ST Monaco Editor（1 周）

- **Goal**: Monarch tokenizer（40+ IEC 关键字、12+ 类型、注释/字符串/数字）+ completion + diagnostics + semantic tokens + folding + code actions + outline
- **Output**: `theia-extensions/audesys-st-editor/`（1450-2050 行 TS）
- **Blockers**: T1.2 — 可并行 T2b.5/T2b.6/T2b.7

### T2b.5: IL Monaco Editor（1 周）

- **Goal**: 自定义 tokenizer（累加器模型 + LD/CR 特殊语义）、31 指令高亮
- **Output**: `theia-extensions/audesys-il-editor/`（730-1050 行 TS）
- **Blockers**: T1.2 — 并行 T2b.4/T2b.6/T2b.7

### T2b.6: G-code Monaco Editor（0.5 周）

- **Goal**: Monarch tokenizer（62+ G-code/M-code、6 轴字母）
- **Output**: `theia-extensions/audesys-gcode-editor/`（400-600 行 TS）
- **Blockers**: T1.2 — 并行

### T2b.7: SFC Editor 文本模式（1 周）

- **Goal**: STEP/TRANSITION/ACTION/SELECTION/SIMULTANEOUS 关键字高亮，内嵌 ST 表达式，图形 SFC 延后 P2
- **Output**: `theia-extensions/audesys-sfc-editor/`（580-900 行 TS）
- **Blockers**: T1.2 — 并行

### T2b.1t-T2b.5t: 测试任务（~4.5 天）

- T2b.1t: FBD GModel 5 种节点往返测试
- T2b.2t: FBD Server 8 操作测试（含反馈回路检测）
- T2b.3t: ST 诊断映射测试（5 种错误类型→Monaco marker）
- T2b.4t: SFC 编译测试（Step→Transition→HalProgram）
- T2b.5t: 6 语言编译管线回归（ST/IL/LD/FBD/G-code/SFC）

### Phase 2b 并行策略

```
3 人团队：
  Person A: T2b.1→T2b.2→T2b.1t→T2b.2t（FBD GLSP 主路径）
  Person B: T2b.3 ∥ T2b.4 ∥ T2b.3t（Palette ∥ ST Monaco）
  Person C: T2b.5→T2b.6→T2b.7→T2b.4t→T2b.5t（IL/G-code/SFC + 测试）
压缩后：2-3 周（而非 7-9 周，因 4 Monaco 编辑器完全并行）
```

---

## Phase 3: 面板 + Shell（11 任务）

### T3.1: Signal Browser（3 天）

- **Goal**: 移植 SignalBrowserTool 到 Theia TreeView，复用 napi-rs signal_snapshot
- **Reuse**: 现有 118 行 SignalBrowserTool.tsx 的逻辑
- **Output**: `apps/studio-theia/src/browser/signal-browser/`（~300 行 TS）
- **Acceptance**: ① TreeView ≥50 信号无卡顿 ② pattern 过滤可用 ③ napi-rs 数据通路端到端
- **Blockers**: T1.2 — 并行 T3.3、T3.4

### T3.2: Scope View（5 天）

- **Goal**: Canvas 多通道实时示波器（≥30fps 4 通道），不含 ECharts 库
- **Output**: `apps/studio-theia/src/browser/scope-view/`（~600 行 TS）
- **Key**: requestAnimationFrame 渲染循环 + TimeSeriesBuffer 环形缓冲
- **Blockers**: T3.1（需要 Signal Browser 选通道）

### T3.3: Debug Panel（5 天）

- **Goal**: DAP 12 命令适配 Theia Debug API（TheiaDebugSession + DebugAdapterContribution）
- **Output**: `apps/studio-theia/src/browser/debug/`（~700 行 TS）
- **Acceptance**: ① 12 命令全功能 ② Monaco 断点→Controller 收到 ③ Variables 显示寄存器值
- **Blockers**: T1.2 — 并行 T3.1、T3.4

### T3.4: Project Tree（3 天）

- **Goal**: Theia File Explorer 扩展——IEC 61131-3 资源分组、自定义图标、右键编译/部署
- **Output**: `apps/studio-theia/src/browser/project-tree/`（~350 行 TS）
- **Blockers**: T1.1 — 并行 T3.1、T3.3

### T3.5: HMI Designer（2-4 周）— 关键路径

- **Goal**: react-rnd → Lumino ReactWidget 迁移，解决坐标/拖拽/Z-index/CSS 隔离冲突
- **Week 1**: Lumino coordinate system 冲突解决（自定义 HmiCanvasWidget、CSS containment）
- **Week 2**: 7 widget 组件迁移（仅改 useStudioHmiSignal → useTheiaHmiSignal）
- **Week 3-4**: WidgetPalette、PropertyPanel、Toolbar、SignalInjector、Theia 集成
- **Output**: `apps/studio-theia/src/browser/hmi-designer/`（~1800 行 TS）
- **Acceptance**: ① HMI-VAL 8/8 通过 ② 拖拽坐标精确 ③ YAML 往返完整 ④ Edit/Preview 模式切换
- **Blockers**: T1.1、T1.2 — 可并行 Phase 2b Monaco 编辑器

### T3.6: Mode 系统（3 天）

- **Goal**: ShellMode 注入 Theia 菜单/工具栏/Status Bar——Edit/Debug/Commissioning 三模式
- **Blockers**: 需等所有面板注册完成

### T3.7: inversify DI Wiring（贯穿 Phase 2-3）

- **Goal**: 所有编辑器/面板的 ContainerModule 注册（~1500-2000 行）
- **增量**: 每完成一个面板即添加其 DI block

### T3.1t-T3.5t: 测试任务（~3 天）

- T3.1t: Signal Browser 树模型+过滤测试（80 行）
- T3.2t: Canvas 渲染+缓冲测试（100 行）
- T3.3t: Debug 生命周期 6 测试（150 行）
- T3.5t: HMI VAL 8/8 + 拖拽坐标 + YAML 往返（200 行）

### Phase 3 并行策略

```
3 人团队：
  Person A: T3.5（HMI Designer，2-4 周 — 关键路径）
  Person B: T3.1→T3.2（Signal→Scope，8 天）
  Person C: T3.3→T3.4（Debug+Project，8 天）
最后 5 天: T3.6 + T3.7 收尾
总工: 4-5 周
```

---

## Phase 4: 测试 + 打包（7 任务）

### T4.1: napi-rs 集成测试（3 天）

- **Goal**: ~75 测试（25 函数×3: happy+error+edge），80% 覆盖率
- **Output**: Bridge crate tests + llvm-cov 报告
- **Blockers**: T1.2 — 并行 T4.2、T4.4

### T4.2: Theia 扩展测试（3 天）

- **Goal**: 20+ 测试覆盖所有 Theia extensions（backend service + frontend widgets + DI wiring）
- **Output**: 每 extension 的 `__tests__/` 目录
- **Blockers**: Phase 3 — 并行 T4.1、T4.4

### T4.3: Playwright E2E 测试（5 天）

- **Goal**: 20+ E2E 场景：ST/LD/FBD 编辑→编译→部署、信号读写、HMI→Panel、Debug 会话
- **Output**: `apps/studio-theia/e2e/`（~1200 行 TS + fixtures）
- **Blockers**: Phase 3

### T4.4: 性能基准（2 天）

- **Goal**: napi-rs ≤2× Tauri 基线、Electron ≤250MB、启动 <10s cold
- **Steps**: Tauri 基线 → napi-rs latency bench → Theia startup/memory → 报告
- **Blockers**: Phase 3 — 并行 T4.1、T4.2

### T4.5: Electron 打包（3 天）

- **Goal**: DMG/MSI/AppImage + auto-update、三平台 ≤250MB
- **Blockers**: Phase 3 — 并行 T4.1、T4.2、T4.4

### T4.6: 文档（3 天）

- **Goal**: 迁移指南 + 架构更新 + dev 环境搭建指南
- **Output**: 4 份文档（~2000 行 markdown）
- **Blockers**: T4.1-T4.5

### T4.7: Stakeholder 审查（2 天）

- **Goal**: 全量 audit 所有 Phase 4 出口条件、手动签收
- **Output**: QA 报告 + 发布标签
- **Blockers**: T4.3-T4.6

### Phase 4 并行策略

```
13 天（并行优化）：
T4.1 ∥ T4.2 ∥ T4.4（3 天并行）
  → T4.3 ∥ T4.5（5 天并行）
    → T4.6（3 天）
      → T4.7（2 天）
```

---

## 附录：任务数 vs LOC 汇总

| Phase | 任务数 | LOC 估算 | 测试数 | 并行最短工期 |
|-------|:---:|------|:---:|:---:|
| P1 基础设施 | 11 | 2,160 TS + 1,000 Rust | 38+ | 5-6 周 |
| P2a GLSP LD | 13 | 5,500-8,500 TS/Rust | 20+ | 5-7 周 |
| P2b FBD+文本 | 12 | 4,780-7,460 TS | 25+ | 2-3 周 |
| P3 面板+Shell | 11 | 4,300-4,950 TS | 15+ | 4-5 周 |
| P4 测试+打包 | 7 | 2,500 TS/SH/Config | 115+ | 13 天 |
| **总计** | **54** | **~19,500-23,500** | **213+** | **27-35 周** |
