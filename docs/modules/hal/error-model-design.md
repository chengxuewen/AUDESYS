# AUDESYS HAL 错误模型设计

> 生成日期：2026-07-15
> 设计目标：定义 HAL 通信原语的错误分类、处理策略、状态机转换和升级路径，确保错误处理可预测、可观测、可恢复

---

## 设计原则

1. **分层处理**：错误在产生它的层级处理，不泄露到上层抽象
2. **可恢复性优先**：能恢复的错误不升级，不能恢复的快速失败
3. **可观测性**：所有错误类型有唯一的错误码，配套 metrics 和 audit 记录
4. **RT 路径非阻塞**：错误处理不阻塞 RT 线程（SCHED_FIFO），错误升级走控制面

---

## 1. 错误分类与层级

```
HAL Error Hierarchy
│
├── E1: 类型错误 (TypeError)
│   ├── PayloadTypeMismatch    — Signal 写入类型与声明类型不匹配
│   └── IncompatibleUnion      — FlatBuffers union 解析失败
│
├── E2: 传输错误 (TransportError)
│   ├── PublishFailed          — publish_signal 写入失败
│   ├── SubscribeFailed        — subscribe_signal 注册失败
│   ├── StreamWriteFailed      — StreamChannel 写入失败
│   ├── StreamReadFailed       — StreamChannel 读取失败
│   └── Disconnected           — 传输层连接断开
│
├── E3: 资源错误 (ResourceError)
│   ├── QueueOverflow          — StreamChannel 队列溢出
│   ├── QueueFullBackpressure  — 反压模式下队列满
│   ├── BufferExhausted        — SHM 缓冲池耗尽
│   └── TooManySubscribers     — Signal 订阅者超限
│
├── E4: 发现错误 (DiscoveryError)
│   ├── SignalNotFound         — 订阅/读取不存在的 Signal
│   ├── StreamNotFound         — 打开不存在的 StreamChannel
│   ├── RegistrationConflict   — 同名 Signal 注册冲突
│   └── WatchFailed            — 发现 watch 注册失败
│
└── E5: 调度错误 (SchedulingError)
    ├── DeadlineViolated       — Signal 超过最大更新间隔
    ├── TickMissed             — RT 线程周期超时
    └── WatchdogTriggered      — 组件心跳丢失
```

```rust
/// 统一的 HAL 错误类型
#[derive(Clone, Debug, thiserror::Error)]
enum HalError {
    #[error("type mismatch: expected {expected}, got {actual}")]
    TypeError { expected: HalPinType, actual: HalPinType, signal: String },

    #[error("publish failed: {signal} — {reason}")]
    PublishFailed { signal: String, reason: String },

    #[error("stream write failed: {stream} — {reason}")]
    StreamWriteFailed { stream: String, reason: String },

    #[error("transport disconnected: {endpoint}")]
    Disconnected { endpoint: String },

    #[error("queue overflow: {stream} — dropped {dropped} messages")]
    QueueOverflow { stream: String, dropped: u64 },

    #[error("signal not found: {signal}")]
    SignalNotFound { signal: String },

    #[error("deadline violated: {signal} — last update {elapsed_ms}ms ago")]
    DeadlineViolated { signal: String, elapsed_ms: u64 },
}
```

---

## 2. Signal 写入失败处理

Signal 是单写多读的通信原语，写入失败通常发生在传输层（内存不足、UDS 断开、SHM 耗尽）。

### 本地写入（InProc）

```rust
impl AmwInproc {
    fn publish_signal(&self, name: &str, value: HalValue) -> Result<(), HalError> {
        let signal = self.signals.get(name).ok_or(
            HalError::SignalNotFound { signal: name.to_string() }
        )?;

        // 类型检查
        if value.pin_type() != signal.declared_type {
            return Err(HalError::TypeError {
                expected: signal.declared_type,
                actual: value.pin_type(),
                signal: name.to_string(),
            });
        }

        // 写入最新值
        *signal.last_value.lock() = Some(value);

        // 通知所有订阅者
        // ponytail: 同步调用，RT 线程内零延迟。订阅者回调内禁止阻塞
        let subscribers = signal.subscribers.lock().clone();
        for cb in subscribers {
            cb(signal.last_value.lock().as_ref().unwrap());
        }

        Ok(())
    }
}
```

### 写入失败恢复策略

| 失败原因 | 行为 | 恢复方式 |
|---------|------|---------|
| 类型不匹配 | 拒绝写入，返回 `TypeError` | 写入者修复类型声明或写入值 |
| Signal 不存在 | 拒绝写入，返回 `SignalNotFound` | 等待注册（动态发现场景）或修复配置 |
| 内存分配失败 | 丢弃写入，递增 `publish_dropped` metric | 下一周期重试（RT 路径不 panic） |
| 订阅者回调 panic | catch_unwind，隔离异常订阅者 | 移除该订阅者，记录 audit 事件 |

### 写入失败 metrics

```rust
struct SignalMetrics {
    /// 总写入次数
    publishes_total: AtomicU64,
    /// 失败的写入次数
    publishes_failed: AtomicU64,
    /// 类型不匹配次数
    type_mismatches: AtomicU64,
    /// 当前订阅者数
    active_subscribers: AtomicU32,
    /// 回调 panic 次数（隔离后累加）
    subscriber_panics: AtomicU64,
}
```

---

## 3. StreamChannel 溢出恢复

StreamChannel 有三种队列策略（`DropOldest`、`Backpressure`、`DropNewest`），溢出后的行为取决于策略选择。

### 状态机

```
                 ┌──────────────┐
                 │    Normal    │
                 │   (正常写入)  │
                 └──────┬───────┘
                        │
           ┌────────────┼────────────┐
           │            │            │
           ▼            ▼            ▼
    ┌───────────┐ ┌──────────┐ ┌──────────┐
    │DropOldest │ │DropNewest│ │Backpress │
    │ 丢弃最旧  │ │ 丢弃最新  │ │ 阻塞写入  │
    └─────┬─────┘ └────┬─────┘ └────┬─────┘
          │            │            │
          ▼            ▼            │
    ┌───────────┐ ┌──────────┐      │
    │ 丢弃回调  │ │ 丢弃回调  │      │
    │ on_drop() │ │ on_drop()│      │
    └─────┬─────┘ └────┬─────┘      │
          │            │            │
          └────────────┴────────────┘
                        │
                        ▼
                  ┌──────────────┐
                  │  Recovery    │
                  │ (队列有空位)  │
                  └──────┬───────┘
                         │
                         ▼
                  ┌──────────────┐
                  │    Normal    │
                  └──────────────┘
```

### 溢出通知

无论哪种策略，溢出时都会触发一个 `StreamOverflow` 告警 Signal：

```rust
struct StreamChannel {
    name: String,
    queue: VecDeque<StreamMessage>,
    config: StreamConfig,
    /// 溢出告警 Signal 名称（可选）
    overflow_signal: Option<String>,
    metrics: StreamMetrics,
}

impl StreamChannel {
    fn push(&mut self, msg: StreamMessage) -> Result<(), HalError> {
        if self.queue.len() < self.config.queue_depth as usize {
            self.queue.push_back(msg);
            return Ok(());
        }

        // 队列满，按策略处理
        match self.config.overflow_policy {
            OverflowPolicy::DropOldest => {
                self.queue.pop_front();
                self.queue.push_back(msg);
                self.metrics.dropped_oldest.fetch_add(1, Ordering::Relaxed);
                self.notify_overflow("drop_oldest");
            }
            OverflowPolicy::DropNewest => {
                // 直接丢弃新消息，不改队列
                self.metrics.dropped_newest.fetch_add(1, Ordering::Relaxed);
                self.notify_overflow("drop_newest");
            }
            OverflowPolicy::Backpressure => {
                // 写入者应该检查返回的 OverflowError 并等待
                return Err(HalError::StreamWriteFailed {
                    stream: self.name.clone(),
                    reason: "queue full, backpressure active".to_string(),
                });
            }
        }
        Ok(())
    }

    fn notify_overflow(&self, policy: &str) {
        if let Some(ref signal) = self.overflow_signal {
            // 写入告警 Signal，供监控系统消费
            // 该 Signal 在一段时间后自动复位
            // 使用 try_publish 避免告警本身失败
            let _ = self.amw.publish_signal(signal, HalValue::String(format!(
                "overflow:{}:dropped_at={}", policy, now_ms()
            )));
        }
    }
}
```

### 熔断保护

当 StreamChannel 的消费者连续失败时，触发熔断：

```rust
struct CircuitBreaker {
    /// 连续失败次数阈值
    max_consecutive_failures: u32,
    /// 冷却时间 (ms)
    cooldown_ms: u64,
    state: AtomicU8,  // 0=Closed, 1=Open, 2=HalfOpen
    failure_count: AtomicU32,
    last_open_ms: AtomicU64,
}

impl CircuitBreaker {
    fn record_failure(&self) {
        let count = self.failure_count.fetch_add(1, Ordering::Relaxed) + 1;
        if count >= self.max_consecutive_failures {
            self.state.store(1, Ordering::Release); // Open
            self.last_open_ms.store(now_ms(), Ordering::Release);
            // ponytail: 熔断后丢弃消息，不阻塞写入者
        }
    }

    fn is_open(&self) -> bool {
        if self.state.load(Ordering::Acquire) == 0 {
            return false; // Closed
        }
        let elapsed = now_ms() - self.last_open_ms.load(Ordering::Acquire);
        if elapsed >= self.cooldown_ms {
            // Half-Open: 允许一个试探消息
            self.state.compare_exchange(1, 2, Ordering::AcqRel, Ordering::Relaxed).ok();
            return false;
        }
        true
    }
}
```

---

## 4. 传输断开状态机

amw 传输层（UDS / Zenoh）可能因网络中断、对端进程崩溃、超时等原因断开。

```
                  ┌──────────────┐
                  │   Connected  │
                  │  (正常运行)   │
                  └──────┬───────┘
                         │ 连接断开或超时
                         ▼
                  ┌──────────────┐
                  │  Disconnected│
                  │  (触发重连)   │
                  └──────┬───────┘
                         │
            ┌────────────┼────────────┐
            │ 自动重连    │ 手动重连    │ 不重连
            ▼            ▼            ▼
     ┌───────────┐ ┌──────────┐ ┌──────────┐
     │Reconnecting│ │  Waiting │ │  Dead   │
     │ (指数退避) │ │(RPC触发)│ │(需重新加载)│
     └─────┬─────┘ └────┬─────┘ └──────────┘
           │            │
           └────────────┘
              成功重连
                  │
                  ▼
            ┌──────────────┐
            │   Connected  │
            │ (重新订阅)    │
            └──────────────┘
```

### 重连逻辑

```rust
#[derive(Clone, Debug, PartialEq)]
enum TransportState {
    Connected,
    Disconnected { since_ms: u64, retry_count: u32 },
    Reconnecting { attempt: u32, backoff_ms: u64 },
    Dead,
}

struct TransportReconnector {
    state: Mutex<TransportState>,
    max_retries: u32,           // 默认 10 次
    base_backoff_ms: u64,       // 默认 100ms
    max_backoff_ms: u64,        // 默认 30s
}

impl TransportReconnector {
    fn on_disconnect(&self) {
        let mut state = self.state.lock();
        *state = TransportState::Disconnected {
            since_ms: now_ms(),
            retry_count: 0,
        };
        // 触发重连
        self.schedule_reconnect();
    }

    fn schedule_reconnect(&self) {
        let mut state = self.state.lock();
        match *state {
            TransportState::Disconnected { retry_count, .. } if retry_count < self.max_retries => {
                let backoff = std::cmp::min(
                    self.base_backoff_ms * 2u64.pow(retry_count),
                    self.max_backoff_ms,
                );
                *state = TransportState::Reconnecting {
                    attempt: retry_count + 1,
                    backoff_ms: backoff,
                };
                // 在控制面线程上调度重连，不阻塞 RT 线程
                let _ = self.reconnect_tx.send(ReconnectCmd {
                    attempt: retry_count + 1,
                    backoff_ms: backoff,
                });
            }
            _ => {
                *state = TransportState::Dead;
            }
        }
    }

    fn on_reconnect_success(&self) {
        let mut state = self.state.lock();
        *state = TransportState::Connected;
        // 重新订阅所有 Signal
        // 重新打开 StreamChannel
        // 刷新发现缓存
    }
}
```

### 断开期间的数据策略

| 原语 | 断开期间行为 | 重连后行为 |
|------|-------------|-----------|
| Signal | 写入端继续覆盖最新值（内存缓冲区） | 读取端收到最新值，丢失中间值（Signal 语义） |
| StreamChannel | 写入端缓冲（有限），积压超限触发 DropOldest | 读取端从断点继续（如果配置了持久化），否则丢弃积压 |
| RPC | 调用立即返回 `Disconnected` 错误 | 调用者重试 |
| Discovery | 发现缓存冻结，不更新 | 刷新发现缓存，重新 watch |

---

## 5. 类型不匹配处理

类型不匹配发生在 HAL 的多个层次，从 FlatBuffers 解析到 Pin 级别的类型声明。

### 检测层次

```
层级 1: FlatBuffers 解析层
  └─ union 字段解析失败 → 抛出 IncompatibleUnion
  └─ 字段类型与 schema 不匹配 → 抛出 ParseError

层级 2: HalTransport 层
  └─ publish_signal 时 value 类型与 Signal 声明类型不匹配 → TypeError
  └─ StreamChannel 写入时元素类型与 StreamConfig 不匹配 → TypeError

层级 3: Pin 映射层
  └─ linkPin 时两个 Pin 类型不一致 → LinkError
  └─ 隐式类型转换请求不被支持 → ConversionError
```

### 类型转换规则

AUDESYS 不做隐式类型转换。类型不匹配永远是错误，不静默转换。

```rust
/// 检查两个 HalPinType 是否兼容
fn check_type_compatibility(
    declared: HalPinType,
    provided: HalPinType,
) -> Result<(), HalError> {
    match (declared, provided) {
        // 完全匹配
        (a, b) if a == b => Ok(()),
        // 特例：Blob 可以承载任何类型（但需要消费者协商格式）
        (HalPinType::Blob, _) => Ok(()),
        (_, HalPinType::Blob) => Ok(()),
        // 其他所有情况 → 拒绝
        (expected, actual) => Err(HalError::TypeError {
            expected,
            actual,
            signal: String::new(),
        }),
    }
}
```

### 类型不匹配的传播

```
Signal publish 时类型不匹配
  │
  ├─ 写入者：收到 TypeError 错误码
  │    └─ 写入者自行修复（或丢弃该次写入）
  │
  ├─ 读取者：不受影响，继续看到旧值
  │    └─ 读取者不感知类型不匹配事件
  │
  └─ 监控系统：metrics.type_mismatches 递增
       └─ Deadline 监控未触发（旧值未更新，但 Signal 未超时）
```

---

## 6. 错误升级路径

某些错误在可恢复范围内允许一定次数的重试，超过阈值后升级为更高严重级别。

### 升级阈值

| 错误类型 | 计数窗口 | 阈值 | 升级动作 |
|---------|---------|------|---------|
| PublishFailed | 60s | 10 次 | 日志 Warning → Error；通知 Supervisor |
| QueueOverflow | 60s | 5 次 | 日志 Info → Warning；扩容推荐 |
| TypeMismatch | 300s | 3 次 | 日志 Warning → Error；写入者隔离 |
| Disconnected | 300s | 3 次 | 自动重连 → 人工介入 |
| DeadlineViolated | 1 次 | 1 次 | 触发 RT 回调（紧急停机） |

### 升级实现

```rust
struct ErrorEscalator {
    counters: HashMap<ErrorKind, SlidingWindowCounter>,
    escalation_signal: Box<dyn Fn(ErrorKind, Severity) + Send + Sync>,
}

#[derive(Clone, Debug, PartialEq, Eq, Hash)]
enum ErrorKind {
    PublishFailed, QueueOverflow, TypeMismatch, Disconnected,
}

#[derive(Clone, Debug, PartialEq)]
enum Severity {
    /// 可恢复，仅记录 metrics
    Info,
    /// 需关注，写入 audit log
    Warning,
    /// 影响运行，通知 Supervisor
    Error,
    /// 安全相关，触发紧急停机
    Critical,
}

impl ErrorEscalator {
    fn record(&mut self, kind: ErrorKind) -> Severity {
        let count = self.counters.entry(kind).or_default();
        count.add(now_ms());

        let severity = match kind {
            ErrorKind::PublishFailed if count.rate() > 10.0 => Severity::Error,
            ErrorKind::QueueOverflow if count.rate() > 5.0 => Severity::Warning,
            ErrorKind::TypeMismatch if count.rate() > 3.0 => Severity::Error,
            ErrorKind::Disconnected => Severity::Critical,
            _ => Severity::Info,
        };

        if severity >= Severity::Warning {
            (self.escalation_signal)(kind, severity.clone());
        }
        severity
    }
}
```

### 升级通知路径

```
记录错误 → SlidingWindowCounter 计数
  │
  ├─ Info:    仅 metrics 递增，不产生额外事件
  ├─ Warning: 写入 audit log + 组件日志
  ├─ Error:   写入 audit log + 通知 Supervisor RPC
  │            Supervisor 决定是否替换组件或降级运行
  └─ Critical: 通知 Supervisor + 触发紧急停机 Signal
               (RT 路径：同一周期内同步写入紧急停机 Signal)
```

---

## 7. 错误码汇总

```yaml
hal_error_codes:
  E001: { name: TYPE_MISMATCH,          severity: Error,   recovery: automatic }
  E002: { name: SIGNAL_NOT_FOUND,       severity: Info,    recovery: automatic }
  E003: { name: STREAM_NOT_FOUND,       severity: Info,    recovery: automatic }
  E004: { name: PUBLISH_FAILED,         severity: Warning, recovery: retry }
  E005: { name: SUBSCRIBE_FAILED,       severity: Warning, recovery: retry }
  E006: { name: QUEUE_OVERFLOW,         severity: Warning, recovery: automatic }
  E007: { name: BACKPRESSURE_ACTIVE,    severity: Info,    recovery: backoff }
  E008: { name: DISCONNECTED,           severity: Error,   recovery: reconnect }
  E009: { name: REGISTRATION_CONFLICT,  severity: Error,   recovery: manual }
  E010: { name: DEADLINE_VIOLATED,      severity: Critical, recovery: immediate }
  E011: { name: BUFFER_EXHAUSTED,       severity: Error,   recovery: retry }
  E012: { name: CIRCUIT_BREAKER_OPEN,   severity: Warning, recovery: cooldown }
  E013: { name: WATCHDOG_TRIGGERED,     severity: Critical, recovery: restart }
  E014: { name: INCOMPATIBLE_UNION,     severity: Error,   recovery: automatic }
  E015: { name: TOO_MANY_SUBSCRIBERS,   severity: Info,    recovery: manual }
```

---

## 8. 设计决策记录

| 决策 | 理由 |
|------|------|
| 错误分层为五类（类型/传输/资源/发现/调度） | 每类错误有不同的处理策略和升级路径，分层后更清晰。TypeError 自动修复，TransportError 重连，SchedulingError 走紧急路径 |
| Signal 写入失败不通知订阅者 | 订阅者看到的是缓存的最新值，不是写入事件。写入失败不影响读取者，降低耦合 |
| StreamChannel 溢出通知复用告警 Signal | 复用现有 Signal 机制，监控系统无需额外适配。告警 Signal 自动复位，避免状态残留 |
| 传输断开用指数退避重连 | 工业网络中断通常是瞬时的（网线抖动、交换机重启），指数退避避免重连风暴。阈值 10 次后进入 Dead 状态，防止无限重连 |
| 类型不匹配不做隐式转换 | 隐式转换（S32→F64、U16→S32）可能在工业场景导致精度损失或溢出。显式错误让开发者更早发现配置问题 |
| 错误升级使用 SlidingWindowCounter | 固定窗口计数器在窗口边界可能漏掉高密度错误。滑动窗口更准确反映当下错误率 |
| RT 回调不处理错误恢复 | RT 线程（SCHED_FIFO）不能执行阻塞操作（重连、磁盘 I/O、RPC 调用）。错误恢复全部在控制面执行 |
| Phase 1 熔断默认关闭 | 单进程（InProc）场景下消费者失败不会影响其他消费者。跨进程场景（Phase 2+）才需要熔断保护 |