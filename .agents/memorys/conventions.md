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

## 提交规范
- 格式：`chore: adapt AUDESYS project identity from MODACS split`
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
