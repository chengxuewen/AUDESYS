# AUDESYS HMI Designer Theia SDD 规范

> **来源**: `theia-extensions/audesys-hmi-designer/` + `packages/studio-core/widgets/` + `docs/modules/runtime/panel-architecture-design.md`
#RM|> **总项数**: 38 (Widget 库 7 + 画布布局 5 + 属性编辑 4 + 信号绑定 5 + 预览模式 2 + 部署集成 4 + Theia 集成 2 + LD→Runtime 垂直切片 5 + 变量→信号映射 4)
> **Phase**: P1 = 23 项, P2 = 2 项
> **当前状态**: 基础实现完成 (7 widgets, react-rnd 画布, 属性面板, 信号注入器), 0 测试于 theia-extension

---

## 1. HMI-WGT — Widget 库 (7 项)

> **组件**: `theia-extensions/audesys-hmi-designer/src/browser/widgets/*.tsx` (re-export from `@audesys/studio-core`)
> **共享 props**: `SharedWidgetProps { label, config, width, height, signalValue, isSelected, isPreview, error, onDismissError }`

### HMI-WGT-001: GaugeWidget — 圆形仪表盘

圆形仪表盘，显示数值范围 [min, max]，可视化指针指示当前值，支持阈值颜色带。

- **前置条件**: widget type="gauge" 已创建，`signalValue` 绑定到有效的数值信号
- **操作**: 信号值更新为 `42`，config = `{ min: 0, max: 100, unit: "°C" }`
- **期望**: 指针指向 42% 位置，数值 "42 °C" 居中显示，指针颜色随值变化（低=蓝/中=绿/高=红）
- **边界**: signalValue 超出 [min, max] — 指针锚定至边界，数值显示保持实际值；signalValue 为 null — 显示 "—"；负 min 值合法
- **测试**: vitest — 渲染 GaugeWidget with signalValue=42, 检查 DOM 包含 "42"

### HMI-WGT-002: TrendWidget — 时间序列折线图

实时折线图，滚动时间窗口内显示信号历史值。

- **前置条件**: widget type="trend" 已创建，`signalValue` 更新频率 ≥ 500ms
- **操作**: 信号值连续更新 60 次（模拟 30s 历史数据），config = `{ history: 60, color: "#FFB800" }`
- **期望**: 显示折线图，x 轴为时间（最新 60 个采样点），y 轴为信号值，线条颜色为 #FFB800
- **边界**: 采样点数 < history — 已收集部分正常渲染；信号值突发 null（断连） — 线条中断跳空；history=0 视为 1（至少 1 点）
- **测试**: vitest — 渲染 TrendWidget with 10 sample points, 检查 svg path 包含 10 个数据点

### HMI-WGT-003: TankWidget — 液位填充图

垂直液位罐可视化，填充高度正比于信号值相对 [min, max] 范围。

- **前置条件**: widget type="tank" 已创建，`signalValue` 绑定到 F64 信号
- **操作**: signalValue=70, config = `{ min: 0, max: 100, unit: "%" }`
- **期望**: 填充高度 70%，填充颜色为渐变色，数值 "70%" 标注于罐体旁
- **边界**: signalValue 超出 max — 填充 100% + 溢出指示（顶部红色警告线）；signalValue=null — 空罐灰色 + 标签显示 "—"; min/max 未配置 — 使用默认 min=0 max=100
- **测试**: vitest — 渲染 TankWidget with signalValue=70, 检查 fill height 为容器 70%

### HMI-WGT-004: IndicatorWidget — 布尔状态指示灯

圆形指示灯，布尔值 true=亮绿色, false=暗红色。

- **前置条件**: widget type="indicator" 已创建，`signalValue` 绑定到 BOOL 信号
- **操作**: signalValue=true, config = `{ onColor: "#00D26A", offColor: "#FF4444" }`
- **期望**: 圆形指示器填充 onColor (#00D26A)，带发光效果（box-shadow glow）
- **操作**: signalValue=false
- **期望**: 圆形指示器填充 offColor (#FF4444)，无发光效果
- **边界**: signalValue=null — 灰色闪烁（未知状态）；signalValue="true" 字符串 — 视为 true
- **测试**: vitest — 渲染 IndicatorWidget with signalValue=true/false/null, 检查 circle fill 颜色

### HMI-WGT-005: ButtonWidget — 命令按钮

可点击按钮，发送布尔信号写入。toggle 模式保持按下状态，momentary 模式释放后复位。

- **前置条件**: widget type="button" 已创建，`signal` 绑定到可写信号
- **操作**: Preview 模式下点击按钮，config = `{ onColor: "#00D26A", offColor: "#2a2a30" }`
- **期望**: 按钮高亮显示 onColor, 调用 writeSignal 发送 Bool(true)
- **操作**: 再次点击
- **期望**: 按钮恢复 offColor, 调用 writeSignal 发送 Bool(false)
- **边界**: Edit 模式下点击 — 选中 widget，不触发信号写入；isPreview=false — 按钮显示但无写操作；信号未绑定 — 按钮仅显示 label 文本，不可点击
- **测试**: vitest — 渲染 ButtonWidget, 模拟 click, 检查 onSignalWrite 回调调用

### HMI-WGT-006: TextWidget — 动态文本标签

显示绑定信号的字符串值或静态文本。

- **前置条件**: widget type="text" 已创建，`signalValue` 绑定到 String 信号或使用静态文本
- **操作**: signalValue="Running", config = `{ fontSize: 14, color: "#e8e8ed" }`
- **期望**: 文本 "Running" 以 14px 字体、#e8e8ed 颜色渲染
- **操作**: signalValue 为数值 42
- **期望**: 文本显示为字符串 "42"
- **边界**: signalValue 为空字符串 — 显示空行；fontSize < 1 — 使用默认 14；无 signalValue 且无 signal 绑定 — 显示 label 文本作为静态文本
- **测试**: vitest — 渲染 TextWidget with signalValue="Running", 检查 textContent

### HMI-WGT-007: DisplayWidget — 数值读显

带单位的数值显示器，适合紧凑显示关键测量值。

- **前置条件**: widget type="display" 已创建，`signalValue` 绑定到数值信号
- **操作**: signalValue=123.45, config = `{ unit: "rpm" }`
- **期望**: 显示 "123.45 rpm"，数值大字体居中，单位小字体右侧
- **边界**: signalValue 为 null — "— rpm"；unit 为空字符串 — 仅显示数值 "123.45"；数值超大（> 1e9） — 使用科学计数法 "1.23e9"
- **测试**: vitest — 渲染 DisplayWidget with signalValue=123.45 unit="rpm", 检查 textContent 含 "123.45 rpm"

---

## 2. HMI-CVS — 画布与布局 (5 项)

> **组件**: `HmiCanvas.tsx` (react-rnd) + `HmiCanvasWidget.ts` (Lumino Widget)
> **冲突解决方案**: C1-C7 per `docs/plans/t3p5-lumino-conflict-resolution.md`

### HMI-CVS-001: 画布 Widget 拖拽

Edit 模式下，单击选中 widget 后可拖拽移动位置。Preview 模式下禁止拖拽。

- **前置条件**: Edit 模式，widget 已添加到画布
- **操作**: 鼠标按下 widget，拖拽 100px 向右，释放
- **期望**: widget 位置从 `(x=100, y=100)` 更新为 `(x=200, y=100)`，onUpdateWidget 调用含新 position
- **操作**: 切换至 Preview 模式，尝试拖拽
- **期望**: 鼠标事件穿透到 Preview 控件（按钮可点、滚轮可滚动），widget 不移动
- **边界**: 拖拽至画布外 — 限制在 `bounds="parent"` 内（react-rnd 强制约束）；负坐标拖拽 — bounds 阻止；键盘 Delete 按下时正在拖拽 — 拖拽优先，不触发删除
- **测试**: Playwright — 拖拽 widget from (100,100) to (200,100), 检查 widget position 属性

### HMI-CVS-002: 画布 Widget 缩放

Edit 模式下，选中 widget 后拖拽角 handle (resize handle) 可缩放尺寸。最小 80×40。

- **前置条件**: Edit 模式，widget 尺寸 200×160
- **操作**: 拖拽右下角 resize handle 向右 50px，向下 30px，释放
- **期望**: widget 尺寸更新为 250×190，onUpdateWidget 调用含新 size + position（若 resize 改变了 origin 方向）
- **边界**: 缩放到 < minWidth=80 — 锁定在 80；缩放到 < minHeight=40 — 锁定在 40；resize 左上角方向 — position 和 size 同时更新
- **测试**: Playwright — resize widget from 200×160 to 250×190 via bottom-right handle

### HMI-CVS-003: Widget 选中与多选视觉反馈

单击 widget 选中（金色边框 #FFB800 2px），点击画布空白区取消选中。Delete/Backspace 删除选中 widget。

- **前置条件**: 画布上有 widget "gauge-1" 和 "tank-1"
- **操作**: 点击 "gauge-1"
- **期望**: selectedWidgetId="gauge-1", "gauge-1" 边框变为 `2px solid #FFB800`, PropertyPanel 显示 "gauge-1" 属性
- **操作**: 点击画布空白区
- **期望**: selectedWidgetId=null, 所有 widget 恢复默认边框, PropertyPanel 显示 "Select a widget"
- **操作**: 选中 "gauge-1", 按下 Delete 键
- **期望**: "gauge-1" 从画布移除, confirm 对话框弹出 "Remove this widget?"
- **边界**: 两个 widget 重叠区域点击 — 选中 z 轴最上层 widget（DOM 事件冒泡）；选中后 resize 另一个 widget — 选中状态不变
- **测试**: Playwright — click widget, 检查 border color; click canvas blank, 检查 selected=null; press Delete, 检查 widget removed

### HMI-CVS-004: Widget 碰撞追加偏移

从 WidgetPalette 添加新 widget 时，position 自动递增偏移避免重叠。

- **前置条件**: 画布上已有 3 个 widget
- **操作**: 从 palette 点击 "Gauge" 添加第 4 个 widget
- **期望**: widget position 为 `(160, 160)` — 即 `(100+3*20, 100+3*20)`
- **操作**: 空画布添加第一个 widget
- **期望**: position 为 `(100, 100)`
- **边界**: 偏移累计 > 画布尺寸 — widget 创建仍成功，手动拖拽调整即可
- **测试**: vitest — addWidget 5 次, 检查 position.x/y 递增

### HMI-CVS-005: Lumino 冲突解决 C1/C2/C4/C7

HmiCanvasWidget 实现 Lumino 冲突解决方案：C1 坐标原点、C2 拖拽事件捕获、C4 滚轮拦截、C7 防抖 resize。

- **前置条件**: HmiCanvasWidget 挂载到 Theia Dock Panel
- **操作 (C1)**: render widget at position (500, 300)
- **期望**: widget 渲染在画布内部坐标 (500, 300)，不受 Lumino tab bar 偏移影响
- **操作 (C2)**: 拖拽 react-rnd handle，同时 Theia 尝试 tab drag
- **期望**: react-rnd 处理拖拽，Theia tab 不倒流；capture 阶段 stopPropagation 阻止 Lumino
- **操作 (C4)**: Edit 模式下画布内滚轮滚动
- **期望**: 滚轮事件被 preventDefault，不触发 Theia scroll container 的滚动
- **操作 (C7)**: 调整 Theia Dock 面板尺寸
- **期望**: canvasResize 回调触发（16ms rAF 防抖），1px 阈值过滤浮点振荡
- **边界**: Preview 模式下滚轮 — 正常放行（trend widget pan/zoom）
- **测试**: Playwright — 拖拽 widget, 检查 Theia tab 无变化; 滚轮, 检查 canvas 未滚动

---

## 3. HMI-PRO — 属性编辑面板 (4 项)

> **组件**: `property-panel.tsx`
> **面板**: 280px 侧栏, 深色主题 #141416

### HMI-PRO-001: 通用属性编辑 (Position/Size/Label)

PropertyPanel 提供 Position(X,Y)、Size(W,H)、Label 统编入口。

- **前置条件**: 选中 widget "gauge-1", 当前 position=(100, 200), size=(200, 160), label="Pressure"
- **操作**: property panel 中修改 X=300, W=250
- **期望**: onUpdateWidget 调用 `{ position: {x:300, y:200}, size: {width:250, height:160} }`, canvas 实时重绘
- **操作**: 修改 Label="Boiler Pressure"
- **期望**: label 更新为 "Boiler Pressure"，canvas 和 YAML export 反映新值
- **边界**: 输入负值 → 接受（保存后 validateLayout 拦截）；输入 NaN → 转为 0；Label 空字符串合法（无文本 widget）
- **测试**: vitest — renderHook useHmiLayout.updateWidget, 检查 patch 应用

### HMI-PRO-002: 类型专属 Config 编辑

每种 widget 类型展示对应的 config 字段：Gauge(min/max/unit), Button(onColor/offColor), Text(fontSize/color), Indicator(onColor/offColor), Trend(history/color), Tank(min/max/unit), Display(unit)。

- **前置条件**: 选中 gauge widget
- **操作**: 修改 min=0, max=200, unit="kPa"
- **期望**: `widget.config = { min: 0, max: 200, unit: "kPa" }`, 仪表盘重绘为 0-200kPa 范围
- **操作**: 选中 text widget, 修改 fontSize=24, color="#FF0000"
- **期望**: `widget.config = { fontSize: 24, color: "#FF0000" }`, 文本变为红色 24px
- **边界**: 未配置 config 字段 → 使用默认值（不写入空值）；type 修改 config 后切换到不同 type widget — 面板字段重新加载，无残留值
- **测试**: vitest — updateWidget config for gauge, 检查 config.min/config.max

### HMI-PRO-003: 数值输入与颜色选择器

Position/Size 使用 number input，颜色配置使用 `<input type="color">`。

- **前置条件**: 选中 widget
- **操作**: NumInput 输入 "50.5" 给 X 坐标
- **期望**: onChange 收到 `50`（Math.round）; 显示 "50"
- **操作**: ColorInput 选择 #FFB800
- **期望**: widget config.onColor = "#FFB800"
- **边界**: NumInput 清空后失焦 → 恢复为 0（Number(e.target.value) || 0）
- **测试**: vitest — fire change event on NumInput with "123", 检查 onChange called with 123

### HMI-PRO-004: Widget 删除确认

属性面板底部 "Remove Widget" 按钮含 confirm 对话框。

- **前置条件**: 选中 widget "gauge-1"
- **操作**: 点击 "Remove Widget" 按钮
- **期望**: 浏览器 `confirm("Remove this widget?")` 弹出
- **操作**: 用户确认
- **期望**: onRemoveWidget("gauge-1") 调用, widget 从画布消失, selectedWidgetId=null
- **操作**: 用户取消
- **期望**: widget 保留
- **边界**: 未选中 widget — Remove 按钮不渲染
- **测试**: Playwright — click remove, handle dialog accept, 检查 widget removed

---

## 4. HMI-SGN — 信号绑定 (3 项)

> **组件**: `property-panel.tsx` (signal binding section) + `signal-injector.tsx`

### HMI-SGN-001: 信号名绑定与解绑

PropertyPanel 提供 Signal 绑定入口：显示当前绑定信号名，点击 "Bind" 展开输入框，输入信号名（如 "axis.0.pos"），按 Enter 或点 OK 确认；点击 × 解绑。

- **前置条件**: 选中 widget，当前 signal 未绑定
- **操作**: 点击 "Bind" → 输入 "axis.0.pos" → 点 OK
- **期望**: signal 更新为 "axis.0.pos"（通过 onUpdateWidget），输入框自动折叠，显示信号名
- **操作**: 点击 × 解绑按钮
- **期望**: signal 设为 undefined，输入框显示 "(none)"
- **边界**: 输入空字符串 → OK 不触发更新（保持原绑定状态）；空格字符 → 与空字符串一致处理；信号名含非法字符（如空格的 "axis. 0.pos"）→ 接受（validateLayout 在 save 时警告）
- **测试**: Playwright — bind signal to gauge, check property panel shows signal name; click ×, check "(none)"

### HMI-SGN-002: SignalInjector — Preview 模式信号注入

Preview 模式下右侧面板切换为 SignalInjector，列出所有绑定信号的 widget，可手动输入模拟值并发送 setSignal 命令。

- **前置条件**: Preview 模式，画布上有 2 个信号绑定 widget (signal="axis.0.pos", signal="tank.level")
- **操作**: SignalInjector 面板显示两个 widget 行，在 "axis.0.pos" 输入框输入 "42"，点 Set
- **期望**: 调用 `window.__audesysSim.setSignal("axis.0.pos", "F64(42)")`（或 "Bool(true)" 布尔值），反馈显示绿色 "ok"
- **操作**: 输入 "invalid" → 点 Set
- **期望**: 调用 setSignal("axis.0.pos", "invalid") — SimHarness 返回错误，反馈显示红色错误文本
- **边界**: 无信号绑定 widget — 显示 "No signal-bound widgets." 提示；SimHarness 未加载 (`window.__audesysSim` 不存在) — setSignal 静默无操作
- **测试**: Playwright — switch to Preview, inject signal value "42", check widget renders updated value

### HMI-SGN-003: useTheiaHmiSignal — 信号读取钩子

Theia 环境下的信号读取钩子：优先通过 napi-rs bridge 读取 controller 信号，回退至 SimHarness 模拟。

- **前置条件**: widget 绑定 signal="axis.0.pos"
- **操作**: 组件挂载，启动 500ms 轮询 `readSignalNative("axis.0.pos")`
- **期望**: 返回信号当前值（F64/String/Bool），widget 组件重新渲染；读取间隔 500ms
- **操作**: signal 解绑或组件卸载
- **期望**: clearInterval 停止轮询
- **边界**: napi-rs 不可用且 SimHarness 未加载 — return null；信号名变更 — 旧 signal 的 timer 被清除，新 signal 立即启动；读取失败 — setError(errmsg)，WidgetErrorOverlay 显示
- **测试**: vitest — mock `window.__audesysSim.readSignal`, 检查 useTheiaHmiSignal 返回正确值

---

## 5. HMI-PRE — 预览模式 (2 项)

> **组件**: `hmi-designer-tool.tsx` (editMode state toggle)

### HMI-PRE-001: Edit ↔ Preview 模式切换

工具栏 "▶ Preview" / "✏ Edit" 按钮切换编辑/预览模式。Edit 模式下显示 Palette + PropertyPanel + 画布可拖拽；Preview 模式下隐藏 Palette，PropertyPanel 替换为 SignalInjector，画布禁止拖拽缩放。

- **前置条件**: Edit 模式，画布上有 3 个 widget
- **操作**: 点击 "▶ Preview" 按钮
- **期望**: editMode=false, WidgetPalette 不可见, PropertyPanel → SignalInjector, widget 的 Rnd disableDragging=true, enableResizing=false
- **操作**: 点击 "✏ Edit" 按钮
- **期望**: editMode=true, 恢复 Palette + PropertyPanel + 拖拽/缩放功能
- **边界**: Preview 模式下 Save/Load/Deploy 工具栏按钮仍可用；切换模式时不重置 selectedWidgetId
- **测试**: Playwright — toggle to Preview, 检查 Palette 不可见 + SignalInjector 可见 + Rnd 不可拖拽

### HMI-PRE-002: Preview 模式下 Widget 交互

Preview 模式下 ButtonWidget 可点击触发信号写入，KeyDown 事件不触发 Delete（仅在 Edit 模式生效），SignalInjector 面板可设置模拟信号值。

- **前置条件**: Preview 模式，button widget 绑定 signal="pump.start"
- **操作**: 点击 button widget
- **期望**: 按钮状态切换，触发 signal write 调用
- **操作**: 按下 Delete 键
- **期望**: 不触发 widget 删除（delete 逻辑仅在 Edit 模式响应）
- **边界**: Preview 模式下点击 widget 不选中（不激活金色边框）
- **测试**: Playwright — in Preview mode, click button widget, check writeSignal called; press Delete, check widget count unchanged

---

## 6. HMI-DPL — Designer 部署集成 (2 项)

> **组件**: `hmi-designer-tool.tsx` (onDeploy callback)

### HMI-DPL-001: Designer 验证-导出-部署编排

点击 "⬆ Deploy" 按钮触发：validateBeforeSave → exportYaml → onDeploy(yaml) 三步流水线。验证失败阻止部署。

- **前置条件**: 画布上有 1 个 valid widget
- **操作**: 点击 "⬆ Deploy"
- **期望**: 1) validateBeforeSave 返回无 errors; 2) exportYaml 生成完整 YAML; 3) onDeploy 调用传入 YAML 字符串; 4) 错误栏显示 "✓ deployed"
- **操作**: 故意创建无效 layout（gauge min=100 max=0），点击部署
- **期望**: validateBeforeSave 返回 errors, 阻止部署, 错误栏显示具体错误列表
- **边界**: onDeploy 未提供 — Deploy 按钮不渲染；onDeploy 异步失败 — 错误栏显示 "Deploy failed: ..."；validateBeforeSave 仅 warning 无 errors — 允许部署继续
- **测试**: vitest — mock onDeploy, trigger handleDeploy, 检查 validateBeforeSave + exportYaml + onDeploy 调用链

### HMI-DPL-002: YAML 导出格式

exportYaml 输出为手工拼接的 YAML 字符串，含 version/name/canvas_size/widgets 列表，每个 widget 含 id/type/position/size/label/signal。

- **前置条件**: layout 包含 2 个 widget
- **操作**: 调用 `exportYaml()`
- **期望**: 返回多行字符串，每行无额外缩进，widget 列表以 `- id:` 开头，缺失 signal 字段时不输出 `signal:` 行
- **边界**: 空 layout → YAML 输出 widgets 段落为空；widget label 含特殊字符（如冒号 "A:B"）→ 裸字符串输出（不转义），后续升级 js-yaml
- **测试**: vitest — exportYaml on layout with 1 widget, 检查字符串内容含所有字段

---

## 7. HMI-THI — Theia 集成 (2 项)

> **组件**: `hmi-canvas-widget.ts` (Lumino Widget), `hmi-designer-frontend-module.ts` (DI bindings)

### HMI-THI-001: Theia DI 绑定与命令注册

audesys-hmi-designer 扩展通过 inversify ContainerModule 注册：HmiDesignerWidget 绑定为 `openHandler`，命令 `audesys-hmi:open-designer` 打开 HMI Designer 控件。

- **前置条件**: Theia 启动，audesys-hmi-designer 扩展已加载
- **操作**: 通过 Command Palette（Ctrl+Shift+P）执行 "audesys-hmi:open-designer"
- **期望**: Theia Dock Panel 新增 "HMI Designer" 标签页，渲染完整 HMI Designer (Toolbar + Palette + Canvas + PropertyPanel)
- **操作**: 关闭标签页
- **期望**: React root unmount, Lumino widget detach, event listeners 移除
- **边界**: 重复执行命令 — 聚焦已有 HMI Designer 标签（不创建新实例）；扩展依赖 `@theia/core` 不存在 — 加载失败，Theia 启动仍正常（扩展隔离）
- **测试**: Playwright — type "open-designer" in command palette, 检查 "HMI Designer" tab appears

### HMI-THI-002: Lumino Widget 生命周期

HmiCanvasWidget 实现 Lumino Widget 完整生命周期：onAfterAttach（挂载 React root + 注册事件监听）、onBeforeDetach（卸载 React root + 移除事件监听）、onResize（防抖 resize 回调）、updateProps（patch 属性重新渲染）。

- **前置条件**: HmiCanvasWidget 已挂载到 Theia Dock
- **操作**: 外部调用 `canvasWidget.updateProps({ editMode: false })`
- **期望**: React root 重新渲染，画布切换至 Preview 模式，widget 的 Rnd disableDragging=true
- **操作**: 拖拽 Theia Dock 面板 resize handle
- **期望**: onResize 触发（16ms rAF 防抖），仅幅度 > 1px 时回调 onCanvasResize
- **操作**: 关闭 "HMI Designer" 标签
- **期望**: onBeforeDetach 移除 mousedown/wheel listeners, reactRoot.unmount(), 无内存泄漏
- **边界**: 快速重复 resize — 每次取消前一个 rAF, 仅最后一次触发；组件未挂载时调用 updateProps — 仅更新内存 props, 不触发 re-render
- **测试**: vitest — 创建 HmiCanvasWidget, onAfterAttach, updateProps, 检查 reactRoot.render 调用次数

---

## 交叉引用

| 决策 | 规范项 |
|------|--------|
| D67 | HMI-SGN-002（sim_set_signal 复用 — SignalInjector） |
| D68 | HMI-DPL-001, HMI-DPL-002（0x17 DEPLOY_HMI_LAYOUT 上游 — Designer 导出） |
| D69 | HMI-DPL-002（YAML 持久化格式） |
| D71 | HMI-THI-001, HMI-THI-002（Theia 迁移） |

## Phase 边界

- **P1 实现**: 全部 23 项 (HMI-WGT-001~007, HMI-CVS-001~005, HMI-PRO-001~004, HMI-SGN-001~003, HMI-PRE-001~002, HMI-DPL-001~002, HMI-THI-001~002)
- **P2 实现**: HMI-WGT-008 CameraView（IP Cam/RTSP 视频流 widget）; HMI-CVS 重叠检测 (HMI-VAL-009 的 canvas 层实现)
- **P1 已知缺口**: useTheiaHmiSignal 的 napi-rs bridge 尚未实现（当前回退到 SimHarness）; exportYaml 使用手工拼接 YAML 未用 js-yaml; SignalInjector 依赖 `window.__audesysSim` 全局对象（非正式 API）

## 关联规范

- 布局验证: `openspec/specs/hmi-spec.md` §1 HMI-VAL (009 项)
- 部署管道: `openspec/specs/hmi-spec.md` §2 HMI-DPL (007 项)
- SignalBridge: `openspec/specs/hmi-spec.md` §3 HMI-SIG (006 项)
- Studio Theia 迁移: `openspec/specs/studio-theia-spec.md` (050 项)

---

## 8. HMI-VSL — LD→Runtime 垂直切片 (5 项)

> **范围**: LD 编译器 (`audesys-ld-compiler`) → HalProgram → Runtime Engine (`audesys-runtime`) → HMI Designer → Panel
> **端到端验证**: LD 源码编译后信号名自动映射至 Runtime 信号注册表，HMI 绑定后经 SignalBridge 推送至 Panel 渲染

### HMI-VSL-001: LD 源码编译 → HalProgram 信号生成

LD 梯形图编译为 HalProgram 后，所有 VAR 块变量自动成为 HalProgram 信号定义。每个信号包含名称、类型（Bool/Int/Real）、方向（Input/Output/Local）。

- **前置条件**: LD 源码包含 `VAR IN1 AT %IX0.0 : BOOL; OUT1 AT %QX0.0 : BOOL; temp : INT; END_VAR`
- **操作**: 调用 `ld_compile(source)` → 输出 `HalProgram`
- **期望**: `HalProgram.signals` 列表含 3 项：`{name:"IN1", type:Bool, dir:Input}`, `{name:"OUT1", type:Bool, dir:Output}`, `{name:"temp", type:S16, dir:Local}`
- **边界**: 无 VAR 块的 LD 程序 → signals 列表为空（合法，仅 I/O 触点不产生信号）；VAR 块中变量名含非 ASCII 字符 → 编译错误
- **测试**: `crates/audesys-ld-compiler/tests/` — `test_ld_compile_generates_signal_definitions`

### HMI-VSL-002: HalProgram 信号 → Runtime 信号注册表初始化

Runtime Engine 接收 HalProgram 后实例化信号注册表，每个信号以默认值初始化（Bool=false, Int=0, Real=0.0），方向决定读写权限。

- **前置条件**: HalProgram 含 5 个信号定义（`IN1:In`, `OUT1:Out`, `temp:Local`, `counter:InOut`, `status:Local`）
- **操作**: `engine.deploy_program(hal_program)` — Runtime 在周期边界实例化信号
- **期望**: `engine.signal_registry.snapshot()` 返回 5 个条目，全部初始化为默认值；`signal_registry.get("OUT1").writable == true`（Output 方向可写）
- **边界**: HalProgram 含重名信号 → deploy 返回 `Error::DuplicateSignalName`；信号注册表已有旧程序信号 → 旧信号全部移除，新信号替换（hot-swap D17）
- **测试**: `crates/audesys-runtime/src/engine.rs` — `test_signal_register_and_snapshot` (扩展)

### HMI-VSL-003: HMI 信号绑定 → Runtime 信号存在性校验

HMI Designer 在保存/部署前校验所有 widget 绑定的 signal 名称是否存在于 Runtime 信号注册表。缺失的信号产生警告，允许保存但阻止部署。

- **前置条件**: Runtime 运行中，信号注册表含 `["IN1", "OUT1", "temp"]`；HMI layout 中 widget 绑定 `signal="IN1"` 和 `signal="ghost_signal"`
- **操作**: Designer 调用 `validateLayout(layout, { signalNames: runtime_signals })`
- **期望**: `result.warnings` 含 `"widget 'indicator-1' bound to unknown signal 'ghost_signal'"`；`IN1` 校验通过无警告
- **操作**: 点击 Deploy 按钮 — 存在未知信号绑定时阻塞部署
- **期望**: Deploy 被 `validateBeforeSave` 的 `errors` 拦截，返回错误列表；仅 warnings 无 errors 时允许部署
- **边界**: signal 字段为 null/空字符串的 widget 跳过校验（无绑定=无错误）；Runtime 断连时校验降级为跳过（不阻塞保存）
- **测试**: vitest — `test_hmi_signal_validation_against_runtime_registry`

### HMI-VSL-004: LD 信号 → HMI Widget → Panel 显示 端到端

完整垂直链路：LD 程序部署到 Runtime → Runtime 执行并更新信号值 → HMI Designer 导出布局并部署到 Runtime → Panel 通过 SignalBridge 读取信号 → Panel widget 渲染更新。

- **前置条件**: (1) LD 程序已编译为 HalProgram 并部署到 Runtime, 含 `temp_sensor : INT`; (2) HMI Designer 导出布局，gauge widget 绑定 `signal="temp_sensor"`; (3) 布局已部署到 Runtime; (4) Panel 已连接 Runtime
- **操作**: Runtime `sim_step()` 将 `temp_sensor` 更新为 42
- **期望**: Panel SignalBridge 在下一轮询周期（≤500ms）读取到 `temp_sensor=42`，gauge widget 的 `signalValue` 更新为 42，指针指向 42% 位置
- **操作**: 再次 `sim_step()` 更新为 85
- **期望**: Panel gauge widget 同步更新至 85
- **边界**: Runtime 断连 → Panel gauge 显示最后一次已知值 + 错误覆盖层（"Connection lost"）；信号值类型不匹配（INT 信号→F64 gauge）→ gauge 接收 F64(42.0) 正常渲染（INT→F64 自动转换）
- **测试**: 集成测试 — `crates/audesys-runtime/tests/integration_e2e_test.rs` — `test_ld_to_hmi_to_panel_full_chain`

### HMI-VSL-005: LD 变量类型 → HMI Widget 类型兼容性检查

LD 变量类型必须与 HMI widget 类型兼容。类型不兼容产生警告（如 BOOL 绑定到 Gauge）、严重不兼容产生错误（如 String 绑定到 Tank）。

- **前置条件**: LD 变量 `is_running : BOOL`; HMI gauge widget 绑定 `signal="is_running"`; indicator widget 绑定同一信号
- **操作**: `validateLayout(layout, { signalTypes: {"is_running": "Bool"} })`
- **期望**: gauge 绑定产生 `result.warnings` 含 `"widget 'gauge-1' expects F64 signal but 'is_running' is BOOL"`; indicator 绑定无警告（BOOL→Indicator 兼容）
- **操作**: LD 变量 `sensor_name : STRING` 绑定到 tank widget
- **期望**: `result.errors` 含 `"widget 'tank-2' cannot bind to STRING signal 'sensor_name'"`
- **边界**: 未知类型的 widget → 绑定始终允许（警告 "unknown widget type compatibility for 'custom_widget'"）；P1 仅实现 BOOL/数字/String 三族类型检查，复杂类型（Array/Blob）P2
- **测试**: vitest — `test_hmi_widget_signal_type_compatibility`

---

## 9. HMI-MAP — LD 变量名 → Runtime 信号名映射 (4 项)

> **原则**: LD 源码中的变量名是 HMI 信号绑定的唯一标识符。映射规则须确定性、可逆、可追溯。
> **参考**: D55 (CNC G-code→HAL IR 编译器 — 同构模式：G-code 变量→HalProgram 信号)

### HMI-MAP-001: LD 直接变量名 → Runtime 信号名 1:1 映射

LD `VAR` 块中声明的变量名直接作为 Runtime 信号名注册（除去 I/O 地址映射变量）。映射在编译阶段完成，HalProgram 保存映射表。

- **前置条件**: LD 源码 `VAR speed : INT := 100; END_VAR`
- **操作**: `ld_compile(source)` 编译, 检查输出的 HalProgram
- **期望**: `HalProgram.signal_name_map["speed"] = {type: S16, default: 100, direction: Local}`
- **操作**: Runtime Engine 加载 HalProgram 后 `signal_registry.get("speed")`
- **期望**: 返回 `SignalValue::S16(100)` — 名称和默认值均来自 LD 变量声明
- **边界**: LD 变量名与 HAL 引脚名冲突 → 编译错误（"variable 'speed' conflicts with HAL pin name"）；LD 变量名大小写 → 保持原样（"Speed" ≠ "speed"，区分大小写）
- **测试**: `crates/audesys-ld-compiler/tests/` — `test_ld_variable_to_signal_name_mapping`

### HMI-MAP-002: LD I/O 地址 → 标准化 HAL 信号名

LD 的 `AT %IX0.0` / `AT %QX0.0` 地址映射通过 HAL 配置文件转换为点分隔的标准化信号名（`component.interface.pin` 格式），非直接使用 `%IX0.0` 原始地址。

- **前置条件**: LD 源码 `VAR button AT %IX1.2 : BOOL; END_VAR`; HAL 配置 `IO: {IX1.2: "gpio.input_panel.button_start"}`
- **操作**: 编译时 `ld_compile(source, hal_config)` 合并 HAL 映射
- **期望**: HalProgram 中信号名为 `"gpio.input_panel.button_start"`（非 `"button"` 也非 `"IX1.2"`）；HMI Designer 的 Bind 对话框下拉列表中显示 `"gpio.input_panel.button_start"`
- **操作**: HAL 配置未映射 `%IX1.2`
- **期望**: 编译错误 `"I/O address %IX1.2 has no HAL binding"` — 所有 I/O 地址必须显式映射
- **边界**: 同一 HAL 引脚被两个 LD 变量映射 → 编译错误；HAL 配置变更后需重新编译 LD 程序，否则信号名不匹配
- **测试**: `crates/audesys-hal-binding-gen/tests/` — `test_io_address_to_hal_signal_name_mapping`

### HMI-MAP-003: HMI Designer 信号名自动发现 (Autocomplete)

HMI Designer 的 Bind 对话框通过 Runtime `snapshot()` IPC 获取当前信号注册表的完整列表，提供自动补全下拉。用户无需记忆精确信号名。

- **前置条件**: Runtime 运行中，信号注册表含 `["axis.0.pos", "tank.level", "pump.start", "pump.speed"]`; HMI Designer 连接 Runtime
- **操作**: 选中 widget，点击 "Bind" 按钮 → 输入框聚焦
- **期望**: 输入框下方显示下拉列表，列出全部 4 个信号名；用户输入 "pump" → 列表过滤为 `["pump.start", "pump.speed"]`; 选择一项后 signal 绑定更新
- **操作**: Runtime 断连时打开 Bind 对话框
- **期望**: 下拉列表为空，显示提示 "Connect to Runtime to discover signals"，仍可手动输入信号名
- **边界**: Runtime 有 200+ 信号 → 列表虚拟滚动（仅渲染可见项），键盘导航支持（↑↓ 移动、Enter 确认、Esc 关闭）；信号注册表更新（hot-swap 后）→ Bind 对话框下次打开时刷新
- **测试**: Playwright — `test_hmi_signal_autocomplete_from_runtime`

### HMI-MAP-004: LD 变量重命名 → HMI 绑定级联更新

LD 源码中变量重命名后，编译器检测到变更并标记旧名→新名映射。HMI Designer 在加载布局时检测 stale 绑定并提示用户批量更新。

- **前置条件**: LD 程序 v1 含 `temp_old : INT`，HMI 有 2 个 widget 绑定 `signal="temp_old"`; LD 程序 v2 变量重命名为 `temp_new`
- **操作**: LD v2 编译，HalProgram 产生 `rename_map = [{"temp_old": "temp_new"}]`; HMI Designer 打开布局时查询 Runtime 当前信号名列表
- **期望**: Designer 检测到 2 个 widget 绑定 `"temp_old"` 不在当前信号注册表中，在 PropertyPanel 显示 ⚠ 图标 + 提示 `"Signal 'temp_old' was renamed to 'temp_new'"`
- **操作**: 用户点击提示 → 选择 "Apply rename"
- **期望**: 2 个 widget 的 signal 全部更新为 `"temp_new"`，⚠ 图标消失
- **边界**: 变量被删除（非重命名）→ 显示 ⚠ 但无 rename_map 项，用户手动重新绑定；多个旧变量都重名到同一个新变量 → 拒绝（"duplicate rename target"）
- **测试**: 集成测试 — `test_ld_rename_propagates_to_hmi_bindings` (vitest + Rust: 编译→布局校验 端到端)

---

## 4-ext. HMI-SGN — 信号绑定扩展 (Panel 桥接, 2 项)

> **扩展**: 本节补充 Panel 端信号桥接场景。基础信号绑定见 §4 HMI-SGN-001~003。

### HMI-SGN-004: Panel SignalBridge — Widget 值更新循环

Panel 通过 SignalBridge 的 poll 模式（或 push 模式）周期性读取绑定的信号值，并更新所有 widget 渲染。更新循环由 Transport 层驱动。

- **前置条件**: Panel 已连接 Runtime (UdsTransport)，SignalBridge 订阅 `["temp_sensor", "pump_running", "tank.level"]`
- **操作**: SignalBridge poll cycle 触发（100ms 间隔）, 调用 `transport.snapshot()`
- **期望**: 返回 `{"temp_sensor": F64(42.5), "pump_running": Bool(true), "tank.level": F64(78.0)}`; SignalBridge 逐个匹配 widget，将值注入 widget 组件 props
- **期望**: display widget (temp_sensor) 更新为 "42.5 °C"; indicator widget (pump_running) 变为绿色; tank widget (tank.level) 填充 78%
- **操作**: 用户通过 Studio 的 SignalInjector 将 `tank.level` 改为 90.0
- **期望**: Panel 下一轮询周期读取到 90.0, tank widget 填充更新为 90%
- **边界**: 单次 poll 超时（> 2s）→ 保留上次值，widget 显示 ⚠ stale indicator; 订阅中某个信号不存在 → snapshot 返回 null 对该信号，widget 显示 "N/A"
- **测试**: vitest — `test_signalbridge_widget_update_cycle` (mock Transport, 模拟 snapshot 返回)

### HMI-SGN-005: Panel Button Widget → Runtime 信号写入

Panel 中 button widget 的点击事件通过 SignalBridge.writeSignal() 写入 Runtime。写入受 RBAC 限制（仅 button 绑定的信号），写入成功/失败有视觉反馈。

- **前置条件**: Panel 以 Role::HMI 连接 Runtime; button widget 绑定 `signal="emergency_stop"`, config `{ mode: "toggle" }`; Runtime 中 `emergency_stop` 当前值为 false
- **操作**: 操作员点击 Panel 中的 emergency_stop 按钮
- **期望**: `signalBridge.writeSignal("emergency_stop", Bool(true))` 调用；Runtime 接收后在 Config Barrier 边界应用（D17）；下周期 LD 程序读取到 `emergency_stop=true` 并执行停止逻辑
- **操作**: Runtime 返回写入成功 ACK
- **期望**: button widget 切换为按下状态（onColor 高亮），tooltip 显示 "Command sent"（2s 后消失）
- **操作**: 写入权限不足（非 button 信号）, 返回 Forbidden
- **期望**: button widget 保持之前状态，tooltip 显示红色 "Write denied"（3s 后消失），console.error 记录详情
- **边界**: Runtime 断连时点击 → button 保持状态，错误覆盖层显示 "Cannot connect to Runtime"; 连续快速点击（debounce）→ 300ms 内仅发送最后一次点击的值
- **测试**: Playwright — `test_panel_button_writes_signal_to_runtime` (mock Transport 响应)

---

## 6-ext. HMI-DPL — 部署集成扩展 (Panel 管道, 2 项)

> **扩展**: 本节补充 Panel 端部署管道路径。基础部署集成见 §6 HMI-DPL-001~002。

### HMI-DPL-003: Designer→Runtime→Panel 全链路部署

HMI Designer 的 Deploy 按钮触发完整五步流水线，从验证到 Panel 重新加载。每步独立可失败，失败时后续步骤中断。

- **前置条件**: Designer 中有 3 个 widget 的有效布局, Runtime 运行中, Panel 已连接
- **操作**: 点击 "⬆ Deploy" 按钮
- **期望**: 流水线执行: (1) `validateBeforeSave` → 返回无 errors; (2) `exportYaml` → 生成 YAML 字符串; (3) `controllerClient.deploy_hmi_layout(yaml)` → IPC 0x17 发送; (4) Runtime Config Barrier → 下周期边界应用; (5) Runtime 发送 `DEPLOY_ACK(generation=N+1)` → Panel 接收 → `signalBridge.onLayoutChange(N+1)` → Panel 重新加载布局渲染
- **期望**: Designer 错误栏显示 "✓ Deployed (gen 5)"
- **操作**: (3) 网络故障, `deploy_hmi_layout` 抛出
- **期望**: (4)(5) 不执行; Designer 错误栏显示 "Deploy failed: network timeout"; 旧布局和 generation 不受影响
- **边界**: (2) exportYaml 产物 > 1MB → (3) 拒绝发送（Controller `Error::PayloadTooLarge`）; (5) Panel 断开但重新连接后 → Panel 启动时查询当前 generation，自动加载最新布局
- **测试**: 集成测试 — `test_designer_deploy_full_pipeline_to_panel` (vitest mock + Rust Runtime)

### HMI-DPL-004: Panel 冷启动加载持久化布局

Panel 首次启动或重新连接时，通过 SignalBridge 自动从 Runtime 加载上次持久化的布局（HMI-DPL-007）。无历史布局时显示空面板。

- **前置条件**: Runtime 的 `{project}/hmi/layout.yaml` 存有 1 个 gauge widget 的布局; Panel 刚启动，SignalBridge 调用 `connect()`
- **操作**: `connect()` 成功后 Panel 发送 `get_current_layout()` 请求
- **期望**: Runtime 返回 `{ generation: 3, layout_yaml: "..." }`; Panel 解析 YAML → 渲染 gauge widget, SignalBridge 订阅 gauge 绑定的信号
- **操作**: Runtime 无持久化布局（首次部署前）
- **期望**: `get_current_layout()` 返回 `{ generation: 0, layout_yaml: null }`; Panel 显示空画布 + 提示 "No HMI layout deployed. Use Studio to design and deploy."
- **边界**: YAML 解析失败 → Panel 显示错误 "Layout corrupted, contact engineer" + 尝试加载上一次成功缓存的布局（localStorage 兜底）; 布局中引用的信号在 Runtime 中不存在 → Panel 渲染 widget 但显示 "N/A"
- **测试**: 集成测试 — `test_panel_cold_start_loads_persisted_layout` (mock Transport + tempfile layout.yaml)
