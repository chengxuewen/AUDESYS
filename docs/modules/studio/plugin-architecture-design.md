# AUDESYS Studio 插件架构设计

> 生成日期：2026-07-19
> 依赖决策：D58 (PluginRegistry + CommandRegistry + PlatformAdapter + PanelSystem), D59 (PC/Web 双模式)
> 参考架构：VS Code Extension API（`docs/reference/vscode.md`）
> 设计目标：为 AUDESYS Studio 构建插件化编辑器平台，支持 PC (Tauri) 和 Web 双模式部署

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

| 层 | 职责 | 依赖 |
|---|------|------|
| **PluginRegistry** | 插件发现（JSON manifests）、元数据索引、生命周期管理（activate/deactivate） | PlatformAdapter（通过 PluginContext 注入） |
| **CommandRegistry** | 命名空间命令注册、到 PlatformAdapter.invoke() 的映射、快捷键绑定 | PlatformAdapter（invoke 管道） |
| **PanelSystem** | 面板布局引擎、PanelDescriptor 收集、视图容器管理 | React 组件树、PluginRegistry（获取 PanelDescriptor） |
| **PlatformAdapter** | PC/Web 模式切换、能力退化矩阵、统一 IO 抽象 | Tauri (PC) 或浏览器 API (Web) |

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
  main: string;                  // Node.js/ES module 入口
  browser?: string;              // Web 模式替代入口（双平台关键字段）
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
  languages?: LanguageContribution[];       // 语言定义
  commands?: CommandContribution[];          // 命令注册
  panels?: PanelDescriptor[];               // 面板注册
  toolbarActions?: ToolbarAction[];         // 工具栏按钮
  settings?: Record<string, SettingDescriptor>; // 配置项
  protocolAdapters?: ProtocolAdapterContribution[]; // 协议适配器
}

interface LanguageContribution {
  id: string;           // "st", "gcode"
  extensions: string[];  // [".st"], [".nc", ".gcode"]
}
```

---

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

**P1 实现的目标**：
- 四层架构就绪（PluginRegistry + CommandRegistry + PanelSystem + PlatformAdapter）
- 12 个现有面板作为 built-in plugins 注册
- 33 个 Tauri 命令映射到 7 个命名空间
- PC 模式完整可用，Web 模式骨架就绪

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
