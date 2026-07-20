# AUDESYS HMI 管道规范

> **来源**: `apps/studio/src/types/hmi.ts` + `docs/modules/runtime/panel-architecture-design.md` + D62-D69
> **总项数**: 22 (布局验证 9 + 部署管道 7 + SignalBridge 6)
> **传输格式**: YAML (开发期) / FlatBuffers (运行时, D24)
> **相关决策**: D62, D63, D64, D67, D68, D69

---

## 1. HMI 布局验证 (HMI-VAL)

### HMI-VAL-001: Widget 数量上限

布局中 widget 总数不得超过 50 个。超过 30 时应产生警告。

- **前置条件**: 用户保存 HMI 布局
- **操作**: 调用 `validateLayout(layout: HmiLayout)`
- **期望**: `result.warnings` 包含 `"widget count 35 exceeds recommended limit of 30"`（超过 30 时）
- **期望**: `result.errors` 包含 `"widget count 55 exceeds maximum of 50"`（超过 50 时）
- **边界**: 空布局（0 widget）无效，返回 `result.errors` 含 `"layout must contain at least 1 widget"`
- **测试**: `hmi_validation_test.rs` — `test_widget_count_limit`

### HMI-VAL-002: widget 位置非负

所有 widget 的 `x`, `y` 坐标必须 ≥ 0。负值拒绝。

- **前置条件**: widget 的 `x < 0` 或 `y < 0`
- **操作**: 调用 `validateLayout(layout)`
- **期望**: `result.errors` 包含 `"widget 'gauge-1' has negative position x=-10"`
- **边界**: 坐标 0 合法（左上角锚点）
- **测试**: `test_negative_position_rejected`

### HMI-VAL-003: widget 位置不越界

所有 widget 的 `x + width` 和 `y + height` 不得超出画布边界（默认 1920×1080）。

- **前置条件**: widget 的 `x + width > canvasMaxWidth` 或 `y + height > canvasMaxHeight`
- **操作**: 调用 `validateLayout(layout, { canvasWidth: 1920, canvasHeight: 1080 })`
- **期望**: `result.errors` 包含 `"widget 'tank-1' exceeds canvas boundary"`
- **边界**: 画布大小可配置（通过 `ValidationOptions`）
- **测试**: `test_widget_out_of_bounds`

### HMI-VAL-004: widget 尺寸合法

`width` 和 `height` 必须 > 0。必须 ≥ 最小尺寸（Gauge 40×40, Trend 80×80, 其他 20×20）。

- **前置条件**: widget `width` 或 `height` ≤ 0
- **操作**: 调用 `validateLayout(layout)`
- **期望**: `result.errors` 包含 `"widget 'btn-1' has invalid dimensions: width=0, height=30"`
- **边界**: 最大尺寸不超过画布大小（1920×1080）
- **测试**: `test_invalid_widget_dimensions`

### HMI-VAL-005: widget ID 唯一

布局中不得存在重复的 widget ID。

- **前置条件**: 两个或多个 widget 使用相同的 `id`
- **操作**: 调用 `validateLayout(layout)`
- **期望**: `result.errors` 包含 `"duplicate widget id 'gauge-1' found at indices [0, 5]"`
- **边界**: 大小写敏感比较
- **测试**: `test_duplicate_widget_id`

### HMI-VAL-006: 信号名有效性

每个 widget 的 `signal` 字段（若不为空）必须存在于当前信号注册表中。

- **前置条件**: widget 绑定了不存在的信号 `"axis.99.pos"`
- **操作**: 调用 `validateLayout(layout, { signalNames: ["axis.0.pos", "axis.1.pos"] })`
- **期望**: `result.warnings` 包含 `"widget 'indicator-2' bound to unknown signal 'axis.99.pos'"`
- **边界**: `signal` 为空字符串或 `null` 时跳过检查（允许未绑定的占位 widget）
- **测试**: `test_unknown_signal_binding_warns`

### HMI-VAL-007: 必填字段完整性

每个 widget 必须包含 `id`, `type`, `x`, `y`, `width`, `height`。缺失任一项 → 错误。

- **前置条件**: widget 缺少 `type` 字段
- **操作**: 调用 `validateLayout(layout)`
- **期望**: `result.errors` 包含 `"widget at index 3 missing required field 'type'"`
- **边界**: 额外字段（如 `zIndex`）允许，不会报错
- **测试**: `test_missing_required_field`

### HMI-VAL-008: Widget 类型专属配置

Gauge widget 必须有 `min < max`。Trend widget 必须有 `timespan > 0`。

- **前置条件**: Gauge widget 配置 `min=100, max=0`
- **操作**: 调用 `validateLayout(layout)`
- **期望**: `result.errors` 包含 `"gauge 'gauge-3': min (100) must be less than max (0)"`
- **边界**: Trend timespan 单位秒，最小 1 秒
- **测试**: `test_gauge_min_max_validation`

### HMI-VAL-009: 重叠检测 (P2)

Phase 2 可选启用 widget 重叠检测。Phase 1 允许重叠（方便布局调整）。

- **前置条件**: P2 启用重叠检测 + 两个 widget 边界重叠
- **操作**: 调用 `validateLayout(layout, { detectOverlap: true })`
- **期望**: `result.warnings` 包含 `"widgets 'gauge-1' and 'tank-2' overlap"`
- **边界**: 边框接触（touching）不算重叠
- **测试**: `test_overlap_detection_p2` (标记 `#[ignore]` 至 Phase 2)

---

## 2. HMI 部署管道 (HMI-DPL)

### HMI-DPL-001: DEPLOY_HMI_LAYOUT 消息格式

IPC method `0x17` 携带序列化的 HmiLayout。请求结构同 `0x10`（deploy_program）：`<header(8B)> + <hmac(32B)> + <payload>`。payload 为 YAML 字符串（Phase 1）或 FlatBuffers 二进制（Phase 2）。

- **前置条件**: Studio 调用 `controller_client.deploy_hmi_layout(yaml_content)`
- **操作**: Controller 接收 0x17 帧
- **期望**: 解析成功，payload 提取为 `String`
- **边界**: payload 最大 1MB（超过拒绝并返回错误）
- **测试**: `test_deploy_hmi_layout_message_format`

### HMI-DPL-002: HMAC 认证

`0x17` 必须携带有效的 HMAC token，角色必须为 `Role::Engineer`（值 1）。

- **前置条件**: 使用过期 token 或 `Role::Operator` 发送 0x17
- **操作**: IPC Server 验证 HMAC + RBAC
- **期望**: 返回 `ErrorCode::AuthFailed`（401）或 `ErrorCode::Forbidden`（403）
- **边界**: 空 HMAC token → AuthFailed；HMI 角色 layout 部署 → Forbidden（仅 Engineer 可部署布局）
- **测试**: `test_deploy_hmi_layout_auth_rejected`

### HMI-DPL-003: Config Barrier 周期边界应用

HmiLayout 在 RT 周期边界批量生效（D17），当前周期内写入的内容在本周期不可见。

- **前置条件**: 调用 `deploy_hmi_layout` 后立即 `read_current_layout`
- **操作**: 在周期 N 中调用 deploy → 在周期 N 中立即 read
- **期望**: `read_current_layout` 返回旧布局（新布局尚未生效）
- **期望**: 周期 N+1 开始时新布局生效
- **边界**: 同周期多次 deploy → 仅最后一次生效
- **测试**: `test_config_barrier_hmi_layout_defer`

### HMI-DPL-004: 部署确认

Controller 在布局应用成功后发送 `DEPLOY_ACK(0x17, status=0, generation=N)`。

- **前置条件**: 布局部署成功
- **操作**: Controller 在周期边界应用新布局
- **期望**: Studio 接收 `DEPLOY_ACK` 帧，`generation` 递增
- **期望**: `generation` 从 1 开始单调递增（与 D68 一致）
- **边界**: 部署失败 → `DEPLOY_ACK` 带 `status=1`（错误码）
- **测试**: `test_deploy_hmi_layout_acknowledgment`

### HMI-DPL-005: Panel 获取新布局

Panel 收到 `DEPLOY_ACK` 后通过 SignalBridge 重新加载布局（D68）。

- **前置条件**: Controller 部署新布局并发送 ACK
- **操作**: Panel 的 `SignalBridge` 接收到 `onLayoutChange(generation)` 回调
- **期望**: Panel 调用 `snapshot()` 刷新所有绑定的信号值
- **期望**: Panel 渲染新布局（旧 widget 隐藏、新 widget 显示）
- **边界**: Panel 与 Controller 断开重连 → Panel 启动时请求当前 generation
- **测试**: 集成测试（延迟至 P1 — 需 SignalBridge 实现）

### HMI-DPL-006: 布局 YAML 持久化

部署成功后将布局写入 Controller 本地文件系统 `{project}/hmi/layout.yaml`（D69）。

- **前置条件**: 布局部署成功（`DEPLOY_ACK` status=0）
- **操作**: Controller 将 YAML 内容写入磁盘
- **期望**: 文件存在且内容与 Studio 发送的一致
- **期望**: 文件通过 Git 纳入版本管理（`{project}/` 目录已在 Git 中）
- **边界**: 磁盘满 → 部署失败，DEPLOY_ACK 带 status=2（磁盘错误）
- **测试**: `test_hmi_layout_persistence_to_disk`（使用 tempdir）

### HMI-DPL-007: 启动加载持久化布局

Controller 启动时从 `{project}/hmi/layout.yaml` 加载上次部署的布局。

- **前置条件**: 上次部署后 Controller 重启
- **操作**: Controller 读取 `{project}/hmi/layout.yaml`
- **期望**: 加载成功，Panel 可立即显示持久化的布局
- **边界**: 文件不存在 → 返回默认空布局（无错误）
- **边界**: YAML 解析失败 → 返回错误，不应用损坏的布局
- **测试**: `test_load_hmi_layout_on_startup`

---

## 3. SignalBridge (HMI-SIG)

### HMI-SIG-001: Hybrid 模式推送优先

默认启用 push 优先级（Controller 端 SIGNAL_PUSH frame）。仅当 `push_available=false` 时降级为 poll 模式。

- **前置条件**: Controller 支持 0x16 push（UDS 或 WebSocket 连接）
- **操作**: SignalBridge 建立连接时检测 push 可用性
- **期望**: `mode` 字段 = `"push"`，`push_available` = true
- **期望**: UDS 连接 push 延迟 <50μs（D62）
- **期望**: push 不可用时（Controller 不支持、网络受限）→ `mode` = `"poll"`，`poll_interval_ms` = 100（D62）
- **测试**: `test_signalbridge_push_priority`

### HMI-SIG-002: 周期边界批量推送

Controller 端信号推送在 RT 周期边界（Config Barrier 边界）批量发送（D63）。

- **前置条件**: 同一周期内 `axis.0.pos` 被写入 3 次（值 1.0 → 2.0 → 3.0）
- **操作**: RT 周期结束时批量推送
- **期望**: Panel 仅收到一次推送，值为最终值 3.0
- **期望**: Panel 不会在推送间隙看到中间值（1.0 → 2.0 仅在 RT 线程内可见）
- **测试**: `test_batch_push_at_cycle_boundary`

### HMI-SIG-003: writeSignal 权限检查

Role::HMI（枚举值 5）仅限于 HmiLayout 中 button widget 绑定的信号执行写入（D64）。

- **前置条件**: Panel 以 Role::HMI 连接，尝试写入 `"axis.0.pos"`（非 button 信号）
- **操作**: SignalBridge 调用 `writeSignal("axis.0.pos", 50.0)`
- **期望**: Controller 拒绝写入，返回 `Forbidden`
- **期望**: 尝试写入 button 绑定的信号 `"pump.1.start"` → 成功
- **边界**: Role::Engineer 可写入任意信号（不受 button 绑定限制）
- **测试**: `test_hmi_write_signal_permission`

### HMI-SIG-004: Deadband 写入过滤

F64 信号值变化 < Deadband 阈值时不推送（避免网络洪水）。默认 deadband: F64 = 0.1%, F32 = 0.5%, 整数 = 0。

- **前置条件**: 信号 `"tank.level"` 当前值 50.000，下周期变为 50.001（变化 0.002%）
- **操作**: 周期边界推送时检查 deadband
- **期望**: 值 50.001 不被推送（变化 < 0.1% deadband）
- **边界**: 变化 ≥ deadband 阈值时正常推送
- **边界**: 布尔值始终推送（无 deadband）
- **测试**: `test_deadband_filter_filters_small_changes`

### HMI-SIG-005: 信号订阅生命周期

Panel 通过 `subscribe(signalNames: string[])` 注册订阅，`unsubscribe(signalNames)` 取消。Controller 仅向已订阅 Panel 推送。

- **前置条件**: Panel 订阅 `["axis.0.pos", "tank.level"]`
- **操作**: 周期边界，`axis.0.pos` 变更
- **期望**: Panel 收到 `axis.0.pos` 推送，`tank.level` 不变时不推送
- **操作**: Panel 调用 `unsubscribe(["axis.0.pos"])`
- **期望**: 后续周期 `axis.0.pos` 变更不再推送到该 Panel
- **边界**: Panel 断开连接 → 自动取消所有订阅
- **测试**: `test_signal_subscription_lifecycle`

### HMI-SIG-006: IPanelTransport 接口

所有 Panel 传输实现遵循统一接口。Phase 1 实现 `UdsTransport`（D66）。

```typescript
interface IPanelTransport {
  connect(): Promise<void>;
  readSignal(name: string): Promise<HalValue | null>;
  writeSignal(name: string, value: HalValue): Promise<void>;
  snapshot(): Promise<Record<string, HalValue>>;
  subscribe(names: string[], onPush: SignalPushCallback): Promise<void>;
  unsubscribe(names: string[]): Promise<void>;
}
```

- **前置条件**: `UdsTransport` 已实现 `IPanelTransport`
- **操作**: 调用 `transport.connect()` 后调用 `transport.snapshot()`
- **期望**: 返回所有已发布信号的当前值快照
- **边界**: 未连接时调用 → 抛出 `TransportError("not connected")`
- **测试**: 集成测试（延迟至 P1 — 需完整 Transport 实现）

---

## 交叉引用

| 决策 | 规范项 |
|------|--------|
| D62 | HMI-SIG-001（Hybrid push/poll）, HMI-SIG-002（周期边界批量） |
| D63 | HMI-SIG-002（周期边界批量推送） |
| D64 | HMI-SIG-003（writeSignal 权限） |
| D66 | HMI-SIG-006（IPanelTransport） |
| D67 | HMI-DPL-001（sim_set_signal 复用——Preview 信号注入） |
| D68 | HMI-DPL-001~007（0x17 DEPLOY_HMI_LAYOUT 全流程） |
| D69 | HMI-DPL-006~007（YAML 持久化） |

## Phase 边界

- **P1 实现**: HMI-VAL-001~008（验证逻辑），HMI-DPL-001~004,006,007（部署核心），HMI-SIG-001~004,006（SignalBridge 核心）
- **P2 实现**: HMI-VAL-009（重叠检测），HMI-DPL-005（Panel 集成），HMI-SIG-005（订阅生命周期）
- **P1 延迟**: 集成测试标记 `#[ignore]`，需完整 SignalBridge + Panel 实现后再激活
