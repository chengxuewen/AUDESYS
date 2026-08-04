# AUDESYS LD GLSP Editor SDD 规范

> **来源**: `theia-extensions/audesys-ld-glsp/` (client/ + server/ + gmodel/ + theia/) + `docs/reference/glsp.md` + `docs/reference/theia-architecture.md`
> **总项数**: 33
> **Phase**: P2
> **当前状态**: 基础实现完成 (GLSP 2.x 客户端 + 服务端, 7 种节点类型, 5 种视图渲染, 4 个操作处理器, Theia 集成)
> **根因修复**: D99 (GLSP 模块隔离), D103 (构建时移除 symlink), D104 (OpenerService.addHandler)

---

## 1. LD-CLIENT — 客户端模块 (5 项)

> **组件**: `src/client/ld-glsp-client-module.ts` + `src/theia/ld-theia-frontend-module.ts` + `src/theia/ld-theia-diagram-configuration.ts`

### LD-CLIENT-001: configureDefaultModelElements 在模块加载时调用

GLSP 客户端模块必须在 `ContainerModule` 构造函数中调用 `configureDefaultModelElements()`，注册所有标准 Sprotty 视图（SGraphView, PolylineEdgeView 等）到正确的 GLSP DI Symbols。

- **前置条件**: `ld-glsp-client-module.ts` 被 `initializeDiagramContainer()` 加载
- **操作**: 创建 `ContainerModule` 实例，执行其构造函数
- **期望**: `configureDefaultModelElements(context)` 被调用，`SGraphView` 和 `PolylineEdgeView` 注册到 `@eclipse-glsp/sprotty` 的 DI 容器中，`ViewRegistry` 可解析 `graph` 类型
- **边界**: 模块被多次加载（重复调用 `initializeDiagramContainer`）— 应幂等或抛出可处理错误
- **测试映射**: `ld-glsp-client-module.ts::44-50` (configureDefaultModelElements 调用)

### LD-CLIENT-002: 所有 sprotty 导入来自 @eclipse-glsp/client

遵循 D99 决策，所有 GLSP 客户端代码必须从 `@eclipse-glsp/client` 导入 sprotty 类型，禁止直接从 `sprotty` 导入。`@eclipse-glsp/client` 是 GLSP 对 sprotty 的 fork，使用正确的 DI Symbol 体系。

- **前置条件**: `ld-glsp-client-module.ts` 和 `ld-gmodel-views.ts` 中所有导入路径
- **操作**: 检查每条 import 语句
- **期望**: `SGraphView`, `PolylineEdgeView`, `GNode`, `SEdgeImpl`, `SGraphImpl`, `selectFeature`, `moveFeature`, `deletableFeature`, `boundsFeature`, `viewportFeature`, `IView`, `RenderingContext` 全部从 `@eclipse-glsp/client` 导入。零个 `from 'sprotty'` 导入
- **边界**: 混合导入（部分来自 `@eclipse-glsp/client` 部分来自 `sprotty`）— 应全部统一
- **测试映射**: `ld-glsp-client-module.ts::8-24`, `ld-gmodel-views.ts::8`

### LD-CLIENT-003: 7 个 LD_NODE_TYPES 注册

客户端模块定义 7 种节点类型常量，涵盖整个 LD 图模型的全部元素类型。类型字符串遵循 GLSP 的 `node:<kind>` 和 `edge:<kind>` 命名约定。

- **前置条件**: `LD_NODE_TYPES` 常量对象定义在 `ld-glsp-client-module.ts`
- **操作**: 读取 `LD_NODE_TYPES` 对象属性
- **期望**: 包含 7 个键值对：`GRAPH = 'graph'`, `CONTACT = 'node:contact'`, `COIL = 'node:coil'`, `POWERRAIL = 'node:powerrail'`, `FB = 'node:fb'`, `WIRE = 'edge:wire'`, `POWER = 'edge:power'`
- **边界**: 新增节点类型（如 `node:rung`）— 需同步添加到此集合
- **测试映射**: `ld-glsp-client-module.ts::30-38`

### LD-CLIENT-004: initializeDiagramContainer 创建有效 DI 容器

`LdTheiaDiagramConfiguration.configureContainer()` 调用 `initializeDiagramContainer()` 创建包含所有注册视图和功能的 inversify DI 容器。容器必须可解析 `SGraphView`、`PolylineEdgeView` 等关键视图。

- **前置条件**: `LdTheiaDiagramConfiguration` 实例已创建，`ldGlspClientModule` 已导入
- **操作**: 调用 `configureContainer(container, ldGlspClientModule)` 并解析 key 视图
- **期望**: `container.get(SGraphView)` 返回 `SGraphView` 实例，`container.get(PolylineEdgeView)` 返回 `PolylineEdgeView` 实例，`container.get(IView)` 返回视图注册表
- **边界**: 空容器（无参数）— 应抛出类型错误；重复加载同一模块 — 幂等
- **测试映射**: `ld-theia-diagram-configuration.ts::18-20`

### LD-CLIENT-005: LD 图配置映射到 diagramType 'ld-diagram'

`LdTheiaDiagramConfiguration.diagramType` 返回 `LdDiagramLanguage.diagramType` 的值，GLSP 客户端用此类型匹配来自服务端的 GModel 数据。

- **前置条件**: `LdTheiaDiagramConfiguration` 实例和 `LdDiagramLanguage` 常量
- **操作**: 读取 `diagramType` 属性
- **期望**: `diagramType` 返回字符串 `'ld-diagram'`，与 `LdDiagramModule.diagramType` 一致（服务端同名）
- **边界**: 服务端和客户端类型不匹配 — 图无法渲染；空字符串 — 应拒绝加载
- **测试映射**: `ld-theia-diagram-configuration.ts::14-16`, `ld-language.ts::12`

---

## 2. LD-VIEW — 视图渲染 (10 项)

> **组件**: `src/client/ld-gmodel-views.ts` + `src/client/ld-css-inject.ts` + `src/gmodel/nodes.ts`

### LD-VIEW-006: LdContactView 渲染 NO 触点

NO (Normally Open) 触点由 `LdContactView` 渲染，显示为带矩形边框、水平横线和垂直竖线的 SVG 元素，变量名标注在下方的标签文本中。

- **前置条件**: `LdContactView` 实例已创建，`contactType='NO'`, `variableName='X1'`
- **操作**: 调用 `render(model, context)` 其中 `model.args.contactType = 'NO'`
- **期望**: 返回 SVG `g` 元素，包含：`rect` (矩形边框，`stroke: #4caf50`)，`line` (水平横线 `x1: cx-12, x2: cx+12`)，`line` (垂直竖线 `y1: cy-12, y2: cy+12`)，`text` (值为 `'X1'`，`fill: #888`)
- **边界**: `variableName` 为空字符串 — 标签显示空文本；`position` 为负值 — SVG 渲染在可视区域外
- **测试映射**: `ld-gmodel-views.ts::56-125`

### LD-VIEW-007: LdContactView 渲染 NC 触点

NC (Normally Closed) 触点渲染为带矩形边框和斜线的 SVG 元素，斜线从左上到右下穿过触点。

- **前置条件**: `LdContactView` 实例，`contactType='NC'`, `variableName='X2'`
- **操作**: 调用 `render(model, context)` 其中 `model.args.contactType = 'NC'`
- **期望**: 返回 SVG `g` 元素，包含：`rect` (矩形边框，`stroke: #f44336`)，`line` (水平横线)，`line` (斜线，从 `x1: cx, y1: cy-12` 到 `x2: cx+12, y2: cy+12`)，`text` (值为 `'X2'`)
- **边界**: `contactType` 为 undefined — 默认渲染为 NO；`contactType` 为任意非 NO 值 — 渲染为 NC
- **测试映射**: `ld-gmodel-views.ts::97-113`

### LD-VIEW-008: LdCoilView 渲染 Normal 线圈

Normal 线圈渲染为带圆角矩形边框的 SVG 元素，无内部标记符号，变量名标注在下方。

- **前置条件**: `LdCoilView` 实例，`coilType='Normal'`, `variableName='Y1'`
- **操作**: 调用 `render(model, context)` 其中 `model.args.coilType = 'Normal'`
- **期望**: 返回 SVG `g` 元素，包含：`rect` (圆角矩形，`rx: 18`, `stroke: #4caf50`)，`text` (值为 `'Y1'`)，无额外 'S'/'R' 文本或斜线
- **边界**: `coilType` 为 undefined — 默认渲染为 Normal
- **测试映射**: `ld-gmodel-views.ts::132-205`

### LD-VIEW-009: LdCoilView 渲染 Set 线圈

Set 线圈渲染为圆角矩形内部显示大写 'S' 文本标记。

- **前置条件**: `LdCoilView` 实例，`coilType='Set'`, `variableName='Y2'`
- **操作**: 调用 `render` 方法
- **期望**: SVG 包含 `text` 元素值为 `'S'`，`font-weight: bold`，`fill: #ff9800`，居中显示在矩形内部
- **边界**: 'S' 文本在矩形内水平/垂直居中
- **测试映射**: `ld-gmodel-views.ts::177-184`

### LD-VIEW-010: LdCoilView 渲染 Reset 线圈

Reset 线圈渲染为圆角矩形内部显示大写 'R' 文本标记。

- **前置条件**: `LdCoilView` 实例，`coilType='Reset'`, `variableName='Y3'`
- **操作**: 调用 `render` 方法
- **期望**: SVG 包含 `text` 元素值为 `'R'`，`font-weight: bold`，`fill: #f44336`，居中显示在矩形内部
- **边界**: 'R' 文本在矩形内水平/垂直居中
- **测试映射**: `ld-gmodel-views.ts::185-193`

### LD-VIEW-011: LdCoilView 渲染 Negated 线圈

Negated 线圈渲染为圆角矩形内部带斜线标记（从左上到右下）。

- **前置条件**: `LdCoilView` 实例，`coilType='Negated'`, `variableName='Y4'`
- **操作**: 调用 `render` 方法
- **期望**: SVG 包含 `line` 元素，从 `x1: cx-12, y1: cy+12` 到 `x2: cx+12, y2: cy-12`，`stroke-width: 1.5`，无 'S'/'R' 文本
- **边界**: Negated 线圈的斜线方向与 NC 触点相反（右上到左下 vs 左上到右下）
- **测试映射**: `ld-gmodel-views.ts::169-176`

### LD-VIEW-012: LdPowerRailView 渲染垂直竖线

Power Rail 渲染为一条垂直竖线，颜色由 `--ld-power-rail-color` CSS 变量控制（默认 `#2196f3`），线宽 `RAIL_WIDTH = 4px`。

- **前置条件**: `LdPowerRailView` 实例，`side='Left'`, `model.size.height = 400`
- **操作**: 调用 `render(model, context)`
- **期望**: 返回 SVG `line` 元素，起点 `(x, y)` 终点 `(x, y+400)`，`stroke: #2196f3`，`stroke-width: 4`
- **边界**: `size.height` 为 0 — 不渲染可见线；`size.height` 为 undefined — 默认 400
- **测试映射**: `ld-gmodel-views.ts::213-228`

### LD-VIEW-013: LdFbView 渲染矩形带标签

Function Block 视图渲染为带填充色和描边色的矩形，内部居中显示 FB 类型名称。

- **前置条件**: `LdFbView` 实例，`fbType='TON'`, `model.size = { width: 120, height: 60 }`
- **操作**: 调用 `render(model, context)`
- **期望**: 返回 SVG `g` 元素，包含：`rect` (宽 120 高 60 `fill: #37474f` `stroke: #4caf50` `rx: 6`)，`text` (值为 `'TON'`，居中 `fill: #4caf50` `font-weight: bold`)
- **边界**: `fbType` 为空字符串 — 显示空标签；`size` 为 undefined — 默认宽 120 高 60
- **测试映射**: `ld-gmodel-views.ts::236-275`

### LD-VIEW-014: PolylineEdgeView 渲染节点间连线

`PolylineEdgeView` 渲染两个节点之间的连线，线型为折线，支持 `edge:wire` 和 `edge:power` 两种边缘类型。通过 `configureModelElement` 注册到 GLSP 的 Edge 类型。

- **前置条件**: PolylineEdgeView 通过 `configureModelElement(context, 'edge:wire', SEdgeImpl, PolylineEdgeView)` 注册，两个节点间存在 wire 连接
- **操作**: 渲染包含 `edge:wire` 类型的 GEdge 的完整图模型
- **期望**: 源节点和目标节点之间出现折线，线色为 `--ld-wire-color` (默认 `#666`)，可选中、可删除
- **边界**: 源/目标节点 ID 不存在 — 连线不渲染；路由点数组为空 — 渲染为直线
- **测试映射**: `ld-glsp-client-module.ts::78-83`

### LD-VIEW-015: 所有视图使用 CSS 变量带硬编码回退

每个视图的颜色引用采用 CSS 变量模式 `var(--ld-xxx, #fallback)`，确保在 CSS 变量未注入时仍能显示。

- **前置条件**: `ld-gmodel-views.ts` 中 `C` 常量对象
- **操作**: 检查每个颜色引用的定义
- **期望**: 全部 10 个颜色变量均使用 `var(--ld-xxx, #hex)` 格式：`powerRail`, `contactNo`, `contactNc`, `coilNormal`, `coilSet`, `coilReset`, `label`, `selection`, `wire`, `fbFill`, `fbStroke`
- **边界**: CSS 变量 `--ld-xxx` 未定义（如 `injectLdCssVariables()` 未调用）— 使用硬编码回退色
- **测试映射**: `ld-gmodel-views.ts::21-33`, `ld-css-inject.ts::9-42`

---

## 3. LD-SERVER — 服务端处理器 (7 项)

> **组件**: `src/server/index.ts` + `src/server/ld-diagram-generator.ts` + `src/server/ld-operation-handler.ts`

### LD-SERVER-016: loadSourceModel 解析 sourceModel 从 action options

`LdSourceModelStorage.loadSourceModel()` 从 `RequestModelAction` 的 `options` 中读取 `sourceModel`（JSON 字符串），解析为 `LdGraph` 对象存入 `ModelState`。

- **前置条件**: `LdSourceModelStorage` 实例，`ModelState` 中无已有 `ld-source-model` 数据
- **操作**: 调用 `loadSourceModel(action)`，其中 `action.options.sourceModel = '{"id":"g1","nodes":[],"edges":[],"rungs":[]}'`
- **期望**: `modelState.set(LD_SOURCE_KEY, parsedLdGraph)` 被调用，`LdGraph` 对象的 `id` 为 `'g1'`
- **边界**: `sourceModel` 为非法 JSON — catch 静默失败，回退到 `createLdGraph()`；`sourceModel` 缺失字段 — 解析后作为部分 LdGraph 使用
- **测试映射**: `server/index.ts::158-181`

### LD-SERVER-017: loadSourceModel 回退到 createLdGraph()

当 `sourceModel` 和 `sourceUri` 均不可用时，`loadSourceModel` 必须创建空图防止后续操作访问未初始化的 `ModelState`。

- **前置条件**: `LdSourceModelStorage` 实例，`action.options` 中无 `sourceModel` 和 `sourceUri`
- **操作**: 调用 `loadSourceModel(action)` 其中 `action.options = {}`
- **期望**: `modelState.set(LD_SOURCE_KEY, createLdGraph())` 被调用，创建的 `LdGraph` 包含空 `nodes`、`edges`、`rungs` 数组
- **边界**: `action.options` 为 undefined — 同样回退到空图；`action.options.sourceUri` 指向不存在的文件 — catch 异常后回退到空图
- **测试映射**: `server/index.ts::173-179`

### LD-SERVER-018: LdCreateNodeHandler 创建触点 (NO/NC)

`LdCreateNodeHandler` 处理 `CreateNodeOperation`，根据 `elementTypeId` 为 `'node:contact'` 创建 NO 或 NC 触点节点。触点自动添加到指定的 rung 或创建新 rung，自动连线。

- **前置条件**: `LdCreateNodeHandler` 实例，`ModelState` 中有空 `LdGraph`
- **操作**: 执行 `CreateNodeOperation`，`elementTypeId = 'node:contact'`, `args = { contactType: 'NO' }`
- **期望**: `LdGraph` 中新增 `ContactNode` 类型为 `node:contact`，`contactType = 'NO'`，`variableName` 自动生成（如 `IN0`），自动创建 rung 和电源轨，自动连线到电源轨
- **边界**: `args.contactType` 未指定 — 默认 `'NO'`；同 rung 已有线圈 — 触点位置必须在线圈左侧
- **测试映射**: `server/index.ts::196-243`, `ld-operation-handler.ts::255-316`

### LD-SERVER-019: LdCreateNodeHandler 创建线圈 (Normal/Set/Reset/Negated)

`LdCreateNodeHandler` 根据 `elementTypeId` 为 `'node:coil'` 创建线圈节点，支持 4 种线圈类型。

- **前置条件**: `LdCreateNodeHandler` 实例，已有至少一个触点在同一 rung
- **操作**: 执行 `CreateNodeOperation`，`elementTypeId = 'node:coil'`, `args = { coilType: 'Set' }`
- **期望**: `LdGraph` 中新增 `CoilNode` 类型为 `node:coil`，`coilType = 'Set'`，`variableName` 自动生成（如 `OUT0`），自动连线到最后一个触点和右电源轨
- **边界**: `args.coilType` 未指定 — 默认 `'Normal'`；rung 已有线圈 — 抛出 `ValidationError`；无触点 — 抛出 `ValidationError('Add at least one contact before adding a coil')`
- **测试映射**: `server/index.ts::223-227`, `ld-operation-handler.ts::322-375`

### LD-SERVER-020: StatusAction 处理器防止 GLSPServerError

`reportModelLoading()` 内部 dispatch `StatusAction`。若无 handler 注册，`doDispatch()` 抛出 `GLSPServerError("No handler registered for action kind: statusAction")`。`StatusActionNoOpHandler` 注册为空操作 handler 防止此错误。

- **前置条件**: `LdDiagramModule.configureActionHandlers()` 已调用
- **操作**: 检查 `binding` 中是否注册了 `StatusActionNoOpHandler`
- **期望**: `StatusActionNoOpHandler` 已注册，其 `actionKinds` 包含 `StatusAction.KIND`，`execute()` 返回空数组 `[]`
- **边界**: 多个 `StatusAction` handler 注册 — GLSP 按注册顺序依次调用，全部返回空数组
- **测试映射**: `server/index.ts::144-150`, `server/index.ts::363`

### LD-SERVER-021: 边缘类型默认值为 'edge:wire'

当源数据中的 `edge.type` 为 undefined 或空时，`LdDiagramGenerator` 必须使用 `'edge:wire'` 作为默认类型，防止 `GModelIndex.doIndex()` 抛出 "The type property of a GModelElement must not be undefined"。

- **前置条件**: `LdDiagramGenerator` 实例，边缘对象 `{ id: 'e1', sourceId: 's1', targetId: 't1' }` 无 `type` 字段
- **操作**: `buildGraph()` 处理边缘列表
- **期望**: 生成的 `GEdge` 的 `type` 为 `'edge:wire'` 而非 `undefined`
- **边界**: `edge.type` 为 `'edge:power'` — 保留原值；`edge.type` 为空字符串 — 使用默认值
- **测试映射**: `ld-diagram-generator.ts::92`

### LD-SERVER-022: ComputedBoundsActionHandler 注册用于布局

`ComputedBoundsActionHandler` 处理客户端计算后的边界信息，是 GLSP 2.x 布局流程的必要组件。服务端必须注册此 handler 以接收客户端计算后的位置和尺寸。

- **前置条件**: `LdDiagramModule.configureActionHandlers()` 已调用
- **操作**: 检查 `binding` 中是否注册了 `ComputedBoundsActionHandler`
- **期望**: `ComputedBoundsActionHandler` 已作为 `ActionHandlerConstructor` 注册到 `binding`，来自 `@eclipse-glsp/server/node`
- **边界**: 注册后布局更新时客户端发送的 `ComputedBoundsAction` 被正确接收
- **测试映射**: `server/index.ts::364`

---

## 4. LD-E2E — 端到端渲染 (7 项)

> **组件**: 完整 GLSP 客户端 + 服务端 + Theia 集成

### LD-E2E-023: .ld 文件在 GLSP 图编辑器中打开

当用户在 Theia 工作区中打开 `.ld` 文件时，GLSP 图编辑器（而非 Monaco 文本编辑器）被激活。`LdEditorOpenHandler.canHandle()` 返回 1000（高于 Monaco 文本编辑器的 100），确保 `OpenerService` 选择图编辑器。

- **前置条件**: Theia 应用已启动，工作区包含 `.ld` 文件，`LdEditorOpenHandler` 已通过 `OpenerService.addHandler()` 注册 (D104)
- **操作**: 双击 `.ld` 文件（或从文件菜单打开）
- **期望**: `LdEditorOpenHandler.open()` 被调用，创建 `GLSPDiagramWidget`，widget 标题显示文件名，widget 添加到 `main` 区域并激活
- **边界**: `.ld` 文件内容为空 — 打开空图编辑器；`.ld` 文件为非法 JSON — 打开空图编辑器（非崩溃）
- **测试映射**: `ld-theia-opener.ts::27-59`

### LD-E2E-024: 图 SVG 可见包含 graph view

打开 `.ld` 文件后，GLSP 图渲染区域显示 SVG 元素，包含 `graph` 类型的根节点。SVG 中可识别 Sprotty 的 `SGraphView` 渲染结果。

- **前置条件**: `.ld` 文件已在 GLSP 编辑器中打开
- **操作**: 检查编辑器 DOM 中的 SVG 元素
- **期望**: SVG 元素存在，包含 `g[data-svg-element-id="ld-root"]` 或类似根节点标识，`SGraphView` 已渲染
- **边界**: 图完全为空（无节点）— 显示空白画布而非错误
- **测试映射**: Playwright E2E

### LD-E2E-025: 触点标签 IN1 在 SVG 中可见

创建的触点节点在 SVG 中显示变量名标签 `IN1`。标签文本渲染在触点矩形下方。

- **前置条件**: 包含至少一个触点的 `.ld` 文件在 GLSP 编辑器中打开，触点的 `variableName` 为 `IN1`
- **操作**: 检查组件的 SVG 渲染输出
- **期望**: SVG 中包含 `text` 元素，其文本内容为 `'IN1'`，`font-size: 10`，`text-anchor: middle`，位于触点矩形下方 (y = cy + HALF + 14)
- **边界**: 变量名过长（如 `THIS_IS_A_VERY_LONG_VARIABLE_NAME`）— 文本可能溢出 SVG 裁剪区域
- **测试映射**: Playwright E2E

### LD-E2E-026: 线圈标签 OUT1 在 SVG 中可见

创建的线圈节点在 SVG 中显示变量名标签 `OUT1`。

- **前置条件**: 包含至少一个线圈的 `.ld` 文件在 GLSP 编辑器中打开，线圈的 `variableName` 为 `OUT1`
- **操作**: 检查组件的 SVG 渲染输出
- **期望**: SVG 中包含 `text` 元素，其文本内容为 `'OUT1'`，`font-size: 10`，`text-anchor: middle`，位于线圈圆角矩形下方
- **边界**: 线圈类型为 Set/Reset/Negated — 标签 `OUT1` 仍显示在下方，内部符号 'S'/'R'/斜线共存
- **测试映射**: Playwright E2E

### LD-E2E-027: 工具面板显示 7 个工具项

GLSP 工具面板渲染 7 个可点击的工具项：NO Contact, NC Contact, Normal Coil, Negated Coil, Set Coil, Reset Coil, Power Rail。每项触发 `TriggerNodeCreationAction`。

- **前置条件**: GLSP 编辑器中工具面板已渲染
- **操作**: 检查工具面板的 DOM 内容
- **期望**: 7 个 `PaletteItem` 显示，每个包含 `label` 和 `icon`，`sortString` 分别为 'A' 到 'G'，点击触发 `TriggerNodeCreationAction.create(elementTypeId, args)`
- **边界**: 所有 7 项均可见，无滚动条隐藏项
- **测试映射**: `ld-tool-palette-provider.ts::33-42`, Playwright E2E

### LD-E2E-028: NO Contact 工具点击创建元素

点击工具面板中的 "NO Contact" 工具项，然后在画布上点击创建 NO 触点元素。元素渲染为绿色矩形带垂直竖线。

- **前置条件**: GLSP 编辑器已打开，工具面板可见
- **操作**: 点击 NO Contact 工具项，点击画布位置 (200, 100)
- **期望**: 新 `ContactNode` 以 `contactType='NO'` 被创建，自动生成变量名 `IN{n}`，rung 自动创建，SVG 中出现绿色矩形带竖线
- **边界**: 连续点击画布多处 — 每次创建新的独立触点
- **测试映射**: Playwright E2E

### LD-E2E-029: 控制台 0 个 GLSP 错误

打开 `.ld` 文件后，浏览器控制台不出现 GLSP 相关的错误。关键无错误列表：`"No handler registered for action kind: statusAction"`, `"The type property of a GModelElement must not be undefined"`, `"Cannot read properties of null (reading 'useState')"`, `"No matching bindings found"`。

- **前置条件**: GLSP 编辑器已打开，`.ld` 文件已加载
- **操作**: 收集浏览器控制台所有错误级别消息
- **期望**: 无 GLSP 相关错误，无 `GLSPServerError`，无 `TypeError`，无 `@injectable` 装饰器错误
- **边界**: 可接受 favicon.ico 404 — 这是 Theia 框架的已知无关错误
- **测试映射**: Playwright E2E (console.error 检查)

---

## 5. LD-BUILD — 构建验证 (4 项)

> **组件**: `apps/studio/lib/frontend/bundle.js` + `theia-extensions/audesys-ld-glsp/`

### LD-BUILD-030: Symbol("OpenHandler") = 1

构建后前端 bundle 中 `Symbol("OpenHandler")` 必须恰好出现 1 次。大于 1 表示扩展 node_modules symlink 导致 esbuild 将 `@theia/core` 打包为多个独立模块，DI 静默失败。

- **前置条件**: `apps/studio` 的 `npm run build` 已完成，扩展 node_modules 在构建前已移除 (D103)
- **操作**: 在 `lib/frontend/bundle.js` 中搜索 `Symbol("OpenHandler")`
- **期望**: `grep -c 'Symbol("OpenHandler")'` 返回 1
- **边界**: 值为 0 — DI 未绑定任何 OpenHandler，`.ld` 文件无法打开；值 > 1 — DI 绑定冲突，handler 可能不工作
- **测试映射**: `apps/studio/lib/frontend/bundle.js` (构建后验证)

### LD-BUILD-031: Symbol("FrontendApplicationContribution") = 1

构建后前端 bundle 中 `Symbol("FrontendApplicationContribution")` 必须恰好出现 1 次。此 Symbol 控制所有 `FrontendApplicationContribution` 的收集，包括 `LdOpenerBootstrap`。

- **前置条件**: 同 LD-BUILD-030
- **操作**: 在 `lib/frontend/bundle.js` 中搜索 `Symbol("FrontendApplicationContribution")`
- **期望**: `grep -c 'Symbol("FrontendApplicationContribution")'` 返回 1
- **边界**: 值 > 1 — DI 容器中的 `ContainerBasedContributionProvider` 只收集第一个 Symbol 的贡献，导致 `LdOpenerBootstrap` 不被调用
- **测试映射**: `apps/studio/lib/frontend/bundle.js` (构建后验证)

### LD-BUILD-032: GLSP 服务端进程在打开图时启动

当用户打开 `.ld` 文件时，`LdServerContribution` 启动独立的 GLSP 服务端 Node.js 进程。服务端进程在随机端口上监听 WebSocket 连接。

- **前置条件**: Theia 后端已启动，`LdServerContribution` 已注册
- **操作**: 打开 `.ld` 文件
- **期望**: `LdServerContribution.createContributionOptions()` 返回 `executable` 指向 `audesys-ld-glsp/lib/server/index`，新 Node.js 进程启动，`launch()` 函数执行，`SocketServerLauncher` 开始监听
- **边界**: 服务端进程崩溃 — `GLSPSocketServerContribution` 应自动重启；端口被占用 — 服务端启动失败，编辑器显示错误
- **测试映射**: `ld-server-contribution.ts::15-27`, `server/index.ts::386-397`

### LD-BUILD-033: GLSP 服务端从文件 URI 加载源模型

`LdSourceModelStorage.loadSourceModel()` 从 `action.options.sourceUri` 读取文件路径，加载 `.ld` JSON 文件内容，解析为 `LdGraph`。

- **前置条件**: `LdSourceModelStorage` 实例，`.ld` 文件在磁盘上（内容为合法 JSON LdGraph），`sourceUri` 为 `'file:///path/to/diagram.ld'`
- **操作**: 调用 `loadSourceModel(action)` 其中 `action.options.sourceUri = 'file:///path/to/diagram.ld'`
- **期望**: `fs.readFileSync()` 读取文件，`JSON.parse()` 解析为 `LdGraph`，`modelState.set(LD_SOURCE_KEY, parsed)` 被调用
- **边界**: 文件不存在 — catch 异常，回退到 `createLdGraph()` 或 `sourceModel` 选项；文件编码非 UTF-8 — 使用 `utf-8` 编码读取
- **测试映射**: `server/index.ts::164-172`

---

## 附录 A: 决策引用

| 决策 | 关联项 | 内容 |
|------|--------|------|
| D99 | LD-CLIENT-002 | GLSP 模块隔离 — sprotty vs @eclipse-glsp/sprotty |
| D103 | LD-BUILD-030, LD-BUILD-031 | 构建时移除扩展 node_modules symlink |
| D104 | LD-E2E-023 | LD GLSP OpenHandler 注册策略 — OpenerService.addHandler() |

## 附录 B: 诊断命令

```bash
# Symbol 唯一性验证 (LD-BUILD-030, 031)
for s in OpenHandler FrontendApplicationContribution OpenerService; do
  echo "$s: $(grep -c "Symbol(\"$s\")" apps/studio/lib/frontend/bundle.js)"
done

# sprotty 导入检查 (LD-CLIENT-002)
grep -rn "from 'sprotty'" theia-extensions/audesys-ld-glsp/src --include="*.ts" --include="*.tsx"

# GLSP 服务端进程检查 (LD-BUILD-032)
ps aux | grep 'ld-glsp.*server/index' | grep -v grep | wc -l
```
---

## 6. LD-RF — React Flow 布局与验证 (2026-08-04, D110 后)

> **状态标注**: 上文 LD-CLIENT/LD-VIEW/LD-SERVER/LD-E2E/LD-BUILD 章节为 GLSP 时代规范（D110 已完全移除 GLSP，GLSP 相关条目仅供历史参考）。本章节是 React Flow 编辑器（`theia-extensions/audesys-ld-editor/`）的现行规范。
> **组件**: `src/components/LdCanvas.tsx` + `src/components/nodes/` + `src/model/grid.ts` + `src/model/serialization.ts` + `src/model/validation-ui.ts` + `src/backend/ld-operation-handler.ts`

### LD-RF-034: 电源轨框定 rung 容器（右轨贴合右边缘）

右电源轨 x 位置必须与 rung 容器右边缘贴合，禁止存在"幻影右 padding"。

- **前置条件**: `grid.ts` 常量定义
- **操作**: 检查 `RUNG_GROUP_WIDTH` 与 `RAIL_X_RIGHT` 的关系
- **期望**: `RUNG_GROUP_WIDTH === RAIL_X_RIGHT + RAIL_WIDTH`（= 644）。左轨 x=0，右轨 x=640（= COIL_X_OFFSET + CONTACT_SIZE + RAIL_WIDTH），容器右边缘 = 右轨 x + 轨道宽
- **边界**: 曾为 `RAIL_X_RIGHT + 160`（GLSP 时代遗留），导致右轨渲染在容器中部（6533dbc 修复）
- **测试映射**: `src/__tests__/grid.test.ts`（5 项），E2E T28

### LD-RF-035: 空 rung 是警告（warning）而非错误（error）

空 rung（`elementIds.length === 0`）是编辑过程中的合法中间态，必须降级为 warning，不阻塞编译。

- **前置条件**: 图包含空 rung
- **操作**: `validateGraph()` 对空 rung 输出 warning；`LdOperationHandler.validate()` 透传 warnings；`compile()` 仅因 errors 失败
- **期望**: `ValidationResult.warnings` 含 `Empty rung: "..." (rung N) has no elements`；`valid` 仍为 true；Compile 成功（空网络编译为默认 Load+Halt 程序）
- **边界**: 空 rung 曾为 error（红色徽标 + 阻塞编译），用户创建空白 LD 即误报（99bb2b4 修复）
- **测试映射**: `src/__tests__/operation-handler.test.ts`（warns-not-errors），E2E T27/T29

### LD-RF-036: 空 rung 警告高亮仅对选中 rung 显示

多个空 rung 时，黄色警告高亮（`ld-rung-group--warning` + ⚠ 徽标）仅渲染在当前选中的 rung 上，未选中的空 rung 不显示黄色边框（tooltip 保留提示）。

- **前置条件**: 3 个空 rung，无选中
- **操作**: `LdCanvas` 只注入 `warningCount/warningTitle` data（不加 className）；`RungGroupNode` 内 `hasWarnings = warningCount > 0 && !hasErrors && selected`
- **期望**: 无选中时 `.ld-rung-group--warning` 计数 = 0；点击 rung 后计数 = 1（仅该 rung）
- **边界**: 曾无条件高亮全部空 rung（视觉噪声）；error 高亮不受 selected 限制（始终显示）
- **测试映射**: E2E T27

### LD-RF-037: 触点放置类型不依赖 DOM 顺序

E2E 断言触点类型必须按 stroke 值匹配（`nc-fill`），禁止按 `nth()` DOM 顺序（React Flow 按位置排序渲染子节点，新节点可能排在 fixture 节点前）。

- **前置条件**: fixture 含 1 个 NO 触点 + 放置 1 个 NC 触点
- **操作**: 通过 stroke 属性值定位 NC 触点
- **期望**: 存在 stroke 含 `nc-fill` 的触点；`nth(1)` 可能是 c1（NO）——不得作为定位依据
- **边界**: 6533dbc（容器 800→644）后触点 x=0 排最前，暴露了 nth 断言脆弱性
- **测试映射**: E2E T12
