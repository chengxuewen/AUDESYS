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

## Theia 扩展开发约束 (D97, 2026-07-28)

### 强制规则（违反 = 构建失败或运行时 DI 静默失败）

1. **React 导入必须用 `@theia/core/shared/react`**
   - `import React from '@theia/core/shared/react'` ✅
   - `import { useState } from '@theia/core/shared/react'` ✅
   - `import React from 'react'` ❌ — 导致 bundle 中多 React 实例，hooks 崩溃
   - react-dom 用 `@theia/core/shared/react-dom/client`

2. **扩展 node_modules 必须用 symlink（禁止物理副本）**
   - 扩展需要 node_modules 用于 **构建**（tsc 解析类型）
   - 但必须是 **symlink** 指向 app 的 node_modules，禁止物理副本
   - 物理副本 → esbuild 打包为独立模块 → Symbol 重复 → DI 静默失败
   - 结构: `theia-extensions/*/node_modules/@theia/core -> ../../../apps/studio/node_modules/@theia/core`
   - esbuild 通过 `preserveSymlinks=true` 使用 app 模块（运行时无重复）
   - 扩展的 `node_modules/` 含 @theia、@eclipse-glsp、inversify 等物理副本
   - esbuild 将不同路径的同一包视为不同模块 → Symbol 重复 → DI 静默失效
   - 所有依赖通过 `apps/studio/node_modules/` 解析（file: link + preserveSymlinks walk-up）
   - 扩展 package.json 中声明 `peerDependencies`，实际安装在 app 层
   - 若扩展需要本地 dev 工具（vitest 等），用 `devDependencies` 但不影响 bundle

3. **`preserveSymlinks = true` 不可删除**
   - `esbuild.mjs` 中 `preserveSymlinks = true` 是 file: link 模式的基础
   - 它让 esbuild 用 `apps/studio/node_modules/audesys-*` 路径解析依赖
   - 删除后扩展无法解析 @theia/core → 构建失败

4. **@theia/* 声明为 `peerDependencies`（精确版本）**
   - `"@theia/core": "1.73.0"` ✅（精确）
   - `"@theia/core": "^1.73.0"` ❌（可能安装 1.73.1 → @injectable 重复）

5. **构建后验证 Symbol 唯一性**
   - `grep -c 'Symbol("FrontendApplicationContribution")' lib/frontend/bundle.js` 必须 = 1
   - 若 > 1，检查哪个扩展有本地 `node_modules/@theia` symlink

### 项目结构约定

| 项目 | 约定 | 原因 |
|------|------|------|
| 扩展位置 | `theia-extensions/audesys-*/` | 与 app 分离，独立版本控制 |
| 引用方式 | `"file:../../theia-extensions/audesys-*"` | npm file: link |
| @theia 解析 | 通过 app 的 node_modules walk-up | 不需要扩展本地 symlink |
| 构建工具 | `theia build`（esbuild） | Theia 1.73+ 默认 |
| 启动命令 | `node lib/backend/main.js --port=3100` | 浏览器模式 |

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

### GLSP 构建两步法
```bash
# 1. 构建前必须移除扩展 node_modules symlink（防止 Symbol 重复）
rm theia-extensions/audesys-ld-glsp/node_modules
# 2. 构建
cd apps/studio && npm run build
# 3. 验证 Symbol 唯一性
for s in OpenHandler FrontendApplicationContribution OpenerService; do
  echo "$s: $(grep -c "Symbol(\"$s\")" lib/frontend/bundle.js)"
done
# 全部必须 = 1
# 4. 恢复 symlink（GLSP 独立服务器需要）
ln -sf ../../apps/studio/node_modules theia-extensions/audesys-ld-glsp/node_modules
```

