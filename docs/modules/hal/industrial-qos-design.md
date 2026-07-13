# AUDESYS 工业 QoS 设计

> 生成日期：2026-07-09
> 设计目标：定义 `HalQoS` trait 作为 amw 第三极，统一 Deadline / Liveliness / Security Domain 三个维度，与 HalTransport / HalDiscovery 平齐

---

## 设计原则

工业控制系统的 QoS 不是 DDS 的 reliable/best-effort/durability——那是面向消息中间件的概念。工业 QoS 的核心是三件事：

1. **数据时效**：编码器还能工作吗？（Deadline）
2. **设备存活**：设备还连着吗？（Liveliness）
3. **安全隔离**：cell_1 的数据安全吗？（Security Domain）

三者执行层级不同（RT 数据面、非 RT 控制面、静态配置面），但概念上属于同一个关注面：**服务质量**。用单一 `HalQoS` trait 统一，不让它们散落在不同模块。

---

## 1. HalQoS trait

```rust
/// 服务质量抽象 — 与 HalTransport（数据面）、HalDiscovery（控制面）平齐
///
/// 每个 amw 实现自行决定如何实现每个维度：
/// - amw_inproc:   Deadline 用 RT tick，Liveliness 无（单进程），Security 无
/// - amw_zenoh:    Deadline 用 Zenoh timer，Liveliness 原生，Security 用 keyexpr 前缀
/// - amw_dds 未来: Deadline/Liveliness 走 DDS QoS，Security 走 Partition
trait HalQoS: Send + Sync {

    // ═══ Deadline: 数据面，RT 周期级别 ═══

    /// 注册信号的最大更新间隔监控。
    ///
    /// amw 在每次 publish_signal(name) 时内部重置计时器。
    /// 当 elapsed > max_interval_ms 时，在当前 RT tick 内同步调用 cb，
    /// 不经过 Supervisor，不经过 async。
    fn watch_deadline(
        &self,
        name: &str,
        max_interval_ms: u64,
        cb: DeadlineCallback,
    ) -> Result<DeadlineHandle>;


    // ═══ Liveliness: 控制面，非 RT ═══

    /// 为此组件启用心跳。amw 负责按 period_ms 周期发送。
    /// 心跳丢失时，其他组件通过 check_liveliness 感知。
    fn enable_liveliness(
        &self,
        component: &str,
        period_ms: u64,
    ) -> Result<()>;

    /// 查询另一个组件的存活状态。
    /// 当前组件不需要有直接 Signal 连接——纯控制面查询。
    fn check_liveliness(&self, component: &str) -> LivenessStatus;


    // ═══ Security Domain: 配置面，静态 ═══

    /// 设置当前节点的安全域。
    /// Transport 层用此标记隔离数据。
    fn set_security_domain(&self, domain: &str) -> Result<()>;

    /// 获取当前安全域。空字符串 = 默认域（全局可见）。
    fn security_domain(&self) -> String;
}
```

### 类型定义

```rust
type DeadlineCallback = Box<dyn Fn(&str) + Send + Sync>;
// 参数: Signal 名称。回调在 RT 线程内同步执行，禁止 async、禁止阻塞 I/O

struct DeadlineHandle {
    signal_name: String,
    // Drop 时自动取消监控
}

#[derive(Clone, Debug, PartialEq)]
enum LivenessStatus {
    Alive,
    Missing { last_seen_ms: u64 },
    Unknown,
}
```

---

## 2. amw 架构更新

```
        ┌──────────────────────────────────┐
        │       AmwMiddleware (组合)         │
        │                                   │
        │  HalTransport    传输 — 数据面     │
        │  HalDiscovery    发现 — 控制面     │
        │  HalQoS          质量 — 服务面     │
        └──────────┬───────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────┴─────┐ ┌─────┴──────┐ ┌───┴──────────┐
│amw_inproc│ │ amw_zenoh  │ │ amw_* (未来)  │
└──────────┘ └────────────┘ └───────────────┘
```

```rust
/// 组合 trait — 使用时取这个
trait AmwMiddleware: HalTransport + HalDiscovery + HalQoS {
    fn shutdown(&self) -> Result<()>;
    fn metrics(&self) -> AmwMetrics;
}
```

---

## 3. 各实现差异化

| | amw_inproc | amw_zenoh | amw_dds (未来) |
|---|---|---|---|
| **Deadline** | RT 线程内 tick 计时器 | Zenoh 内置 timer + callback | DDS Deadline QoS |
| **Liveliness** | 无意义（同进程共享声明周期）| Zenoh `liveliness::declare_token` | DDS Liveliness QoS |
| **Security Domain** | 无意义（同进程天然隔离）| keyexpr 前缀 `{domain}/` | DDS Partition |

### amw_zenoh Deadline 实现

```rust
impl HalQoS for AmwZenoh {
    fn watch_deadline(&self, name: &str, max_interval_ms: u64,
                       cb: DeadlineCallback) -> Result<DeadlineHandle>
    {
        let deadline = DeadlineWatcher {
            signal_name: name.to_string(),
            max_interval: Duration::from_millis(max_interval_ms),
            last_update: Arc::new(AtomicU64::new(now_ms())),
            callback: cb,
        };

        // 注册到内部 tick 循环
        let handle = self.deadlines.lock().insert(name.to_string(), deadline);

        Ok(DeadlineHandle {
            signal_name: name.to_string(),
        })
    }
}

// amw_zenoh 内部：每次 publish_signal 时重置计时器
impl AmwZenoh {
    fn publish_signal(&self, name: &str, value: HalValue) -> Result<()> {
        // 1. 写入 Signal
        self.signals.lock().insert(name.to_string(), value);

        // 2. 如有 deadline 监控，reset timer
        if let Some(watcher) = self.deadlines.lock().get(name) {
            watcher.last_update.store(now_ms(), Ordering::Release);
        }

        Ok(())
    }

    // RT tick: 检查所有 deadline
    fn check_all_deadlines(&self) {
        let deadlines = self.deadlines.lock();
        for (_, watcher) in deadlines.iter() {
            let elapsed = now_ms() - watcher.last_update.load(Ordering::Acquire);
            if elapsed > watcher.max_interval.as_millis() as u64 {
                (watcher.callback)(&watcher.signal_name);
            }
        }
    }
}
```

### amw_inproc Deadline 实现

```rust
impl HalQoS for AmwInproc {
    fn watch_deadline(&self, name: &str, max_interval_ms: u64,
                       cb: DeadlineCallback) -> Result<DeadlineHandle>
    {
        // 同进程内直接改用同一线程 tick 监控
        let deadline = DeadlineWatcher { /* 同上 */ };
        // 注册到 RT 线程 tick 循环
        self.rt_loop_deadlines.lock().push(deadline);
        Ok(DeadlineHandle { signal_name: name.to_string() })
    }

    fn enable_liveliness(&self, _component: &str, _period_ms: u64) -> Result<()> {
        // 同进程内，组件退出 = 进程退出，无需心跳
        Ok(())
    }

    fn check_liveliness(&self, _component: &str) -> LivenessStatus {
        LivenessStatus::Unknown // 进程内无此概念
    }

    fn set_security_domain(&self, _domain: &str) -> Result<()> { Ok(()) }
    fn security_domain(&self) -> String { String::new() }
}
```

---

## 4. 与现有设计的整合

### hal-protocol-design.md 更新点

1. ASCII 架构图加入 `HalQoS` 一极
2. amw 章节 `AmwMiddleware` trait 从双极变三极
3. YAML 协议规格加入 `qos` 块
4. 设计决策记录更新：
   - 删除 "不做 QoS" 决策
   - 新增 "HalQoS 作为第三极" 决策
   - 新增 "Deadline 在 RT 周期、Liveliness 在控制面、Security 在配置面" 决策

### YAML 协议规格新增

```yaml
qos:
  deadline:
    scope: per_signal
    granularity: millisecond
    on_violation: callback_in_rt_tick
    implementation:
      amw_inproc: rt_tick_timer
      amw_zenoh: zenoh_timer_callback
      amw_dds: dds_deadline_qos

  liveliness:
    scope: per_component
    detection:
      - check_liveliness(component_name) -> LivenessStatus
      - zenoh_liveliness_token (amw_zenoh)
    heartbeat_loss_handling: application_defined

  security_domain:
    scope: per_node
    isolation:
      amw_inproc: none
      amw_zenoh: keyexpr_prefix
      amw_dds: dds_partition
```

---

## 5. 使用示例

### 编码器 Deadline 监控

```rust
// Controller 启动时注册
let qos = amw.qos();

// 编码器轴位置必须 1ms 更新一次，5ms 无数据 → 紧急停机
qos.watch_deadline(
    "encoder.axis.0.position",
    5, // max_interval_ms
    Box::new(|name| {
        // 在 RT 线程内同步执行
        // 写入告警 Signal，motion-controller 同一周期读到
        amw.publish_signal(
            &format!("{}.deadline_violated", name),
            HalValue::Bool(true),
        ).ok();
    }),
)?;
```

### 急停按钮 Liveliness

```rust
// 急停按钮 Component 启用
qos.enable_liveliness("estop-button", 100)?; // 100ms 心跳

// 安全控制器 500ms 检查
let status = qos.check_liveliness("estop-button");
match status {
    LivenessStatus::Missing { last_seen_ms } if last_seen_ms > 500 => {
        // 触发安全停机——非 RT 路径
        safety_controller.emergency_stop();
    }
    _ => { /* 正常 */ }
}
```

### 多产线 Security Domain 隔离

```rust
// cell_1 Supervisor
qos.set_security_domain("cell_1")?;
// 所有 Signal 自动加 keyexpr 前缀 (amw_zenoh)
// cell_1 的 "encoder.axis.0.position" → "cell_1/encoder.axis.0.position"

// cell_2 Supervisor 注册到不同域
qos.set_security_domain("cell_2")?;
// cell_2 的 keyexpr 查找 "cell_1/**" → 零结果
```

---

## 6. 设计决策记录

| 决策 | 理由 |
|------|------|
| HalQoS 作为独立 trait（非混入 HalTransport） | 关注面分离。Liveliness 是控制面、Security 是配置面——和 Transport 的数据面职责不同 |
| HalQoS 与 HalTransport/HalDiscovery 平齐 | 和 amw 抽象层一致——三个 trait，一个 AmwMiddleware 组合 |
| Deadline 监控在 RT 数据面 | 编码器断连 → 同 RT 周期触发，Supervisor 延迟不可接受 |
| Liveliness 在控制面 | 组件心跳丢失不是微秒级事件；Zenoh 原生处理，100ms 级足够 |
| Security Domain 在配置面 | 纯 meta 标记，zero runtime overhead；静态隔离，不参与 RT 路径 |
| 各 amw 实现自行解释 HalQoS | 同 HalTransport/HalDiscovery 哲学。inproc 无 Liveliness 是语义正确，不是缺失 |
| 不做 DDS 式 QoS 映射（reliable/best-effort 等） | AUDESYS 的 Signal 天然 latest-value, StreamChannel 有 QueuePolicy。那是另一个维度，不混合 |
