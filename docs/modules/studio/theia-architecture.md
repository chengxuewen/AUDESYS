# AUDESYS Studio Theia 架构

> 更新日期：2026-07-22
> 参考决策：D71

## 架构概览

AUDESYS Studio 基于 Eclipse Theia 1.73 构建，采用 Electron + Browser 双渲染模式。前端使用 Theia Workbench（Monaco Editor + GLSP 图形编辑器），后端通过 napi-rs 桥接 Rust Runtime。

```
┌────────────────────────────────────────────────────────────────┐
│  Theia Frontend (Electron Renderer / Browser)                  │
│  ┌─────────┐ ┌──────────┐ ┌────────────┐ ┌───────────┐        │
│  │ Monaco  │ │ GLSP     │ │ Custom     │ │ Theia     │        │
│  │ Editor  │ │ Editor   │ │ React      │ │ Widgets   │        │
│  │ (ST/IL/ │ │ (LD/FBD) │ │ Widgets    │ │ (Tree,    │        │
│  │ G-code/ │ │          │ │ (HMI/Scope)│ │  Panel)   │        │
│  │ SFC)    │ │          │ │            │ │           │        │
│  └─────────┘ └──────────┘ └────────────┘ └───────────┘        │
├────────────────────────────────────────────────────────────────┤
│  Theia Backend (Node.js)                                       │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  Audesys Bridge Service (napi-rs)                        │  │
│  │  · compile_st / compile_ld / compile_il / compile_fbd    │  │
│  │  · compile_sfc / compile_gcode                           │  │
│  │  · controller_start / stop / health                      │  │
│  │  · deploy_program / deploy_hmi_layout                    │  │
│  │  · read_signal / signal_snapshot                         │  │
│  │  · debug_* (9 命令) / sim_* (3 命令)                     │  │
│  │  · open_project / load_hmi_layout / save_hmi_layout      │  │
│  └──────────────────────────────────────────────────────────┘  │
├────────────────────────────────────────────────────────────────┤
│  Rust Runtime (独立进程 / worker_thread)                        │
│  · Controller (5-step RT cycle)  · Supervisor (进程编排)       │
│  · IPC Server (UDS 17 methods)   · Compilers (6 langs + CNC)   │
│  · Modbus/HART adapters          · DAP Debug Adapter            │
└────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
apps/studio-theia/            # Theia 应用主目录
├── package.json              # 依赖 @theia/* 1.73.0 + 扩展
├── src/                      # 前端入口
├── lib/                      # 编译输出（backend/electron-main.js）
├── e2e/                      # Playwright 端到端测试
└── electron-builder.yml      # Electron 打包配置

theia-extensions/             # 10 个 Theia 扩展
├── audesys-core/             # 核心扩展：菜单、主题、命令面板
├── audesys-backend/          # 后端服务：JSON-RPC 代理 + RBAC + 审计
├── audesys-st-editor/        # ST Monaco Editor（Monarch tokenizer + completion）
├── audesys-il-editor/        # IL Monaco Editor
├── audesys-gcode-editor/     # G-code Monaco Editor
├── audesys-sfc-editor/       # SFC Monaco Editor（文本模式）
├── audesys-ld-glsp/          # LD GLSP 图形编辑器（GModel + Server + 工具面板）
├── audesys-fbd-glsp/         # FBD GLSP 图形编辑器
├── audesys-hmi-designer/     # HMI 设计器（ReactWidget 包装）
├── audesys-debug/            # 调试面板（DAP adapter 适配 Theia Debug API）
└── workshop-playground/      # 开发 workshop

crates/audesys-theia-bridge/  # napi-rs 绑定层
├── src/lib.rs                # ~25 个 napi-rs 函数
├── index.d.ts                # TypeScript 类型声明
├── index.js                  # JS 绑定入口（多平台自动选择）
├── index.darwin-x64.node     # macOS x64 原生二进制
└── __tests__/                # napi-rs 测试
```

## 关键扩展详解

### audesys-core
Theia 扩展入口，负责：
- 注册菜单和工具栏贡献点
- 注入 AUDESYS 主题（工业灰色调 + ISA-101 语义状态色）
- 模式系统（Edit/Debug/Commissioning Mode）
- inversify DI 注册

### audesys-backend
后端服务层（`BackendApplicationContribution`），运行在 Node.js 主进程：
- 加载 napi-rs 原生模块（`require('@audesys/theia-bridge')`）
- JSON-RPC 代理（Frontend ↔ Rust Runtime）
- Schema 验证（参数格式校验）
- RBAC 中间件（6 角色权限检查）
- Rate limiting（防止 API 滥用）
- 审计日志（所有 napi-rs 调用记录）

### GLSP 编辑器 (LD / FBD)
每个 GLSP 编辑器包含：
- **GModel**（`src/gmodel/`）：图形模型类型定义（ContactNode、CoilNode、PowerRail、WireConnection、ANDNode、ORNode、FunctionBlockNode 等）
- **Server**（`src/server/`）：GLSP 操作处理（CreateContact、DeleteElement、ReconnectWire、MoveRung 等）
- **Tool palette**（`src/tool-palette/`）：工具栏预设（NO/NC 触点、线圈、取反、FB placeholder 等）
- **Property view**（`src/property-view/`）：属性面板（变量名、注释、取反标志、Pin 类型）

LD 编辑器通过 IL 文本转换编译：LD GModel → IL 文本 → HalProgram。

### Monaco 编辑器 (ST / IL / G-code / SFC)
每个文本编辑器包含：
- **Monarch tokenizer**：IEC 61131-3 / RS274 语法高亮
- **Completion provider**：关键词补全、变量补全、功能块补全
- **Diagnostics**：napi-rs 桥接 Rust 编译器错误 → Monaco marker

## napi-rs 桥接架构

```
Theia Backend (Node.js)
  │
  │  require('@audesys/theia-bridge')
  ▼
index.js (多平台 .node 二进制选择)
  │
  │  napi-rs FFI (零序列化开销)
  ▼
audesys-theia-bridge.darwin-x64.node
  │
  │  Rust libraries (static linking)
  ▼
├── audesys-hal-binding-gen   # ST 编译器
├── audesys-il-compiler       # IL 编译器
├── audesys-ld-compiler       # LD 编译器
├── audesys-fbd-compiler      # FBD 编译器
├── audesys-sfc-compiler      # SFC 编译器
├── audesys-controller-client # UDS IPC 客户端
└── serde_json                # JSON 序列化
```

函数映射：34 个 Tauri 命令 → ~25 个 napi-rs 函数（合并相似命令）
- `compile_st` / `compile_ld` / `compile_il` / `compile_fbd` / `compile_sfc` / `compile_gcode`
- `deploy_program` / `deploy_hmi_layout` / `load_hal_config`
- `read_signal` / `signal_snapshot` / `health_query`
- `controller_start` / `controller_stop` / `controller_health`
- `debug_*`（9 个调试命令）
- `sim_*`（3 个仿真命令）
- `open_project` / `read_project_file` / `load_hmi_layout` / `save_hmi_layout`

## 通信流程

```
用户操作（Frontend）
  │
  │  JSON-RPC over WebSocket (Theia 内置)
  ▼
AudesysBackendService（Node.js）
  │
  │  RBAC 检查 → Schema 验证 → Rate limiting
  ▼
napi-rs 函数调用（同步/异步）
  │
  ├─ 编译：直接调用 Rust 编译器库（进程内，<10ms）
  │  compile_st(source) → HalProgram JSON
  │
  ├─ 控制：通过 audesys-controller-client 建立 UDS 连接
  │  read_signal() → UDS → Controller → HalValue JSON
  │
  └─ 调试：通过 UDS 连接 DAP 适配器
     debug_step() → UDS → DAP Adapter → state JSON
```

## 技术栈

| 层 | 技术 | 版本 |
|----|------|------|
| Theia Framework | `@theia/core` | 1.73.0 |
| 编辑器 | Monaco Editor | 内置于 @theia/monaco |
| 图形编辑器 | Eclipse GLSP | 内置于 theia-extensions |
| Electron | electron | 39.8.7 |
| Rust 桥接 | napi-rs | 3.x (napi4) |
| Rust 编译器 | audesys-*-compiler | workspace crates |
| UI 渲染 | ECharts + react-rnd | 5.6.0 / 10.5.3 |
| 测试 | Playwright | 1.61.1 |
