# VS Code — 插件化 IDE 与 Web/Desktop 双模式参考

> 生成日期：2026-07-19
> 研究目的：为 AUDESYS Studio 插件架构和 PC/Web 双平台部署策略提供架构参考
> 参考价值维度：插件系统设计、命令体系、Web/Desktop 适配层、扩展市场、进程隔离模型
> 数据来源：GitHub 仓库 microsoft/vscode（165K+ stars）、官方 API 文档、coder/code-server（76K+ stars）、Eclipse Theia
> 活跃参考 — 项目持续活跃，月度发布

---

## 1. 产品画像

### 1.1 基本信息

- **产品全称**: Visual Studio Code（简称 VS Code）
- **开发商**: Microsoft
- **首次发布**: 2015 年 4 月 29 日（Preview），2016 年 4 月 14 日（1.0）
- **开源协议**: MIT License
- **当前版本**: 1.100+（月度发布，2026 年 7 月）
- **GitHub**: https://github.com/microsoft/vscode
- **官方网站**: https://code.visualstudio.com
- **Web 版本**: https://vscode.dev
- **GitHub Stars**: 165,000+（截至 2026 年 7 月）
- **贡献者**: 20,000+
- **核心技术栈**: Electron + TypeScript + HTML/CSS (Desktop), Web Worker + WebAssembly (Web)

### 1.2 产品定位与核心价值主张

VS Code 是全球最流行的代码编辑器/轻量级 IDE，定位为「面向开发者的通用编辑器平台」。其核心竞争力在于：

- **插件化架构**：核心极简，所有语言支持、调试、主题、面板通过扩展提供。内置功能也通过 `IWorkbenchContribution` 接口以插件方式注册
- **Web 原生设计**：基于 Electron（TypeScript + HTML + CSS），天然支持 Web 迁移
- **开放生态**：VS Code Marketplace 60,000+ 扩展，覆盖几乎所有编程语言和工作流
- **LSP/DAP 标准化**：定义并推广了 Language Server Protocol 和 Debug Adapter Protocol 两大行业标准，被 100+ 编辑器采用
- **工业 IDE 取代 Eclipse**：Beckhoff TwinCAT、CODESYS、Siemens TIA Portal 等工业 IDE 正从 Eclipse RCP 迁移到 VS Code + Theia

### 1.3 关键指标

| 指标 | 数值 |
|------|:--:|
| Marketplace 扩展总数 | 60,000+ |
| 扩展分类 | 18 种（语言、主题、调试、代码片段等） |
| 月活跃安装 | 数百万 |
| 发布者数 | 20,000+ |
| 扩展 API 数量 | 4,000+ (vscode.d.ts) |
| 激活事件类型 | 25 种 |
| 贡献点类型 | 20+ 种 |
| 月下载量 (code-server Docker) | 100M+ |

---

## 2. 技术架构

### 2.1 整体架构模型

```
┌─────────────────────────────────────────────────────────────────┐
│                      VS Code 多进程架构                           │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Renderer Process (Chromium)                │  │
│  │  ┌───────────┐ ┌──────────────┐ ┌──────────────────────┐  │  │
│  │  │ Workbench  │ │   Editor     │ │   Extensions UI       │  │  │
│  │  │ (面板/菜单) │ │ (Monaco核心) │ │ (Webview/TreeView)   │  │  │
│  │  └───────────┘ └──────────────┘ └──────────────────────┘  │  │
│  └──────────────────────────┬────────────────────────────────┘  │
│                              │ IPC (RPCProtocol 二进制协议)       │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │                  Main Process (Electron)                    │  │
│  │  ┌──────────────────────┐ ┌──────────┐ ┌──────────────┐   │  │
│  │  │ ExtensionHostStarter  │ │  File    │ │ Task/Debug   │   │  │
│  │  │ (子进程生命周期管理)    │ │  System  │ │ /Terminal    │   │  │
│  │  └──────────────────────┘ └──────────┘ └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
│                              │ spawn                             │
│  ┌──────────────────────────┴────────────────────────────────┐  │
│  │          Extension Host Process (Node.js / Web Worker)      │  │
│  │  ┌──────────────────────────────────────────────────────┐  │  │
│  │  │  ExtensionHostMain  ← RPCProtocol →  Workbench       │  │  │
│  │  │  · 所有扩展运行在这一进程中                             │  │  │
│  │  │  · 崩溃不影响编辑器核心                                 │  │  │
│  │  │  · JS Proxy 透明跨进程调用                            │  │  │
│  │  └──────────────────────────────────────────────────────┘  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                   │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Language / Debug Servers (独立进程)            │  │
│  │  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────────┐   │  │
│  │  │ LSP  │ │ LSP  │ │ DAP  │ │ DAP  │ │   任意语言    │   │  │
│  │  │ Rust │ │  TS  │ │ Node │ │  Go  │ │              │   │  │
│  │  └──────┘ └──────┘ └──────┘ └──────┘ └──────────────┘   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### 2.2 核心进程模型

| 进程 | 职责 | 技术栈 | 关键文件路径 |
|------|------|--------|-------------|
| **Main Process** | 窗口管理、文件系统、进程生命周期 | Electron (Node.js) | `src/vs/code/electron-main/` |
| **Renderer Process** | UI 渲染、编辑器、面板、状态管理 | HTML/CSS/TypeScript (Chromium) | `src/vs/workbench/` |
| **Extension Host** | 独立 Node.js 进程，运行所有扩展代码 | Node.js (Desktop) / Web Worker (Web) | `src/vs/workbench/api/common/extensionHostMain.ts` |
| **Language Servers** | 独立的语言分析进程，通过 LSP JSON-RPC 通信 | 任意语言 | 独立进程 |
| **Debug Adapters** | 调试运行时，通过 DAP 通信 | 任意语言 | 独立进程 |

**ExtensionHostKind 枚举**（定义在 `extensionHostKind.ts`）:
- `LocalProcess = 1` — Node.js 子进程（Desktop Electron）
- `LocalWebWorker = 2` — Web Worker（浏览器/vscode.dev）
- `Remote = 3` — 远程 SSH/Container/Tunnel extension host

### 2.3 RPC 协议 (Main ↔ Extension Host)

VS Code 使用自定义的 **二进制 RPC 协议**（非 JSON-RPC，非 gRPC）进行进程间通信：

**关键实现**: `src/vs/workbench/services/extensions/common/rpcProtocol.ts`

```typescript
export class RPCProtocol extends Disposable implements IRPCProtocol {
    // 12 种消息类型：RequestJSONArgs, Acknowledged, Cancel,
    // ReplyOKEmpty, ReplyOKJSON, ReplyOKVSBuffer, ReplyErrError 等
    // 支持 VSBuffer 零拷贝二进制传输
    // JS Proxy 透明 RPC: getProxy<T>(identifier)
}
```

**设计模式**:
- **JS Proxy** 对象实现透明的跨进程方法调用
- **ProxyIdentifier** 类型化 RPC 接口
- 双向服务注册: `rpcProtocol.set(identifier, implementation)`
- **MessageBuffer** 二进制协议，12 种 `MessageType` 变体
- 支持 cancellation tokens、VSBuffer 二进制传输、URI transformers

**命名约定**: `ExtHost*Shape` 和 `MainThread*Shape` 接口定义契约:
- `ExtHostWebviewsShape` — ext host 暴露的实现，main thread 调用
- `MainThreadWebviewsShape` — main thread 暴露的实现，ext host 调用

### 2.4 平台抽象层 (src/vs/ 目录结构)

```
src/vs/
├── base/                 # 零依赖工具库
├── platform/             # 平台抽象服务层
│   ├── commands/         # CommandsRegistry + ICommandService
│   └── extensions/       # IExtensionDescription + IExtensionService
├── editor/               # ☆ Monaco Editor 核心 (浏览器的)
│   ├── common/           # 编辑器模型、文本模型、tokenization
│   ├── browser/          # 渲染、CodeEditorWidget
│   └── contrib/          # 编辑器扩展（查找、折叠等）
├── workbench/
│   ├── common/           # 平台无关 workbench 逻辑
│   ├── browser/          # Browser 实现（Electron + Web 共用）
│   │   └── web.api.ts    # ☆ IWorkbenchConstructionOptions (Web 嵌入配置)
│   ├── electron-browser/ # Electron 特定（Node.js API 可用）
│   ├── electron-main/    # ☆ Main Process 专用
│   └── api/
│       ├── common/       # ExtHost 公共
│       ├── browser/      # ExtHost 浏览器/WebWorker
│       └── node/         # ExtHost Node.js 进程
```

### 2.5 Web/Desktop 双模式架构

```
┌─────────────────────────────────────────────────────────┐
│              VS Code Platform Abstraction                │
│                                                           │
│  ┌─────────────────────┐        ┌─────────────────────┐  │
│  │  Desktop (Electron)  │        │  Web (Browser)       │  │
│  │                      │        │                      │  │
│  │  · Node.js FS       │        │  · OPFS/IndexedDB   │  │
│  │  · Native Dialog    │        │  · <input> dialog    │  │
│  │  · Child Process    │        │  · Web Worker        │  │
│  │  · Terminal pty     │        │  · xterm.js (wasm)   │  │
│  │  · Full Debug       │        │  · Debug via WS      │  │
│  │  · Extension Node   │        │  · Extension WebWkr  │  │
│  └──────────┬──────────┘        └──────────┬──────────┘  │
│             │                              │               │
│             └──────────┬───────────────────┘               │
│                        ▼                                    │
│            ┌─────────────────────┐                         │
│            │  Shared Code Base   │                         │
│            │  (TypeScript + CSS) │                         │
│            └─────────────────────┘                         │
└─────────────────────────────────────────────────────────┘
```

| 能力 | Desktop | Web (vscode.dev) |
|------|:---:|:---:|
| 代码编辑 | ✅ | ✅ |
| 语法高亮 | ✅ | ✅ |
| LSP 语言智能 | ✅ | ✅ (Web Worker) |
| 终端 (Terminal) | ✅ | ❌ 不可用（浏览器沙箱无 shell） |
| 调试 (Debugger) | ✅ | ❌ 不可用（无 runtime） |
| 文件系统 | ✅ (Node fs) | ⚠️ OPFS/File API (Chrome/Edge only) |
| 扩展 | ✅ (Node.js) | ⚠️ Web Extensions (无原生模块) |
| Git | ✅ | ✅ (wasm-git) |
| 构建/运行 | ✅ | ❌ |
| 键盘快捷键 | ✅ 完整 | ⚠️ 浏览器拦截部分快捷键 |

**vscode.dev 升级路径**: 提供 "Continue Working On..." 命令一键切换到:
- 本地 VS Code Desktop（克隆仓库到本地）
- GitHub Codespaces（创建云端开发环境）
- Remote Tunnels（连接到自己的计算实例）

### 2.6 第三方 Web 研究方案

#### code-server (coder/code-server) — 76K+ stars

**架构**: 通过 git submodule 拉取 VS Code 源码，以 patch 文件方式修改。后端为 Node.js HTTP 服务器，提供认证、TLS、端口代理。

| 维度 | 说明 |
|------|------|
| 终端 | ✅ 完整（服务器上运行真实 shell） |
| 文件系统 | ✅ 完整 |
| 扩展市场 | ⚠️ Open-VSX（不能使用 Microsoft Marketplace，ToS 禁止） |
| 缺失扩展 | Live Share、Remote Extensions (SSH/Container/WSL) |
| 安全 | 密码认证 + hashed password + TLS + healthz 端点 |
| 配置 | `~/.config/code-server/config.yaml` |

**关键教训**: 证明了 "服务器端运行 + 浏览器前端" 在 IDE 场景完全可行，但扩展生态受限于 Market 使用条款。

#### Eclipse Theia — 20K+ stars

**定位**: Cloud & Desktop IDE Framework（不仅是 IDE，是构建 IDE 的框架）

**关键特征**:
- **Web-native 从零设计**: 非 VS Code fork/patch，独立架构
- **共用 Monaco Editor**: 与 VS Code 使用相同的文本编辑器核心
- **VS Code 扩展 API 兼容**: 有 API 兼容性报告
- **双模式**: 同一代码库可运行在浏览器（Cloud）和 Electron（Desktop）
- **VS Code 配置不兼容**: 不能复用 VS Code 配置文件
- **使用案例**: Espressif IDF Web IDE (ESP32)、YottaDB Dashboard

#### Gitpod / Ona

**方案**: Docker 容器工作区 + 浏览器前端。容器内提供完整 Linux 环境，终端通过 WebSocket + xterm.js 连接到浏览器。核心思路: 不在浏览器里解决文件系统和终端问题，在云端提供真实 Linux 容器。

---

## 3. 特性概览 — 插件系统深度分析

### 3.1 扩展 API (`vscode.d.ts`)

VS Code 提供 4,000+ 个 API 接口，是业界最成熟的 IDE 扩展 API：

```typescript
// 扩展激活入口 — package.json 中 main 字段指向此文件
export function activate(context: vscode.ExtensionContext) {
    // 注册命令
    context.subscriptions.push(
        vscode.commands.registerCommand('myExt.hello', () => {
            vscode.window.showInformationMessage('Hello');
        })
    );
    // 可选：暴露 API 给其他扩展
    return { doSomething() { /* ... */ } };
}

export function deactivate() {
    // 清理资源
}
```

**核心 API 类别**: `vscode.window` (UI), `vscode.workspace` (文件系统), `vscode.languages` (LSP), `vscode.debug` (DAP), `vscode.commands` (命令), `vscode.tasks` (任务)

### 3.2 贡献点 (Contribution Points) — 完整列表

扩展通过 `package.json` 的 `contributes` 字段声明功能。以下是 VS Code 支持的完整贡献点列表：

| 贡献点 | 用途 | AUDESYS 对应 | 优先级 |
|--------|------|-------------|:---:|
| `commands` | 注册命令（快捷键绑定） | Tauri commands → Command Registry | P1 |
| `languages` | 语言定义（语法高亮、括号匹配、自动缩进） | 6 语言编译器注册 | P1 |
| `views` | 自定义面板（TreeView、WebviewView） | 8 面板系统 → PluginRegistry | P1 |
| `viewsContainers` | 面板容器（activitybar/panel/editor） | 面板布局区域 | P1 |
| `menus` | 菜单项扩展（全局菜单、右键菜单、view/item/context） | 右键菜单系统 | P2 |
| `debuggers` | 调试适配器（DAP 适配器注册） | 已有 DAP 12 命令 | ✅ |
| `themes` | 颜色主题 | 工业琥珀色主题 | P2 |
| `iconThemes` | 图标主题 | 工业图标集 | P3 |
| `snippets` | 代码片段（按语言） | ST/IL/G-code snippets | P2 |
| `keybindings` | 快捷键绑定（when 条件表达式） | 编辑器快捷键系统 | P2 |
| `taskDefinitions` | 任务定义（构建、部署、测试） | 构建与部署任务 | P3 |
| `configuration` | 配置项（settings UI） | 编辑器/项目配置 | P2 |
| `customEditors` | 自定义编辑器（文件类型 → 编辑器映射） | HMI 布局编辑器、LD 编辑器 | P1 |
| `grammars` | TextMate 语法高亮定义 | 6 语言语法高亮 | P2 |
| `notebooks` | Notebook 支持 | 调试日志 notebook | P3 |
| `walkthroughs` | 入门引导 | Quick Start 向导 | P3 |
| `authentication` | 认证提供者 | 企业 LDAP/OAuth | P3 |
| `codeActions` | 代码操作（快速修复） | ST/FBD 代码重构 | P3 |
| `colors` | 颜色定义（供主题使用） | 设计系统色板 | P2 |
| `localizations` | 本地化语言包 | 中文/英文 | P3 |
| `chatParticipants` | AI Chat 参与者 | AI 辅助编程 | P3 |

### 3.3 Activation Events — 25 种延迟激活事件

扩展按需激活，减少启动时间。VS Code 1.74+ 自动从 `contributes` 推断激活事件。

| 激活事件 | 触发条件 | AUDESYS 应用 |
|---------|---------|-------------|
| `onLanguage:st` | 打开 ST 文件 | 延迟加载 ST 编译器/编辑器 |
| `onLanguage:gcode` | 打开 G-code 文件 | 延迟加载 CNC 面板 |
| `onCommand:audesys.deploy` | 执行部署命令 | 延迟加载部署流程 |
| `onView:signalWatch` | 展开信号监视面板 | 延迟加载信号绑定 |
| `onView:hmiCanvas` | 展开 HMI 设计面板 | 延迟加载 HMI Builder |
| `onDebug` | 启动调试会话 | 延迟加载 DAP 面板 |
| `onStartupFinished` | VS Code 启动完成 | 非关键面板延迟注册 |
| `workspaceContains:**/*.st` | 工作区含 ST 文件 | 自动激活 ST 语言支持 |
| `onFileSystem:hal` | 访问 HAL 文件系统 | 虚拟文件系统提供者 |
| `onCustomEditor:hmiLayout` | 打开 HMI 布局编辑器 | HMI 自定义编辑器 |
| `*` | 启动时立即激活 | ⚠️ 仅核心面板，不推荐滥用 |

**扩展生命周期**:
```
Extension Host 启动
  ↓ 读取 package.json → 注册贡献点（commands, views, menus 等）
等待 activationEvents 触发
  ↓ 触发 → 调用 activate(context) 一次且仅一次
运行中 → 通过 context.subscriptions 管理资源
  ↓
deactivate() 或进程退出 → 清理
```

### 3.4 扩展描述接口 (`IExtensionDescription`)

VS Code 内部描述扩展的完整 TypeScript 接口 (`src/vs/platform/extensions/common/extensions.ts`)：

```typescript
interface IExtensionDescription {
    identifier: ExtensionIdentifier;  // "publisher.name"
    name: string;
    version: string;
    publisher: string;
    engines: { vscode: string };
    main?: string;        // Node.js 入口文件
    browser?: string;     // Web Worker 入口文件（双模式关键字段）
    activationEvents?: string[];
    contributes?: IExtensionContributions;
    extensionKind?: ExtensionKind | ExtensionKind[];  // 'ui' | 'workspace' | 'web'
    enabledApiProposals?: string[];
}
```

**`browser` 字段**: 双模式的核心机制。扩展可提供两个入口点——`main` 用于桌面（Node.js 全能力）、`browser` 用于 Web（受限 Web Worker）。未提供 `browser` 的扩展在 Web 模式下不可用。

### 3.5 VSIX 打包格式

```
myextension.vsix (ZIP 包)
├── package.json        # 扩展清单（必需）
│   · name (全小写无空格，市场唯一)
│   · version (SemVer)
│   · publisher (发布者标识)
│   · engines.vscode (兼容版本)
│   · main / browser (入口文件)
│   · activationEvents (延迟激活)
│   · contributes (UI 贡献点)
├── README.md           # 市场展示
├── CHANGELOG.md        # 变更日志
├── LICENSE             # 许可证
├── extension.js        # 编译后的扩展代码
├── node_modules/       # 生产依赖（自动打包）
└── images/             # 图标等资源
```

**发布命令**: `vsce publish`（自动版本递增）
**离线安装**: `code --install-extension my-extension.vsix`
**企业分发**: 通过 `.vscode/extensions/` 目录直接部署

### 3.6 命令系统 (Command Pattern)

VS Code 的核心设计模式：「Everything is a Command」。

```typescript
// src/vs/platform/commands/common/commands.ts
export const CommandsRegistry: ICommandRegistry = new class {
    private readonly _commands = new Map<string, LinkedList<ICommand>>();
    // priority-linked-list: 允许多个 handler per command
    // 最近注册的 handler 获得最高优先级
};

export interface ICommandService {
    executeCommand<R>(commandId: string, ...args: unknown[]): Promise<R>;
}
```

```
用户操作 → command ID → command handler → 结果
              ↑
    (可从菜单、快捷键、面板操作、扩展 API、自动化测试触发)
```

**多层触发**: 同一命令可从 6+ 种 UI 入口或编程接口触发，handler 只需注册一次。

**AUDESYS 应用**: 33 个 Tauri 命令可重构为统一的 Command Registry。Web 模式下通过 HTTP API 调用相同的 command ID。

---

## 4. 生态与现状

### 4.1 Marketplace 数据与审核

| 指标 | 数值 |
|------|:--:|
| 总扩展数 | 60,000+ |
| 分类 | 18 种（语言、片段、代码检查、主题、调试、格式化器、快捷键、SCM、扩展包、语言包、数据科学、机器学习、可视化、Notebook、教育、测试、AI、其他） |
| 月活跃安装 | 数百万 |
| 发布平台 | Azure DevOps（2026.12 将迁移至 Microsoft Entra ID） |
| 审核机制 | 自动化（无人工审核）、恶意软件扫描、社区举报 |
| 信任标识 | Verified Publisher（需域名 DNS TXT 验证 + 6 个月发布历史） |

### 4.2 工业/嵌入式相关扩展

**PLC / IEC 61131-3:**
- **CODESYS Extension** — IEC 61131-3 开发（ST, LD, FBD, SFC），OPC UA 支持
- **Beckhoff TwinCAT** — TwinCAT PLC 项目编辑，AD 通信
- **PLC Ladder Logic** — LD 梯形图语法高亮
- **Structured Text (ST)** — IEC 61131-3 ST 语法支持

**SCADA / HMI / 工业 IoT:**
- **Ignition** — Inductive Automation SCADA 平台 Python 脚本开发
- **MQTT Explorer** — MQTT 协议调试
- **OPC UA Client** — 浏览/监控 OPC UA 服务器节点

**CNC / 运动控制 / 嵌入式:**
- **G-Code / CNC** — G-code 语法高亮、预览
- **GRBL Extension** — GRBL 固件 G-code 发送器和监控
- **PlatformIO** — 嵌入式 MCU 跨平台开发（Arduino, ESP32, STM32）
- **Cortex-Debug** — ARM Cortex-M 调试（J-Link, OpenOCD）

**关键趋势**: 工业 IDE 正从专有编辑器（Eclipse RCP）转向 VS Code + LSP/DAP 插件模式。

### 4.3 LSP/DAP 标准化影响

| 协议 | 版本 | 通信 | 采用 |
|------|:---:|------|------|
| **LSP** (Language Server Protocol) | 3.18 | JSON-RPC 2.0 over stdio/pipe/socket | 100+ 编辑器/IDE |
| **DAP** (Debug Adapter Protocol) | 1.71.0 | JSON over stdio | 50+ 调试适配器实现 |

**LSP 核心消息**: `textDocument/completion`, `definition`, `references`, `hover`, `signatureHelp`, `formatting`, `documentSymbol`, `codeAction`, `workspace/symbol`

**DAP 核心消息**: `initialize`, `launch`, `attach`, `setBreakpoints`, `continue`, `next`, `stepIn`, `stepOut`, `threads`, `stackTrace`, `scopes`, `variables`, `evaluate`

AUDESYS 当前已实现 DAP（12 命令），可与 VS Code 生态完全互操作。LSP Server 可通过 `audesys-st-compiler` 等编译器扩展实现。

---

## 5. 市场定位 — 与其他 IDE 平台对比

### 5.1 IDE 平台矩阵

| 维度 | VS Code | IntelliJ Platform | Eclipse RCP | Theia | Atom (停更) |
|------|---------|-------------------|-------------|-------|-------------|
| 编辑器核心 | Monaco Editor | 自研 PSI 树 | SWT/StyledText | Monaco Editor | 自研 |
| 插件语言 | TypeScript/JS | Java/Kotlin | Java | TypeScript/JS | CoffeeScript/JS |
| Web 支持 | vscode.dev | Gateway | ❌ (RAP 有限) | ✅ 原生 | ❌ |
| 启动速度 | 快 (~2s) | 中 (~5-10s) | 慢 (~10-20s) | 中 (~3-5s) | 中 |
| 扩展数量 | Marketplace 60K+ | Plugins 30K+ | ~2K | Open VSX 3K+ | 停更 |
| 进程隔离 | Extension Host | Plugin ClassLoader | OSGi Bundles | Extension Host | 原生 |
| 许可证 | MIT | Apache 2.0/Commercial | EPL | EPL/MIT | MIT |
| AI 扩展 | 原生支持 (Chat/LM/MCP) | AI Assistant 插件 | 无 | 社区 | 无 |
| 工业采用 | Beckhoff, CODESYS, Siemens | IntelliJ Android | CODESYS v2, TwinCAT v2 | Beckhoff vNext | 无 |

### 5.2 Tauri vs Electron — 插件化 IDE 场景对比

| 维度 | Tauri (AUDESYS 当前) | Electron (VS Code) |
|------|----------------------|-------------------|
| 包体积 | ~5-10 MB | ~120 MB+ |
| 内存占用 | ~50 MB | ~150 MB+ |
| 后端语言 | ✅ Rust (编译为原生) | Node.js (JS 运行时) |
| WebView | OS 原生 (WebKit/WebView2/WebKitGTK) | 捆绑 Chromium |
| 渲染一致性 | ⚠️ 跨平台 ≤3% 像素差异 | ✅ Chromium 完全一致 |
| **插件热加载** | ❌ 编译时集成 (Rust crate) | ✅ 运行时 `require()` |
| **动态扩展安装** | ❌ 需自定义 IPC 协议 | ✅ Extension Host 原生支持 |
| 安全模型 | ✅ Rust 内存安全 + 最小权限 | Node.js 沙箱 + contextIsolation |
| 生态成熟度 | 年轻（v2 稳定） | 成熟（10年+ 百万级应用） |
| 工业环境 | ✅ 小体积适合嵌入工控 | ⚠️ 体积大 |

**核心差异**: Electron 的 Node.js 运行时允许动态加载扩展代码，天然匹配 VS Code Extension Host 模型。Tauri 插件是编译时集成的 Rust crate，无法实现运行时动态安装/卸载。对于 AUDESYS 若需要动态扩展市场，需自定义 IPC 扩展协议（类似 LSP 式的独立进程通信）或评估 Electron。

---

## 6. 产品特色 — 可借鉴的设计模式

### 6.1 命令系统 (Everything is a Command)

每个功能注册为命令，通过 `commandService.executeCommand('workbench.action.files.save')` 调用。天然支持可扩展性——新扩展只需注册新命令。

**AUDESYS 应用**: 将 33 个 Tauri 命令重构为统一的 Command Registry接口。Web 模式下通过 HTTP API 调用相同的 command ID。

### 6.2 Monaco Editor 关系 — 编辑器即核心

VS Code 的编辑器源码 (`src/vs/editor/`) 就是 Monaco Editor 核心。Monaco 的 standalone npm 包是从同一个 monorepo 构建的。CodeMirror 6 是 AUDESYS 的 Monaco 等价物。

### 6.3 扩展沙箱 (Extension Sandbox)

Extension Host 独立进程确保：扩展崩溃不影响编辑器核心、扩展通过 Workspace API 间接访问文件系统（非直接 fs）、安全边界清晰。

**AUDESYS 应用**: 第三方 HMI Widget 可在沙箱中运行，通过 PlatformAdapter 受限访问 HAL 信号。

### 6.4 DI 容器 — 服务注册与发现

VS Code 使用依赖注入容器管理 100+ 内部服务。每个服务通过 `I*Service` 接口定义契约。

**AUDESYS 应用**: PluginRegistry 可作为轻量 DI 容器，管理面板、命令、文件系统提供者等。

### 6.5 远程开发扩展模式

Remote SSH / Containers / WSL 扩展将 Extension Host 分流到远程机器。本地仅运行 UI Shell，扩展和语言服务在远程运行。

**AUDESYS 应用**: Studio 可通过 Remote 模式连接到 Controller（Runtime）上的 Extension Host，实现远程调试和部署。

### 6.6 渐进式 Web 迁移策略

VS Code Web 通过以下策略实现:
1. **抽象文件系统**: `IFileService` → Desktop 用 `fs`, Web 用 IndexedDB
2. **终端模拟**: Desktop 用 `node-pty`, Web 用 `xterm.js` + WebSocket
3. **扩展兼容**: `browser` 字段决定 Web 可用性
4. **架构差异**: 某些能力仅桌面可用，Web 优雅降级

---

## 7. 对 AUDESYS 参考价值

### 7.1 插件架构映射

| VS Code 模式 | AUDESYS 映射 | 优先级 | 关键文件/路径 |
|-------------|-------------|:---:|------|
| Extension Host 进程隔离 | PluginRegistry + 独立 Web Worker | P1 | `src/vs/workbench/api/common/extensionHostMain.ts` |
| Command System | Unified Command Registry | P1 | `src/vs/platform/commands/common/commands.ts` |
| Contribution Points | StudioPlugin manifest + `contributes` | P1 | `src/vs/platform/extensions/common/extensions.ts` |
| Activation Events | `onLanguage` / `onCommand` / `onView` 映射 | P1 | package.json `activationEvents` |
| IExtensionDescription | StudioPluginDescriptor 结构体 | P1 | 含 `main`/`browser` 双入口字段 |
| Webview 面板 | HMI Canvas + Signal 监视面板 | P2 | `src/vs/workbench/api/browser/mainThreadWebviews.ts` |
| TreeView | ProjectTree 重构 | P2 | `src/vs/workbench/common/views.ts` |
| Custom Editor | LD/SFC/HMI 布局编辑器 | P1 | package.json `customEditors` |
| StatusBar API | StatusBar 统一接口 | P2 | `vscode.window.createStatusBarItem()` |
| VSIX 打包 | 插件 `.zip` 分发格式 | P3 | |


### 7.2 双平台适配映射

| VS Code Web 策略 | AUDESYS 策略 |
|------------------|-------------|
| `IFileService` 抽象层 | `PlatformAdapter.fs` trait |
| `ICommandService` 统一入口 | `PlatformAdapter.invoke()` |
| `browser` 扩展字段 | `plugin.capabilities` 声明 + `platformTarget` |
| OPFS/IndexedDB | Web adapter 使用 IndexedDB |
| IWorkbenchConstructionOptions | `StudioConfig.webMode` 配置 |
| File System Provider API | HAL 虚拟文件系统 Provider |
| "Continue Working On..." 迁移 | Desktop ↔ Web 模式切换 |
| WebSocket 远程终端 | Signal WebSocket 桥接 |

### 7.3 关键教训矩阵

| VS Code 成功经验 | AUDESYS 应采纳 | AUDESYS 应避免的陷阱 |
|-----------------|---------------|-------------------|
| ✅ 核心极简，功能全插件 | ✅ PluginRegistry 驱动面板 | ❌ 不要过度设计 Plugin API v1 |
| ✅ LSP/DAP 成为行业标准 | ✅ 继续推进 DAP 兼容 + LSP | — |
| ✅ Electron → Web 渐进迁移 | ✅ Tauri → Web adapter 增量构建 | ❌ 不要同时做双模式 + 插件架构 |
| ✅ Marketplace 生态飞轮 | 延后 P3 | ❌ P1 不要自建 Marketplace |
| ✅ MIT 开源最大化采用 | ✅ 已采用 Apache 2.0 | — |
| ✅ Extension Host 进程隔离 | ✅ Web Worker 沙箱化第三方 Widget | ❌ 不要让扩展直接访问 HAL |
| ✅ 命令系统统一 UI 入口 | ✅ Command Registry 替代 33 个裸 Tauri 命令 | ❌ 不要每种触发方式注册重复 handler |
| ⚠️ Tauri 不支持运行时插件加载 | ✅ 使用独立进程 + IPC 协议扩展 | ❌ 不要尝试 Tauri 热加载 Rust crate |

### 7.4 实施建议排序

1. **PlatformAdapter 先行** (P1, ~200 行 TS): 参考 VS Code `IFileService` + `ICommandService`，先做抽象层，替换 61 处 `@tauri-apps/*` 硬绑定
2. **Command Registry 统一** (P1, ~200 行 TS): 将所有 Tauri 命令 + 面板操作映射为 command ID，Web 模式通过 HTTP 调用
3. **Plugin Manifest 最小化** (P1, ~100 行 TS): v1 只需 `name` + `activationEvents` + `contributes.panels` + `main`/`browser`
4. **不需重造 Monaco**: CodeMirror 6 已足够好，集中资源在插件架构上
5. **参考 Theia 的路径**: 若未来需完整 Web-native IDE，Theia 的 DI 容器 + 前端-后端分离架构值得参考
6. **自定义 IPC 扩展协议** (P2): 参考 VS Code RPCProtocol 设计，为 Tauri 创建运行时扩展加载机制（独立子进程 + IPC）

---

## 参考资料

- [VS Code GitHub Repository](https://github.com/microsoft/vscode) — 架构源码参考
- [VS Code Extension API](https://code.visualstudio.com/api) — 扩展开发文档
- [VS Code Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest) — package.json 规范
- [Activation Events](https://code.visualstudio.com/api/references/activation-events) — 25 种激活事件
- [VS Code Web (vscode.dev)](https://vscode.dev) — 浏览器版
- [VS Code for the Web 文档](https://code.visualstudio.com/docs/editor/vscode-web) — Web 限制说明
- [Monaco Editor](https://github.com/microsoft/monaco-editor) — 编辑器核心
- [code-server (coder/code-server)](https://github.com/coder/code-server) — 76K+ stars，自托管方案
- [Eclipse Theia](https://theia-ide.org) — Web-native IDE 框架
- [Language Server Protocol](https://microsoft.github.io/language-server-protocol/) — v3.18
- [Debug Adapter Protocol](https://microsoft.github.io/debug-adapter-protocol/) — v1.71.0
- [VS Code Extension Samples](https://github.com/microsoft/vscode-extension-samples) — 官方示例
- [Open VSX Registry](https://open-vsx.org) — 开放扩展市场
- [Tauri Architecture](https://github.com/tauri-apps/tauri/blob/dev/ARCHITECTURE.md) — Rust 桌面框架
- [Gitpod / Ona](https://github.com/gitpod-io/gitpod) — 云端 IDE 参考
