# AUDESYS 项目约定

## 命名规范
- **项目标识**: `AUDESYS`（全大写）
- **npm scope**: `@audesys/`（全小写，npm 规范）
- **代码中引用**: `AUDESYS`
- **文档标题**: AUDESYS 项目

## 项目身份
- AUDESYS 是从 MODACS（模块化自动化与控制系统）分离出的独立项目
- AUDESYS 聚焦：Studio IDE、Runtime 运行时、Simulator 仿真器、HAL 硬件抽象层
- 与 MODACS 通过 JSON-RPC/REST API 契约通信，不共享代码
- architecture.md 中无 MODACS 历史引用（完全去 MODACS 化）

## 文档原则
- 技能文件（SKILL.md）需自包含，不依赖外部设计文档
- 架构文档中删除 MODACS 部分用 `TODO: 为 AUDESYS 重写此节` 占位
- 不自动替换 `@modacs/*` 为 `@audesys/*`（移除即可）
- 不全局 MODACS→AUDESYS 替换，使用精确的手术式编辑

## 文档组织
- 架构概览：`docs/architecture.md`（系统级，各模块均衡）
- 详细设计主文档：`docs/{module}-detailed-design.md`（独立维护，不膨胀架构文档）。HAL 例外：采用 `docs/modules/hal/` 子文档模式（D14/D15）
- 子文档归档：`docs/modules/{module}/`（独立设计文档、审核输出、对比分析）
- 参考文档：`docs/reference/{产品名}.md`（竞品分析，独立文件）
- 跨引用模式：architecture.md §X 内用 `详见 docs/modules/hal/<子文档>.md` 一行指向
- crate 命名：Cargo.toml `name` 字段统一 `audesys-<module>` 前缀，hyphen 分隔（如 `audesys-hal-core`、`audesys-amw-inproc`、`audesys-hal-flatbuffers`）。非正式/速记语境可用 `hal-core`、`amw-inproc` 短名
- 目录名：`crates/audesys-<module>/`，与 Cargo.toml name 完全一致

## 提交规范
- 格式：遵循 conventional commits 规范（feat/fix/docs/chore/refactor）
- 提交前验证：`grep -ri modacs . --exclude-dir=.git --exclude-dir=.sisyphus`
- 提交前验证：`grep -ri modacs . --exclude-dir=.git --exclude-dir=.sisyphus`

## 通用编码约定
- 不可变性优先（不可变模式）
- 小文件 > 大文件（200-400 行典型，800 行最大）
- 显式错误处理，无静默吞异常
- `camelCase` 变量/函数，`PascalCase` 类型/组件
- 布尔值前缀：`is`、`has`、`should`、`can`

## TypeScript 约定
- 公共 API 显式类型注解
- 优先 `interface`（对象形状），`type`（联合类型、交叉类型）
- `unknown` > `any`：对不可信输入使用 `unknown`，安全窄化
- Zod 用于模式验证（边界层）
- 禁止 `console.log`（生产代码），禁止 `as any` / `@ts-ignore`

### 编辑代码约束
1. 编辑前读取目标区域 ±5 行
2. 编辑后立即 `tsc --noEmit` 验证语法
3. 同一文件 3+ 次 edit → 改用 write 整体重写
4. range replace 的 end 锚点禁止选闭合括号行
5. 同一文件第 2 次 edit 前必须 re-read
6. 编辑后 `grep -c '{' file && grep -c '}' file` 验证括号匹配

## HAL 协议设计约定
- 命名规范：Signal = `component.interface.name`，StreamChannel = `domain.stream_name`，RPC = `action.{id}.{status|feedback}`（命名模式，非第四原语）
- 组件名：kebab-case，Pin 名：snake_case
- 禁止桥接外部协议 — AUDESYS HAL 是原生协议，被移植代码改造后以 HAL 为原生通信层
- 端口/功能：移植自 LinuxCNC/OpenPLC/ROS2/dora-rs 功能以 HAL 原语对接，非协议桥接
- 延迟声明必须带前提条件（内核、消息大小、硬件）和典型范围，必须配套验证方法

## Studio IDE 技术栈约定
- **框架**: Tauri (Rust 后端) + React + TypeScript
- **样式**: Tailwind CSS（内置跨浏览器 normalize）
- **测试**: CI/CD 同时验证 macOS/Windows/Linux 三平台 Playwright E2E 测试
- **Phase 2**: 增加 PWA 辅助访问

## 配置格式约定
- **开发**: YAML（人类可读、Git 友好）
- **运行时**: FlatBuffers 二进制（零拷贝加载，L1 RT 兼容）
- **构建**: YAML → FlatBuffers 编译步骤纳入 CI

## 测试约定 (D30)
- **qa-fast**: cargo test + clippy + rustfmt + cargo deny（每次 commit）
- **qa-full**: + criterion bench + proptest + tarpaulin 覆盖率（每次 PR）
- **qa-deep**: + Miri UB 检测 + loom 并发 + 变异测试（release 前）
- **Phase 1**: 不要求 80% 覆盖率（代码驱动阶段再要求）

## HalQoS 安全域约定
- **格式**: `{level}.{domain}.{subdomain}` 点分隔层级化标签
- **通配**: `l1.*` 匹配所有 L1 设备
- **编译**: 展开为位掩码，零 RT 开销
- **示例**: `l1.control.reactor_a`、`l3.supervisory.hmi`

## MCP 配置约定
- **插件集成优先**: 对于需要自动注入的 AI 辅助工具，优先使用 OpenCode plugin 方式（如 ponytail）
- **MCP 按阶段分层**: Phase 0（文档/CI）→ GitHub + OpenSpace；Phase 1（前端）→ playwright；Phase 2（DB）→ postgres + memory
- **初始化脚本**: 自定义 MCP 使用 `.opencode/init-mcp-*.mjs` 模式，遵循 auto-install → spawn 流程
- **Python MCP**: 非 Node.js 的 MCP（如 openspace）使用 venv 隔离安装，通过 init 脚本管理
- **API Key 环境变量**: 需要认证的 MCP 通过 `opencode.json` 的 `env` 字段注入，密钥不写入配置文件

## 架构命名约定 (2026-07-24)
- **Agent**: 车端管理代理 (原 Supervisor) — 进程管控、容器管理、Field 连接
- **Runtime**: 实时运行时 (原 Controller) — RT 执行、IO 驱动、安全
- **Hub**: 统一插件化平台 (原 Field+Cloud) — 场端·云端可部署
- **Studio**: 集成开发环境 — Desktop (Theia) + Web (Hub 插件) 双形态
- **Panel**: 操作员 HMI 界面 — PWA + Tauri + Docker 三形态
- **crate 命名**: Cargo.toml `name` 统一 `audesys-<module>` 前缀，hyphen 分隔

## Studio IDE 技术栈约定 (更新)
- **Desktop**: Eclipse Theia + Monaco Editor + GLSP + napi-rs (Rust bridge) — 已替代 Tauri+React (D71)
- **Web**: Hub 插件，Monaco Editor + WASM 编译器
- **Panel**: Tauri (桌面) + PWA (移动) + Docker (Kiosk)
- **样式**: Tailwind CSS

## Theia 扩展开发约束 (2026-07-31 修正)

### 核心架构：Yarn Workspaces monorepo

- **根目录 `package.json`**：`"workspaces": ["theia-extensions/*", "apps/studio"]`
- **扩展 `package.json`**：`"dependencies": {"@theia/core": "1.73.0"}` — 不是 peerDependencies
- **原理**：yarn hoist 所有 @theia/* 到根 node_modules，扩展通过 symlink 解析到根目录
- **esbuild**：所有依赖通过单一根路径解析 → 无 Symbol 重复 → 无两步构建
- **参考**：Theia 官方 Composing Applications + Authoring Extensions 文档

### 强制规则（违反 = 构建失败或运行时 DI 静默失败）

1. **React 导入必须用 `@theia/core/shared/react`**
   - `import React from '@theia/core/shared/react'` ✅
   - `import { useState } from '@theia/core/shared/react'` ✅
   - `import React from 'react'` ❌ — 导致 bundle 中多 React 实例，hooks 崩溃
   - react-dom 用 `@theia/core/shared/react-dom/client`

2. **构建后验证 Symbol 唯一性**
   - `for s in OpenHandler FrontendApplicationContribution OpenerService WidgetFactory; do echo "$s: $(grep -c "Symbol(\"$s\")" lib/frontend/bundle.js)"; done`
   - 全部必须 = 1。若 > 1，说明 symlink 未移除或恢复

3. **@theia/* 精确版本锁定**
   - `"@theia/core": "1.73.0"` ✅（精确）
   - `"@theia/core": "^1.73.0"` ❌（可能安装 1.73.1 → @injectable 重复）


### 诊断清单（扩展不显示时）

```bash
# 1. Symbol 唯一性
grep -c 'Symbol("FrontendApplicationContribution")' lib/frontend/bundle.js  # 必须 = 1

# 2. React 导入检查
grep -rn 'from "react"\|from '\''react'\''' theia-extensions/*/src packages/*/src \
  --include="*.ts" --include="*.tsx" | grep -v "@theia/core/shared/react"  # 必须为空

# 3. 本地 @theia 检查
find theia-extensions -path "*/node_modules/@theia/core" 2>/dev/null  # 必须为空

# 4. 浏览器控制台
# 无 'Cannot read properties of null (reading useState)' 错误
# 无 'No matching bindings found' 错误
```

### 构建流程（yarn workspaces）
```bash
# 1. 安装依赖（yarn workspaces hoist 所有 @theia/* 到根 node_modules）
yarn install
# 2. 构建
yarn theia build
# 3. 验证 Symbol 唯一性
for s in OpenHandler FrontendApplicationContribution OpenerService; do
  echo "$s: $(grep -c "Symbol(\"$s\")" apps/studio/lib/frontend/bundle.js)"
done
# 全部必须 = 1
```

```

## GLSP 扩展开发约定 (2026-07-31)

### snabbdom 变量命名
- **禁止**: 在使用 snabbdom `h()` 函数的文件中用 `h` 作为变量名
- **替代**: 使用 `nodeH`/`nodeW` 作为节点尺寸变量名
- **验证**: `grep -rn 'const h =' src/client/*.ts` 应返回 0 结果
- **先例**: FBD GLSP 迁移中 `const h = model.size?.height` 覆盖了 snabbdom 的 `h()`，导致 14 个编译错误

### GLSP 依赖导入路径
- `ActionHandler`/`ActionHandlerConstructor` → 从 `@eclipse-glsp/server` 导入（非 protocol）
- `GPort`/`GNode`/`GEdge` → 从 `@eclipse-glsp/server` 或 `@eclipse-glsp/graph` 导入
- `DefaultTypes` → 从 `@eclipse-glsp/protocol` 导入
- `configureModelElement` 等 → 从 `@eclipse-glsp/client` 导入

### GLSP 传递依赖
- `snabbdom` 通过 `@eclipse-glsp/client` 传递引入，不应作为直接依赖
- `inversify` 通过 `@theia/core` 传递引入，不应作为直接依赖
- **验证**: `ls theia-extensions/*/node_modules/snabbdom` 应报 No such file

### 新扩展构建流程
- `theia build` 只打包已编译的 `.js`，不编译 `.ts`
- 新建扩展后必须先 `npx tsc -b`（在扩展目录），再 `theia build`（在 apps/studio）
- **验证**: `ls theia-extensions/新扩展/lib/theia/*.js` 应存在

## GLSP 网格与节点创建约定 (2026-08-03)

### 网格背景
- 网格背景必须用 **GGraphView**（`configureDefaultModelElements` 默认注册），禁止 configureModelElement 覆盖 'graph'
- 网格尺寸通过 `rebind(TYPES.Grid).toConstantValue({x:40,y:40})` 设置
- 网格视觉用 CSS 变量覆盖（`--grid-color` 等），不写死 background-size
- **验证**: `getComputedStyle(graph).getPropertyValue('--grid-background-width')` 非空

### Ghost 元素（插入预览）
- 使用默认 InsertIndicator（自带 moveFeature），**禁止**自定义无 features 的 ghostElement 模板
- 容器（rung:group）的 shapeTypeHint containableElementTypeIds 必须包含 `'node:insert-indicator'`
- ghost 平滑移动需覆写 ChangeBoundsManager.getMinimumMovement 返回 1px（GridSnapper 仍 snap 40px）

### 工作区依赖
- workspace 内扩展用 semver 版本（`"0.1.0"`），**禁止** file: 引用（会创建物理副本）
- `@audesys/theia-bridge`（crates/ 下）不在 workspaces，保留 file:

### 验证流程
- 修改扩展源码 → `npx tsc -b`（扩展）→ `npx theia build`（apps/studio）
- 修改 GLSP 服务器代码 → 杀 GLSP 进程 + 重启 Theia 后端
- **验证**: `require.resolve('audesys-ld-glsp/package.json', {paths:[...apps/studio]})` 指向 theia-extensions/

## Studio 构建门禁 (2026-08-03)

- **check-gates.sh**: apps/studio/check-gates.sh 三条门禁，已接入 `npm run build`（theia build 后自动运行）：
  1. **workspace 链接检查**: 每个 theia-extensions/* 必须通过 yarn workspaces symlink 解析（require.resolve 指向 theia-extensions/），禁止 file: 依赖/物理副本
  2. **扩展 lib 存在性**: 每个扩展 lib/ 必须有编译产物（防"改了不生效"）
  3. **Symbol 唯一性**: bundle.js 中 OpenHandler/FrontendApplicationContribution/OpenerService/WidgetFactory 全部 = 1
- 单独运行: `cd apps/studio && npm run check:gates`
- **验证**: 全部门禁通过（2026-08-03）

## React Flow 编辑器开发约定 (2026-08-03)

- **D110**: LD/FBD 编辑器使用 React Flow（@xyflow/react），完全移除 GLSP
- **架构**: React Flow Widget → LdOperationHandler（前端内存，纯 TS）→ napi-rs → Rust 编译器。无 Theia command 用于 CRUD（LdOperationHandler 前端直跑）
- **选择器**: `.react-flow__node-<type>`（非 data-type）；位置断言用 `el.style.transform`（非 boundingBox，viewport 影响）
- **网格**: `snapToGrid={true} snapGrid={[40, 40]}`；边 `defaultEdgeOptions={{ zIndex: 1 }}`
- **节点**: 自定义 JSX 组件（SVG），rung 容器用 `parentId` + `extent: 'parent'`
- **测试**: vitest 单元（model/operation-handler/gmodel-state）+ Playwright E2E（`.react-flow__node` 选择器）
- **E2E 异步**: React re-render 异步，用 `expect.poll`/`toBeVisible({timeout})`，禁止 sleep()
