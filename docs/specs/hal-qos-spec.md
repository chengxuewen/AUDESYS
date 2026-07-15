# HAL QoS Spec

> 生成日期: 2026-07-15
> 来源: `docs/modules/hal/industrial-qos-design.md`
> 覆盖: HalQoS trait、Deadline/Liveliness/Security Domain 三个维度、层级化 security domain 匹配、状态转换、位掩码编译、各 amw 实现差异

## Spec 约定

每条 spec 项编号 `S-QOS-NNN`，包含:

| 字段 | 说明 |
|------|------|
| **ID** | S-QOS-NNN 唯一编号 |
| **Title** | 测试标题 |
| **Preconditions** | 测试前必须满足的条件 |
| **Action** | 执行的操作 |
| **Expected** | 期望结果 |
| **Boundary** | 边界条件 |
| **Test Mapping** | 对应测试方法/用例 |

---

## 1. HalQoS Trait 定义

### S-QOS-001: HalQoS 五方法接口

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-001 |
| **Title** | HalQoS trait 暴露五个方法: watch_deadline / enable_liveliness / check_liveliness / set_security_domain / security_domain |
| **Preconditions** | 任意 amw 实现（amw_inproc / amw_zenoh）已初始化 |
| **Action** | 调用 `qos.watch_deadline(name, interval, cb)`、`qos.enable_liveliness(component, period)`、`qos.check_liveliness(component)`、`qos.set_security_domain(domain)`、`qos.security_domain()` |
| **Expected** | 五个方法均可调用。`watch_deadline` 返回 `Result<DeadlineHandle>`。`enable_liveliness` 返回 `Result<()>`。`check_liveliness` 返回 `LivenessStatus`。`set_security_domain` 返回 `Result<()>`。`security_domain` 返回 `String`。 |
| **Boundary** | 空字符串 name 传入 watch_deadline → 应返回 Err。空字符串 component 传入 enable_liveliness → 应返回 Err。 |
| **Test Mapping** | `test_hal_qos_trait_surface` — 验证 trait 所有方法签名编译且可调用 |

### S-QOS-002: DeadlineHandle Drop 自动取消

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-002 |
| **Title** | DeadlineHandle 被 Drop 时自动取消对应 deadline 监控 |
| **Preconditions** | 注册了一个 `watch_deadline("sig_x", 100, cb)` 并获得 handle |
| **Action** | drop handle，然后停止发送 "sig_x" 超过 200ms |
| **Expected** | 回调 `cb` 不被调用（监控已取消） |
| **Boundary** | handle 在另一个线程 drop（Send + Sync 保证）→ 同样取消 |
| **Test Mapping** | `test_deadline_handle_drop_cancels` — 创建 handle、drop、等待超时、验证回调未触发 |

### S-QOS-003: DeadlineCallback 签名和约束

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-003 |
| **Title** | DeadlineCallback 类型为 `Box<dyn Fn(&str) + Send + Sync>`，回调在 RT 线程内同步执行 |
| **Preconditions** | amw 实例，RT tick 循环在运行 |
| **Action** | 注册 deadline 回调，让 deadline 超时触发 |
| **Expected** | 回调参数为触发超时的 signal 名称（`&str`）。回调执行线程为 RT tick 线程（与 `publish_signal` 同线程）。回调内禁止 async / 阻塞 I/O。 |
| **Boundary** | 回调 panic → amw 实现应 catch 并记录，不传播到 RT tick 循环 |
| **Test Mapping** | `test_deadline_callback_execution_context` — 记录回调线程 ID，验证与 publish 线程 ID 相同 |

---

## 2. Deadline 监控

### S-QOS-004: Deadline 超时触发回调

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-004 |
| **Title** | 超过 max_interval_ms 未发布 signal 时触发 deadline 回调 |
| **Preconditions** | `watch_deadline("test.sig", 50, cb)` 已注册，"test.sig" 最后一次发布在 0ms |
| **Action** | 等待 60ms 不发布 "test.sig" |
| **Expected** | 第 51ms 后的下一个 RT tick 调用 `cb("test.sig")`。回调在 deadline 超时后的第一个检查周期内触发。 |
| **Boundary** | max_interval_ms = 0 → 每次 tick 均触发回调（等同于每次检查都超时） |
| **Test Mapping** | `test_deadline_triggers_after_interval` — 用 mock clock 加速，验证超时后的第一个 tick 调用回调 |

### S-QOS-005: Deadline 超时后恢复

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-005 |
| **Title** | 重新发布 signal 后 deadline 计时自动重置，回调不再触发 |
| **Preconditions** | `watch_deadline("test.sig", 50, cb)` 已注册，上次发布在 60ms 前（已超时触发过回调） |
| **Action** | 在 70ms 时 `publish_signal("test.sig", value)` |
| **Expected** | 计时器重置。从 70ms 起再过 50ms 内不发布 → 再次触发。50ms 内发布 → 不触发。 |
| **Boundary** | 紧贴边界: 在第 50ms 精确发布 → 不应触发回调（elapsed = 50, condition: `elapsed > max_interval_ms` → false） |
| **Test Mapping** | `test_deadline_reset_on_publish` — 发布 signal、等待略小于 interval、验证回调未触发 |

### S-QOS-006: Deadline 多 Signal 独立监控

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-006 |
| **Title** | 多个 signal 各有独立 deadline，互不影响 |
| **Preconditions** | `watch_deadline("sig_a", 20, cb_a)` 和 `watch_deadline("sig_b", 100, cb_b)` 均已注册 |
| **Action** | 持续按 15ms 周期发布 "sig_a"，停止发布 "sig_b" |
| **Expected** | `cb_a` 不被触发（sig_a 在 interval 内）。`cb_b` 在 100ms 后触发。 |
| **Boundary** | 同时注册 1000 个 signal 的 deadline → 所有计时器在单次 tick 检查中完成，无显著延迟 |
| **Test Mapping** | `test_deadline_multiple_signals_independent` — 两个 signal 不同 interval，只停一个，验证只有对应的触发 |

---

## 3. Liveliness 状态转换

### S-QOS-007: Liveliness 状态枚举

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-007 |
| **Title** | LivenessStatus 三态: Alive / Missing { last_seen_ms } / Unknown |
| **Preconditions** | amw 实例，未启用任何 liveliness |
| **Action** | 调用 `check_liveliness("non_existent")` |
| **Expected** | 返回 `LivenessStatus::Unknown`。对于已启用 liveliness 但心跳超时的组件返回 `Missing { last_seen_ms }`。 |
| **Boundary** | 对刚启用 liveliness 的组件立即检查 → 应返回 `Alive`（首跳心跳立即生效） |
| **Test Mapping** | `test_liveliness_status_enum_variants` — 检查三种变体的构造和 match |

### S-QOS-008: enable_liveliness 启动心跳

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-008 |
| **Title** | enable_liveliness 启动组件的周期性心跳发送 |
| **Preconditions** | amw_zenoh 实例 |
| **Action** | `qos.enable_liveliness("estop-button", 100)` |
| **Expected** | amw 每 100ms 自动发送该组件的心跳。其他节点通过 `check_liveliness("estop-button")` 可感知。 |
| **Boundary** | period_ms = 0 → 返回 Err（心跳周期必须 > 0） |
| **Test Mapping** | `test_liveliness_enable_starts_heartbeat` — 启用后验证心跳报文存在于 transport 层 |

### S-QOS-009: Liveliness 超时状态转换

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-009 |
| **Title** | 心跳丢失后状态从 Alive 转换为 Missing |
| **Preconditions** | 组件 "comp_a" 已 `enable_liveliness("comp_a", 50)`，初始为 Alive |
| **Action** | 模拟组件离线（停止心跳发送），等待 150ms |
| **Expected** | 初始 50ms 内 → Alive。50ms 后至 150ms → Missing { last_seen_ms }，其中 last_seen_ms 为上次心跳时间戳。 |
| **Boundary** | 刚好在 50ms 时检查 → 边界精度 ±1 tick（取决于检查周期，应允差 1 tick） |
| **Test Mapping** | `test_liveliness_alive_to_missing_transition` — 控制心跳发送，验证精确的状态转换时间点 |

### S-QOS-010: Liveliness 恢复

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-010 |
| **Title** | 组件恢复心跳后状态从 Missing 回到 Alive |
| **Preconditions** | 组件 "comp_a" 已处于 Missing 状态 |
| **Action** | 组件恢复心跳发送 |
| **Expected** | 再次调用 `check_liveliness("comp_a")` 返回 `Alive` |
| **Boundary** | 从 Missing 到 Alive 的转换应在恢复后的第一个检查周期内完成，无延迟惩罚 |
| **Test Mapping** | `test_liveliness_recovery_from_missing` — 丢失心跳 → 恢复 → 验证回到 Alive |

---

## 4. Security Domain

### S-QOS-011: set_security_domain 配置安全域

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-011 |
| **Title** | set_security_domain 设置当前节点的安全域标签 |
| **Preconditions** | amw 实例，初始 security_domain 为空字符串 |
| **Action** | `qos.set_security_domain("cell_1")` |
| **Expected** | `qos.security_domain()` 返回 `"cell_1"`。Transport 层将所有后续发布的 signal 自动加 keyexpr 前缀 `"cell_1/"`（amw_zenoh）。 |
| **Boundary** | 空字符串 `""` → 设置默认域（全局可见，不加前缀）。超长字符串 256 字符 → 应 Err 或截断。 |
| **Test Mapping** | `test_security_domain_set_and_get` — 设置后读取，验证一致。跨 amw 实现验证隔离行为。 |

### S-QOS-012: 层级化 Security Domain 标签格式

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-012 |
| **Title** | 安全域标签为 `{level}.{domain}.{subdomain}` 三层层级格式 |
| **Preconditions** | amw 实例 |
| **Action** | `qos.set_security_domain("l1.control.reactor_a")` |
| **Expected** | `security_domain()` 返回 `"l1.control.reactor_a"`。Transport 层将该标签以点分隔层级存储。三个层级含义: level (l1/l2/l3/l4/l5)、domain (功能域)、subdomain (设备/区域)。 |
| **Boundary** | 两层格式 `"l1.control"` → subdomain 留空，语义为匹配该 domain 下所有 subdomain。一层格式 `"l1"` → 匹配该 level 下所有 domain.subdomain。 |
| **Test Mapping** | `test_security_domain_hierarchical_format` — 验证 1/2/3 层标签的解析、存储和还原 |

### S-QOS-013: 层级化匹配规则

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-013 |
| **Title** | Security domain 通配匹配: `l1.*` 匹配所有 L1 域 |
| **Preconditions** | 节点 A: domain = `"l1.control.reactor_a"`，节点 B: domain = `"l1.safety.reactor_a"` |
| **Action** | 配置订阅者以 `"l1.*"` 匹配 |
| **Expected** | 匹配规则: `"l1.*"` 匹配任何 `l1.{anything}.{anything}`。`"l1.control.*"` 匹配 `l1.control.{anything}` 但不匹配 `l1.safety.*`。`"*"` 匹配所有域。`"l1.control.reactor_a"` 精确匹配自身。 |
| **Boundary** | `"l1.*"` 不应匹配 `"l10.control.*"`（级别边界） |
| **Test Mapping** | `test_security_domain_wildcard_matching` — 各种通配模式与目标域的匹配/不匹配测试矩阵 |

### S-QOS-014: Security Domain 位掩码编译

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-014 |
| **Title** | 层级化 security domain 编译为位掩码，零运行时开销 |
| **Preconditions** | 已知完整的 domain 层级表（在构建时确定） |
| **Action** | 构建时编译: `"l1.control.reactor_a"` → 分配唯一的位掩码值。`"l1.*"` → 展开为所有 `l1.{*}.{*}` 的位掩码 OR。 |
| **Expected** | 匹配操作在运行时为位与运算 `(mask & wildcard_mask) != 0`。无字符串解析、无正则、无循环。每个 domain 标签在编译时映射到一个固定位。 |
| **Boundary** | 位掩码宽度上限（u64 = 64 个独立域，u128 = 128 个）。超出上限 → 编译错误。 |
| **Test Mapping** | `test_security_domain_bitmask_compilation` — 预定义 5 个 domain，验证编译后的位掩码匹配结果与手动计算的预期一致 |

### S-QOS-015: Security Domain 隔离效果

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-015 |
| **Title** | 不同 security domain 的组件互相不可见 |
| **Preconditions** | amw_zenoh 实例，节点 A domain = "cell_1"，节点 B domain = "cell_2"，节点 C domain = ""（默认） |
| **Action** | 节点 A 发布 signal。节点 B 尝试发现/订阅该 signal。节点 C 尝试发现/订阅该 signal。 |
| **Expected** | 节点 B 发现零结果（keyexpr 前缀 `cell_1/` 不匹配 `cell_2/`）。节点 C 可发现/订阅（默认域无前缀限制，或视为全局可见）。 |
| **Boundary** | 节点 A domain = "cell_1.sub"，节点 B domain = "cell_1" → keyexpr 前缀 `cell_1.sub/` vs `cell_1/` → 不匹配（非前缀关系，精确隔离） |
| **Test Mapping** | `test_security_domain_isolation` — 不同 domain 的节点互相发现/订阅测试 |

---

## 5. amw 实现差异

### S-QOS-016: amw_inproc Deadline 实现

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-016 |
| **Title** | amw_inproc 用 RT 线程 tick 计时器实现 deadline |
| **Preconditions** | amw_inproc 实例，RT tick 循环间隔 1ms |
| **Action** | `watch_deadline("sig", 5, cb)`，停止发布 "sig" |
| **Expected** | Deadline 检查在 RT tick 循环内同步执行。每次 tick 遍历所有已注册 deadline，计算 elapsed。超时时调用 cb。 |
| **Boundary** | tick 间隔 1ms、deadline interval 5ms → 实际触发在 5-6ms 间（最多延迟 1 tick） |
| **Test Mapping** | `test_amw_inproc_deadline_rt_tick` — 验证 deadline 检查与 RT tick 同步 |

### S-QOS-017: amw_inproc Liveliness 无意义

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-017 |
| **Title** | amw_inproc 中 enable_liveliness 是 no-op，check_liveliness 返回 Unknown |
| **Preconditions** | amw_inproc 实例 |
| **Action** | `qos.enable_liveliness("comp", 100)` 然后 `qos.check_liveliness("comp")` |
| **Expected** | `enable_liveliness` 返回 `Ok(())`。`check_liveliness` 返回 `LivenessStatus::Unknown`。 |
| **Boundary** | 对任意 component 名称调用结果相同 |
| **Test Mapping** | `test_amw_inproc_liveliness_noop` — 验证 enable 不 panic，check 恒为 Unknown |

### S-QOS-018: amw_inproc Security Domain 无意义

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-018 |
| **Title** | amw_inproc 中 set_security_domain 是 no-op，返回 Ok(()) |
| **Preconditions** | amw_inproc 实例 |
| **Action** | `qos.set_security_domain("cell_1")` |
| **Expected** | 返回 `Ok(())`。`security_domain()` 返回空字符串（或设置的值，但不影响 transport）。 |
| **Boundary** | 设置任意 domain 值，transport 行为不变 |
| **Test Mapping** | `test_amw_inproc_security_domain_noop` — 设置后验证 transport 隔离无变化 |

### S-QOS-019: amw_zenoh Deadline 实现

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-019 |
| **Title** | amw_zenoh 用内部定时器 + AtomicU64 实现 deadline |
| **Preconditions** | amw_zenoh 实例 |
| **Action** | `watch_deadline("sig", 200, cb)`，等待 300ms 不发布 "sig" |
| **Expected** | 每次 `publish_signal("sig", v)` 重置 `AtomicU64 last_update`。内部 tick 循环读取 `last_update` 与当前时间比较。超时调用 `cb`。 |
| **Boundary** | AtomicU64 精度: `now_ms()` 使用 `SystemTime::now()` 或 `clock_gettime(CLOCK_MONOTONIC)`。当计时器 wrap around（50 天+）时不受影响。 |
| **Test Mapping** | `test_amw_zenoh_deadline_timer` — 模拟 tick 循环，验证 AtomicU64 计时器正确性 |

### S-QOS-020: amw_zenoh Liveliness 实现

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-020 |
| **Title** | amw_zenoh 用 Zenoh liveliness token 实现组件心跳 |
| **Preconditions** | amw_zenoh 实例 A 和 B 连接同一 Zenoh 路由 |
| **Action** | A: `enable_liveliness("comp_a", 100)`. B: `check_liveliness("comp_a")` |
| **Expected** | Zenoh 自动管理 token 的声明期。Token 丢失 → B 的 check 返回 Missing。Token 存活 → Alive。 |
| **Boundary** | A 进程崩溃后 token 自动释放 → B 在 Zenoh 的 lease 到期后感知 Missing |
| **Test Mapping** | `test_amw_zenoh_liveliness_token` — 双节点测试，验证 token 声明和丢失后的状态变化 |

### S-QOS-021: amw_zenoh Security Domain keyexpr 前缀

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-021 |
| **Title** | amw_zenoh 用 keyexpr 前缀 `{domain}/` 实现安全域隔离 |
| **Preconditions** | amw_zenoh 实例，domain = "cell_1" |
| **Action** | 发布 signal "encoder.axis.0.position" |
| **Expected** | Transport 层自动转换为 keyexpr `"cell_1/encoder.axis.0.position"`。仅订阅 `"cell_1/**"` 的节点可收到。未设 domain 的节点订阅 `"cell_1/**"` 不可见 `"cell_2/**"`。 |
| **Boundary** | domain 含特殊字符（`/`、`*`）→ 需转义或拒绝 |
| **Test Mapping** | `test_amw_zenoh_security_domain_keyexpr` — 验证 keyexpr 前缀正确拼接和隔离 |

---

## 6. 组合与集成

### S-QOS-022: AmwMiddleware 三极组合

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-022 |
| **Title** | AmwMiddleware trait 组合 HalTransport + HalDiscovery + HalQoS |
| **Preconditions** | — |
| **Action** | 检查 `AmwMiddleware` trait 定义 |
| **Expected** | `trait AmwMiddleware: HalTransport + HalDiscovery + HalQoS { fn shutdown(); fn metrics(); }`。三个子 trait 平级。实现者必须同时实现所有三个子 trait。 |
| **Boundary** | 只实现 HalQoS 而不实现 HalTransport 的类型无法满足 AmwMiddleware bound |
| **Test Mapping** | `test_amw_middleware_trait_bounds` — 验证类型约束编译通过 |

### S-QOS-023: YAML 协议规格中的 QoS 块

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-023 |
| **Title** | YAML 协议规格包含完整的 qos 块定义 |
| **Preconditions** | `protocol-spec-yaml.md` 存在 |
| **Action** | 验证 YAML 规格中 `qos` 块的完整性 |
| **Expected** | `qos` 包含 `deadline`（scope: per_signal, granularity: millisecond, on_violation: callback_in_rt_tick）、`liveliness`（scope: per_component, detection: check_liveliness + zenoh_liveliness_token）、`security_domain`（scope: per_node, isolation: none/keyexpr_prefix/dds_partition per amw）。 |
| **Boundary** | YAML 格式应严格与 hal-protocol-design.md 中的规格同步 |
| **Test Mapping** | `test_qos_yaml_spec_completeness` — 解析 YAML，验证所有必要字段存在 |

### S-QOS-024: Deadline + Liveliness 执行层级分离

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-024 |
| **Title** | Deadline 在 RT 数据面执行，Liveliness 在控制面执行 |
| **Preconditions** | amw_zenoh 实例运行在 PREEMPT_RT 系统上 |
| **Action** | 同时配置 deadline（1ms interval）和 liveliness（100ms period） |
| **Expected** | Deadline 回调在 RT tick 线程内同步执行（SCHED_FIFO 优先级）。Liveliness 心跳和检查在非 RT 控制面线程。两者不在同一线程，互不阻塞。 |
| **Boundary** | RT tick 间隔 < 1ms → deadline 精度受 tick 间隔限制。Liveliness 延迟 100ms 级，不进入 RT 路径。 |
| **Test Mapping** | `test_qos_execution_layer_separation` — 验证 deadline 和 liveliness 的线程归属不同 |

---

## 7. 边界与错误

### S-QOS-025: Deadline max_interval_ms 合法范围

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-025 |
| **Title** | Deadline max_interval_ms 必须 > 0 |
| **Preconditions** | amw 实例 |
| **Action** | `watch_deadline("sig", 0, cb)` |
| **Expected** | 返回 `Err`（interval 必须为正）。`watch_deadline("sig", 1, cb)` → Ok。`watch_deadline("sig", u64::MAX, cb)` → Ok（约 5 亿毫秒 ≈ 584,942 年）。 |
| **Boundary** | u64::MAX 作为 interval → 实际上永不触发（除非机器运行 50 万年） |
| **Test Mapping** | `test_deadline_max_interval_valid_range` — 验证 0 返回 Err，正数返回 Ok |

### S-QOS-026: enable_liveliness period_ms 合法范围

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-026 |
| **Title** | Liveliness period_ms 必须 >= 1 |
| **Preconditions** | amw 实例（amw_zenoh） |
| **Action** | `enable_liveliness("comp", 0)` |
| **Expected** | 返回 `Err`（心跳周期必须 >= 1ms）。`enable_liveliness("comp", 1)` → Ok。 |
| **Boundary** | period_ms = 1 → 1ms 心跳（可能产生显著网络流量）。工业典型值 100-1000ms。 |
| **Test Mapping** | `test_liveliness_period_valid_range` — 验证 0 返回 Err，正数返回 Ok |

### S-QOS-027: set_security_domain 格式校验

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-027 |
| **Title** | Security domain 字符集和长度校验 |
| **Preconditions** | amw 实例 |
| **Action** | 设置各种格式的 domain: `"l1.control.reactor_a"`、`"INVALID UPPERCASE"`、`"a.b.c.d.e"`（5 层）、空字符串 |
| **Expected** | 层级分隔符为 `.`。每级字符集 `[a-z0-9][a-z0-9_-]*`。最多 3 级。总长度上限 64 字符。空字符串合法（默认域）。不符合格式的返回 Err。 |
| **Boundary** | 空字符串 `""` 是合法默认域。超过 64 字符 → Err。大写字母 → Err。4 层 `"a.b.c.d"` → Err 或只取前 3 级。 |
| **Test Mapping** | `test_security_domain_format_validation` — 合法/非法 domain 字符串的接受/拒绝测试 |

### S-QOS-028: DeadlineCallback 内 panic 安全

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-028 |
| **Title** | Deadline 回调 panic 不传播到 RT tick 循环 |
| **Preconditions** | amw 实例，注册的回调内调用 `panic!("test")` |
| **Action** | 让 deadline 超时触发该回调 |
| **Expected** | amw 实现应 catch panic（`std::panic::catch_unwind`）。记录错误日志。RT tick 循环继续执行。其他 deadline 不受影响。 |
| **Boundary** | 连续 panic 的回调 → 每次触发都 catch，循环不中断 |
| **Test Mapping** | `test_deadline_callback_panic_safety` — 注册会 panic 的回调，验证 tick 循环继续运行 |

---

## 8. 跨 amw 一致性

### S-QOS-029: HalQoS trait 签名跨实现一致

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-029 |
| **Title** | 所有 amw 实现使用同一 HalQoS trait 签名 |
| **Preconditions** | amw_inproc 和 amw_zenoh 均可实例化 |
| **Action** | 对两种实现调用相同参数的 `watch_deadline`、`enable_liveliness`、等 |
| **Expected** | 编译通过，trait 签名完全一致。各实现内部行为按 §3 表差异化。 |
| **Boundary** | 未来 amw_dds 实现也必须实现同一 trait |
| **Test Mapping** | `test_hal_qos_trait_consistency_across_implementations` — 泛型函数测试任一 `impl HalQoS` |

### S-QOS-030: HalQoS Send + Sync

| 字段 | 内容 |
|------|------|
| **ID** | S-QOS-030 |
| **Title** | HalQoS trait 要求 Send + Sync |
| **Preconditions** | — |
| **Action** | 检查 trait bound: `trait HalQoS: Send + Sync` |
| **Expected** | `HalQoS` 自动要求所有实现是 `Send + Sync`。跨线程传递 `&dyn HalQoS` 安全。 |
| **Boundary** | 内部使用 `Arc<Mutex<DeadlineWatcher>>` 或 `AtomicU64` 等线程安全原语 |
| **Test Mapping** | `test_hal_qos_send_sync` — 编译时检查 `dyn HalQoS` 满足 Send + Sync |

---

## 附录 A: 状态转换图

```
Liveliness:

  ┌──────────┐
  │  Unknown  │
  └────┬─────┘
       │ enable_liveliness()
       v
  ┌──────────┐   heartbeat timeout    ┌─────────────────────┐
  │  Alive   │ ─────────────────────> │ Missing { last_seen }│
  └──────────┘ <───────────────────── └─────────────────────┘
       ^         heartbeat resumed
       │
       │ drop / component gone (amw_zenoh token expire)
       v
  ┌──────────┐
  │  Unknown  │
  └──────────┘


Deadline:

  publish_signal(name, value)
       │
       v
  Reset timer: last_update = now_ms()
       │
       │  elapsed = now_ms() - last_update
       │  (checked each RT tick)
       │
       ├──────────────────────────────────────┐
       │ elapsed <= max_interval_ms            │ elapsed > max_interval_ms
       │ (normal, no action)                   │ (deadline violated)
       v                                       v
  Wait for next tick                   Call callback(name)
                                       (in RT thread, sync)
                                       ──> publish_signal(
                                             "{name}.deadline_violated",
                                             HalValue::Bool(true)
                                           )
                                       (typical application callback)
```

## 附录 B: 位掩码编译示例

```
Domain 层级定义:
  level:      l1 | l2 | l3 | l4 (2 bits)
  domain:     control | safety | supervisory | diagnostics (4 bits)
  subdomain:  每个 domain 下最多 4 个（2 bits）
  总计: 8 bits = 256 种组合，可用 u8 表示

编译示例:
  "l1.control.reactor_a"
    → level_bits = 0b00 (l1)
    → domain_bits = 0b00 (control)
    → subdomain_bits = 0b00 (reactor_a 的分配位)
    → mask = 0b00000000

  "l1.*"
    → level_bits = 0b00 (l1)
    → domain_bits = 0b1111 (any)
    → subdomain_bits = 0b1111 (any)
    → mask = 0b00111111

  运行时匹配: (mask_a & mask_b) != 0
    "l1.control.reactor_a" & "l1.*" = (0b00000000 & 0b00111111) = 0b00000000
    若 subdomain 为 0，reactor_a 实际 mask 应为 0b00000000 + 唯一偏移
    具体分配策略由构建时编译器决定，确保每个独立 domain 有唯一 bit
```

---

*End of spec. Total: 30 spec items (S-QOS-001 to S-QOS-030).*