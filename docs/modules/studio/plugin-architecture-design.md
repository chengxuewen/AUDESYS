# AUDESYS Studio 插件架构设计

> ⚠️ **已弃用** — 本文档描述的 PluginRegistry + CommandRegistry + PanelSystem + PlatformAdapter 四层架构已被 Tool+Slot+Mode 架构取代，后者又已被 Eclipse Theia 迁移计划取代。
> 
> **当前活跃文档**：docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md
> 
> 本文档保留作为 D58 决策的历史记录。


> 生成日期：2026-07-19（2026-07-21 弃用）
> 依赖决策：D58 (PluginRegistry + CommandRegistry + PlatformAdapter + PanelSystem), D59 (PC/Web 双模式)
> 参考架构：VS Code Extension API（`docs/reference/vscode.md`）
> 设计目标：为 AUDESYS Studio 构建插件化编辑器平台，支持 PC (Tauri) 和 Web 双模式部署

## 0. 现状矩阵（2026-07-20）

四层架构的实现完成度：

| 层 | 设计状态 | 实现状态 | 代码位置 | 合规 |
|---|:---:|:---:|------|:---:|
| PluginRegistry | ✅ 设计完成 | ❌ 零代码 | — | — |
| CommandRegistry | ✅ 设计完成 | 🟡 骨架（897 行） | `packages/studio-core/src/commands/` | ❌ 未接入 App.tsx |
| PanelSystem | ✅ 设计完成 | ❌ 零代码 | 面板硬编码在 `apps/studio/src/App.tsx:300-395` | — |
| PlatformAdapter | ✅ 设计完成 | 🟡 已实现（578 行） | `apps/studio/src/platform/` | ❌ 未接线：57 文件直接 import @tauri-apps/* |

**当前面板渲染模式**：App.tsx 使用 `langMode` 状态 + 嵌套三元运算符直接渲染面板（而非通过 PluginRegistry/PanelSystem）。

**关键缺口**（详见 §8 实现状态）：
- PluginRegistry：零代码。无 manifest 扫描、生命周期、activate/deactivate
- PanelSystem：零代码。5 区域布局引擎未实现
- PlatformAdapter：578 行代码闲置。App.tsx 第 2-4 行直接 import `@tauri-apps/api/core`
- HMI 部署管道：IPC 0x17 后端就绪，但 Studio 缺少 deploy 按钮和 Tauri 命令
- Role::HMI：D64 决策声明但枚举值未添加

---

## 1. 四层架构

```
┌──────────────────────────────────────────────────────────────────────┐
│                       AUDESYS Studio Shell                            │
│                                                                       │
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Plugin      │  │ Command          │  │ Panel                    │ │
│  │ Registry    │  │ Registry         │  │ System                   │ │
│  │             │  │                  │  │                          │ │
│  │ · manifests │  │ · namespace.cmd  │  │ · layout engine          │ │
│  │ · lifecycle │  │ → Platform.invoke│  │ · PanelDescriptor[]      │ │
│  │ · activate  │  │ → Rust handler   │  │ · view container mgmt    │ │
│  └──────┬──────┘  └────────┬─────────┘  └────────────┬─────────────┘ │
│         │                  │                         │               │
│         └──────────────────┼─────────────────────────┘               │
│                            │                                         │
│  ┌─────────────────────────▼──────────────────────────────────────┐  │
│  │                    PlatformAdapter                              │  │
│  │  · mode: "pc" | "web"                                           │  │
│  │  · capabilities: PlatformCapabilities                           │  │
│  │  · invoke / readTextFile / writeTextFile / dialogs              │  │
│  │  ┌──────────────────┐  ┌──────────────────┐                     │  │
│  │  │  PcAdapter       │  │  WebAdapter      │                     │  │
│  │  │  Tauri invoke()  │  │  fetch() HTTP    │                     │  │
│  │  │  Native FS       │  │  IndexedDB VFS   │                     │  │
│  │  └──────────────────┘  └──────────────────┘                     │  │
│  └─────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────┘
```

| 层 | 职责 | 实现状态 | 依赖 |
|---|------|:---:|------|
| **PluginRegistry** | 插件发现（JSON manifests）、元数据索引、生命周期管理（activate/deactivate） | ❌ 零代码 | PlatformAdapter（通过 PluginContext 注入） |
| **CommandRegistry** | 命名空间命令注册、到 PlatformAdapter.invoke() 的映射、快捷键绑定 | 🟡 骨架存在，未接入 App.tsx | PlatformAdapter（invoke 管道） |
| **PanelSystem** | 面板布局引擎、PanelDescriptor 收集、视图容器管理 | ❌ 零代码 | React 组件树、PluginRegistry（获取 PanelDescriptor） |
| **PlatformAdapter** | PC/Web 模式切换、能力退化矩阵、统一 IO 抽象 | 🟡 已实现，未接线（57 文件绕过） | Tauri (PC) 或浏览器 API (Web) |
│  ┌─────────────┐  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Plugin      │  │ Command          │  │ Panel                    │ │
│  │ Registry ❌  │  │ Registry 🟡      │  │ System ❌                │ │

**关键设计决策**：
- PluginRegistry 和 CommandRegistry 是**纯前端层**（TypeScript），不依赖 Rust 后端变更
- PlatformAdapter 是**唯一**的 `@tauri-apps/*` 导入点
- PanelSystem 只管理面板布局/生命周期，面板内容由 Plugin 提供
- 参考 VS Code 的 activate/deactivate 模式，最小化 v1 API 表面积

---

## 2. StudioPlugin 接口

模仿 VS Code 的 `activate(context)` / `deactivate()` 模式。

### 2.1 PluginManifest

```typescript
interface PluginManifest {
  id: string;                    // "audesys.st-compiler" (小写.分隔)
  displayName: string;           // "ST Compiler"
  version: string;               // SemVer
  engines: { studio: string };   // 最低 Studio 版本
  main: string;                  // Node.js/ES module 入口（P1: 静态 JSON manifest，无文件导入）
  browser?: string;              // Web 模式替代入口（P1: 未启用）
  activationEvents: ActivationEvent[];
  contributes?: PluginContributions;
}

type ActivationEvent =
  | `onLanguage:${string}`       // 打开特定语言文件
  | `onCommand:${string}`        // 执行命令
  | `onView:${string}`           // 面板展开
  | `onProtocol:${string}`       // 协议适配器需要
  | `onStartupFinished`;         // 启动完成后
```

**browser 字段**：双模式的核心机制。扩展可提供两个入口点——`main` 用于 PC（Tauri 全能力）、`browser` 用于 Web（受限浏览器环境）。

### 2.2 StudioPlugin 与 PluginContext

```typescript
interface StudioPlugin {
  readonly manifest: PluginManifest;
  activate(context: PluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

interface PluginContext {
  readonly pluginId: string;
  readonly platform: IPlatformAdapter;     // 统一 IO 抽象
  readonly commands: ICommandRegistry;      // 命令注册表
  readonly panels: PanelRegistry;           // 面板注册表
  readonly extensionPath: string;
  readonly subscriptions: Disposable[];     // 自动清理（VS Code 模式）
}
```

**生命周期**：

```
Manifest Scan (JSON files) → Contribution Index → UI Bootstrap
    → activationEvent 触发 → import() + activate()
    → Running (subscriptions 管理资源)
    → deactivate() → dispose subscriptions → 卸载
```

### 2.3 PluginContributions（贡献点）

```typescript
interface PluginContributions {
  languages?: LanguageContribution[];       // 语言定义 ✅ 已实现（App.tsx 内 6 种语言硬编码）
  commands?: CommandContribution[];          // 命令注册 🟡 CommandRegistry 已实现，贡献注册机制缺失
  panels?: PanelDescriptor[];               // 面板注册 ❌ 零代码（App.tsx 硬编码渲染）
  toolbarActions?: ToolbarAction[];         // 工具栏按钮 ❌ 零代码（App.tsx 硬编码 HTML）
  settings?: Record<string, SettingDescriptor>; // 配置项 ❌ 零代码
  protocolAdapters?: ProtocolAdapterContribution[]; // 协议适配器 ❌ 零代码
}
```

### 2.3.1 当前实现状态

P1 阶段以 JSON manifest 文件静态注册插件（Tauri 不支持运行时动态模块加载）。当前 6 种 `contributes` 类型实现状态见上文注释。语言定义、命令处理、面板渲染均硬编码在 `apps/studio/src/App.tsx:300-395`。

## 3. PlatformAdapter — PC/Web 双模式

### 3.1 接口定义

```typescript
interface IPlatformAdapter {
  readonly mode: 'pc' | 'web';
  readonly capabilities: PlatformCapabilities;

  // RPC — 替代 invoke()
  invoke<T>(command: string, args?: Record<string, unknown>): Promise<T>;

  // 文件系统
  readTextFile(path: string): Promise<string>;
  writeTextFile(path: string, content: string): Promise<void>;

  // 对话框
  openFileDialog(options?: FileDialogOptions): Promise<string | null>;
  saveFileDialog(defaultName?: string): Promise<string | null>;

  // 项目持久化（Web 模式无真实文件系统）
  saveProject(id: string, data: ProjectBundle): Promise<void>;
  loadProject(id: string): Promise<ProjectBundle>;
}

interface PlatformCapabilities {
  readonly nativeFileSystem: boolean;   // PC: true, Web: false
  readonly nativeTerminal: boolean;     // PTY 支持
  readonly nativeProcess: boolean;     // 子进程管理
  readonly localController: boolean;    // UDS 直连控制器
  readonly systemTray: boolean;         // 系统托盘
  readonly notifications: boolean;      // 桌面通知
}
```

### 3.2 功能降级矩阵

| 能力 | PC (Tauri) | Web | 降级策略 |
|------|:---:|:---:|------|
| RPC 调用 | `invoke()` → Rust | `fetch('/api/invoke')` → HTTP | 零修改，同签名 |
| 文件系统 | Tauri FS plugin | IndexedDB VFS | 透明适配 |
| 文件对话框 | 原生 OS | `<input type="file">` | 功能等价 |
| 终端 (PTY) | ✅ | ❌ 隐藏 | `capabilities.nativeProcess=false` → 面板不挂载 |
| 调试 (DAP) | UDS | WebSocket | 协议不变，传输不同 |
| 系统托盘 | ✅ | ❌ 隐藏 | `capabilities.systemTray=false` |
| 桌面通知 | OS Notification | ServiceWorker + toast | 降级 |
| 项目持久化 | 文件系统目录 | IndexedDB bundles | `saveProject/loadProject` 适配 |

### 3.3 与 VS Code 双模式的对应

| VS Code 策略 | AUDESYS 策略 |
|-------------|-------------|
| `IFileService` 抽象 | `IPlatformAdapter.fs` 方法 |
| `ICommandService` | `IPlatformAdapter.invoke()` |
| `browser` 扩展入口字段 | `PluginManifest.browser` |
| `extensionKind: 'web'` | `capabilities` 标记 + 降级逻辑 |
| vscode.dev 限制（无终端/调试器） | capabilities-based 面板条件挂载 |

---

## 4. CommandRegistry — 统一命令系统

### 4.1 接口设计

```typescript
interface ICommandDescriptor {
  id: string;                          // "compiler.st.compile"
  handler: (adapter: IPlatformAdapter, ...args: unknown[]) => Promise<unknown>;
  metadata: CommandMetadata;
  priority?: 'high' | 'normal' | 'low';
  precondition?: () => boolean;        // 运行时门控（如 Web 模式禁用 sim 命令）
}

interface CommandMetadata {
  label: string;                       // "Compile ST"
  description?: string;
  category: string;                    // "Compiler"
  keybinding?: string;                 // "Ctrl+Shift+B"
  aliases?: string[];                  // 次级命令名
}
```

### 4.2 命令分类体系

37 个命令，7 个命名空间（当前 33 个 Tauri 命令 + 4 个新增）：

| 命名空间 | 命令数 | 示例 |
|----------|:---:|------|
| `compiler.*` | 8 | compiler.st.compile, compiler.gcode.compile, compiler.run |
| `project.*` | 4 | project.open, project.create, project.file.read |
| `deploy.*` | 2 | deploy.program, deploy.hal_config |
| `signal.*` | 3 | signal.read, signal.snapshot |
| `controller.*` | 11 | controller.debug.pause/resume/step, controller.debug.breakpoint.*, controller.metrics.* |
| `sim.*` | 7 | sim.control.start/stop/step, sim.modbus.*, sim.scenes.*, sim.faults.* |
| `hmi.*` | 2 | hmi.layout.save, hmi.layout.load |

### 4.3 快捷键绑定

| 快捷键 | 命令 |
|--------|------|
| F5 | compiler.run |
| F9 | controller.debug.breakpoint.add |
| F10 | controller.debug.step |
| Ctrl+Shift+B | compiler.st.compile |
| Ctrl+O | project.open |
| Ctrl+S | hmi.layout.save |

### 4.4 与 PlatformAdapter 集成

```typescript
class CommandRegistry {
  execute(id: string, ...args: unknown[]): Promise<unknown> {
    const cmd = this.commands.get(id);
    return cmd.handler(this.adapter, ...args);
  }
}

// PC 模式: handler 内部调用 adapter.invoke() → Tauri
// Web 模式: handler 内部调用 adapter.invoke() → fetch('/api/invoke')
```

---

## 5. PanelSystem — 面板布局引擎

### 5.1 PanelDescriptor

```typescript
interface PanelDescriptor {
  id: string;                         // "audesys.st-compiler.editor"
  title: string;                      // "ST Editor"
  icon: string;                       // Lucide icon name
  defaultPosition: PanelPosition;
  factory: () => Promise<ComponentType<PanelProps>>;  // lazy import
  minWidth?: number;
  defaultWidth?: number;
}

type PanelPosition = 'sidebar.left' | 'sidebar.right' | 'editor' | 'panel.bottom' | 'statusbar';

interface PanelProps {
  panelId: string;
  platform: IPlatformAdapter;
  commands: ICommandRegistry;
}
```

### 5.2 布局引擎

PanelSystem 收集所有已注册的 PanelDescriptor，按 `defaultPosition` 分配到 5 个区域。面板组件通过 `factory()` 懒加载——仅在面板首次可见时执行 `import()`。

---

## 6. 与 VS Code 架构对比

| 设计维度 | VS Code | AUDESYS Studio |
|---------|---------|---------------|
| 插件入口 | `activate(context)` / `deactivate()` | 同模式 |
| 激活事件 | 25 种 activationEvents | 5 种（P1 核心子集） |
| 贡献点 | 20+ 种 contributes | 5 种（languages, commands, panels, toolbar, settings） |
| 命令系统 | CommandsRegistry (priority-linked-list) | 同模式 |
| 面板系统 | Webview + TreeView + CustomEditor | PanelDescriptor + PanelSystem |
| 平台抽象 | `IFileService` + `ICommandService` | `IPlatformAdapter`（整合） |
| 双模式机制 | `browser` 入口字段 + `extensionKind` | `browser` 字段 + `capabilities` |
| 进程隔离 | Extension Host (独立进程 + RPC) | P1: 同进程 lazy import; P2+: Web Worker |
| 插件格式 | VSIX (ZIP) | JSON manifest + ES module |
| 插件市场 | Microsoft Marketplace (60K+) | P1: 内置 manifests; P3+: 私有仓库 |

**借鉴的核心模式**：
1. activate/deactivate 生命周期（VS Code 10 年验证）
2. activationEvents 延迟加载（防止启动膨胀）
3. commands 统一切入点（从菜单、快捷键、面板均可触发）
4. browser 双入口字段（Web 迁移零架构变更）
5. IFileService 抽象模式（PlatformAdapter 的设计来源）

---

## 7. P1 范围与约束

**P1 当前实现状态**：

| 目标 | 状态 | 说明 |
|------|:----:|------|
| PluginRegistry（Manifest Scan + Lifecycle） | ❌ 未实现 | 设计已定，无代码 |
| CommandRegistry（7 命名空间 37 命令） | 🟡 骨架就绪 | 897 行代码，仅有 `read_controller_signal` 1 个命令通过注册系统 |
| PanelSystem（PanelDescriptor 布局引擎） | ❌ 未实现 | App.tsx 硬编码渲染 switch(panel) |
| PlatformAdapter（PC/Web 双模式） | 🟡 PC 已实现 | 578 行代码，但 57 文件绕过它直接 import invoke |
| 12 个现有面板作为 built-in plugins 注册 | ❌ 未实现 | 等待 PanelSystem |
| PC 模式完整可用 | ✅ 可用 | Tauri 全功能 |
| Web 模式骨架就绪 | ❌ 未实现 | 等待 PlatformAdapter 接线 |

**P1 明确不做**：

| 不做 | 理由 |
|------|------|
| Marketplace / 插件商店 | P1 内部工具，无分发需求 |
| VSIX 打包 | Tauri 无 VSIX 等效物 |
| 热加载 (Hot Reload) | 增加复杂度，P1 无需求 |
| WASM 沙箱 | 内部代码可信 |
| Web Extension (Web Worker) | P2 引入 `runtime: 'wasm'` |
| `when` clause 条件可见性 | P1 面板总是可见或按 activationEvent 激活 |
| 面板拖放/停靠 | P1 固定布局 |

---

## 参考资料

- `docs/architecture.md` §三.8 — Studio 插件架构概览
- `docs/architecture.md` §六 — 双平台 Web 迁移路径
- `docs/reference/vscode.md` — VS Code 插件化 IDE 参考分析
- `.agents/memorys/decisions.md` — D58 (插件架构), D59 (PC/Web 双模式)
