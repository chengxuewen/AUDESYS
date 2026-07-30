# Eclipse GLSP — 图形编辑器框架

> 竞品参考文档 — 工业控制 / 自动化行业
> 调研日期：2026-07-30
> 版本：GLSP 2.x（当前 2.7.x，2.8.0-next 开发中）
> 许可：EPL-2.0 / GPL-2.0 Classpath Exception (GPLCP)
> 状态：活跃参考

---

## 1. 产品画像

| 维度 | 详情 |
|------|------|
| 官方地址 | https://projects.eclipse.org/projects/ecd.glsp |
| GitHub 组织 | https://github.com/eclipse-glsp（30+ repos） |
| 许可 | EPL-2.0 / GPL-2.0 Classpath Exception |
| 社区规模 | GitHub ~233 stars（主仓库），npm 包 40+ |
| 文档 | https://www.eclipse.org/glsp/documentation/ |
| 语言 | Java（glsp-server）+ TypeScript（glsp-client, theia-integration） |
| npm 前缀 | `@eclipse-glsp/*` |
| 构建系统 | pnpm workspace（TypeScript 仓库）；Maven（Java 仓库） |

GLSP（Graphics, Layout, Styling, and Presentation）是 Eclipse 基金会下的**完整图形编辑器框架**，提供从底层图形引擎到 IDE 集成、从协议定义到代码生成 CLI 的全栈解决方案。

**AUDESYS 调研重点**：GLSP 是 AUDESYS LD/FBD GLSP 编辑器迁移（D92）的核心框架。本文档重点覆盖仓库结构、Theia 集成模式、sprotty fork 差异、模板结构，以及 AUDESYS 实际迁移中遇到的陷阱。

---

## 2. 仓库结构

### 2.1 仓库全景

| 仓库 | 用途 | 技术栈 | 语言 | Stars |
|------|------|--------|------|-------|
| glsp | 元仓库（README、CI 配置） | — | TS | 233 |
| glsp-client | 客户端核心 + 示例 | pnpm workspace | TS | 51 |
| glsp-server-node | Node.js 服务端 + 示例 | pnpm workspace | TS | 23 |
| glsp-server | Java 服务端核心 | Maven | Java | 45 |
| glsp-server-core | Java 服务端基础组件 | Maven | Java | — |
| glsp-core | 核心框架（客户端 + TS/Node 服务端） | pnpm workspace | TS | 1 |
| glsp-theia-integration | Theia 集成 | pnpm workspace | TS | 23 |
| glsp-vscode-integration | VS Code 扩展 | pnpm workspace | TS | 26 |
| glsp-eclipse-integration | Eclipse IDE 集成 | Maven | Java | 9 |
| glsp-examples | 4 种项目模板 | 混合 | 混合 | 53 |
| glsp-website-source | 官网源码 | Vite/Docker | HTML | 2 |
| glsp-playwright | E2E 测试库 | pnpm workspace | TS | 1 |
| glsp-tools | 代码生成工具（glsp-cli, glsp-maven-plugin） | Maven | Java | — |
| .github | GitHub Actions workflows | — | — | 0 |
| .eclipsefdn | Eclipse 基金会配置 | — | Jsonnet | 0 |

### 2.2 仓库间关系

```
                         ┌─────────────────────┐
                         │    glsp-client      │  ← TypeScript 客户端核心
                         │    (@eclipse-glsp/  │
                         │     client, protocol│
                         │     , sprotty)      │
                         └──────────┬──────────┘
                                    │ JSONRPC 2.0
                         ┌──────────┴──────────┐
                         │    传输层 (跨仓库)   │
                         │  WebSocket/Socket.IO │
                         │  MCP/JSONRPC/SSE    │
                         └──────────┬──────────┘
                                    │
              ┌─────────────────────┼─────────────────────┐
              │                     │                     │
    ┌─────────┴────────┐  ┌─────────┴────────┐  ┌────────┴─────────┐
    │ glsp-server-node │  │ glsp-server      │  │ glsp-tools       │
    │ (TypeScript 服务) │  │ (Java 服务)      │  │ (glsp-cli)       │
    └──────────────────┘  └──────────────────┘  └──────────────────┘
              │
              │ 集成到 IDE
              ▼
    ┌─────────────────────────────────────────────┐
    │ glsp-theia-integration  (Theia 集成)        │
    │ glsp-vscode-integration (VS Code 集成)      │
    │ glsp-eclipse-integration (Eclipse IDE 集成) │
    └─────────────────────────────────────────────┘
```

### 2.3 仓库定位说明

- **glsp-client**：唯一的客户端核心。包含 `@eclipse-glsp/client`（DiagramEngine、ModelManager、FeatureRegistry）、`@eclipse-glsp/protocol`（JSONRPC 协议定义）、以及基于 `@eclipse-glsp/sprotty` fork 的渲染层。是 AUDESYS GLSP 扩展的**唯一客户端依赖**。
- **glsp-server-node**：TypeScript 服务端，提供 `@eclipse-glsp/server`、`@eclipse-glsp/server-protocol`、`@eclipse-glsp/server-api` 等。AUDESYS 场景（napi-rs bridge）对应的参考模板。
- **glsp-server（Java）**：Java 服务端，提供 `DiagramService`、`CommandStack`、`ActionManager`、`ModelState`。工业场景中大型项目常用。
- **glsp-theia-integration**：Theia 集成的核心仓库。提供 `@eclipse-glsp/theia-integration`（前端 widget）、Theia 后端贡献（启动 GLSP server）。AUDESYS 通过此包集成。
- **glsp-tools**：代码生成工具，`glsp-cli`（Yeoman 生成器）和 `glsp-maven-plugin`（Maven 集成），可生成模板项目。

---

## 3. 技术架构

### 3.1 整体架构

```
┌──────────────────────────────────────────────────────────────────┐
│ CLIENT LAYER (TypeScript, runs in browser/Electron)             │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @eclipse-glsp/client — 核心引擎                              │ │
│  │  • DiagramEngine       — 事件驱动渲染引擎                    │ │
│  │  • ModelManager        — 管理 GModel（图形模型）             │ │
│  │  • FeatureRegistry     — 注册 Feature（move/select/zoom）  │ │
│  │  • ActionDispatcher    — clientAction → server             │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @eclipse-glsp/sprotty — Sprotty fork（视图层）               │ │
│  │  • SGraphView / SNodeView / SEdgeView — 渲染节点/边         │ │
│  │  • ViewRegistry        — type → IView 映射                 │ │
│  │  • ActionDispatcher    — 事件分发（fork 独立）              │ │
│  │  • IView / INotify     — 渲染接口                            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ @eclipse-glsp/theia-integration — Theia 集成                 │ │
│  │  • GLSPSocketServerContribution — Theia 后端生命周期        │ │
│  │  • GLSPDiagramWidget       — ReactWidget 封装的图形编辑器   │ │
│  │  • GlspEditorContribution  — 文件打开/保存/dirty state      │ │
│  └────────────────────────────────────────────────────────────┘ │
├──────────────────────────────────────────────────────────────────┤
│ TRANSPORT LAYER (跨层)                                          │
│  WebSocket · Socket.IO · MCP RPC · JSONRPC · SSE                │
├──────────────────────────────────────────────────────────────────┤
│ SERVER LAYER (TypeScript / Java)                                │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ glsp-server-node (TypeScript)                               │ │
│  │  • @eclipse-glsp/server        — 服务核心                  │ │
│  │  • @eclipse-glsp/server-api    — 服务端接口定义             │ │
│  │  • @eclipse-glsp/server-protocol — 服务端协议定义           │ │
│  │  • @eclipse-glsp/server-theia  — Theia 后端集成            │ │
│  └────────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ glsp-server-java (Java)                                     │ │
│  │  • DiagramService   — 核心服务                              │ │
│  │  • CommandStack     — 命令管理（undo/redo）                 │ │
│  │  • ActionManager    — Action → Response 路由               │ │
│  │  • ModelState       — 服务端图形模型状态                    │ │
│  │  • DefaultModelState — JSON 模型默认实现                   │ │
│  └────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────┘
```

### 3.2 npm 包矩阵

#### glsp-client 仓库（pnpm workspace）

| 包名 | 说明 |
|------|------|
| `@eclipse-glsp/client` | 客户端核心（DiagramEngine、ModelManager、FeatureRegistry） |
| `@eclipse-glsp/protocol` | 共享 JSONRPC 协议（action、model、response 类型） |
| `@eclipse-glsp/sprotty` | Sprotty fork（ViewRegistry、ActionDispatcher、IView） |
| `@eclipse-glsp/sprotty-svg` | SVG 渲染器 |
| `@eclipse-glsp/sprotty-html` | HTML 节点渲染器 |
| `@eclipse-glsp/sprotty-gl` | WebGL 渲染器 |
| `@eclipse-glsp/sprotty-debug` | 调试 UI（Model Explorer、Log Viewer） |
| `@eclipse-glsp/sprotty-vscode` | VS Code 编辑器集成 |
| `glsp-workflow-example` | 工作流示例 |
| `glsp-mcp-example` | MCP 连接器示例 |

#### glsp-server-node 仓库（pnpm workspace）

| 包名 | 说明 |
|------|------|
| `@eclipse-glsp/server` | 服务端核心（DiagramService 实现） |
| `@eclipse-glsp/server-protocol` | 服务端协议定义 |
| `@eclipse-glsp/server-api` | 服务端接口 API |
| `@eclipse-glsp/server-theia` | Theia 后端集成 |
| `@eclipse-glsp/server-socketio` | Socket.IO 传输实现 |
| `@eclipse-glsp/server-socket` | WebSocket 传输实现 |
| `@eclipse-glsp/server-sse` | Server-Sent Events 传输 |
| `@eclipse-glsp/server-jsonrpc` | JSONRPC 传输实现 |

#### glsp-theia-integration 仓库（pnpm workspace）

| 包名 | 说明 |
|------|------|
| `@eclipse-glsp/theia-integration` | Theia 集成核心（DiagramWidget、GLSPSocketServerContribution） |
| `@eclipse-glsp/theia-protocol-connector` | Theia ↔ Server 协议桥接 |
| `@eclipse-glsp/theia-socket-connector` | Socket.IO 连接器 |
| `@eclipse-glsp/theia-mcp-connector` | MCP 连接器 |
| `@eclipse-glsp/theia-quick-open` | Theia Quick Open 集成 |

### 3.3 版本

| 仓库 | 当前版本 |
|------|----------|
| glsp-client | 2.7.0（已发布），2.8.0-next（main 分支） |
| glsp-server-node | 2.7.0（已发布），2.8.0-next（main 分支） |
| glsp-theia-integration | 2.7.0（已发布），2.8.0-next（main 分支） |
| glsp-core | 2.8.0-next（main 分支） |

### 3.4 核心组件

| 组件 | 层 | 说明 |
|------|-----|------|
| **DiagramEngine** | Client | 核心引擎，管理 ModelManager + FeatureRegistry + ActionDispatcher |
| **ModelManager** | Client | 管理 GModel（图形模型），处理服务端下发的 modelUpdate |
| **ActionDispatcher** | Client | 将 clientAction（用户输入）发送到服务端 |
| **FeatureRegistry** | Client | 管理 Feature 集合（move、select、hover、zoom 等） |
| **Feature** | Client | 单个交互能力（onEvent、activate/deactivate） |
| **ViewRegistry** | Client | 管理 type → IView 映射（渲染特定节点类型） |
| **IView** | Client | 渲染接口（configureModelElement → SVG/HTML） |
| **DiagramService** | Server | 服务端核心，接收 action，返回 response |
| **CommandStack** | Server | 命令管理（undo/redo），基于 Command 模式 |
| **ActionManager** | Server | Action → Response 路由 |
| **ModelState** | Server | 服务端图形模型状态（DefaultModelState） |
| **GLSPSocketServerContribution** | Theia Backend | Theia 生命周期集成，启动 GLSP 服务器子进程 |
| **GLSPDiagramWidget** | Theia Frontend | ReactWidget 封装的图形编辑器 |
| **GlspEditorContribution** | Theia Frontend | 文件打开/保存/dirty state 管理 |


---

## 4. 关键特征

### 4.1 完整图形编辑器全栈

GLSP 提供从**底层图形渲染**到**IDE 集成**的全栈方案，是工业领域最完整的开源图形编辑器框架：

| 层级 | GLSP 提供 | AUDESYS 当前缺失 |
|------|-----------|-----------------|
| 图形引擎 | DiagramEngine（事件驱动渲染） | 手动 SVG 状态管理 |
| 模型管理 | ModelManager（GModel 生命周期） | 无统一模型 |
| 命令框架 | CommandStack（undo/redo，Command 模式） | 手动 JSON 快照 |
| 交互层 | FeatureRegistry（move/select/zoom/rotate） | 手动事件绑定 |
| 视图系统 | ViewRegistry（type→IView 映射） | 手动渲染逻辑 |
| 协议层 | JSONRPC 2.0（clientAction↔server response） | 无 |
| 后端框架 | DiagramService / ActionManager | 无 |
| IDE 集成 | Theia / VS Code / Eclipse | 需自行实现 |
| 代码生成 | glsp-cli（Yeoman 模板） | 无 |

### 4.2 渲染后端分离

通过 `@eclipse-glsp/sprotty-svg`、`@eclipse-glsp/sprotty-html`、`@eclipse-glsp/sprotty-gl` 三个渲染后端，支持 SVG、HTML、WebGL 三种渲染模式，渲染器与模型/逻辑完全分离，可通过配置切换。

### 4.3 命令框架

`CommandStack`（服务端）提供基于 Command 模式的 undo/redo，支持 `CommandStackAccessor.execute(...)` 执行任意命令，`commandStack.undo()` / `redo()` 反向执行。AUDESYS 当前手动维护 JSON 快照，GLSP 命令框架是**开箱即用的替代方案**。

### 4.4 多传输支持

客户端与服务器之间支持多种传输协议：WebSocket、Socket.IO、Server-Sent Events (SSE)、JSONRPC，以及 MCP（Model Context Protocol）连接器。AUDESYS 使用 Socket.IO（通过 `@eclipse-glsp/server-socketio`）。

### 4.5 代码生成

`glsp-cli`（Yeoman 生成器）提供 4 种模板：
- `empty`：完全空白，从零构建
- `tasklist`：轻量任务列表示例
- `full`：完整图形编辑器（含所有 Feature）
- `full-java`：完整图形编辑器 + Java 后端

### 4.6 调试工具

`@eclipse-glsp/sprotty-debug` 提供 Model Explorer（树状模型浏览）和 Log Viewer（action/response 日志），内置于所有示例项目。AUDESYS 迁移后可以直接使用此工具调试 LD/FBD 图模型。

---

## 5. Sprotty Fork 深度分析

### 5.1 为什么 fork

GLSP 团队 fork 了 [eclipse-sirius/sirius-web](https://github.com/eclipse-sirius/sirius-web) 的 sprotty 实现，创建 `@eclipse-glsp/sprotty`。fork 的主要动机：

1. **与 GLSP 协议解耦**：原生 sprotty（eclipse/sprotty）直接操作 DOM 元素，GLSP 需要在 sprotty 之上叠加 `GModelIndex`（服务端下发模型→客户端视图），fork 后修改 `IView.configureModelElement` 接口支持 GLSP 模型。
2. **DI 注入系统**：fork 后引入 Inversify DI，每个 view 通过 `@injectable()` 注册到 `ViewRegistry`，原生 sprotty 无 DI 支持。
3. **与 GLSP server 集成**：fork 提供 `GLSPDiagramEngine`（原生 sprotty 无此概念），自动处理 action→server→response→modelUpdate→reconfigure 的完整循环。

**关键事实**：原生 `sprotty`（eclipse/sprotty）和 `@eclipse-glsp/sprotty` 是两个独立包，**不兼容**。D99 决策正是基于此——mix 导入 sprotty（features）和 @eclipse-glsp/sprotty（views）是 AUDESYS 的折衷方案。

### 5.2 sprotty fork 差异详解

| 特性 | 原生 sprotty (eclipse/sprotty) | @eclipse-glsp/sprotty (fork) |
|------|-------------------------------|------------------------------|
| DI 系统 | 无 | Inversify (`@injectable`) |
| ViewRegistry | 手动注册 | DI 容器自动发现 |
| 与 GLSP server 集成 | 无 | `GLSPDiagramEngine` 自动处理 action 分发 |
| `IView.configureModelElement` | 原生 sprotty 接口 | 扩展接口，支持 `configureModelElement` + `configureFeature` |
| ActionDispatcher | 独立 | 与 GLSP action 系统集成 |
| NPM 包名 | `sprotty` | `@eclipse-glsp/sprotty` |
| 维护者 | eclipse-sirius 团队 | GLSP 团队 |
| Stars | 329 | 内置于 glsp-client 仓库 |

### 5.3 AUDESYS 实际混合导入方案

由于 D99 决策，AUDESYS 采用混合导入策略：

```typescript
// FROM @eclipse-glsp/sprotty（views + DI）
import { SGraphView, PolylineEdgeView } from '@eclipse-glsp/sprotty';
import { configureModelElement } from '@eclipse-glsp/sprotty';

// FROM sprotty（features）
import { selectFeature, moveFeature, hoverFeature } from 'sprotty';
```

**原因**：
- `@eclipse-glsp/sprotty` 的 features 通过 CJS `__exportStar` 重导出，esbuild 打包后 `DEFAULT_FEATURES` 可能为 `undefined`
- 从子路径直接导入更可靠：`import { SGraphView } from 'sprotty/lib/graph/views'`

### 5.4 D99 决策记录

```markdown
## D99: GLSP 模块隔离 — sprotty vs @eclipse-glsp/sprotty
- **日期**: 2026-07-30
- **决定**: configureModelElement 和视图类（SGraphView, PolylineEdgeView）从 @eclipse-glsp/sprotty
  导入以确保 DI Symbol 一致；features（selectFeature, moveFeature 等）从 sprotty 导入以避免
  DEFAULT_FEATURES 未定义错误
- **理由**: @eclipse-glsp/sprotty 是 GLSP 对 sprotty 的 fork，使用不同的 DI Symbol（ViewRegistration,
  ActionDispatcher 等）。从 sprotty 导入视图会导致注册在错误 Symbol 上，ViewRegistry 不可见。但
  @eclipse-glsp/sprotty 的 features 通过 CJS __exportStar 重导出，esbuild 打包后 DEFAULT_FEATURES
  可能为 undefined
- **方案**: 混合导入：views 从 @eclipse-glsp/sprotty，features 从 sprotty
```

---

## 6. 模板项目结构与 Theia 集成模式

### 6.1 模板项目（glsp-examples）

`glsp-examples` 仓库提供 4 种模板，覆盖从零构建到完整 IDE 集成的所有场景：

| 模板 | 说明 | 依赖包数量 | 适合 |
|------|------|-----------|------|
| `empty` | 完全空白，仅依赖 `@eclipse-glsp/client` + `@eclipse-glsp/protocol` | 3 个核心包 | 从零构建，最小依赖 |
| `tasklist` | 轻量任务列表示例，包含完整 client + server + Theia 集成 | 10+ 包 | 快速原型验证 |
| `full` | 完整图形编辑器，含所有 Feature（move/select/zoom/rotate/hover） | 15+ 包 | 生产级编辑器 |
| `full-java` | 完整编辑器 + Java 后端（`DiagramService`、`CommandStack`） | 15+ 包 | 工业级 Java 项目 |

**模板结构**：

```
glsp-examples/
├── tasklist/
│   ├── packages/
│   │   ├── client/          ← @eclipse-glsp/client 集成
│   │   │   ├── index.ts     ← 入口：DiagramEngine 配置
│   │   │   ├── views/       ← IView 实现
│   │   │   └── model-state.ts ← DefaultModelState（前端状态）
│   │   ├── server/          ← glsp-server-node 集成
│   │   │   ├── diagram-service.ts ← DiagramService 实现
│   │   │   ├── actions/     ← ActionHandler 实现
│   │   │   └── model-state.ts ← 服务端 ModelState
│   │   └── theia/           ← theia-integration 集成
│   │       ├── frontend/    ← Theia 前端扩展
│   │       └── backend/     ← Theia 后端扩展
│   └── package.json
├── full/
│   ├── packages/
│   │   ├── client/          ← 含全部 Feature（move/select/zoom/rotate）
│   │   ├── server/          ← 含 ActionHandler 完整实现
│   │   └── theia/           ← Theia 集成
└── full-java/
    ├── packages/
    │   ├── client/          ← 同 full
    │   └── server/          ← Java 后端（Maven）
```

### 6.2 Theia 集成模式

GLSP Theia 集成通过以下流程工作：

```
用户打开 .ld 文件
  → GlspEditorContribution.getFileExtension() 匹配 'ld'
  → GlspEditorContribution.editorCreated() 打开 editor
  → Theia 前端创建 GLSPDiagramWidget
  → GLSPSocketServerContribution 启动服务器子进程
  → 客户端 DiagramEngine 通过 WebSocket 连接服务器
  → RequestModelAction → RequestModelHandler.execute()
  → RequestModelHandler.reportModelLoading()
  → 加载 .ld 文件 → 生成 GModel → 发送 modelUpdate → 客户端渲染
```

**集成点（AUDESYS 参考）**：

1. **Frontend Module**：DI 绑定（`DISymbol`、`GLSPDiagramWidget`、`GlspEditorContribution`）
2. **Backend Module**：`GLSPSocketServerContribution` 注册（指定 server 入口路径、子进程配置）
3. **File Extension**：`GlspEditorContribution.getFileExtension()` 返回 `'ld'`，触发文件关联

### 6.3 关键文件清单（Theia 集成）

| 文件 | 说明 |
|------|------|
| `packages/theia/frontend/index.ts` | Theia 前端扩展入口（ReactWidget 渲染、DiagramEngine 配置） |
| `packages/theia/frontend/frontend-module.ts` | DI 绑定文件 |
| `packages/theia/backend/backend-module.ts` | Theia 后端贡献（GLSPSocketServerContribution） |
| `packages/client/index.ts` | 客户端入口（DiagramEngine、ModelManager、FeatureRegistry） |
| `packages/client/views.ts` | IView 实现（`configureModelElement`） |
| `packages/server/index.ts` | 服务端入口（`launchLdServer()`、`LdDiagramModule`） |
| `packages/server/diagram-service.ts` | DiagramService 实现 |
| `packages/server/actions/` | ActionHandler 实现（RequestModelHandler 等） |

---

## 7. 现状与生态

### 7.1 仓库结构

- **Eclipse 基金会项目**，30+ 仓库，pnpm workspace（TypeScript）+ Maven（Java）双体系
- **核心仓库**：`glsp-client`（51 stars）、`glsp-theia-integration`（23 stars）、`glsp-examples`（53 stars）
- **代码生成**：`glsp-cli`（Yeoman 生成器）、`glsp-maven-plugin`（Maven）
- **E2E 测试**：`glsp-playwright`（专用 Playwright 测试库）

### 7.2 生态定位

GLSP 是 Eclipse 基金会下**唯一**提供完整图形编辑器全栈的框架。相比 Sirius Web（偏重语义模型）、Kite（已归档），GLSP 覆盖从渲染到 IDE 集成的**所有层级**。

**竞品对比**：

| 框架 | 全栈 | Theia 集成 | 代码生成 | 工业项目验证 |
|------|------|-----------|---------|------------|
| Eclipse GLSP | ✅ 完整 | ✅ 原生 | ✅ glsp-cli | ✅ Neuron（GLSP 集成验证） |
| Sirius Web | ✅ 完整 | ✅ 原生 | ✅ | ⚠️ 偏语义模型 |
| Sprotty | ❌ 仅渲染 | ⚠️ 手动 | ❌ | ✅ 广泛使用 |



---

## 7. 现状与生态

### 7.1 仓库结构

- **Eclipse 基金会项目**，30+ 仓库，pnpm workspace（TypeScript）+ Maven（Java）双体系
- **核心仓库**：glsp-client（51 stars）、glsp-theia-integration（23 stars）、glsp-examples（53 stars）
- **代码生成**：glsp-cli（Yeoman 生成器）、glsp-maven-plugin（Maven）
- **E2E 测试**：glsp-playwright（专用 Playwright 测试库）

### 7.2 生态定位

GLSP 是 Eclipse 基金会下唯一提供完整图形编辑器全栈的框架。相比 Sirius Web（偏重语义模型）、Kite（已归档），GLSP 覆盖从渲染到 IDE 集成的所有层级。

| 框架 | 全栈 | Theia 集成 | 代码生成 | 工业项目验证 |
|------|------|-----------|---------|------------|
| Eclipse GLSP | ✅ 完整 | ✅ 原生 | ✅ glsp-cli | ✅ Neuron |
| Sirius Web | ✅ 完整 | ✅ 原生 | ✅ | ⚠️ 偏语义模型 |
| Sprotty | ❌ 仅渲染 | ⚠️ 手动 | ❌ | ✅ 广泛使用 |

### 7.3 社区活跃度

- GitHub Issues：约 200 个 open issues（截至 2026-07）
- Release 频率：2.7.0 于 2026 发布（2.0 于 2023-10）
- 贡献者：30+ 活跃贡献者，主要来自 Eclipse 基金会成员（Siemens、博世、SAP 等）
- 讨论：Eclipse 邮件列表 + GitHub Discussions + Stack Overflow

---

## 8. AUDESYS 迁移分析

### 8.1 AUDESYS 当前状态

| 组件 | AUDESYS 当前 | GLSP 提供 |
|------|-------------|----------|
| 前端编辑器 | LdEditorWidget（929 行，React+SVG） | GLSPDiagramWidget（自动集成） |
| 图模型管理 | 手动 JSON 状态管理 | ModelManager（GModel 生命周期） |
| undo/redo | LdGModelState（118 行，JSON 快照） | CommandStack（Command 模式） |
| 渲染引擎 | 手动 SVG DOM 操作 | DiagramEngine + ViewRegistry |
| 交互层 | 手动事件绑定（touch/click） | FeatureRegistry（move/select/zoom） |
| IDE 集成 | 手动 onStart() → initializeLayout() | GlspEditorContribution（自动文件关联） |
| 脏状态 | 无 | 自动（dirty state 跟踪） |
| 文件打开 | LdEditorWidget 手动实例化 | 自动（.ld 扩展匹配） |
| 工具面板 | LdPaletteWidget（通过 new 创建） | GLSPPalette（自动注册） |

### 8.2 已发现的死代码/未实现

| 死代码/缺失 | 文件 | 说明 |
|------------|------|------|
| LdSprottyDiagramWidget | audesys-ld-glsp/src/ | 导出但从未被 DI 容器实例化 |
| sprotty-theia | package.json | 依赖 sprotty-theia ^0.12.0，GLSP 2.x 已废弃 |
| @eclipse-glsp/client | package.json | 包在 node_modules 中不存在 |
| @eclipse-glsp/protocol | package.json | 同上 |
| @eclipse-glsp/server-node | package.json | 同上 |
| server/index.ts | audesys-ld-glsp/src/server/ | 定义 launchLdServer() 但从未被调用 |
| theiaExtensions | package.json | 未注册 backend 入口 |

### 8.3 迁移收益

- 减少 ~929 行 LdEditorWidget，替换为 GLSP 自动集成
- 减少 ~118 行 LdGModelState，替换为 CommandStack
- ModelManager 自动处理 modelUpdate → reconfigure() 循环
- FeatureRegistry 提供开箱即用的 move/select/zoom/hover
- 自动脏状态跟踪和 save 功能
- 基于 Command 模式的 undo/redo，无需手动快照
- .ld 扩展自动触发 GLSP editor
- @eclipse-glsp/sprotty-debug 提供 Model Explorer 和 Log Viewer

### 8.4 迁移代价

- 学习成本：GLSP 全栈（client/server/theia-integration）
- sprotty fork 混淆：sprotty 与 @eclipse-glsp/sprotty 不兼容，需 D99 混合导入
- DI 绑定：每个 view 需要 @injectable() 并注册到 DI 容器
- 独立 GLSP server 子进程（Node.js）
- napi-rs bridge：GLSP server → Rust 编译器通过 worker_threads 隔离（D94）
- esbuild 对 CJS __exportStar 导出不可靠，需子路径导入
- 26 个 Playwright E2E 测试需重写

---

## 9. 迁移实施步骤

### 9.1 Phase 0：基础设施验证

| 步骤 | 说明 | 文件 |
|------|------|------|
| P0.1 | 删除 sprotty-theia，安装 @eclipse-glsp/theia-integration | audesys-ld-glsp/package.json |
| P0.2 | 安装 @eclipse-glsp/client、@eclipse-glsp/protocol、@eclipse-glsp/server | audesys-ld-glsp/package.json |
| P0.3 | 创建 server 目录结构（diagram-service.ts、actions/） | audesys-ld-glsp/src/server/ |
| P0.4 | 注册 Theia backend 入口（theiaExtensions） | audesys-ld-glsp/package.json |
| P0.5 | 验证 tsc --noEmit 无错误 | — |

### 9.2 Phase 1：客户端实现

| 步骤 | 说明 | 文件 |
|------|------|------|
| P1.1 | 实现 LdDiagramEngine（DiagramEngine + ModelManager + FeatureRegistry） | audesys-ld-glsp/src/client/ |
| P1.2 | 实现 LD views（configureModelElement，复用 ld-views.tsx SVG 组件） | audesys-ld-glsp/src/client/ld-views.ts |
| P1.3 | 实现 LdPaletteWidget（通过 DI 容器） | audesys-ld-glsp/src/client/ |
| P1.4 | 实现 Theia frontend module（DI 绑定） | audesys-ld-glsp/src/client/frontend-module.ts |
| P1.5 | 实现 GlspEditorContribution（.ld 文件关联） | audesys-ld-glsp/src/client/ |

### 9.3 Phase 2：服务端实现

| 步骤 | 说明 | 文件 |
|------|------|------|
| P2.1 | 实现 LdDiagramService | audesys-ld-glsp/src/server/ |
| P2.2 | 实现 RequestModelHandler（.ld → GModel） | audesys-ld-glsp/src/server/actions/ |
| P2.3 | 实现 ModelState | audesys-ld-glsp/src/server/ |
| P2.4 | 实现 WorkerPool（编译在 worker 中执行） | audesys-ld-glsp/src/server/ |
| P2.5 | 实现 napi-rs bridge | audesys-ld-glsp/src/server/ |
| P2.6 | 注册 StatusActionNoOpHandler | audesys-ld-glsp/src/server/ |

### 9.4 Phase 3：FBD 复制

| 步骤 | 说明 | 文件 |
|------|------|------|
| P3.1 | 复制 LD client 到 FBD，修改 views（功能块） | audesys-fbd-glsp/src/client/ |
| P3.2 | 复制 LD server 到 FBD | audesys-fbd-glsp/src/server/ |
| P3.3 | 修改 GlspEditorContribution 支持 .fbd 扩展 | audesys-fbd-glsp/src/client/ |

**总工期**：预计 10-15 天（含测试重写）

---

## 10. 实际迁移陷阱

### 10.1 GLSP 服务器 stdout 被端口发现机制消费

- 问题：console.log() 在 GLSP 服务器进程中不输出到 Theia 日志
- 原因：GLSPSocketServerContribution 读取 stdout 用于端口发现，其他行被丢弃
- 方案：必须使用 console.error()（stderr）
- 禁止：GLSP 服务器代码中禁止使用 console.log() 调试

### 10.2 StatusAction 分发失败导致 loadSourceModel 不被调用

- 问题：打开 .ld 文件后 loadSourceModel() 从未被调用
- 原因：RequestModelActionHandler.execute() 调用 reportModelLoading() dispatch StatusAction，无 handler 则抛出 GLSPServerError
- 方案：注册 StatusActionNoOpHandler

### 10.3 边缘 type 为 undefined 导致 GModelIndex 抛出

- 问题：GModelIndex.doIndex() 抛出 "type property must not be undefined"
- 原因：.ld JSON 文件中 edges 缺少 type 字段
- 方案：edge.type ?? 'edge:wire'

### 10.4 esbuild CJS 命名导出不可靠

- 问题：import { SGraphView } from 'sprotty' 在 esbuild 打包后为 undefined
- 原因：sprotty 是 CJS 模块，export * from './graph/views' re-export，esbuild 对 CJS 不可靠
- 方案：从子路径直接导入：import { SGraphView } from 'sprotty/lib/graph/views'

### 10.5 GLSP 视图类必须 @injectable

- 问题：报错 "Views should be @injectable"
- 方案：所有视图类添加 @injectable() 装饰器

### 10.6 GLSP 服务器进程无法通过端口 kill

- 问题：kill $(lsof -t -i:3100) 只终止 Theia 后端
- 方案：ps aux | grep 'ld-glsp.*server/index' | awk '{print $2}' | xargs kill

---

## 11. 市场定位

| 维度 | 详情 |
|------|------|
| 定位 | 工业级完整图形编辑器框架（全栈） |
| 价格 | 开源免费（EPL-2.0） |
| 目标客户 | 需要图形编辑器的工业/自动化项目 |
| 竞争者 | Sirius Web、Sprotty、Eclipse IDE |
| 优势 | 全栈覆盖、Theia 原生集成、代码生成、多传输支持 |
| 劣势 | Java 后端对 Rust 不友好、sprotty fork 混淆、社区规模较小 |

---

## 12. 产品特色

1. 完整全栈：从底层图形引擎到 IDE 集成，无需拼装多个框架
2. Theia 原生集成：自动处理文件打开、脏状态、保存
3. 命令框架：基于 Command 模式的 undo/redo
4. 多传输支持：WebSocket、Socket.IO、SSE、JSONRPC、MCP
5. 代码生成：glsp-cli 提供 4 种模板
6. 调试工具：Model Explorer + Log Viewer 内置
7. 渲染分离：SVG/HTML/WebGL 三种后端可切换
8. DI 系统：Inversify DI 容器，自动发现 view
9. Eclipse 基金会背书：工业级项目，长期维护保证

---

## 13. 对 AUDESYS 的参考价值

GLSP 是 AUDESYS LD/FBD GLSP 编辑器迁移（D92）的直接技术基础。

### 13.1 架构参考

- 全栈架构（§3.1）：AUDESYS 迁移需覆盖 client（DiagramEngine + ViewRegistry）、server（DiagramService + CommandStack）、Theia 集成（GLSPSocketServerContribution）三层
- 模板结构（§6.1）：tasklist 模板是 AUDESYS 迁移的最小可运行参考，full 模板提供完整 Feature 集合
- Theia 集成模式（§6.2）：注册 GlspEditorContribution（.ld 文件关联）和 GLSPSocketServerContribution（服务端启动）

### 13.2 实现参考

- sprotty fork 差异（§5.2）：D99 混合导入方案是当前最优解
- 代码生成（§4.5）：glsp-cli 模板可减少样板代码

### 13.3 迁移陷阱

- 已发现 6 个陷阱（stdout 消费、StatusAction、边缘 type、CJS 导出、@injectable、进程 kill），需在正式迁移前全部解决
- D99 决策（§5.4）：混合导入是已被验证的方案

### 13.4 AUDESYS 迁移收益

- 减少约 1047 行（929 行 LdEditorWidget + 118 行 LdGModelState）
- 获得 undo/redo、脏状态、文件关联、调试工具等开箱即用功能
- GLSP 框架更新自动升级，AUDESYS 只需更新依赖版本

---

## 14. node-json-theia 模板深度分析

> 基于 2026-07-30 对 `eclipse-glsp/glsp-examples/project-templates/node-json-theia` (v2.7.0) 的源码分析

### 14.1 四包架构

```
tasklist-browser-app/   — Theia 浏览器应用 (theia build + esbuild)
tasklist-glsp-server/   — Node.js GLSP 服务器 (tsc + webpack 打包)
tasklist-glsp-client/   — Sprotty 客户端视图 (tsc 仅编译)
tasklist-theia/         — Theia 粘结层 (tsc, 依赖 client + server)
```

**构建链**: `tsc -b` (项目引用) → `webpack` (服务器打包) → `theia build` (浏览器应用)。根 `tsconfig.json` 使用 `@eclipse-glsp/ts-config` 复合项目引用。

### 14.2 服务器关键模式

**DiagramModule 注册**:
```typescript
@injectable()  // ← 必须！GLSP 通过 DI 解析 DiagramModule
export class TaskListDiagramModule extends DiagramModule {
    readonly diagramType = 'tasklist-diagram';
    
    protected bindSourceModelStorage() { return TaskListStorage; }
    protected bindModelState() { return { service: TaskListModelState }; }
    protected bindGModelFactory() { return TaskListGModelFactory; }
    
    protected override configureActionHandlers(binding): void {
        super.configureActionHandlers(binding);
        binding.add(ComputedBoundsActionHandler);  // ← 必须：布局计算
    }
}
```

**SourceModelStorage（loadSourceModel 的正确实现）**:
```typescript
@injectable()
export class TaskListStorage extends AbstractJsonModelStorage {
    @inject(TaskListModelState)
    protected override modelState: TaskListModelState;

    loadSourceModel(action: RequestModelAction): void {
        const sourceUri = this.getSourceUri(action);  // ← 从 Action 提取 URI
        const taskList = this.loadFromFile(sourceUri, TaskList.is);  // ← 读文件 + 类型验证
        this.modelState.updateSourceModel(taskList);  // ← 存储 + 索引
    }
}
```

**关键细节**: `AbstractJsonModelStorage` 已提供 `getSourceUri()`、`loadFromFile(uri, typeGuard)`、`writeFile()` 等基础方法。`loadFromFile` 读取 JSON 文件并调用类型守卫验证——不需要手动 `fs.readFileSync`。

### 14.3 客户端关键模式

**客户端 DI 模块（正确的导入方式）**:
```typescript
import { 
    configureDefaultModelElements,  // ← 注册 SGraphView 等所有标准视图
    configureModelElement,
    ConsoleLogger, DefaultTypes, 
    initializeDiagramContainer, LogLevel, TYPES
} from '@eclipse-glsp/client';  // ← 全部从 @eclipse-glsp/client 导入

const taskListDiagramModule = new ContainerModule((bind, unbind, isBound, rebind) => {
    context = { bind, unbind, isBound, rebind };
    configureDefaultModelElements(context);  // ← 注册标准视图
    configureModelElement(context, DefaultTypes.LABEL, GLabel, GLabelView);
});
```

**关键发现**: 官方模板 **绝不从 `sprotty` 直接导入**。所有 sprotty 符号通过 `@eclipse-glsp/client` 间接获取，确保 DI Symbol 一致性。

### 14.4 Theia 集成关键模式

**GLSPDiagramConfiguration（连接客户端与服务端）**:
```typescript
@injectable()
export class TasklistDiagramConfiguration extends GLSPDiagramConfiguration {
    readonly diagramType = TaskListLanguage.diagramType;

    override configureContainer(container: Container, ...containerConfiguration): void {
        initializeTasklistDiagramContainer(container, ...containerConfiguration);
    }
}
```

**GLSPSocketServerContribution（服务器进程管理）**:
```typescript
@injectable()
export class TaskListServerContribution extends GLSPSocketServerContribution {
    readonly id = TaskListLanguage.contributionId;

    createContributionOptions() {
        return {
            executable: MODULE_PATH,  // ← require.resolve('tasklist-glsp-server')
            socketConnectionOptions: { port: getPort(PORT_ARG_KEY, DEFAULT_PORT) },
            additionalArgs: ['--no-consoleLog', '--fileLog', '--logDir', LOG_DIR]
        };
    }
}
```

**关键细节**: 服务器为独立进程，`GLSPSocketServerContribution` 自动管理生命周期。`executable` 指向 webpack 打包后的 JS 文件。stdout 用于端口发现（其他输出被丢弃）。

### 14.5 CSS 注入模式

官方模板在客户端 DI 模块中直接 `import` CSS——远简于自建 `injectCssVariables()` 方法：

```typescript
import 'balloon-css/balloon.min.css';
import '../css/diagram.css';
```

### 14.6 操作处理模式

```typescript
@injectable()
export class CreateTaskHandler extends JsonCreateNodeOperationHandler {
    readonly elementTypeIds = [DefaultTypes.NODE];

    override createCommand(operation: CreateNodeOperation): MaybePromise<Command | undefined> {
        return this.commandOf(() => {
            this.modelState.sourceModel.tasks.push({ ... });  // ← 变更包裹在 commandOf 中
        });
    }
}
```

`this.commandOf()` 将变更包裹为可逆 Command，自动集成到 GLSP 的 Undo/Redo 系统。

*本文档基于 2026-07-30 对 Eclipse GLSP 官方仓库的实际调研编写，覆盖 30+ 仓库、24 个 npm 包、4 种项目模板、6 个实际迁移陷阱。*

*参考来源：github.com/eclipse-glsp、eclipse.org/glsp/documentation/、projects.eclipse.org/projects/ecd.glsp、npmjs.com/org/eclipse-glsp*