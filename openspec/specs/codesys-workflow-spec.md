# AUDESYS Studio CODESYS 工作流 SDD 规范

> **来源**: `theia-extensions/audesys-core/src/browser/iec-new-file-contribution.ts` + `theia-extensions/audesys-ld-glsp/src/editor/ld-editor-contribution.ts` + `crates/audeys-theia-bridge/` + `docs/modules/runtime/panel-architecture-design.md`
> **总项数**: 30
> **工作流**: 工程创建 → 文件创建 → LD 编辑 → 编译 → 部署 → 调试 → HMI 绑定
> **关联决策**: D22, D25, D55, D56, D57, D68, D71
> **关联规范**: studio-theia-spec.md (STH-001~050), hmi-spec.md (HMI-VAL/DPL/SIG)

---

## 1. WF-CREATE — 工程创建 (4 项)

### WF-CREATE-001: 新建工程项目

用户通过 File > New Project 创建 AUDESYS 工程项目，生成标准项目目录结构和 `.audesys-project.yaml` 清单文件。

- **前置条件**: Studio 已启动，无工程打开（或已关闭当前工程）
- **操作**: 执行 `File > New Project` 命令，在弹出对话框中输入工程名称 `"my-automation"`，选择目标目录
- **期望**: 
  - 项目树 (File Explorer) 显示工程根节点 `my-automation`
  - 根目录生成 `.audesys-project.yaml`，含 `name`、`version`、`created`、`runtime` 字段
  - 预创建子目录: `src/`、`hmi/`、`build/`、`tests/`
  - Theia workspace 自动切换到新工程目录
- **边界**: 
  - 工程名仅允许 `[a-zA-Z0-9_-]`，长度 1-64 字符
  - 目标目录已存在同名文件夹 → 提示覆盖确认
  - 目标目录权限不足 → 错误提示 `"Cannot create project: permission denied"`
  - 工程名空字符串 → 拒绝，提示 `"Project name is required"`
- **测试**: `test_create_project_basic` (vitest), Playwright E2E: `new-project-flow.spec.ts`

### WF-CREATE-002: 打开已有工程

用户通过 File > Open Project 打开已存在的 AUDESYS 工程。

- **前置条件**: `.audesys-project.yaml` 文件存在于目标目录
- **操作**: 执行 `File > Open Project` → 选择包含 `.audesys-project.yaml` 的目录 → 确认
- **期望**: 
  - 项目树刷新显示工程结构（src/、hmi/、build/、tests/）
  - `.audesys-project.yaml` 被解析，name 字段显示为项目根节点标签
  - 无 `.audesys-project.yaml` 的目录 → 提示 `"Not a valid AUDESYS project"`
- **边界**: 
  - `.audesys-project.yaml` 格式损坏 → 错误提示含具体解析错误行号
  - 打开工程时检测到 `.audesys-project.yaml` 中 `runtime` 版本高于当前 Studio 版本 → 警告 `"Project requires runtime vX.Y.Z, current is vA.B.C"`
- **测试**: `test_open_existing_project` (vitest)

### WF-CREATE-003: 工程清单文件格式

`.audesys-project.yaml` 遵循约定的 YAML schema。

- **前置条件**: 工程创建完成
- **操作**: 读取 `.audesys-project.yaml` 内容
- **期望**: 文件包含以下字段（均为必填）:
  ```yaml
  name: "my-automation"
  version: "1.0.0"
  created: "2026-07-24T10:00:00Z"
  runtime:
    cycle_ms: 10
    language: "rust"
  author: ""
  description: ""
  ```
- **边界**: 
  - `name` 与目录名不一致 → 以文件为准（警告 `"project name mismatch: dir='X', file='Y'"`）
  - `cycle_ms` 范围 1-1000，超出默认 10
  - `version` 遵循 SemVer 2.0.0
- **测试**: `test_project_yaml_schema_validation`

### WF-CREATE-004: 工程关闭

用户关闭当前工程时，释放工程资源并提示保存未保存文件。

- **前置条件**: 工程已打开，存在未保存的编辑器标签
- **操作**: 执行 `File > Close Project`
- **期望**: 
  - 弹出 `"Unsaved changes"` 对话框，列出未保存文件
  - 用户选择 Save All → 保存后关闭；Discard → 丢弃后关闭；Cancel → 不关闭
  - 关闭后编辑器区域清空，项目树显示空状态
- **边界**: 工程正在编译中 → 等待编译完成或提示 `"Compilation in progress, close anyway?"`
- **测试**: Playwright E2E: `close-project-unsaved.spec.ts`

---

## 2. WF-FILE — 文件创建 (5 项)

### WF-FILE-001: IEC 61131-3 文件创建入口

File > New 菜单下提供 IEC 61131-3 子菜单，列出全部 6 种源文件类型 + HMI 布局 + G-code。

- **前置条件**: 工程已打开（workspace 存在）
- **操作**: 展开 `File > New > IEC 61131-3` 子菜单
- **期望**: 菜单项列表为:
  - Structured Text (.st)
  - Instruction List (.il)
  - Ladder Diagram (.ld)
  - Function Block Diagram (.fbd)
  - Sequential Function Chart (.sfc)
  - HMI Layout (.hmi)
  - G-code CNC (.gcode)
- **边界**: 无 workspace 时所有 IEC 菜单项灰色禁用（`isEnabled: false`）
- **测试**: `test_iec_new_file_menu_structure` (vitest)

> **实现参考**: `IecNewFileContribution.registerMenus()` — `theia-extensions/audesys-core/src/browser/iec-new-file-contribution.ts:102-140`

### WF-FILE-002: 模板文件生成 — ST

选择 New Structured Text (.st) 后在工程 src/ 目录下生成带模板代码的 .st 文件。

- **前置条件**: 工程 workspace 已打开，`src/` 目录存在
- **操作**: 点击 `File > New > IEC 61131-3 > Structured Text (.st)`
- **期望**: 
  - 在 `src/untitled.st` 创建文件（若不存在）
  - 文件内容为 ST 模板:
    ```
    (* Structured Text Program *)
    PROGRAM Main
    VAR
        (* variables *)
    END_VAR
    (* code *)
    END_PROGRAM
    ```
  - 文件在项目树中显示，编辑器自动打开该文件
- **边界**: 
  - `untitled.st` 已存在 → 自动命名为 `untitled-1.st`、`untitled-2.st`，最多尝试 99
  - 全部编号已占用 → 错误提示 `"Too many untitled files, please rename existing files"`
  - `src/` 目录不存在 → 自动创建（不视为错误）
- **测试**: `test_new_st_file_template` (vitest)

> **实现参考**: `IEC_TEMPLATES` 数组 — `iec-new-file-contribution.ts:52-60`

### WF-FILE-003: 模板文件生成 — LD

选择 New Ladder Diagram (.ld) 后生成占位 .ld 文件，后续由 GLSP 编辑器接管。

- **前置条件**: 工程 workspace 已打开
- **操作**: 点击 `File > New > IEC 61131-3 > Ladder Diagram (.ld)`
- **期望**: 
  - 生成 `src/untitled.ld`，内容为注释 `(* Ladder Diagram — placeholder *)`
  - 双击文件 → 打开 LD GLSP 编辑器（空梯级画布，左/右母线就绪）
- **边界**: .ld 文件内容并非最终图形格式；GLSP 首次保存时覆盖为 JSON GModel
- **测试**: `test_new_ld_file_opens_glsp_editor` (Playwright E2E)

### WF-FILE-004: 模板文件生成 — 其他语言

FBD、SFC、IL、HMI、G-code 各有独立模板，生成方式与 ST/LD 一致。

- **前置条件**: 工程 workspace 已打开
- **操作**: 依次创建 .il、.fbd、.sfc、.hmi、.gcode 文件
- **期望**:
  - `.il`: `LD TRUE\nST result\n`
  - `.fbd`: `(* Function Block Diagram — placeholder *)\n`
  - `.sfc`: `(* Sequential Function Chart — placeholder *)\n`
  - `.hmi`: `# HMI Layout\nwidgets: []\n`
  - `.gcode`: `; G-code CNC Program\nG21 ; mm units\nG90 ; absolute positioning\nG0 X0 Y0 Z0\nM30\n`
- **边界**: 所有模板文件行为与 ST 一致（自动编号、覆盖检测）
- **测试**: `test_all_iec_templates_generated` (vitest)

### WF-FILE-005: 文件命名与扩展名校验

创建文件后支持重命名，扩展名变更触发编辑器切换。

- **前置条件**: 文件 `src/untitled.st` 已在项目树中显示
- **操作**: 右键 `untitled.st` → Rename → 输入 `main_control.st` → 确认
- **期望**: 
  - 项目树文件名更新为 `main_control.st`
  - 编辑器标签更新
  - 扩展名不变时编辑器不变
- **操作**: 重命名 `main_control.st` → `main_control.il`
- **期望**: 
  - 扩展名变更 → 重新匹配 OpenHandler → 切换到 IL 编辑器
  - 未保存内容提示保存后切换
- **边界**: 
  - 文件名含非法字符（`/`、`\`、`:`）→ 拒绝并提示
  - 重名 → 错误提示 `"File 'X' already exists"`
- **测试**: `test_rename_changes_editor` (Playwright E2E)

---

## 3. WF-LD — LD 编辑器交互 (5 项)

### WF-LD-001: 双击 .ld 打开 GLSP 编辑器

.d 文件通过 LdEditorOpenHandler 路由到 LD GLSP 编辑器 widget。

- **前置条件**: `src/main.ld` 文件存在于项目树中
- **操作**: 双击 `main.ld`
- **期望**: 
  - LD GLSP 编辑器在主区域 (main area) 打开
  - 画布显示左母线 (Power Rail L) 和右母线 (Power Rail R)
  - 工具面板 (Tool Palette) 显示可拖拽元素: 常开触点、常闭触点、线圈、取反线圈、功能块占位符
  - 编辑器标题显示文件名 `main.ld`
- **边界**: 
  - 文件已打开 → 激活现有编辑器标签（复用，不新建）
  - 文件内容损坏（非有效 GModel JSON）→ 显示警告并回退到空梯级
  - 非 .ld 文件 → `canHandle` 返回 0，由其他 OpenHandler 处理
- **测试**: `test_ld_file_opens_glsp_editor` (Playwright E2E)

> **实现参考**: `LdEditorOpenHandler.canHandle()` / `open()` — `ld-editor-contribution.ts:81-134`

### WF-LD-002: 工具面板拖放触点

从工具面板拖放常开触点到 LD 画布，在梯级上创建 ContactNode。

- **前置条件**: LD GLSP 编辑器已打开，画布至少有一个空梯级
- **操作**: 从工具面板拖动 `--| |--` (常开触点) 到画布梯级左侧区域
- **期望**: 
  - 触点节点出现在释放位置
  - 自动连线到左母线（输入边）和下一个元素位置（输出边）
  - 属性面板显示触点属性：变量名（空）、注释（空）、取反标志（未选中）
  - 触点可拖拽调整位置，连线跟随
- **边界**: 
  - 拖放到画布外部 → 触点取消创建
  - 梯级已满（水平方向无空间）→ 自动创建新梯级
  - 拖放功能块占位符 → 弹出 FBD 选择对话框
- **测试**: `test_drag_contact_to_canvas` (Playwright E2E)

### WF-LD-003: 触点/线圈连线

在触点和线圈之间绘制连线 (WireConnection)。

- **前置条件**: 画布梯级上有常开触点 (左侧) 和线圈 (右侧)
- **操作**: 点击触点输出端口 → 拖动到线圈输入端口 → 释放
- **期望**: 
  - 绿色/蓝色连线渲染在触点输出和线圈输入之间
  - 连线使用直角正交路由 (orthogonal routing)
  - 选中连线时显示删除手柄（可右键删除或按 Delete）
- **边界**: 
  - 连线自环（同元素同端口）→ 拒绝
  - 连线短路（左母线直接连右母线）→ 拒绝并标记为编译错误
- **测试**: `test_wire_contact_to_coil` (vitest, GModel 验证)

> **参考**: LD GModel 定义 — `STH-021`

### WF-LD-004: 撤销/重做

LD 编辑器支持标准的 Undo/Redo 操作链。

- **前置条件**: 在梯级上依次添加触点 A、触点 B、删除触点 A
- **操作**: 执行 Undo (Ctrl+Z / Cmd+Z)
- **期望**: 
  - 第一次 Undo → 触点 A 恢复（删除操作撤销）
  - 第二次 Undo → 触点 B 消失（添加操作撤销）
  - Undo 深度耗尽后 `isEnabled: false`
- **操作**: 执行 Redo (Ctrl+Shift+Z / Cmd+Shift+Z)
- **期望**: 恢复对应撤销的操作
- **边界**: 
  - 保存文件后 Undo 栈不清空 — 可撤销到文件打开时的状态
  - 外部文件变更（其他编辑器修改同文件）→ Undo 历史失效，提示重新加载
- **测试**: `test_ld_undo_redo_chain` (vitest, 基于 `LdGModelState`)

> **实现参考**: `LdEditorCommandContribution.undo()` / `redo()` — `ld-editor-contribution.ts:262-269`

### WF-LD-005: 梯形图保存

LD 编辑器将当前 GModel 序列化为 JSON 并写回 .ld 文件。

- **前置条件**: LD 编辑器中有未保存的修改（`isDirty: true`）
- **操作**: 执行 Save (Ctrl+S / Cmd+S) 或点击工具栏保存按钮
- **期望**: 
  - GModel 通过 `toJSON()` 序列化为 JSON 字符串
  - `FileService.write()` 写入原 .ld 文件
  - `markClean()` 被调用，编辑器标签取消脏标记（● 消失）
  - 消息栏显示 `"Saved: main.ld"`
- **边界**: 
  - 保存时文件被外部删除 → 重新创建文件，正常保存
  - 序列化失败（模型数据异常）→ 错误提示 `"Failed to serialize LD graph"`
- **测试**: `test_ld_save_writes_gmodel_json` (vitest)

> **实现参考**: `LdEditorCommandContribution.save()` — `ld-editor-contribution.ts:232-258`

---

## 4. WF-COMPILE — 编译 (5 项)

### WF-COMPILE-001: LD 编译流程 (LD → IL → HalProgram)

LD 编辑器右键 Compile 触发完整编译链：LD GModel → IL 中间表示 → HalProgram。

- **前置条件**: LD 编辑器中有完整梯级（含触点+线圈+连线），编辑器连接到 theia-bridge
- **操作**: 右键画布 → 选择 `LD: Compile`（或执行 Command Palette `audesys.ld.compile`）
- **期望**: 
  - `LdOperationHandler.compile(graph)` 被调用
  - 返回 `CompileResult { success: true, programJson: "..." }`
  - 消息栏显示 `"Compilation successful!"` + 输出大小
  - `markClean()` 被调用（编译成功视作保存点）
- **边界**: 
  - 短路线圈 → `success: false`，`diagnostics` 含 `[ERROR] Short circuit detected (LD-001)`
  - 空梯级 → `success: true`（空梯级合法，生成空 HalProgram）
  - 未定义变量 → `diagnostics` 含 `[WARNING] Undefined variable 'motor1' (LD-002)`
  - 编译超时 30s → `success: false`，消息 `"Compilation timed out"`
- **测试**: `test_ld_compile_basic` (vitest), `test_ld_compile_with_error` (vitest)

> **实现参考**: `LdEditorCommandContribution.compile()` — `ld-editor-contribution.ts:210-228`

### WF-COMPILE-002: 编译输出格式

编译成功后的 HalProgram 输出为标准 JSON 字符串，可通过 bincode 转二进制。

- **前置条件**: 编译成功，`result.success === true`
- **操作**: 读取 `result.programJson`
- **期望**: 
  - JSON 结构包含 `operations` 数组（34 种操作码之一）
  - 每个 operation 含 `opcode`、`operands`、`line` 字段
  - JSON 可通过 `bincode::serialize()` 转为二进制（用于部署）
- **边界**: 
  - JSON 超过 10MB → 编译失败（`programJson` 截断），提示 `"Program too large"`
  - 空 HalProgram → `operations: []`，合法
- **测试**: `test_compile_output_json_schema` (vitest)

### WF-COMPILE-003: 其他语言编译入口

ST、IL、FBD、SFC、G-code 语言各有独立编译命令，统一输出 HalProgram。

- **前置条件**: 各语言编辑器中有有效源码
- **操作**: 分别执行各语言编译命令:
  - ST: `audesys.st.compile` → ST 编译器 → HalProgram
  - IL: `audesys.il.compile` → IL 编译器 → HalProgram
  - FBD: `audesys.fbd.compile` → FBD 编译器 → HalProgram
  - SFC: `audesys.sfc.compile` → SFC 编译器 → HalProgram
  - G-code: `audesys.gcode.compile` → G-code 编译器 → HalProgram
- **期望**: 所有语言编译器输出符合相同 HalProgram JSON schema（共享后端）
- **边界**: 各语言特有错误 → 诊断消息含语言前缀（`ST-xxx`, `IL-xxx` 等）
- **测试**: `test_all_languages_compile_to_halprogram` (vitest)

> **参考**: `STH-001` ~ `STH-006` (studio-theia-spec.md)

### WF-COMPILE-004: 编译诊断与编辑器标记

编译错误在编辑器中以 Monaco markers 形式内联显示。

- **前置条件**: ST 文本编辑器中有语法错误 `IF x > 0 THN`（THN 应为 THEN）
- **操作**: 保存文件（触发自动编译，500ms 去抖动）
- **期望**: 
  - 错误行高亮红色波浪线
  - 鼠标悬停显示 `"[ERROR] Unknown keyword 'THN', did you mean 'THEN'? (ST-015)"`
  - 问题面板 (Problems View) 列出错误: 文件、行号、严重程度、消息
- **边界**: 
  - 编译时文件已被删除 → 清除该文件的全部 markers
  - 多个编译器同时对同文件诊断 → 合并显示（按行号排序）
- **测试**: `test_compile_error_inline_marker` (Playwright E2E)

> **参考**: `STH-033` (ST 诊断)

### WF-COMPILE-005: 工程级全量编译

Build > Build Project 触发工程内所有源文件的全量编译。

- **前置条件**: 工程包含 3 个源文件: `main.st`、`motor.ld`、`alarm.fbd`
- **操作**: 执行 `Build > Build Project`
- **期望**: 
  - 所有源文件按依赖顺序编译（.st → .ld → .fbd）
  - 汇总输出: `"Build complete: 3 succeeded, 0 failed, 0 warnings"`
  - 任一文件编译失败 → 汇总显示 `"Build failed: 2 succeeded, 1 failed"`
  - 输出目录 `build/` 中生成合并的 `program.bincode`（用于部署）
- **边界**: 
  - 工程无源文件 → `"No source files to build"`
  - 文件间有循环依赖 → 检测并报告 `"Circular dependency: main.st ↔ motor.ld"`
- **测试**: `test_project_full_build` (vitest)

---

## 5. WF-DEPLOY — 部署 (5 项)

### WF-DEPLOY-001: 部署命令入口

右键工程或已编译文件 → Deploy 触发部署流程。

- **前置条件**: 编译成功，`build/program.bincode` 存在
- **操作**: 右键工程节点 → Deploy，或右键已编译的 .ld 文件 → Deploy
- **期望**: 
  - 部署对话框显示: Controller 地址（UDS socket 路径）、程序大小、目标角色认证
  - 确认后调用 `theia-bridge.deploy_program(bincode)`
  - 状态栏显示 `"Deploying..."` 进度
- **边界**: 
  - 未编译 → 提示 `"Build project first before deploying"`
  - 无有效 Controller 连接 → 提示 `"Controller not connected. Check IPC socket path."`
- **测试**: `test_deploy_command_entry` (vitest)

### WF-DEPLOY-002: IPC 0x10 deploy_program 消息

部署通过 napi-rs 桥接 → UDS IPC method 0x10 发送 HalProgram 到 Controller。

- **前置条件**: theia-bridge 连接到 Controller（UDS socket 就绪），HMAC 认证通过
- **操作**: 调用 `theiaBridge.deployProgram(bincode: Buffer)`
- **期望**: 
  - IPC 帧格式: `<header:8B> + <hmac:32B> + <payload(bincode)>`
  - Controller 接收后写入 Config Barrier 队列
  - 返回 IPC ACK（status=0）
  - Studio 显示 `"Deployment successful. Program will activate at next cycle."`
- **边界**: 
  - HMAC 认证失败 → 返回 `ErrorCode::AuthFailed`（401），提示重新认证
  - payload 超过 10MB → 返回 `ErrorCode::PayloadTooLarge`，提示 `"Program exceeds maximum size (10MB)"`
  - Controller 不在 Run 状态 → 返回 `ErrorCode::InvalidState`，提示 `"Controller must be in Configure state"`
- **测试**: `test_deploy_via_ipc_0x10` (vitest, mock IPC)

> **参考**: `STH-009` (deploy_program napi-rs), `HMI-DPL-001` (相同 IPC 帧格式)

### WF-DEPLOY-003: Config Barrier 周期边界应用

部署的程序在当前周期不生效，在周期边界批量应用（D17）。

- **前置条件**: 周期 N 中调用 `deployProgram()`，Controller RT 线程正在执行周期 N
- **操作**: 在周期 N 中部署 → 周期 N 内调用 `health_query` 查询 `active_generation`
- **期望**: 
  - 周期 N 中 `active_generation` 仍为旧值（新程序尚未生效）
  - 周期 N+1 开始时新程序生效，`active_generation` 递增
- **边界**: 
  - 同周期多次 deploy → Config Barrier 队列仅保留最后一条（FIFO + 去重）
  - 部署失败（程序校验不通过）→ 队列中该项被丢弃，下周期不切换
- **测试**: `test_config_barrier_deploy_defer` (vitest)

> **参考**: Config Barrier 规范 (config-barrier-spec.md), D17

### WF-DEPLOY-004: 部署确认与 generation 追踪

Controller 在程序应用成功后发送 `DEPLOY_ACK(0x10, status=0, generation=N)`。

- **前置条件**: 周期边界新程序应用成功
- **操作**: Controller 发送 DEPLOY_ACK
- **期望**: 
  - Studio 接收 DEPLOY_ACK，状态栏更新为 `"Running: generation N"`
  - `generation` 从 1 开始单调递增（Controller 重启则归零）
  - 部署失败 → `DEPLOY_ACK` status != 0，消息栏显示错误详情
- **边界**: 
  - ACK 超时 10s 未收到 → Studio 显示 `"Deployment timeout — check controller logs"`
  - ACK 中 generation 跳跃（如 1→5）→ 日志警告 `"Unexpected generation jump"`
- **测试**: `test_deploy_ack_generation_tracking` (vitest)

### WF-DEPLOY-005: 部署到多 Controller (P2)

Phase 2 支持同一程序部署到多个 Controller（冗余热备拓扑）。

- **前置条件**: P2，配置中定义了 2+ Controller endpoint
- **操作**: 执行 Deploy → 选择目标 Controller 列表 → 确认
- **期望**: 
  - 依次向每个 Controller 发送 IPC 0x10
  - 所有 Controller 返回 ACK 后显示 `"Deployed to N controllers"`
  - 任一失败 → 显示部分失败详情 `"2 of 3 deployed successfully"`
- **边界**: 
  - 多 Controller 版本不一致 → 部署前校验，不兼容时拒绝部署
  - P1 不支持此功能 → 菜单项隐藏
- **测试**: `test_multi_controller_deploy` (延迟至 P2)

---

## 6. WF-DEBUG — 调试 (4 项)

### WF-DEBUG-001: 断点设置/清除

在 ST 文本编辑器中设置和清除断点。

- **前置条件**: ST 编辑器中有 `main.st` 源码，程序已部署到 Controller
- **操作**: 点击行号旁的装订线 (gutter) → 红色圆点出现 (断点已设置)
- **期望**: 
  - 断点行高亮红色背景
  - DAP Debug Adapter 接收 `setBreakpoints` 请求
  - 再次点击同位置 → 断点清除，红色圆点消失
- **边界**: 
  - 在空行/注释行设断点 → 自动移动到下一个可执行行
  - 在非 .st 文件设断点 → 拒绝（IL/LD/FBD/SFC/G-code 调试延后至 P2）
  - Controller 未连接 → 断点仅在本地标记（灰色），连接后同步
- **测试**: `test_set_clear_breakpoint` (vitest, mock DAP)

> **参考**: DAP Debug Adapter (crates/audeys-dap-adapter/), STH-038 (快速修复)

### WF-DEBUG-002: 步进执行

支持 Step Over、Step Into、Step Out、Continue 四种步进模式。

- **前置条件**: 程序运行中，在断点处暂停
- **操作**: 点击调试工具栏 `Step Over` (F10)
- **期望**: 
  - 当前行执行完成，光标移动到下一行
  - DAP 发送 `next` 请求，Controller 单周期执行一个 HalProgram 操作码
  - 变量视图和寄存器视图刷新
- **操作**: 点击 `Continue` (F5)
- **期望**: 程序恢复运行直到下一个断点或程序结束
- **边界**: 
  - 步进到程序末尾 → 自动停止，显示 `"Program finished"`
  - 步进期间 Controller 崩溃 → DAP 返回 `terminated` 事件
- **测试**: `test_step_over_continue` (vitest, mock DAP)

### WF-DEBUG-003: 变量/寄存器查看

暂停时在调试面板中查看变量值和寄存器状态。

- **前置条件**: 程序在断点处暂停
- **操作**: 展开 Variables 面板 → 查看局部变量列表，展开 Registers 面板 → 查看累加器值
- **期望**: 
  - Variables 面板显示变量名、类型、当前值: `x: INT = 5`, `motor_on: BOOL = TRUE`
  - Registers 面板显示: Accumulator、Program Counter、Stack Pointer
  - 值变化时高亮闪烁（黄→白过渡）
- **边界**: 
  - 变量超出作用域 → 显示 `"<not in scope>"`
  - 结构体/数组变量 → 支持展开查看子字段
  - HAL 信号变量 → 显示实时信号值（通过 `read_signal` IPC 0x0D 查询）
- **测试**: `test_variable_register_view` (vitest)

### WF-DEBUG-004: Debug Panel 集成

Theia Debug Panel Widget 显示调试会话状态。

- **前置条件**: Debug Panel widget 已注册，调试会话已启动
- **操作**: 打开 Debug Panel → 观察面板内容
- **期望**: 
  - 显示: 当前状态 (Running/Paused/Stopped)、当前行号、当前文件
  - 工具栏: Continue / Step Over / Step Into / Step Out / Stop 按钮
  - 断点列表 (Breakpoints): 文件 + 行号 + 启用/禁用开关
  - 调用栈 (Call Stack): 当前函数 → 调用者（多级）
- **边界**: 
  - Debug Panel 在无调试会话时显示 `"No active debug session"`
  - 调试会话异常终止 → 面板显示错误原因，所有断点保留
- **测试**: `test_debug_panel_integration` (Playwright E2E)

> **参考**: `apps/studio-theia/debug-panel` — 8 源文件/7 测试, DI bindings 完整

---

## 7. WF-BINDING — HMI 变量绑定 (2 项)

### WF-BINDING-001: HMI Designer 中输入 LD 变量名

在 HMI Designer 中为 widget 配置 signal 字段，绑定 LD 程序中定义的变量名。

- **前置条件**: HMI Designer 打开，画布上有 Gauge widget，LD 程序中定义了 `tank.level: REAL`
- **操作**: 选中 Gauge widget → 属性面板 signal 字段输入 `tank.level` → 回车确认
- **期望**: 
  - widget 的 `signal` 属性保存为 `"tank.level"`
  - 信号名实时校验（调用 `validateSignalName()`）→ 有效信号名显示绿色勾，无效显示红色叉
  - 信号名符合 `component.interface.name` 三段式命名约定时最高优先级匹配
- **边界**: 
  - 信号名不存在于当前信号注册表 → 黄色警告 `"Signal 'tank.level' not found in registry"`（但允许绑定——部署时校验）
  - 信号名空字符串 → 跳过检查（允许未绑定的占位 widget）
  - button widget 信号绑定 → 同时受 `HMI-SIG-003` writeSignal 权限约束
- **测试**: `test_hmi_widget_signal_binding` (vitest)

> **参考**: HMI-VAL-006 (信号名有效性), HMI-SIG-003 (writeSignal 权限)

### WF-BINDING-002: Preview 模式显示实时值

HMI Designer 的 Preview 模式中通过信号注入显示绑定变量的实时值。

- **前置条件**: HMI Designer 有 Gauge widget 绑定 `tank.level`，Controller 正常运行
- **操作**: 切换到 Preview 模式（工具栏 Preview 按钮）
- **期望**: 
  - Gauge widget 实时显示 `tank.level` 的当前值（通过 `read_signal` IPC 0x0D 轮询，500ms 间隔）
  - 值变化时仪表盘指针平滑过渡（CSS transition 300ms）
  - Display widget 以数字形式显示值
- **边界**: 
  - Controller 未连接 → widget 显示 `"N/A"` 灰色占位状态
  - 信号值超出 Gauge min/max → 指针停在极值处，tooltip 显示实际值
  - Preview 模式下 widget 不可拖拽/编辑（只读）
- **测试**: `test_preview_mode_live_signal` (Playwright E2E)

> **参考**: D67 (sim_set_signal 复用), `useHmiSignal.ts`

---

## 交叉引用

| 决策 | 规范项 |
|------|--------|
| D17 | WF-DEPLOY-003 (Config Barrier 周期边界) |
| D22 | WF-FILE-002~004 (IEC 61131-3 编译器路线) |
| D25 | WF-FILE-001 (Phase 1 全语言支持偏离) |
| D55 | WF-FILE-004 (G-code 编译) |
| D56 | WF-COMPILE-003 (直接自研编译器) |
| D57 | WF-FILE-001~004 (6 语言全实现) |
| D68 | WF-DEPLOY-001, WF-DEPLOY-002 (IPC 0x10 部署) |
| D71 | WF-CREATE-001 (Theia 架构) |

| 关联规范 | 规范项 |
|----------|--------|
| STH-001~006 | WF-COMPILE-003 (各语言编译 napi-rs) |
| STH-009 | WF-DEPLOY-002 (deploy_program napi-rs) |
| STH-021~026 | WF-LD-001~005 (GLSP 编辑器) |
| STH-033 | WF-COMPILE-004 (编译诊断) |
| HMI-VAL-005 | WF-BINDING-001 (信号名有效性) |
| HMI-SIG-003 | WF-BINDING-001 (writeSignal 权限) |
| Config-Barrier | WF-DEPLOY-003 (周期边界应用) |

## Phase 边界

- **P1 实现**: WF-CREATE-001~004, WF-FILE-001~005, WF-LD-001~005, WF-COMPILE-001~005, WF-DEPLOY-001~004, WF-DEBUG-001~004, WF-BINDING-001~002 (29/30 项)
- **P2 实现**: WF-DEPLOY-005 (多 Controller 部署)
- **P1 备注**: WF-DEBUG-002 LD/FBD/SFC 断点调试延后至 P2（P1 仅 ST 文本断点）
