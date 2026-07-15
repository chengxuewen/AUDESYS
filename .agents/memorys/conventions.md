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
