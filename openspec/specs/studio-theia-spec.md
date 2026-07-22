# AUDESYS Studio Theia 迁移 SDD 规范

> **来源**: `docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md`
> **总项数**: 50
> **决策**: 从 Tauri+React 自建架构迁移到 Eclipse Theia 框架（2026-07-21）
> **时间线**: 22-31 周（5 个 Phase，三审修订后）
> **前置**: Fork VS Code 已排除，CodeBlitz 已排除

---

## 1. STH-BRIDGE — napi-rs 桥接 API (10 项)

> **crate**: `crates/audesys-theia-bridge/`（~500-1000 行）
> **运行模式**: worker_thread 池（避免阻塞 Node.js 事件循环）
> **覆盖**: ~25 个函数（原 34 个 Tauri 命令审计后）

**STH-001**: compile_st — 接受 ST 结构化文本源字符串，调用 Rust ST 编译器，返回 HalProgram JSON 字符串；编译错误返回结构化诊断数组

**STH-002**: compile_il — 接受 IL 指令表源字符串，调用 Rust IL 编译器，返回 HalProgram JSON 字符串

**STH-003**: compile_ld — 接受 LD 梯形图 JSON 表示（GLSP 输出），调用 Rust LD 编译器，返回 HalProgram JSON 字符串

**STH-004**: compile_fbd — 接受 FBD 功能块图 JSON 表示（GLSP 输出），调用 Rust FBD 编译器，返回 HalProgram JSON 字符串

**STH-005**: compile_sfc — 接受 SFC 顺序功能图 JSON 表示，调用 Rust SFC 编译器，返回 HalProgram JSON 字符串

**STH-006**: compile_gcode — 接受 G-code 源字符串（RS274 子集），调用 Rust G-code 编译器，返回 HalProgram JSON 字符串

**STH-007**: read_signal — 接受信号名（如 "axis.0.pos"），通过 napi-rs 调用 Controller IPC（UDS 0x0D），返回 HalValue 或 null（信号不存在）

**STH-008**: signal_snapshot — 通过 napi-rs 调用 Controller IPC（UDS 0x0F），返回完整信号注册表快照 `Vec<(name: String, value: String)>`

**STH-009**: deploy_program — 接受 HalProgram 字节向量，通过 napi-rs 调用 Controller IPC（UDS 0x10），返回 `Result<()>`；失败时返回 IPC 错误码

**STH-010**: health_query — 通过 napi-rs 调用 Controller IPC（UDS 0x01），返回控制器健康状态摘要字符串（含周期时间、内存、连接状态）；超时 2s

---

## 2. STH-BACKEND — Theia 后端服务 (10 项)

> **路径**: `theia-extensions/audesys-backend/src/node/`
> **框架**: Theia Backend (Node.js + Express + inversify DI)
> **新增代码**: ~1500-2000 行（含 inversify 样板）

**STH-011**: RPC 代理 — 前端通过 WebSocket JSON-RPC 调用后端，后端路由到对应 napi-rs 函数；每个 Rust 函数一个 JSON-RPC method

**STH-012**: RBAC 中间件 — 每次 napi-rs 调用前验证 HMAC 认证令牌（复用现有 IPC HMAC 密钥）；Role::Engineer 可编译/部署，Role::Operator 仅可读信号

**STH-013**: 速率限制 — compile_* 系列限 10 次/分钟/会话，signal_read 限 1000 次/分钟；超限返回 JSON-RPC error code -32000（rate limited）

**STH-014**: 审计日志 — 每次操作记录 timestamp、operation 名称、role、参数摘要（不含完整 source 正文）；写入结构化 JSON 日志文件

**STH-015**: 输入验证 — 每个 napi-rs 函数入口使用 JSON Schema 验证输入参数；source 字符串 ≤ 1MB，signal name 符合 `component.interface.name` 模式

**STH-016**: 错误传播 — napi-rs 返回的 Rust Error → JSON-RPC error response（code=-32001，message=错误描述，data=诊断详情）；NapiError 映射：CompileError → -32002，IpcError → -32003

**STH-017**: worker_thread 池 — 所有 napi-rs 调用在 Worker 线程池中运行（默认 4 线程，可配置）；主线程不阻塞；支持 AsyncTask 取消（AbortController）

**STH-018**: 文件服务 — 项目文件 CRUD 通过 Node.js fs 模块；支持工作区根目录锁定、文件监听（fs.watch）用于资源树自动刷新

**STH-019**: 对话框服务 — 原生文件打开/保存对话框通过 Electron dialog API；文件类型过滤器（.st/.il/.ld/.fbd/.sfc/.gcode/.yaml）

**STH-020**: 会话管理 — ControllerClient 连接生命周期管理：connect（UDS 0x02 认证）、heartbeat（UDS 0x00 1s 间隔）、disconnect（UDS 0x03）、自动重连（指数退避 1-2-4-8s, 最多 3 次）

---

## 3. STH-GLSP — GLSP 图形编辑器集成 (10 项)

> **参考**: Neuron Automation（logi.cals 基于 Theia+GLSP 的 IEC 61131-3 IDE）
> **规模**: LD 单独 5000-9000 行（GModel 800-1500 + GLSP 操作 1200-2000 + 工具面板 400-600 + 布局引擎 1000-2000 + 属性视图 500-800 + Theia 集成 600-1000 + IEC 61131-3 特性 600-1000）
> **Phase 2a**: LD 6-10 周，Phase 2b: FBD 4-6 周

**STH-021**: LD GModel — 梯形图图形模型定义：ContactNode（常开/常闭）、CoilNode（普通/取反/置位/复位）、PowerRail（左母线/右母线）、WireConnection（连线）、Rung（梯级容器）

**STH-022**: LD GLSP Server — 图形操作处理：CreateContactOperation、DeleteElementOperation、ChangeBoundsOperation、ReconnectEdgeOperation；每次操作后调用 Rust 布局引擎验证

**STH-023**: LD 工具面板 — 左侧可拖拽元素：常开触点、常闭触点、线圈、取反线圈、功能块占位符；拖拽到画布创建节点，自动连线到最近电源轨

**STH-024**: LD 布局引擎 — 电源轨垂直排列、梯级自动编号（001, 002, ...）、连线自动路由（直角正交）、元素水平等距分布

**STH-025**: LD 属性视图 — 选中元素后右侧显示属性面板：变量名（text input）、注释（text input）、取反标志（checkbox）；修改后实时更新 GModel

**STH-026**: LD IEC 61131-3 特性 — 功能块 EN/ENO 引脚自动生成、电源流语义（左侧电源轨=TRUE 向右流动）、短路检测（电源轨直接到地=编译错误）

**STH-027**: FBD GModel — 功能块图图形模型：ANDNode、ORNode、XORNode、NOTNode（布尔运算节点）、FunctionBlockNode（自定义功能块）、InputPin/OutputPin（连接点）

**STH-028**: FBD 工具面板 — 左侧可拖拽元素：AND、OR、XOR、NOT 门、功能块库列表（从注册表读取）；拖拽创建节点并自动生成输入/输出引脚

**STH-029**: FBD 连线验证 — 反馈回路检测（输出不能回连到同功能块的输入）、引脚类型匹配（BOOL→BOOL, INT→INT）、未连接输入引脚警告（悬空=默认值）

**STH-030**: Theia GLSP 集成 — diagram 配置文件注册（.ld → LD Editor, .fbd → FBD Editor）、CSS 主题适配（深色/浅色）、Toolbar 贡献点（撤销/重做/缩放/对齐/网格切换）

---

## 4. STH-MONACO — Monaco 语言服务器 (10 项)

> **编辑器**: Monaco Editor（Theia 内置，替代 CodeMirror 6）
> **规模**: ST Monarch tokenizer 400-700 行，IL 需自定义 tokenizer，G-code 200-300 行
> **LSP 集成**: 通过 napi-rs 桥接 Rust 编译器诊断

**STH-031**: ST Monarch tokenizer — 结构化文本语法高亮（400-700 行）：大小写不敏感关键字（IF/THEN/ELSE/END_IF/FOR/WHILE/CASE/FUNCTION_BLOCK 等）、IEC 类型（BOOL/INT/REAL/STRING/TIME）、注释（(*...*)）、字符串

**STH-032**: ST 补全提供器 — Monaco CompletionItemProvider：IEC 类型自动补全、关键字补全、已定义变量/功能块补全（从 Rust 编译器符号表获取）

**STH-033**: ST 诊断 — napi-rs 编译错误 → Monaco markers：错误行号、错误消息、严重程度（Error/Warning/Info）；去抖动 500ms 后触发编译

**STH-034**: ST 语义标记 — 通过 LSP（非 Monarch）实现变量/函数块/类型的高亮区分；napi-rs 返回 semantic tokens 数组 → Monaco DocumentSemanticTokensProvider

**STH-035**: ST 代码折叠 — Monarch folding provider：IF/END_IF、FOR/END_FOR、WHILE/END_WHILE、CASE/END_CASE、FUNCTION_BLOCK/END_FUNCTION_BLOCK 配对折叠

**STH-036**: IL tokenizer — 指令表自定义 tokenizer（Monarch 默认无状态，IL 基于累加器模型）：LD/ST/AND/OR/ADD/SUB/MUL/DIV/JMP 等指令高亮、累加器值注释、标签识别（LABEL:）

**STH-037**: G-code Monarch tokenizer — RS274 子集语法高亮（200-300 行）：G 代码（G0/G1/G2/G3/G17-G21/G90/G91）、M 代码（M3/M4/M5/M30）、坐标轴（X/Y/Z/A/B/C）、进给率（F）、主轴转速（S）

**STH-038**: 快速修复 — Monaco CodeActionProvider：编译器错误 → 建议修复（如 "undeclared variable 'x'" → "declare x as INT"），通过 napi-rs 获取修复建议列表

**STH-039**: 文档符号 — Monaco DocumentSymbolProvider：解析 PROGRAM、FUNCTION、FUNCTION_BLOCK 结构，生成 POU 树（程序组织单元层级）

**STH-040**: 大纲视图 — Theia Outline View 贡献：显示当前文件的 POU 树（Program → Function/FB → 变量/方法），点击跳转到定义位置

---

## 5. STH-BUILD — Electron 构建与打包 (10 项)

> **打包工具**: electron-builder
> **目标**: macOS (DMG) + Windows (MSI/NSIS) + Linux (AppImage)
> **CI**: GitHub Actions macOS × Linux × Windows 矩阵
> **包体积**: DMG < 200MB, 安装后 < 550MB

**STH-041**: macOS DMG 构建 — electron-builder 配置：target=dmg、代码签名（Apple Developer ID）、公证（notarize: true）、Hardened Runtime 启用

**STH-042**: Windows 构建 — electron-builder 配置：target=nsis+msi、Authenticode 签名、安装目录 Program Files、开始菜单快捷方式

**STH-043**: Linux AppImage 构建 — electron-builder 配置：target=AppImage、无签名要求、Desktop Entry 注册、MIME 类型关联（.st/.il/.gcode）

**STH-044**: napi-rs 交叉编译 — 四目标预编译：macOS x86_64、macOS ARM64 (Apple Silicon)、Linux x86_64、Windows x86_64；使用 GitHub Actions matrix 或 Zig 交叉编译

**STH-045**: CI 流水线 — GitHub Actions：macOS 14 (ARM64) + macOS 13 (x86_64) + ubuntu-latest + windows-latest 矩阵；qa-fast 5 门禁（test/clippy/fmt/deny/unwrap）+ electron-builder 打包

**STH-046**: 包体积限制 — DMG < 200MB（移除不需要的内置扩展：TypeScript/HTML/Java 语言服务）；安装后 < 550MB（含 .node 原生二进制 ~50MB + Electron 运行时 ~180MB + VS Code 扩展 ~100MB）

**STH-047**: 自动更新 — electron-updater 集成：启动时检查 GitHub Releases 最新版本、差分更新（delta 补丁 < 50MB）、静默下载 + 下次启动安装

**STH-048**: VS Code 扩展预装 — 白名单机制：10 个核心扩展（LSP servers、GitLens、主题等）打包进 installer；启动时不从 Open VSX 拉取（离线可用）

**STH-049**: 启动时间 — 冷启动 < 5s（首次启动，含扩展激活）、热启动 < 2s（已缓存）；测量项：Electron 启动 → Theia workbench 可交互

**STH-050**: 内存占用 — 空闲状态 < 300MB（仅打开空工作区）、编辑状态 < 500MB（打开 1 个 ST 文件 + Monaco + LSP）；使用 Chrome DevTools Memory 快照测量
