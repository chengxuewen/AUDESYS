# AUDESYS Studio → Eclipse Theia 迁移架构设计

**创建日期**: 2026-07-21  
**决策**: 从 Tauri+React 自建架构迁移到 Eclipse Theia 框架  
**状态**: 设计完成，三审修订（arch-auditor + theia-expert + migration-feasibility，15 项 MUST-FIX）
**前置决策**: Fork VS Code 已排除（周发版维护不可行），CodeBlitz 已排除（无调试/无 Rust LSP）

---

## 0. 决策背景

### 为什么选择 Theia

| 关键因素 | 说明 |
|----------|------|
| **Neuron 验证** | logi.cals/Neuron Automation 基于 Theia+GLSP 构建了 IEC 61131-3 IDE（ST/FBD/LD），已在生产环境运行 |
| **VS Code 扩展兼容** | API 1.116.0 兼容（vs OpenSumi 的 1.68.0），可使用 Open VSX 生态 |
| **GLSP 图形编辑器** | 官方支持，减少 LD/FBD 图形编辑器开发量 |
| **工业产品采纳** | TI、ST、Arm、Samsung、Renesas 已基于 Theia 构建产品 |
| **Eclipse 基金会治理** | 厂商中立，不依赖单一公司战略 |

### 为什么放弃自建（Tauri+React）

- 13/16 项通用 IDE 功能（Dock、Tab、命令面板、快捷键、主题、设置、文件树、搜索、终端、SCM、菜单栏、状态栏、通知）需要从零实现
- AI 生成的通用 UI 质量不稳定（BottomSlot 拖拽 4 次迭代才修复）
- 无 VS Code 扩展生态

---

## 1. 架构概览

```
┌──────────────────────────────────────────────────────────────┐
│                  AUDESYS Studio (Theia)                        │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Theia Frontend (Electron Renderer / Browser)            │ │
│  │  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐  │ │
│  │  │ Monaco  │ │ GLSP     │ │ Custom     │ │ Theia     │  │ │
│  │  │ Editor  │ │ Editor   │ │ React      │ │ Widgets   │  │ │
│  │  │ (ST/IL/ │ │ (LD/FBD) │ │ Widgets    │ │ (Tree,    │  │ │
│  │  │ G-code) │ │          │ │ (HMI/Scope)│ │  Panel)   │  │ │
│  │  └─────────┘ └──────────┘ └────────────┘ └───────────┘  │ │
│  └──────────────────────┬───────────────────────────────────┘ │
│                         │ JSON-RPC (WebSocket)                │
│  ┌──────────────────────┴───────────────────────────────────┐ │
│  │  Theia Backend (Node.js + Express)                       │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │  Audesys Bridge Service (napi-rs)                │   │ │
│  │  │  ┌──────────────┐ ┌──────────────┐               │   │ │
│  │  │  │ Rust IPC     │ │ Rust Compiler│               │   │ │
│  │  │  │ (UDS,信号)   │ │ (6 语言+CNC) │               │   │ │
│  │  │  └──────────────┘ └──────────────┘               │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │  Plugin Host (Node.js 子进程)                             │ │
│  │  ┌──────────────────────────────────────────────────┐   │ │
│  │  │  VS Code Extensions (Open VSX)                   │   │ │
│  │  │  · LSP servers  · 调试器  · 主题  · Git 工具     │   │ │
│  │  └──────────────────────────────────────────────────┘   │ │
│  └──────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────┘
```

---

## 2. 模块映射：当前 → Theia

| 当前 AUDESYS 组件 | Theia 对应 | 迁移方式 |
|---|---|---|
| **Shell** (Tool+Slot+Mode) | Theia Workbench | 直接替换——Theia 提供 Dock/Tab/Menu/StatusBar |
| **NavBar** | Activity Bar (Theia 内置) | 替换——ViewContainer 贡献点注册工具图标 |
| **Toolbar** | Toolbar 贡献点 | 替换——`ToolbarContribution` 注册按钮 |
| **EditorSlot** | Editor Area (Theia 内置) | 替换——`OpenHandler` 管理编辑器打开 |
| **BottomSlot** | Bottom Panel (Theia 内置) | 替换——`BottomPanelContribution` 注册面板 |
| **InspectorSlot** | Right Panel Widget | 重写——`ReactWidget` + `AbstractViewContribution` |
| **ProjectTree** | File Explorer (Theia 内置) | 替换——使用 Theia 内置，添加自定义文件类型图标 |
| **ModeSelector** | Custom Toolbar Widget | 重写——`ReactWidget` 嵌入 Toolbar |
| **ToolRegistry** | Theia Extension System | 替换——`ContainerModule` + `CommandContribution` |
| **StudioEventBus** | Theia `Event` + `MessageService` | 替换——Theia 内置事件系统 |
| **PlatformAdapter** | Theia Backend Services | 重写——`RpcProxy` + 自定义 Backend Service |
| **Editor (ST/IL/G-code)** | Monaco Editor (Theia 内置) | 迁移——Monaco + 自定义语言服务器 |
| **Editor (LD/FBD)** | Eclipse GLSP | **新建**——GLSP 图形编辑器 |
| **HMI Designer** | Custom Editor (ReactWidget) | 重写——React 组件包装为 ReactWidget |
| **Signal Browser** | Custom View Container | 重写——`TreeView` + 自定义 Widget |
| **Simulator** | Custom Editor | 重写——ReactWidget |
| **Debugger (DAP)** | Theia Debug (内置 DAP) | 适配——已有 DAP 适配器，适配 Theia Debug API |

---

## 3. Rust 后端集成方案

### 3.1 方案：napi-rs 原生 addon（推荐）

```
Rust crates (~50% 需适配：纯逻辑代码零修改，34 个 Tauri 命令需重写为 napi-rs 函数，Cargo.toml 配置变更)
  → napi-rs 编译为 .node 二进制
  → Theia Backend (Node.js) require()
  → Theia Backend Service → JSON-RPC → Frontend
```

**保留不变**：
- 所有 Rust 编译器（ST/IL/LD/FBD/SFC/G-code）
- IPC Server（UDS 协议 0x01-0x17）
- Runtime Engine（5 步周期引擎）
- Supervisor（子进程编排）
- Modbus/HART 适配器
- SimulationHarness
- DAP 调试适配器

*注：需适配部分详见 §10.2-10.4。纯逻辑代码（编译器、VM、Engine）零修改。34 个 Tauri 命令重写为 ~25 个 napi-rs 函数。*

**新增**：
- `crates/audesys-theia-bridge/` — napi-rs 绑定层（~500-1000 行）
- `theia-extensions/audesys-backend/` — Theia Backend Service（~300 行）

### 3.2 napi-rs 绑定层接口

```rust
// crates/audesys-theia-bridge/src/lib.rs
use napi_derive::napi;

#[napi]
pub async fn compile_st(source: String, config: String) -> Result<String> { ... }

#[napi]
pub async fn compile_ld(source: String) -> Result<String> { ... }

#[napi]
pub async fn read_signal(name: String) -> Result<Option<f64>> { ... }

#[napi]
pub async fn signal_snapshot() -> Result<Vec<(String, String)>> { ... }

#[napi]
pub async fn deploy_program(program: Vec<u8>) -> Result<()> { ... }

#[napi]
pub async fn health_query() -> Result<String> { ... }
```

### 3.3 Theia Backend Service

```typescript
// theia-extensions/audesys-backend/src/node/audesys-backend-service.ts
@injectable()
export class AudesysBackendService {
    private bridge = require('audesys-theia-bridge'); // napi-rs binary

    async compileSt(source: string): Promise<CompileResult> {
        return JSON.parse(await this.bridge.compileSt(source, '{}'));
    }

    async readSignal(name: string): Promise<number | null> {
        return this.bridge.readSignal(name);
    }
}
```

**认证层**：napi-rs 调用前需通过 Theia Backend 的 RBAC 中间件验证（复用现有 HMAC + 5 角色体系）。输入参数需 JSON Schema 校验。

---

## 4. 自定义编辑器

### 4.1 文本编辑器（ST/IL/G-code）

**Monaco Editor（Theia 内置）** + 自定义语言服务器（napi-rs 桥接）。

```
Theia Monaco Editor
  → AudesysLanguageServer (napi-rs)
    → Rust 编译器（诊断、自动补全、跳转）
```

直接复用现有编译器的诊断输出。创建 Monarch tokenizer（~100-200 行/语言）用于语法高亮。

### 4.2 图形编辑器（LD/FBD）

**Eclipse GLSP + Theia Integration**。

```
Theia GLSP Editor
  → GLSP Server (Node.js)
    → Layout Engine (Rust napi-rs)
```

GLSP 提供：节点+连线画布、拖拽、选择、撤销/重做、属性面板。AUDESYS 提供：LD/FBD 特定的图形模型（Rust 布局引擎）。

### 4.3 HMI 设计器

**ReactWidget 自定义编辑器**。保留当前 react-rnd 画布 + 7 种 widget，包装为 Theia ReactWidget。

---

## 5. 迁移路线图

### Phase 1: 基础设施（2-3 周）

| 任务 | 产出 | 估时 |
|------|------|:--:|
| Theia 应用骨架搭建 | `apps/studio-theia/` 目录 | 3 天 |
| napi-rs 绑定层 | `crates/audesys-theia-bridge/` | 5 天 |
| Theia Backend Service | `theia-extensions/audesys-backend/` | 3 天 |
| CI/CD 适配（Electron 构建） | `.github/workflows/` | 3 天 |
| Rust 测试验证（737 测试仍通过） | 回归测试 | 2 天 |

### Phase 2: 编辑器（3-4 周）

| 任务 | 产出具 | 估时 |
|------|------|:--:|
| ST/IL/G-code Monaco 编辑器 | 语法高亮 + 自动补全 + 诊断 | 5 天 |
| LD 图形编辑器（GLSP） | 梯形图编辑器 | 5 天 |
| FBD 图形编辑器（GLSP） | 功能块图编辑器 | 5 天 |
| SFC 编辑器 | 顺序功能图编辑器 | 3 天 |
| HMI 设计器 | react-rnd → ReactWidget | 5 天 |

### Phase 3: 面板和 Shell（2-3 周）

| 任务 | 产出 | 估时 |
|------|------|:--:|
| Signal Browser（Theia View） | 信号浏览器面板 | 3 天 |
| Scope View | 实时波形面板 | 5 天 |
| Debug Panel（DAP 适配） | DAP 调试器对接 | 5 天 |
| Project Tree | 类型化资源树 | 3 天 |
| Mode 系统（Edit/Debug/Commissioning） | Toolbar 贡献点 | 3 天 |

### Phase 4: 测试和打磨（2-3 周）

| 任务 | 产出 | 估时 |
|------|------|:--:|
| E2E Playwright 测试 | 新 Theia 测试套件 | 5 天 |
| 性能基准 | 启动时间、内存对比 | 3 天 |
| 打包配置 | Electron DMG/MSI/AppImage | 3 天 |
| 文档 | 迁移指南、架构文档 | 3 天 |

**总计**：**11-14 周**（3-4 个月），2-3 人团队。

---

## 6. 可复用与需替换的资产

### 保留（零修改 ~50,000 行）

| 资产 | 行数 | 说明 |
|------|:---:|------|
| Rust 编译器（6 语言 + CNC） | ~20,000 | napi-rs 编译，零修改 |
| Rust Runtime（Engine/VM/Supervisor） | ~10,000 | napi-rs 编译，零修改 |
| IPC Server（UDS 17 方法） | ~3,000 | 后端通过 napi-rs 调用 |
| Modbus/HART 适配器 | ~2,000 | napi-rs 编译 |
| SimulationHarness | ~3,000 | napi-rs 编译 |
| DAP 适配器 | ~2,000 | napi-rs 编译 |
| Rust 测试（737 #[test]） | ~15,000 | 零修改 |
| HMI Widget（7 种） | ~1,500 | 包装为 ReactWidget |

### 替换（~4,850 行）

| 资产 | Theia 替代 |
|------|-----------|
| Shell（Tool+Slot+Mode） | Theia Workbench |
| NavBar | Theia Activity Bar |
| Toolbar | Theia Toolbar 贡献点 |
| BottomSlot | Theia Bottom Panel |
| EditorSlot | Theia Editor Area |
| ProjectTree | Theia File Explorer |
| StudioEventBus | Theia Event System |
| PlatformAdapter | Theia Backend Service |
| ToolRegistry | Theia Extension System |
| CodeMirror 6 | Monaco Editor（Theia 内置） |

---

## 7. 风险与缓解

| 风险 | 概率 | 缓解 |
|------|:--:|------|
| napi-rs 绑定层复杂度过高 | 中 | 先验证 5 个核心函数（compile/read/deploy/health/snapshot），再扩展 |
| GLSP 学习曲线陡峭 | 高 | 参考 Neuron 开源代码，Phase 2 优先 ST 文本编辑器 |
| Electron 包体积不可接受 | 中 | 移除不需要的内置扩展（TypeScript/HTML/Java），目标 130-200MB |
| Theia 版本升级导致 breaking changes | 中 | 锁定 Theia 版本，季度升级而非月度 |
| 团队 Node.js/Electron 经验不足 | 低 | Theia 大量使用 TypeScript，与现有前端技术栈重叠 |

---

## 8. 与当前自建方案的对比

| 维度 | 当前（Tauri+React） | 迁移后（Theia） |
|------|:---:|:---:|
| **通用 UI 质量** | 🟡 AI 生成，偶有 bug | 🟢 生产级（TI/ST/Arm 验证） |
| **编辑体验** | 🟡 CodeMirror 6 | 🟢 Monaco + LSP |
| **图形编辑器** | 🟡 @xyflow/react | 🟢 GLSP |
| **VS Code 扩展** | 🔴 无 | 🟢 Open VSX |
| **调试器** | 🟡 自建 DAP | 🟢 Theia Debug（DAP 原生） |
| **Rust 集成** | 🟢 原生 | 🟡 napi-rs 桥接 |
| **包体积** | 🟢 15MB | 🟡 130-200MB |
| **开发效率** | 🟡 AI 生成 | 🟢 框架提供 |
| **测试覆盖率** | 🟡 126 vitest | 🔴 需重写 E2E |

---

## 9. 实施前检查清单

- [ ] Neuron 开源代码研究（GLSP + IEC 61131-3 集成模式）
- [ ] napi-rs 概念验证（compile_st 双向调用）
- [ ] Theia 最小骨架搭建（Hello World + 自定义编辑器）
- [ ] Open VSX 注册表访问验证
- [ ] Electron 打包体积基准测试
- [ ] 团队 Theia 学习计划（1 周 workshop）
- [ ] Controller napi-rs worker_thread 架构验证
- [ ] 目标 10 个 VS Code 扩展兼容性白名单验证

---

## 10. 评审发现与修正（2026-07-21 三审）

三审团队：arch-auditor + theia-expert + migration-feasibility。共 15 项 MUST-FIX + 14 项 SHOULD-FIX。

### 10.1 GLSP 规模修正

原估 LD 5 天、FBD 5 天、SFC 3 天 = **13 天**。
修正：LD 单独需 **6-10 周**（GModel 800-1500 行 + GLSP 操作 1200-2000 行 + 工具面板 400-600 行 + 布局引擎 1000-2000 行 + 属性视图 500-800 行 + Theia 集成 600-1000 行 + IEC 61131-3 特性 600-1000 行 = **5000-9000 行/编辑器**）。FBD 增加 4-6 周。

**修正后计划**：Phase 2a GLSP LD 6-10 周，Phase 2b GLSP FBD 4-6 周，SFC 后延。备选：探索 @xyflow/react LD/FBD 通过 ReactWidget 迁移（1-2 周 vs 6-10 周）。

### 10.2 napi-rs 规模修正

原估 5 天 6 个函数。Controller sync-only 会阻塞 Node.js 事件循环。DAP 适配器是独立二进制不能直接嵌入。

**修正后计划**：napi-rs 在 `worker_threads` 中运行（新增 1 周架构验证）。完整审计 34 个 Tauri 命令 → ~25 个 napi-rs 函数。DAP 保留为独立进程。

### 10.3 时间线修正

| 阶段 | 原估 | 修正后 |
|------|:--:|:--:|
| Phase 1：基础设施 | 2-3 周 | **4-5 周** |
| Phase 2a：GLSP LD | 2 周 | **6-10 周** |
| Phase 2b：FBD + 文本编辑器 | 2 周 | **6-8 周** |
| Phase 3：面板和 Shell | 2-3 周 | **3-4 周** |
| Phase 4：测试和打磨 | 2-3 周 | **3-4 周** |
| **总计** | **11-14 周** | **22-31 周（5-8 月）** |

### 10.4 其他修正

- **包体积**：130-200MB → **150-200MB**
- **VS Code API**："1.116.0" → "目标 1.105-1.115（Theia v1.72 预估），需验证"
- **ReactWidget 冲突**：新增 1 周专项（坐标系统/拖拽/Z-index/CSS 隔离）
- **inversify DI 样板**：~1500-2000 行新增代码
- **Monarch tokenizer**：100-200 行 → 400-700 行（ST），IL 需自定义 tokenizer
- **升级策略**：月度补丁升级 + 季度 minor 评估（每季 1-2 周）
- **35K Rust 零修改** → **~50% 需修改**（34 个 Tauri 命令重写、Cargo.toml napi-rs 配置、Controller 生命周期适配）

---

## 11. 安全防护

### 11.1 Electron 配置

- `contextIsolation: true` — 渲染进程无法直接访问 Node.js
- `nodeIntegration: false` — 禁止渲染进程 require()
- `sandbox: true` — 渲染进程沙箱隔离
- `webSecurity: true` — 同源策略
- 所有 napi-rs 调用通过 Theia Backend Service 中转（不直接暴露给渲染进程）

### 11.2 napi-rs 输入验证

每个 napi-rs 函数调用前需通过：
1. JSON Schema 参数校验（类型、范围、长度）
2. RBAC 角色检查（复用现有 5 角色体系）
3. Rate limiting（编译：10/min，信号读取：1000/min）

### 11.3 Open VSX 供应链

- 仅允许白名单扩展（Phase 1：0 个第三方扩展，Phase 2+：经审核的扩展列表）
- 扩展运行在隔离的 Plugin Host 进程中
- Plugin Host 无本地文件系统写权限

### 11.4 审计日志

- 所有 napi-rs 调用记录时间戳、操作、调用者角色、参数摘要
- 扩展安装/更新/删除记录完整操作日志

---

## 12. 回滚策略

### 12.1 Phase 级 checkpoint

每个 Phase 结束时执行 git tag + 全量测试：

| Phase | Checkpoint 条件 |
|-------|----------------|
| Phase 1 完成 | napi-rs 5 个核心函数在 worker_thread 中通过 Rust 测试 |
| Phase 2a 完成 | ST Monaco 编辑器 + napi-rs 编译管线端到端可用 |
| Phase 2b 完成 | LD/FBD GLSP 编辑器 + 编译管线可用 |
| Phase 3 完成 | 所有面板 + Debug 模式可用，E2E 15+ 通过 |
| Phase 4 完成 | 全量 126+ 测试通过，Electron 打包可用 |

### 12.2 回滚触发条件

- 任一 Phase 的 napi-rs 函数延迟 > 2x Tauri 基线
- GLSP 编辑器 Phase 2a 超过 12 周（2x 估计）
- Electron 打包体积 > 250MB（超出目标 50MB）

### 12.3 双轨运行

整个迁移期间，Tauri Studio 保持可用。用户可同时运行 Tauri 和 Theia Studio。迁移完成后逐步废弃 Tauri Studio。
