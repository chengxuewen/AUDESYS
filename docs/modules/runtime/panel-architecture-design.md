# AUDESYS Runtime Panel 架构设计

**生成日期**: 2026-07-19
**修订日期**: 2026-07-21

*> ℹ️ Studio 迁移通知：AUDESYS Studio 已从 Tauri+React 迁移到 Eclipse Theia（详见 docs/superpowers/specs/2026-07-21-studio-theia-migration-design.md）。Runtime Panel 不受影响——仍基于 Tauri 独立运行，通过 packages/studio-core/ 共享 Widget 组件。*

**依赖决策**: D58 (Studio PluginRegistry, 已弃用), D59 (PlatformAdapter PC/Web 双模式), D17 (Config Barrier)
**参考**: `docs/modules/studio/plugin-architecture-design.md`（已弃用）、`docs/modules/runtime/ipc-security-design.md`
**设计目标**: Runtime Panel 作为独立操作员进程运行 HMI 布局，区别于 Studio 设计器

---

## 0. 定位概述

```
┌─────────────────────────────────────┐      ┌─────────────────────────────┐
│           Studio IDE                 │      │       Runtime Panel          │
│   (开发者工具 — 离线设计)              │      │   (操作员工具 — 在线监控)       │
│                                     │      │                             │
│  · HMI Designer → 产出 HmiLayout    │──────│→ 加载 HmiLayout (readonly)   │
│  · IEC 编译器/调试器                  │      │  · 实时信号桥 (订阅/轮询)       │
│  · 项目管理/部署                      │      │  · 操作员登录/权限             │
│  · 协议适配器配置                      │      │  · 报警管理/趋势记录            │
│                                     │      │  · 多画面导航                  │
└─────────────────────────────────────┘      └─────────────────────────────┘
          │        共享层                          │         连接层
          ├── widgets/ (React 组件)                ├── UDS (本地 Controller)
          ├── types/hmi.ts (HmiLayout)             ├── WebSocket (远程 Controller)
          └── YAML 解析器                           └── SimulationHarness (仿真)
```

**核心原则**：
- **设计器写，面板读** — Panel 不修改 HmiLayout，信号绑定在设计阶段完成
- **共享组件，隔离桥接** — Widget 渲染复用 Studio，信号桥（SignalBridge）是 Panel 独有
- **独立进程** — Panel 作为 Tauri 应用或 Web PWA 独立部署，不嵌入 Studio 窗口

---

## 1. 五层架构

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                          AUDESYS Runtime Panel Shell                          │
│                                                                               │
│  ┌───────────────────────────┐    ┌───────────────────────────────────────┐  │
│  │     Plugin System          │    │        Navigation Manager             │  │
│  │  · OperatorLogin           │    │  · SceneRegistry (Screen[])           │  │
│  │  · AlarmManager            │    │  · Screen stack (push/pop)            │  │
│  │  · TrendRecorder           │    │  · Navigation guard (login required)  │  │
│  │  · MultiScreenNav          │    │  · Parameter passing (screen args)    │  │
│  └─────────────┬─────────────┘    └──────────────────┬────────────────────┘  │
│                │                                     │                        │
│  ┌─────────────▼─────────────────────────────────────▼────────────────────┐  │
│  │                   Widget Renderer (via PanelRenderer)                      │  │
│  │  · import from packages/studio-core/widgets/  (7 widgets)                 │  │
│  │  · WidgetProps: { signalValue, ...rest } — widget 不感知信号来源          │  │
│  │  · 纯函数组件，零 Tauri 依赖，两端共享同一代码                              │  │
│  │  · Panel 覆盖层: AlarmBanner, LoginOverlay, NavigationBar                │  │
│  └─────────────────────────────┬──────────────────────────────────────────┘  │
│                                │                                              │
│  │                       Signal Bridge (SignalProvider)                       │  │
│  │  · LocalSignalProvider  (UDS, 10ms polling, < 20ms 延迟)                  │  │
│  │  · WsSignalProvider     (WebSocket push, LAN < 25ms)                     │  │
│  │  · SimSignalProvider    (SimulationHarness, 进程内)                       │  │
│  │  · subscribe / unsubscribe / write / snapshot / onUpdate                  │  │
│  └─────────────────────────────┬──────────────────────────────────────────┘  │
│                                │                                              │
│  ┌─────────────────────────────▼──────────────────────────────────────────┐  │
│  │                          Transport                                       │  │
│  │  · ControllerClient (UDS) — LocalSignalProvider 封装                      │  │
│  │  · WebSocket Client      — WsSignalProvider 封装                          │  │
│  │  · SimulationHarness      — SimSignalProvider 封装                        │  │
│  └─────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

| 层 | 职责 | 依赖 | 与 Studio 关系 |
|---|------|------|:---:|
| **Panel Shell** | 启动流程、全屏模式、Operational Mode 锁定、紧急停止按钮 | PlatformAdapter | **Panel 独有** |
| **Plugin System** | 操作员登录、报警管理、趋势记录、多画面导航 — 四大内置插件 | SignalBridge, NavigationManager | **Panel 独有**（参考 Studio PluginRegistry 接口，但不共享实例） |
| **Widget Renderer** | PanelRenderer 加载 HmiLayout YAML，遍历 widgets[]，以 `{ signalValue }` 注入渲染 7 种 widget | packages/studio-core/ (组件), SignalProvider (信号值) | **共享组件** — widget 代码来自 packages/studio-core，零修改复用 |
| **SignalProvider** | subscribe / unsubscribe / write / snapshot / onUpdate — 信号值的获取与更新 | ControllerClient (UDS) / WebSocket / SimulationHarness | **Panel 独有** — Studio 通过 Theia Backend Service (napi-rs) 获取信号值 |
| **Transport** | ControllerClient (UDS) / WebSocket Client / SimulationHarness — 被 SignalProvider 内部封装 | SignalProvider 各实现内部持有 | **非独立层** — 由 LocalSignalProvider/WsSignalProvider 封装 |

---

## 2. Panel 与 Studio 的关系

### 2.1 共享层

```
┌───────────────────────────────────────────────────────┐
│              packages/studio-core/                     │
│                                                       │
│  src/widgets/  ───────────────────► 7 Widget 组件      │
│    GaugeWidget / TrendWidget / TankWidget              │
│    IndicatorWidget / ButtonWidget / DisplayWidget      │
│    TextWidget                                         │
│  src/types/hmi.ts  ───────────────► HmiLayout 类型     │
│                                                       │
│  WidgetProps 接口:                                    │
│    { signalValue: HalValue | undefined, ...rest }     │
│  · widget 不感知信号来源 (纯函数组件)                    │
│  · 零 Tauri 依赖，两端直接 import                       │
│                                                       │
│  Panel 使用: PanelRenderer 循环渲染 widget              │
│  Studio 使用: HmiCanvas 嵌入 widget (含拖拽/缩放)       │
└───────────────────────────────────────────────────────┘
```

**共享策略**：
- Widget 组件已在 `packages/studio-core/` 统一维护，Panel 直接 import
- WidgetProps 接口统一：`{ signalValue, ...rest }`，widget 不感知信号来源
- Studio 侧通过 `useHmiSignal` Hook (Tauri invoke `read_signal`) 提供 signalValue
- Panel 侧通过 `usePanelSignal` Hook (SignalBridge subscribe) 提供 signalValue
- **同名概念，不同 Hook 实现** — widget 代码零修改，两端注入不同的信号源

**Panel 不需要的 Studio 组件**：
- HmiCanvas（拖拽/缩放/选中 — 编辑器专属）
- PropertyPanel（属性编辑 — 编辑器专属）
- WidgetPalette（widget 拖入 — 编辑器专属）

**Panel 新增的覆盖层组件**：
- `PanelRenderer`：加载 HmiLayout YAML → 遍历 widgets[] → 渲染 widget
- `AlarmBanner`：报警叠加层（顶部或弹出），由 AlarmManager 插件驱动
- `NavigationBar`：底部/侧边画面切换栏，由 MultiScreenNav 插件驱动
- `LoginOverlay`：操作员登录覆盖层，由 OperatorLogin 插件驱动

### 2.2 差异矩阵

| 维度 | Studio (设计器) | Runtime Panel (操作员) |
|------|----------------|----------------------|
| **用户角色** | 工程师 / 开发人员 | 操作员 (Operator) |
| **HMI 布局** | 编辑、保存、删除 | 只读加载 |
| **信号连接** | 通过 HmiCanvas 属性面板绑定额值 | 通过 SignalBridge 实时订阅/写入 |
| **进程模型** | 单窗口 IDE (多面板) | 全屏独立进程 (kiosk mode) |
| **UI 模式** | IDE 布局 (编辑器+浏览器+终端) | 全屏操作员界面 (无编辑器 chrome) |
| **插件** | ST Compiler, LD Editor, Debug 等 | OperatorLogin, AlarmManager, TrendRecorder |
| **认证** | HMAC Role::Engineer (Tauri 进程) | HMAC Role::Operator (操作员凭证) |
| **部署** | 开发者工作站 (Tauri) | 操作员站 (Tauri) 或 远程浏览器 (Web PWA) |
| **IPC 方法** | 全部 19 方法 (含 deploy/debug) | 仅 read/write/snapshot + 新增 subscribe |

### 2.3 代码复用拓扑

```
apps/studio/
  └── src/
      ├── components/widgets/         ←─ 已提取到 packages/studio-core/
      └── types/hmi.ts                ←─ 导入自 packages/studio-core/

packages/studio-core/                ← 统一共享库 (已就绪)
  └── src/
      ├── types/
      │   └── hmi.ts                 # HmiLayout + HmiWidgetState + HmiWidgetType
      │                              # WidgetProps: { signalValue, ...rest }
      └── widgets/
          ├── GaugeWidget.tsx
          ├── ButtonWidget.tsx
          ├── TrendWidget.tsx
          ├── TankWidget.tsx
          ├── IndicatorWidget.tsx
          ├── TextWidget.tsx
          └── DisplayWidget.tsx

apps/runtime-panel/                  ← 新建 Tauri 应用
  └── src/
      ├── shell/
      │   ├── PanelShell.tsx         # 全屏 shell (无 IDE chrome)
      │   └── NavigationManager.ts   # 画面切换
      ├── bridge/
      │   ├── SignalBridge.ts        # 信号桥核心
      │   ├── usePanelSignal.ts      # Panel 版 signalValue Hook
      │   └── TransportFactory.ts    # UDS / WS / Sim 自动选择
      ├── plugins/
      │   ├── plugin-registry.ts     # 参考 Studio PluginRegistry
      │   ├── operator-login/
      │   ├── alarm-manager/
      │   ├── trend-recorder/
      │   └── multi-screen-nav/
      └── renderer/
          └── PanelRenderer.tsx      # 加载 YAML → 遍历 widgets → <Widget signalValue={...} />

---

## 3. Panel Plugin 模型

### 3.1 与 Studio PluginRegistry 的关系

Panel 的 Plugin System **参考**但不是 Studio PluginRegistry 的子类/继承。两者有相同的生命周期模式 (`activate/deactivate`) 和 Manifest 结构，但 Panel 的插件上下文不同：

```typescript
// Panel 独有 — 不同于 Studio 的 PluginContext
interface PanelPluginContext {
  readonly pluginId: string;
  readonly signalProvider: SignalProvider;   // 信号读写 + 订阅（核心能力）
  readonly navManager: INavigationManager; // 画面导航
  readonly alarmBus: IAlarmBus;            // 报警事件总线
  readonly platform: IPlatformAdapter;     // PC/Web 适配（与 Studio 共享接口）
  readonly storage: IPanelStorage;         // 持久化存储（报警日志、趋势数据）
}
```

### 3.2 四大内置插件

```
┌──────────────────────────────────────────────────────────┐
│               Panel Plugin System                         │
│                                                          │
│  ┌────────────────┐  ┌────────────────┐                  │
│  │ OperatorLogin  │  │ AlarmManager   │  内置插件(Built-in)│
│  │                │  │                │                  │
│  │ · 凭证验证      │  │ · 阈值检测     │  P1 阶段：         │
│  │ · 会话管理      │  │ · 确认/静音    │  均作为 Application│
│  │ · 自动锁屏      │  │ · 报警日志     │  内逻辑实现        │
│  │ · 权限分层      │  │ · 报警总线     │  P2+ 阶段：        │
│  └────────┬───────┘  └───────┬────────┘  可替换为独立插件  │
│           │                  │                            │
│  ┌────────┴───────┐  ┌──────┴─────────┐                  │
│  │ TrendRecorder  │  │ MultiScreenNav │                   │
│  │                │  │                │                   │
│  │ · 信号快照定时  │  │ · Screen 注册  │                  │
│  │ · 滚动缓冲区    │  │ · Push/Pop     │                  │
│  │ · 持久化导出    │  │ · 参数传递     │                  │
│  │ · 回放支持      │  │ · 导航守卫     │                  │
│  └────────────────┘  └────────────────┘                  │
└──────────────────────────────────────────────────────────┘
```

### 3.3 插件接口定义

```typescript
interface PanelPluginManifest {
  id: string;                       // "audeys.panel.operator-login"
  displayName: string;              // "Operator Login"
  version: string;                  // SemVer
  type: "builtin" | "external";    // 内置 vs 外部
  activationEvents: PanelActivationEvent[];
  requires?: string[];              // 依赖的 Signal 名称 (如 requires: ["system.alarm.*"])
}

type PanelActivationEvent =
  | "onPanelStartup"                // Panel 启动后立即激活
  | "onAuthenticated"               // 操作员登录后
  | "onSignalChange:{pattern}"      // 指定信号变化时
  | "onAlarmRaised"                 // 报警触发时
  | "onScreenChange";               // 画面切换时

interface PanelPlugin {
  readonly manifest: PanelPluginManifest;
  activate(context: PanelPluginContext): Promise<void>;
  deactivate(): Promise<void>;
}

// 插件可通过 context 注册 UI 贡献
interface PanelPluginContext {
  // ... 基础字段 ...
  registerOverlay(component: React.ComponentType): void;      // 覆盖层（报警弹窗、登录界面）
  registerStatusBarItem(item: StatusBarItem): void;            // 状态栏项
  registerToolbarAction(action: ToolbarAction): void;          // 工具栏操作
  registerHeaderWidget(widget: React.ComponentType): void;     // 顶部区域 widget
}
```

### 3.4 插件数据流

```
┌───────────────────────────────────────────────────────────┐
│                      SignalProvider                        │
│                                                           │
│  signalValues: Map<string, string>  (通过 onUpdate 维护)   │
│       │                                                   │
│       ├──► AlarmManager 监听 "*.alarm.*" → 阈值判断       │
│       │       └── alarmBus.raise(AlarmEvent)              │
│       │                                                   │
│       ├──► TrendRecorder 订阅 trend signals → 定时快照     │
│       │       └── storage.appendTrendPoint(signal, value)  │
│       │                                                   │
│       └──► PanelRenderer.onUpdate → setSignalValues       │
│               └── <Widget signalValue={value} />           │
└───────────────────────────────────────────────────────────┘
```

---

## 4. SignalProvider — Signal Bridge 核心接口

### 4.1 SignalProvider 接口 (TypeScript)

```typescript
interface SignalUpdate {
  name: string;
  value: string;          // HalValue 序列化为字符串，Widget 自行解析
  timestampMs: number;
}

interface SignalProvider {
  /** 订阅一组信号，返回初始值映射 */
  subscribe(signals: string[]): Promise<Map<string, string>>;
  /** 取消单个信号的订阅 */
  unsubscribe(signal: string): Promise<void>;
  /** 写入信号值 */
  write(signal: string, value: string): Promise<void>;
  /** 批量快照（通配符匹配） */
  snapshot(pattern: string): Promise<Map<string, string>>;
  /** 注册更新回调，返回取消函数 */
  onUpdate(cb: (updates: SignalUpdate[]) => void): () => void;
}
```

**设计要点**：
- Panel TypeScript 层使用 `string` 表示信号值（避免 HalValue 类型跨语言依赖）
- Widget 组件通过 WidgetProps.signalValue (string) 接收，自行解析为 number/boolean/string
- `onUpdate` 是推送回调，在 LocalSignalProvider 中由 UDS push 帧触发，WsSignalProvider 中由 WS message 触发
- `subscribe` 返回初始值快照，确保 widget 挂载时立即显示当前值

### 4.2 三种 Provider 实现

| Provider | 传输 | 更新机制 | 延迟 | 适用场景 |
|----------|------|---------|:---:|------|
| **LocalSignalProvider** | UDS (ControllerClient) | 10ms polling + 0x16 SIGNAL_PUSH 帧 | < 20ms | 本地操作员站 (Tauri) |
| **WsSignalProvider** | WebSocket `ws://host:9080/signals` | WS 原生 message push | LAN < 25ms | 远程 Web 操作员 (PWA) |
| **SimSignalProvider** | SimulationHarness(进程内) | 函数调用，零延迟 | ~0μs | 仿真/开发模式 |

```typescript
// LocalSignalProvider 内部结构
class LocalSignalProvider implements SignalProvider {
  private client: ControllerClient;       // UDS 连接
  private pollingTimer: number | null;    // setInterval 句柄
  private listeners: Set<(updates: SignalUpdate[]) => void>;
  private cache: Map<string, string>;

  async subscribe(signals: string[]): Promise<Map<string, string>> {
    // 1. 发送 METHOD_SUBSCRIBE_SIGNAL (0x14)
    // 2. 获取初始值响应
    // 3. 加入 polling 集合
    // 4. 收到 SIGNAL_PUSH (0x16) unsolicited frame → notify listeners
  }

  private handlePushFrame(payload: Uint8Array): void {
    // 解码 push 帧 → SignalUpdate[] → 更新 cache → 通知 listeners
  }
}
```

### 4.3 画面切换时的订阅生命周期

```
Screen A (TankOverview) → Screen B (ConveyorStatus) 切换:

1. NavigationManager 触发 "onScreenChange"
2. PanelRenderer 根据新 HmiLayout 提取所需信号:
   oldSignals = ["tank.level", "tank.temp", "pump.speed"]    (Screen A 的 signal 绑定)
   newSignals = ["conveyor.speed", "motor.current", "sensor.prox"] (Screen B)

3. SignalProvider.unsubscribe() oldSignals (逐个取消)
4. SignalProvider.subscribe(newSignals) → 获取初始值
5. SignalProvider.onUpdate() 持续接收新值变更
6. PanelRenderer 卸载 Screen A 组件，挂载 Screen B 组件

切换时间目标: < 50ms (订阅操作) + 组件挂载时间
```

### 4.4 Panel Shell 渲染流程 — SignalProvider → Widget

```
┌─────────────────────────────────────────────────────────────────┐
│  PanelShell                                                      │
│                                                                  │
│  componentDidMount / useEffect:                                  │
│    1. TransportFactory.create(config) → SignalProvider           │
│    2. SignalProvider.onUpdate(handleSignalUpdates) 注册回调       │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  PanelRenderer                                             │  │
│  │                                                            │  │
│  │  state:                                                    │  │
│  │    hmiLayout: HmiLayout           (从 YAML 加载)            │  │
│  │    signalValues: Map<string, string>  (当前信号值缓存)       │  │
│  │                                                            │  │
│  │  render():                                                 │  │
│  │    hmiLayout.widgets.map(w => {                            │  │
│  │      const signalValue = w.signal                           │  │
│  │        ? signalValues.get(w.signal) ?? null                 │  │
│  │        : null;                                              │  │
│  │      return <WidgetComponent                                │  │
│  │        key={w.id}                                          │  │
│  │        signalValue={signalValue}  ←注入给 Widget            │  │
│  │        label={w.label}                                     │  │
│  │        config={w.config}                                   │  │
│  │        width={w.size.width}                                │  │
│  │        height={w.size.height}                              │  │
│  │      />                                                     │  │
│  │    })                                                       │  │
│  │                                                            │  │
│  │  handleSignalUpdates(updates: SignalUpdate[]):             │  │
│  │    setSignalValues(prev => {                               │  │
│  │      const next = new Map(prev);                           │  │
│  │      for (const u of updates) next.set(u.name, u.value);   │  │
│  │      return next;    // 不可变更新，触发 React 重渲染        │  │
│  │    });                                                      │  │
│  └───────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │  Widget (from packages/studio-core/)                       │  │
│  │                                                            │  │
│  │  interface WidgetProps {                                   │  │
│  │    signalValue: string | null;   ← PanelRenderer 注入       │  │
│  │    label: string;                                          │  │
│  │    config: Record<string, unknown>;                        │  │
│  │    width: number;                                          │  │
│  │    height: number;                                         │  │
│  │  }                                                         │  │
│  │                                                            │  │
│  │  Widget 内部自行:                                           │  │
│  │  · parseFloat(signalValue) → number (Gauge/Tank/Trend)     │  │
│  │  · signalValue → boolean (Indicator)                       │  │
│  │  · signalValue → string display (Display/Text)             │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

**数据流路径**：
```
Controller RT Cycle
  │
  ├─ Signal 值变化 (Engine 内部)
  │
  ├─ IPC Server 在周期边界 (Config Barrier) 打包变更 → SIGNAL_PUSH frame
  │    (或 polling timer 触发 → read_signal 获取)
  │
  ├─ SignalProvider 接收更新
  │    LocalSignalProvider: UDS frame → decode → SignalUpdate[]
  │    WsSignalProvider: WS message → JSON.parse → SignalUpdate[]
  │
  └─ SignalProvider.onUpdate 回调 → PanelRenderer.setState
       → React 不可变更新 → Widget 重渲染 (仅 signalValue 变化的组件)
```

---

## 5. Transport 层（SignalProvider 内部封装）

Transport 层不再暴露为独立接口 — 各 SignalProvider 实现内部封装传输细节：

| SignalProvider | 内部 Transport | 认证 |
|---------------|---------------|------|
| LocalSignalProvider | ControllerClient (UDS) via `crates/audeys-controller-client` | HMAC Role::HMI, TTL 1h |
| WsSignalProvider | WebSocket `ws://host:9080/signals` | WS 握手时 HMAC 令牌验证 |
| SimSignalProvider | SimulationHarness (进程内函数调用) | 无需认证 |

---
```

### 5.2 三种实现


---

## 6. 部署拓扑

### 6.1 拓扑 A：本地操作员站 (PC)

```
┌──────────────────────────────────────────────────────────────┐
│                  Operator Workstation                          │
│                                                               │
│  ┌──────────────────────────────────┐  ┌──────────────────┐  │
│  │        Runtime Panel (Tauri)     │  │  Controller       │  │
│  │                                  │  │  (独立进程)        │  │
│  │  Panel Shell  Widget Renderer    │  │                   │  │
│  │       │            │             │  │  Runtime Engine    │  │
│  │  Plugin Sys    Signal Bridge     │  │  IPC Server       │  │
│  │       │            │             │  │  Modbus/HART      │  │
│  │       └────────────┼─────────────┼──┤  Adapters         │  │
│  │                    │             │  │                   │  │
│  │              UdsTransport ───────┼──┤ UDS: /tmp/audeys- │  │
│  │              (HMAC Role::HMI)    │  │ controller.sock   │  │
│  └──────────────────────────────────┘  └────────┬─────────┘  │
│                                                 │             │
│                                        Modbus RTU/TCP        │
│                                        HART 4-20mA            │
│                                                 │             │
│                                        ┌────────┴─────────┐  │
│                                        │  PLC / DCS / I/O │  │
│                                        │  現場設備          │  │
│                                        └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

**特点**：
- Panel 和 Controller 同机部署（同一工业 PC 或边缘网关）
- 通信延迟 ~10μs (UDS)
- 操作员角色 Role::HMI，权限：readSignal（监控域）、signalSnapshot、writeSignal 仅限于特定按钮信号
- 认证：SO_PEERCRED + HMAC SessionToken (TTL: 1h)

### 6.2 拓扑 B：远程 Web 操作员 (Browser)

```
┌──────────────────────────┐         ┌──────────────────────────────┐
│   Remote Browser          │         │    Edge Controller            │
│                           │         │                              │
│  Runtime Panel (PWA)      │   WSS   │  ┌────────────────────────┐  │
│                           │◄────────┼──┤  IPC Server              │  │
│  Panel Shell              │         │  │                          │  │
│  Widget Renderer          │         │  │  UDS Listener            │  │
│  Signal Bridge            │         │  │  + WebSocket Server      │  │
│  WsTransport              │         │  │  (新增 WS 端点)          │  │
│                           │         │  │  · ws://0.0.0.0:9090/   │  │
│  PlatformAdapter          │         │  │    panel                 │  │
│  (mode: "web")            │         │  │  · HMAC 认证             │  │
│                           │         │  │  · TLS (生产环境)        │  │
│  · fetch() HTTP           │         │  └───────────┬────────────┘  │
│  · IndexedDB VFS          │         │              │               │
│  · ServiceWorker          │         │        Runtime Engine        │
│    (offline cache)        │         │        Modbus/HART           │
└──────────────────────────┘         └──────────────────────────────┘
```

**特点**：
- Panel 作为 PWA 部署在浏览器中（平板、瘦客户端）
- WebSocket 推送实现低延迟信号更新
- 功能降级：无原生 FS、无系统托盘、PTY 不可用（不影响操作员功能）
- 安全：WSS + HMAC SessionToken + 可选 mTLS（参考 Zenoh mTLS 证书结构）

### 6.3 拓扑 C：仿真/开发模式

```
┌──────────────────────────────────────────────┐
│            Developer Workstation              │
│                                               │
│  ┌──────────────────────────────────────┐    │
│  │        Runtime Panel (Tauri)         │    │
│  │                                      │    │
│  │  Panel Shell                         │    │
│  │  Widget Renderer                     │    │
│  │  Signal Bridge                       │    │
│  │       │                              │    │
│  │  SimTransport                        │    │
│  │       │                              │    │
│  │       └──────────────┐               │    │
│  └──────────────────────┼───────────────┘    │
│                         │                     │
│  ┌──────────────────────┼───────────────┐    │
│  │  SimulationHarness   │               │    │
│  │                      │               │    │
│  │  · VirtualModbusTcp  │               │    │
│  │  · VirtualHARTDevice │               │    │
│  │  · FaultInjection    │               │    │
│  │  · SceneRecorder     │               │    │
│  │                      │               │    │
│  │  Runtime Engine      │               │    │
│  │  (同进程 — 仿真模式)  │               │    │
│  └──────────────────────────────────────┘    │
└──────────────────────────────────────────────┘
```

**特点**：
- Panel + Runtime Engine + SimulationHarness 全部同进程运行
- 零网络开销，一鍵启动：`cargo run --bin audeys-panel -- --sim`
- 支持场景录制回放 — 操作员 UI 可用录制的数据流离线验证
- 主要用途：HMI 布局验证、操作员培训、报警逻辑测试

---

## 7. 与 IPC Server 的集成

### 7.1 现有 IPC 方法的 Panel 使用

| Method ID | 方法名 | Panel 使用 | 说明 |
|:---:|--------|:---:|------|
| 0x01 | AUTH_REQUEST | ✅ | Role::HMI 认证 |
| 0x02 | CONFIG_COMMAND | ❌ | Panel 不发送配置命令 |
| 0x03 | READ_SIGNAL | ✅ | 单信号轮询读取（降级模式） |
| 0x04 | WRITE_SIGNAL | ✅ | 按钮触发写操作 |
| 0x05 | HEALTH_QUERY | ✅ | 连接健康检查 |
| 0x06 | SIGNAL_SNAPSHOT | ✅ | 画面加载时批量取初始值 |
| 0x07-0x13 | LOAD_PROGRAM ~ ROLLBACK_SWAP | ❌ | 全部被 HMI 角色权限矩阵拒绝 |

### 7.2 新增 IPC 方法

现有 IPC 协议只支持请求-响应模式，Panel 需要**推送订阅**以降低轮询开销。新增 3 个方法：

#### METHOD_SUBSCRIBE_SIGNAL (0x14)

```
Request:
  [2B count: u16 LE]                        // 订阅信号数量
  [count × (
    [2B name_len: u16 LE]                   // 信号名长度
    [name_len bytes]                        // 信号名 (UTF-8)
  )]

Response (immediate):
  [1B status: u8]                           // STATUS_OK or STATUS_ERROR
  [2B count: u16 LE]                        // 返回的初始值数量
  [count × (
    [2B name_len: u16 LE]                   // 信号名长度
    [name_len bytes]                        // 信号名
    [encoded HalValue]                      // 当前值
  )]
```

**行为约定**：
- 订阅后立即返回所有信号的当前值（初始快照）
- Controller 端为每个连接维护 `active_subscriptions: HashSet<String>`
- 单连接限定最大订阅数 500（防止操作员误订阅全系信号）

#### METHOD_UNSUBSCRIBE_SIGNAL (0x15)

```
Request:
  [2B count: u16 LE]                        // 取消订阅的信号数量 (0 = 全部取消)
  [count × (
    [2B name_len: u16 LE]
    [name_len bytes]
  )]

Response:
  [1B status: u8]                           // STATUS_OK / STATUS_ERROR
```

**行为约定**：
- `count = 0` 取消此连接的全部订阅
- 连接断开时自动清理订阅（无需显式取消）

#### METHOD_SIGNAL_PUSH (0x16) — Unsolicited Server Frame

此方法**无客户端请求**，由服务端在周期边界主动推送。帧格式：

```
Frame (unsolicited, server → client):
  [4B total_len LE][1B method_id=0x16][1B status=0x00][N bytes payload]
  
  Payload format:
  [2B update_count: u16 LE]                 // 本次推送的更新数量
  [update_count × (
    [2B name_len: u16 LE]                   // 信号名长度
    [name_len bytes]                        // 信号名
    [encoded HalValue]                      // 新值
  )]
```

**行为约定**：
- Server 在 Runtime Engine 周期边界 (Config Barrier) 批量打包变化信号
- 仅向订阅了对应信号的连接推送
- 同周期内同一信号多次变化，仅推送最终值
- 客户端 `LocalSignalProvider` 监听此帧，解码后触发 `onUpdate` 回调

### 7.3 Controller 端订阅实现要点

```rust
// crates/audeys-controller/src/ipc.rs 新增

/// Per-connection subscription state
struct ConnectionSubs {
    /// Signals this connection is subscribed to (wildcard expanded)
    patterns: Vec<String>,
    /// Set of concrete signal names
    signals: HashSet<String>,
    /// Sender for push frames (UDS uses direct write, WS uses tx channel)
    push_sender: Option<std::sync::mpsc::Sender<PushUpdate>>,
}

struct PushUpdate {
    signal_name: String,
    value: HalValue,
}

impl IpcServer {
    /// Called by the engine at the end of each cycle (Config Barrier boundary)
    /// to push changed signals to subscribed connections.
    fn flush_subscriptions(&mut self) {
        let changed = self.engine.drain_changed_signals(); // Vec<(String, HalValue)>
        if changed.is_empty() { return; }

        for (conn_id, subs) in &self.subscriptions {
            let updates: Vec<_> = changed.iter()
                .filter(|(name, _)| subs.signals.contains(name.as_str()))
                .cloned()
                .collect();
            if !updates.is_empty() {
                self.send_push_frame(conn_id, 0x16 /* METHOD_SIGNAL_PUSH */, &encode_push_payload(&updates));
            }
        }
    }
}
```

**关键约束**：
- 推送在周期边界 (Config Barrier) 批量发送，不在信号变化时即时推送
- 同周期内同一信号多次变化，仅推送最终值
- 单连接限定最大订阅数 500（防止操作员误订阅全系信号）

### 7.4 权限矩阵扩展

| 操作 | Controller | Supervisor | HMI (新增) | Debug |
|------|:----------:|:----------:|:---:|:-----:|
| `subscribe_signal` (0x14) | 是 | 是 | **是** | 是 |
| `unsubscribe_signal` (0x15) | 是 | 是 | **是** | 是 |
| `SIGNAL_PUSH` (0x16, unsolicited) | n/a (server→client) | n/a | **接收** | n/a |
| `writeSignal` (0x04) | 是 | 是 | **是（仅按钮绑定信号）** | 是 |
| `signalSnapshot` (0x06) | 是 | 是 | **是（仅监控域）** | 是 |

**HMI 角色的 writeSignal 限制**：
- Controller 端检查写入目标信号是否在 HMI 配置的 `writable_signals` 列表中（从 HmiLayout 的 button widget 信号绑定中提取）
- 非 button 信号拒绝写入（操作员不能通过 Panel 修改控制逻辑信号）

---

## 8. Navigation Manager

### 8.1 接口定义

```typescript
interface INavigationManager {
  readonly currentScreen: ScreenDescriptor | null;
  readonly screenStack: ScreenDescriptor[];

  registerScreen(screen: ScreenDescriptor): void;
  navigateTo(screenId: string, params?: Record<string, unknown>): void;
  goBack(): boolean;
  canGoBack(): boolean;
  getHomeScreen(): ScreenDescriptor | null;
  setHomeScreen(screenId: string): void;
  onBeforeNavigate(guard: (from: string, to: string) => boolean): void;
}

interface ScreenDescriptor {
  id: string;                              // "tank_overview"
  title: string;                           // "储罐总览"
  layoutPath: string;                      // "screens/tank_overview.yaml"
  icon?: string;                           // Lucide icon name
  requiresAuth?: boolean;                  // 是否需要登录 (默认 true)
  params?: Record<string, unknown>;        // 传递参数
}
```

### 8.2 多画面模型

```
┌──────────────────────────────────────────────────────────┐
│  Panel Shell — NavigationManager                          │
│                                                          │
│  ScreenRegistry (静态注册)                                │
│  ├── screen:tank_overview    → tank_overview.yaml        │
│  ├── screen:conveyor_status  → conveyor_status.yaml      │
│  ├── screen:alarm_summary    → alarm_summary.yaml        │
│  ├── screen:trend_viewer     → trend_viewer.yaml         │
│  └── screen:system_status    → system_status.yaml        │
│                                                          │
│  Screen Stack (运行时)                                    │
│  [tank_overview] → [conveyor_status] → [trend_viewer]   │
│      Home              推入             推入              │
│                                                          │
│  NavigationBar (固定底部/侧边)                             │
│  [← Back] [Home] [Alarms] [画面1] [画面2] [画面3] ...    │
└──────────────────────────────────────────────────────────┘
```

---

## 9. Panel Shell UI 布局

```
┌─────────────────────────────────────────────────────────────┐
│  Panel Shell (全屏 / kiosk mode)                             │
│                                                             │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  Header Bar                                              ││
│  │  [🏭 Tank Farm]     Operator: 张三    ⏰ 14:32    🔔 3   ││
│  │  画面标题            登录用户         时钟       报警计数  ││
│  ├─────────────────────────────────────────────────────────┤│
│  │                                                         ││
│  │                    Canvas Area                           ││
│  │              (HmiLayout.canvasWidth × Height)            ││
│  │                                                         ││
│  │   ┌──────┐  ┌──────┐  ┌──────────┐  ┌────────────┐     ││
│  │   │Gauge │  │Tank  │  │ Indicator│  │   Trend    │     ││
│  │   │  45.2│  │  ███ │  │   ● OK   │  │  ╱╲ ╱╲    │     ││
│  │   │  kPa │  │ 72%  │  │          │  │ ╱    ╲   │     ││
│  │   └──────┘  └──────┘  └──────────┘  └────────────┘     ││
│  │                                                         ││
│  │   ┌──────────────┐  ┌────────┐                          ││
│  │   │  Display     │  │ Button │                          ││
│  │   │  Status: OK  │  │ [START]│                          ││
│  │   └──────────────┘  └────────┘                          ││
│  │                                                         ││
│  ├─────────────────────────────────────────────────────────┤│
│  │  Navigation Bar                                          ││
│  │  [◀ Back] [🏠 Home] [⚠ Alarms] [📊 Trends] [⚙ Sys]     ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## 10. 实现路线图

### P1 (MVP — 操作员基本监控)

| 任务 | 估时 | 依赖 |
|------|:---:|------|
| `packages/studio-core/` widget 组件 + HmiLayout 类型已就绪 | 0d | 无 (已完成) |
| `apps/runtime-panel/` Tauri 应用骨架 + PanelShell | 1d | studio-core |
| PanelRenderer (load YAML → SignalProvider.onUpdate → inject signalValue) | 1d | studio-core + SignalProvider 接口 |
| LocalSignalProvider 实现 (ControllerClient + 10ms poll + SIGNAL_PUSH 帧处理) | 2d | IPC 新增方法 |
| IPC Server 新增 0x14 subscribe / 0x15 unsubscribe / 0x16 SIGNAL_PUSH | 2d | 无 |
| NavigationManager (画面注册/切换) | 1d | PanelRenderer |
| 集成测试: Panel ←UDS→ Controller ←Modbus→ VirtualDevice | 2d | 全部 |
| 集成测试: Panel ←UDS→ Controller ←Modbus→ VirtualDevice | 2d | 全部 |

**P1 总估时: ~9d** (studio-core Widget 库已就绪，节省 2d)

### P2 (远程监控 + 报警)

| 任务 | 估时 | 依赖 |
|------|:---:|------|
| WsSignalProvider + Controller WebSocket 端点 | 3d | P1 |
| OperatorLogin 插件 (凭证/会话/锁屏) | 2d | P1 |
| AlarmManager 插件 (阈值/确认/日志) | 3d | P1 SignalProvider |
| TrendRecorder 插件 (定时快照+缓冲区) | 2d | P1 SignalProvider |
| PWA 离线支持 (ServiceWorker) | 2d | WsSignalProvider |

### P3 (完整操作员站)

| 任务 | 估时 | 依赖 |
|------|:---:|------|
| MultiScreenNav 插件 (导航守卫+参数传递) | 1d | P1 NavigationManager |
| 外部插件 SDK (社区插件支持) | 3d | P2 插件模型 |
| 操作员审计日志 | 2d | P2 OperatorLogin |
| 画面权限 (按角色限制画面可见性) | 1d | P2 OperatorLogin |

---

## 11. 关键设计决策

| ID | 决策 | 理由 |
|----|------|------|
| **D60** | Panel 复用 Studio widget 组件而非重写 | 7 种 widget 已实现且测试通过，重写带来双倍维护成本 |
| **D61** | Panel Plugin 参考 Studio 接口但不继承 | Panel 插件上下文不同（SignalProvider vs Tauri invoke），强行共享接口会引入不必要的抽象 |
| **D62** | SignalProvider 内部封装三种传输实现 | LocalSignalProvider (UDS 10ms poll + push)、WsSignalProvider (WebSocket push)、SimSignalProvider (进程内)，对外暴露统一 SignalProvider 接口 |
| **D63** | SIGNAL_PUSH (0x16) 在周期边界批量发送 | 避免 RT 线程中逐信号推送造成抖动，与 Config Barrier 设计哲学一致；unsolicited frame 无需客户端轮询 |
| **D64** | HMI 角色 writeSignal 限定按钮绑定信号 | 操作员不应通过 Panel 修改控制逻辑，但需要启停按钮能力 |
| **D65** | Panel 作为独立 Tauri 应用而非 Studio 面板 | 操作员站全屏运行，不应嵌入 IDE chrome；独立进程可单独部署、升级、崩溃隔离 |
| **D66** | SignalProvider 接口统一三种传输实现，Panel 业务代码零感知 | LocalSignalProvider / WsSignalProvider / SimSignalProvider 实现同一 SignalProvider 接口，PanelShell/PanelRenderer 通过接口编程，切换传输方式无需变更渲染逻辑 |

---

## 参考资料

- `packages/studio-core/src/widgets/` — 共享 Widget 组件库 (已就绪，WidgetProps: { signalValue, ...rest })
- `packages/studio-core/src/types/hmi.ts` — HmiLayout 类型定义 (已就绪)
- `docs/modules/studio/plugin-architecture-design.md` — Studio PluginRegistry 参考模型
- `docs/modules/runtime/ipc-security-design.md` — IPC 安全设计 (HMAC, 角色权限)
- `crates/audeys-controller/src/ipc.rs` — IPC Server 现有 19 方法实现
- `crates/audeys-controller-client/src/lib.rs` — ControllerClient (UDS 客户端, LocalSignalProvider 封装)
- `docs/reference/ignition.md` — Ignition Perspective (Web-first HMI 参考)
- `docs/reference/intouch.md` — InTouch (传统 SCADA HMI 参考)
