# AUDESYS HAL 详细设计

> 合并日期：2026-07-09
> 由 10 份独立设计文档合并而成；架构概览见 docs/architecture.md §一

---

## 1. 设计原则与通信原语

### 1.1 设计原则

AUDESYS HAL 协议不桥接外部协议——它本身是一个足够表达力的原生协议。移植 LinuxCNC、OpenPLC、ROS2、dora-rs 功能时，被移植的代码改造后以 AUDESYS HAL 为原生通信层。

**核心理念：用最少数量的正交原语，覆盖四种系统的全部通信模式。**

```
┌─────────────────────────────────────────────────┐
│              AUDESYS HAL Protocol               │
│                                                 │
│  ┌──────────┐  ┌──────────────┐  ┌───────────┐ │
│  │  Signal  │  │ StreamChannel│  │    RPC    │ │
│  │          │  │              │  │           │ │
│  │ 单写多读 │  │ 多写多读      │  │ 请求/回复  │ │
│  │ 周期刷新 │  │ 缓冲 + 反压  │  │ 超时 + 幂等│ │
│  │ 低延迟  │  │ 高吞吐       │  │ 低频      │ │
│  └────┬─────┘  └──────┬───────┘  └─────┬─────┘ │
│       │               │                │       │
│  ┌────┴───────────────┴────────────────┴─────┐  │
│  │           统一类型系统 (14 种)              │  │
│  │  + 定长标量 (8/16/32/64 bit)               │  │
│  │  + 变长 String / Blob / Array<T>          │  │
│  └──────────────────────┬────────────────────┘  │
│                         │                       │
│  ┌──────────────────────┴────────────────────┐  │
│  │         amw (AUDESYS Middleware)           │  │
│  │  HalTransport + HalDiscovery + HalQoS     │  │
│  └──────────────────────┬────────────────────┘  │
│                         │                       │
│  ┌───────┬──────────────┼──────────────┬──────┐ │
│  │InProc │  amw_zenoh   │  amw_dds     │ amw_*│ │
│  │Phase1 │  Phase2+     │  (未来)       │(未来)│ │
│  └───────┴──────────────┴──────────────┴──────┘ │
└─────────────────────────────────────────────────┘
```

### 1.2 Signal — 控制信号

控制信号的基元。单写多读，无缓冲（新值覆盖旧值），设计目标是**最低可能延迟**。

```yaml
Signal:
  writers: 1                # 只能有一个写入者
  readers: 1..N             # 任意数量的读取者
  semantics: latest-value   # 只保留最新值，读不到历史
  consumer_modes:
    - push: "subscribe 注册回调，publish 时同步调用 (RT 线程，零延迟)"
    - pull: "read_signal 读取最新缓存 (Supervisor/HMI，按自定频率)"
    - pull_batch: "snapshot_signals 批量快照 (监控面板，通配符匹配)"
  buffer: none              # 无队列缓冲
  update_model: push        # 写入者写入时推送给所有读取者
  typical_size: < 1KB
  typical_latency:
    InProc:   < 1μs    (Typed API, 无序列化, 同进程)
    UDS:      ~10μs   (6–30μs, PREEMPT_RT, <1KB 消息)
    Zenoh:    ~100μs  (50–500μs, 1Gbps 以太网, <64KB)
  use_cases:
    - 轴位置、速度、加速度
    - 温度传感器读数
    - 限位开关状态
    - 数字 I/O 点
    - 配置参数变更通知
```

### 1.3 StreamChannel — 数据流

面向高吞吐、多生产者/多消费者的数据通道。有缓冲队列，支持反压。

```yaml
StreamChannel:
  writers: 1..N             # 允许多个写入者
  readers: 1..N             # 允许多个读取者
  semantics: ordered-queue  # 按序缓冲，可配置深度
  queue_policies:
    DropOldest:    "队列满时丢弃最旧消息"
    Backpressure:  "队列满时阻塞写入者"
    DropNewest:    "队列满时丢弃最新消息"

  # 故障保护 (dora-rs 参考)
  error_policy:
    on_consumer_error: Notify   # Block | Drop | Notify
                                 # Notify: 丢弃消息 + Signal 告警

  circuit_breaker:
    enabled: false               # Phase 1-2 默认关闭
    max_consecutive_failures: 3
    cooldown_ms: 5000
    on_open: Notify              # 熔断时: Notify | Panic | Ignore

  typical_size: 1B ~ 100MB
  shm_threshold: 4KB        # >= 4KB 走 Zenoh SHM 零拷贝
  typical_throughput: 100+ MB/s (Zenoh SHM)
  use_cases:
    - 点云数据 (LiDAR)
    - 图像流 (Camera)
    - 高速采样数据 (ADC time series)
    - 日志流
    - 示波器波形数据
```

### 1.4 RPC — 请求/回复

用于配置命令、服务调用等需要请求-回复语义的场景。

```yaml
RPC:
  pattern: request/reply
  request_id: auto-increment u64
  timeout: configurable per-call (default 5000ms)
  idempotency: optional boolean flag
    - true:  配置操作，可安全重试
    - false: 控制操作，不可重试
  use_cases:
    - 加载/卸载/配置组件
    - 动态创建 Signal 和 StreamChannel
    - 查询组件状态 (getSnapshot)
    - ROS2 service 等效调用
    - LinuxCNC halcmd 等效命令
```

### 1.5 原语对比表

ROS2 社区花了十年验证的教训：控制信号和流数据是**两类不同的东西**。

| | Signal | StreamChannel |
|---|---|---|
| 写入者 | 1 个 | N 个 |
| 缓冲 | 无（最新值覆盖） | 有（队列，可配置深度） |
| 丢失策略 | 不支持（总是覆盖） | DropOldest / Backpressure / DropNewest |
| 典型大小 | < 1KB | 1B ~ 100MB |
| 谁需要 | LinuxCNC, OpenPLC, ROS2 控制 | ROS2 感知, dora-rs, 数据采集 |

合并会导致：Signal 场景被 Stream 的缓冲开销拖慢（不可接受），或者 Stream 场景被 Signal 的覆写语义吃掉数据（更不可接受）。

---

## 2. amw 中间件抽象层

### 2.1 设计目标

参考 ROS2 `rmw`（ROS Middleware）的设计哲学，AUDESYS 定义 `amw`（AUDESYS Middleware）抽象层，将 HAL 的三种通信原语和发现机制与具体传输实现解耦。换实现不换 API，为未来替换 Zenoh（如 DDS、MQTT）预留空间。

amw 由三个平级 trait 组成：
- **HalTransport**：数据面 — Signal / StreamChannel / RPC 的底层运输
- **HalDiscovery**：控制面 — Signal / StreamChannel 的注册与查找
- **HalQoS**：服务面 — Deadline / Liveliness / Security Domain（详见 §3）

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
│(Phase 1) │ │ (Phase 2+) │ │  DDS / MQTT   │
└──────────┘ └────────────┘ └───────────────┘
```

### 2.2 HalTransport — 传输抽象（数据面）

```rust
/// 传输抽象 — 数据面：Signal / StreamChannel / RPC 的底层运输
trait HalTransport: Send + Sync {
    // ═══ Signal: 单写多读，最新值覆盖 ═══
    fn publish_signal(&self, name: &str, value: HalValue) -> Result<()>;
    fn subscribe_signal(
        &self, name: &str, cb: SignalCallback
    ) -> Result<Subscription>;

    // Pull: 读取最新值，不注册回调（Supervisor/HMI）
    fn read_signal(
        &self, name: &str
    ) -> Result<Option<(HalValue, Timestamp)>>;

    // Pull batch: 批量快照（通配符匹配）
    fn snapshot_signals(
        &self, pattern: &str
    ) -> Result<Vec<(String, HalValue, Timestamp)>>;

    // ═══ StreamChannel: 多写多读，有缓冲 ═══
    fn create_stream(
        &self, name: &str, cfg: StreamConfig
    ) -> Result<Box<dyn StreamWriter>>;
    fn open_stream(
        &self, name: &str
    ) -> Result<Box<dyn StreamReader>>;

    // ═══ RPC: 请求/回复 ═══
    fn expose_rpc(
        &self, method: &str, handler: RpcHandler
    ) -> Result<()>;
    fn call_rpc(
        &self, method: &str, params: &[u8], timeout_ms: u64
    ) -> Result<Vec<u8>>;
}

type SignalCallback = Box<dyn Fn(&HalValue, Timestamp) + Send + Sync>;
type RpcHandler    = Box<dyn Fn(&[u8]) -> Result<Vec<u8>> + Send + Sync>;
```

### 2.3 HalDiscovery — 发现抽象（控制面）

```rust
/// 发现抽象 — 控制面：Signal / StreamChannel 的注册与查找
trait HalDiscovery: Send + Sync {
    fn register(
        &self, kind: PrimitiveKind, name: &str, meta: Metadata
    ) -> Result<()>;
    fn unregister(
        &self, kind: PrimitiveKind, name: &str
    ) -> Result<()>;
    fn lookup(
        &self, kind: PrimitiveKind, pattern: &str
    ) -> Vec<DiscoveryEntry>;
    fn watch(
        &self, kind: PrimitiveKind, pattern: &str,
        cb: DiscoveryCallback
    ) -> Result<WatchHandle>;
}

#[derive(Clone, Debug)]
enum PrimitiveKind { Signal, StreamChannel }

struct DiscoveryEntry {
    name: String,
    kind: PrimitiveKind,
    type_info: HalPinType,
    transport: String,        // "inproc" | "zenoh" | ...
    transport_handle: String, // UDS 路径或 Zenoh keyexpr
    metadata: Metadata,       // 描述、单位、范围等
}

type DiscoveryCallback = Box<dyn Fn(DiscoveryEvent) + Send + Sync>;
enum DiscoveryEvent { Added(DiscoveryEntry), Removed(DiscoveryEntry) }
```

### 2.4 AmwFactory — 统一入口

```rust
/// 工厂 trait — 每个 amw 实现提供一个工厂
trait AmwFactory: Send + Sync {
    fn create(&self, config: AmwConfig) -> Result<Box<dyn AmwMiddleware>>;
    fn name(&self) -> &str;  // "inproc" | "zenoh" | "dds" | ...
}

/// 组合 trait — 使用时取这个（含三极：Transport + Discovery + QoS）
trait AmwMiddleware: HalTransport + HalDiscovery + HalQoS {
    fn shutdown(&self) -> Result<()>;
    fn metrics(&self) -> AmwMetrics;
}
```

### 2.5 分阶段实现

| 阶段 | amw 实现 | 发现 | 传输 |
|------|---------|------|------|
| Phase 1 | `amw_inproc` | 无（Component 编译时已知，直接 Typed API） | InProcess，无序列化 |
| Phase 2 | `amw_zenoh` | Zenoh 键值存储（`hal/registry/signal/**`） | UDS + FlatBuffers |
| Phase 3 | `amw_zenoh`（同） | Zenoh 键值存储（跨机） | Zenoh TCP |
| Phase 4 | `amw_zenoh`（同） | Zenoh 键值存储（同） | Zenoh SHM |

**发现流示例（Zenoh）**：

```rust
// Component A 启动时 — 注册
let amw: Box<dyn AmwMiddleware> = zenoh_factory.create(config)?;
amw.register(Signal, "motion.axis.0.pos", Metadata {
    hal_type: HalPinType::F64,
    unit: Some("mm"),
    ..Default::default()
})?;

// Component B 启动时 — 查找并订阅
let entries = amw.lookup(Signal, "motion/**");
for e in entries {
    amw.subscribe_signal(&e.name, signal_callback)?;
}

// 动态等待新增 — watch 回调
amw.watch(Signal, "motion/**", Box::new(|event| match event {
    Added(entry)  => { amw.subscribe_signal(&entry.name, cb).ok(); }
    Removed(entry) => { /* Component A 挂了，清理 */ }
}))?;
```

**为什么不用 Supervisor 做注册中心**：单机模型下可行，但 Phase 3 跨机时 Supervisor 成为瓶颈。`amw_zenoh` 从 Phase 2 就接入 Zenoh，Phase 1→2→3→4 无架构迁移。

---

## 3. 工业 QoS

### 3.1 设计原则

工业控制系统的 QoS 不是 DDS 的 reliable/best-effort/durability——那是面向消息中间件的概念。工业 QoS 的核心是三件事：

1. **数据时效**：编码器还能工作吗？（Deadline）
2. **设备存活**：设备还连着吗？（Liveliness）
3. **安全隔离**：cell_1 的数据安全吗？（Security Domain）

三者执行层级不同（RT 数据面、非 RT 控制面、静态配置面），但概念上属于同一个关注面：**服务质量**。用单一 `HalQoS` trait 统一，不让它们散落在不同模块。

### 3.2 HalQoS trait

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

### 3.3 各实现差异化

| | amw_inproc | amw_zenoh | amw_dds (未来) |
|---|---|---|---|
| **Deadline** | RT 线程内 tick 计时器 | Zenoh 内置 timer + callback | DDS Deadline QoS |
| **Liveliness** | 无意义（同进程共享生命周期）| Zenoh `liveliness::declare_token` | DDS Liveliness QoS |
| **Security Domain** | 无意义（同进程天然隔离）| keyexpr 前缀 `{domain}/` | DDS Partition |

### 3.4 amw_zenoh Deadline 实现

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

### 3.5 amw_inproc Deadline 实现

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

### 3.6 使用示例

**编码器 Deadline 监控**：

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

**急停按钮 Liveliness**：

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

**多产线 Security Domain 隔离**：

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

## 4. 类型系统

### 4.1 最终类型系统：14 种

IEC 61131-3 有 22 种类型，AUDESYS HAL 最终映射为 14 种：

```
HALValue (FlatBuffers union) {

  // ═══ 标量（11 种） ═══
  Bool       // IEC: BOOL  |  LinuxCNC: HAL_BIT
  S8         // IEC: SINT
  U8         // IEC: USINT, BYTE
  S16        // IEC: INT
  U16        // IEC: UINT, WORD
  S32        // IEC: DINT  |  LinuxCNC: HAL_S32  |  IEC TIME → S32
  U32        // IEC: UDINT, DWORD  |  LinuxCNC: HAL_U32, HAL_PORT  |  IEC DATE/TOD → U32
  S64        // IEC: LINT  |  LinuxCNC: HAL_S64
  U64        // IEC: ULINT, LWORD  |  LinuxCNC: HAL_U64  |  IEC DT → U64
  F32        // IEC: REAL  |  LinuxCNC: HAL_FLOAT
  F64        // IEC: LREAL


  // ═══ 变长容器（3 种） ═══
  String     // UTF-8 字符串（格式: u32 byte_length + u8[byte_length]，与 Blob 同构）
             //   - 报警消息
             //   - 设备名称
             //   - 配方名称
             //   - 操作提示
             //   HMI/Panel 直接消费，不解析为二进制

  Blob       // 裸字节块（格式: u32 length + u8[length] payload）
             //   - OpenPLC image table (IEC_BOOL*[BUFFER_SIZE][8])
             //   - dora-rs Arrow IPC buffer
             //   - 自定义协议帧 (Modbus PDU, CAN frame)
             //   - 无 schema 的二进制载荷
             //   Zero-copy: Zenoh SHM

  Array<T>   // 同构批量数组（格式: u32 pad(4B) + u32 count + T[count] elements）
             //   pad 保证 T[0] 在 8 字节边界对齐（F64 需要）
             //   - ROS2 sequence<float64> (批量关节角)
             //   - 多轴位置同步 (6 轴 F64 × N 步)
             //   - 高速采样时序列 (1000 个 ADC 读数)
             //   - OpenPLC rack I/O 映像 (批量 S32)
}
```

### 4.2 IEC 61131-3 完整映射

#### 4.2.1 数值/位类型（11 种）→ 全部直接映射

| IEC 类型 | AUDESYS HAL 类型 | 理由 |
|----------|-----------------|------|
| BOOL | `Bool` | 1:1 |
| SINT | `S8` | 语义等价 |
| USINT / BYTE | `U8` | USINT=值, BYTE=位串, 同宽 |
| INT | `S16` | 语义等价 |
| UINT / WORD | `U16` | 同上 |
| DINT | `S32` | 语义等价 |
| UDINT / DWORD | `U32` | 同上 |
| LINT | `S64` | 语义等价 |
| ULINT / LWORD | `U64` | 同上 |
| REAL | `F32` | 语义等价 |
| LREAL | `F64` | 语义等价 |

**总计：11 IEC 类型 → 11 AUDESYS 标量类型，一个不差。**

#### 4.2.2 字符串类型：只加 STRING，不加 WSTRING

STRING 在 PLC 生态中是**一等类型**。HMI 面板直接显示来自 PLC 的 STRING 变量值：报警消息、设备名称、配方名称、操作提示。这些信息必须穿透 HAL 到达 HMI/Panel，HAL 需要知道"这是一个可显示的文本"。

如果像 Blob 那样不区分语义，HMI 收到 `Blob` 后不知道是该显示为文本还是当作二进制帧丢弃。

**典型场景**：
```
Signal<String> "conveyor.alarm.message"   →  HMI Panel 直接显示
Signal<String> "batch.recipe_name"        →  Studio 编辑器显示
Signal<Blob>   "camera.jpeg_frame"        →  图像解码器消费（HAL 不感知）
```

STRING 和 Blob 的位布局相同（`u32 length + u8[] data`），但**语义标签不同**——消费端据此区别对待。

**为什么不加 WSTRING**：
- AUDESYS 统一用 UTF-8 编码（ASCII 兼容 + 支持中文/日文/韩文）
- 需要 UTF-16 的场景（Windows legacy COM 接口等）由消费端自行转换
- 减少 FlatBuffers schema / Rust HalType / Thin Client 三层的类型爆炸

#### 4.2.3 时态类型：全部用现有数值类型映射，不加

核心洞察：TIME、DATE、TOD、DT 在运行时都是**编码后的整数**，HAL 传输层不需要感知它们是"时间"。

| IEC 类型 | 内部存储 | AUDESYS 映射 | 精度 | 理由 |
|----------|---------|-------------|------|------|
| TIME | i32 (ms) | `S32` | 1ms | OpenPLC 用 `unsigned long long common_ticktime__` (ns)，TwinCAT 用 100ns ticks。不同运行时表示不同，HAL 不应绑定单一解释 |
| DATE | u16 (days since 1984-01-01) | `U32` | 1 天 | 足够 |
| TOD | u32 (ms since midnight) | `U32` | 1ms | 足够 |
| DT | u32 date + u32 tod | `U64` (Unix epoch ms) | 1ms | 统一 epoch 避免各厂商混乱（Rockwell 用 1970, Siemens 用 1990, B&R 用 2000） |

不加原生时态类型的理由：
1. 不同 PLC 运行时对 TIME/DATE 的内部表示不同（IEC 61131-3 只规定行为，不规定 bit layout）
2. 如果在 HAL 层添加 TIME 类型，则 FlatBuffers schema、Rust HalType、Python Thin Client、Node.js Thin Client 全部需要新增序列化/反序列化逻辑
3. 类型转换逻辑应由 IEC 运行时层统一处理（`TIME → S64(ns) → TIME`），而不是散落在 HAL 的每一层
4. 如果你需要在 Studio 中显示 "T#500ms" 而非 "500000000"，这是 Studio 的渲染职责，不是 HAL 的传输职责

#### 4.2.4 完整映射表

| IEC 61131-3 | AUDESYS HAL |
|-------------|------------|
| BOOL | `Bool` |
| SINT | `S8` |
| USINT | `U8` |
| BYTE | `U8` |
| INT | `S16` |
| UINT | `U16` |
| WORD | `U16` |
| DINT | `S32` |
| UDINT | `U32` |
| DWORD | `U32` |
| LINT | `S64` |
| ULINT | `U64` |
| LWORD | `U64` |
| REAL | `F32` |
| LREAL | `F64` |
| STRING | `String` ⬅︎ 新增 |
| WSTRING | `String` 统一 UTF-8，消费端自行转换 |
| TIME | `S32` (ms) 或 `S64` (ns)，运行时层映射 |
| DATE | `U32` (days since epoch) |
| TIME_OF_DAY | `U32` (ms since midnight) |
| DATE_AND_TIME | `U64` (Unix epoch ms) |

### 4.3 String / Blob / Array 决策

**为什么加 Blob？**

OpenPLC 的 image table 本质是 `IEC_BOOL *bool_input[1024][8]`——一块位图，不是结构化数据。如果 HAL 要求逐个 Pin 映射，1024 × 8 = 8192 个 `Bool` Signal，太重。`Blob` 让移植的 OpenPLC runtime 说："这块 8KB 内存是 rack 0 的输入映像"，然后通过共享内存直接读，不需要逐个 pin 穿越 HAL。

dora-rs 的 Arrow IPC buffer 同理——格式由上游协商，HAL 不解析，只负责传输。

**为什么加 Array<T>？**

三个场景需要批量传输：

1. **ROS2 `sequence<float64>`**：64 个关节角批量发布，一条消息搞定
2. **多轴位置同步**：6 轴 RT 周期内原子更新，不能拆开
3. **高速采样**：1ms 采集 1000 个 ADC 读数，一条 `Array<U16>` 而非 1000 个 Signal

**为什么加 String？**

和 Blob 语义不同（文本 vs 不透明字节），HMI 需区分。

**BYTE/WORD/DWORD/LWORD 为什么不独立？**

HAL 值有类型但无修饰符，位串语义由消费端维护。位级访问不进入 HAL 类型系统——PLC 的 `%MW0.3`（WORD bit 3）由 Studio compiler 映射为独立 `Signal<Bool>`，HAL 不感知位偏移。

**RETAIN 变量不在 HAL 层**：持久化由 Component 自行管理（文件/SQLite），HAL 只传输运行时值。

---

## 5. 线程调度

### 5.1 参考系统分析

#### 5.1.1 LinuxCNC — 显式有序函数列表

LinuxCNC 的 HAL 线程模型是所有参考系统中**最接近 AUDESYS 需求的**。

**数据结构**：

```c
// hal_priv.h — LinuxCNC 内核数据结构
typedef struct {
    hal_list_t links;               // 双向循环链表节点
    void *funct;                    // 函数指针
    void *arg;                      // 函数参数
    hal_compiled_funct_t *funct_ptr; // 函数对象引用
    hal_thread_t *owner;            // 所属线程
} hal_funct_entry_t;

typedef struct {
    hal_list_t links;
    hal_list_t *funct_list;         // 函数入口链表头
    int uses_fp;                    // 是否使用浮点
    long int period;                // 线程周期 (ns)
    int priority;                   // RT 优先级 (SCHED_FIFO)
    int task_id;                    // RTAPI task ID
    long int runtime;               // 本轮执行时间 (ns)
    long int maxtime;               // 最大执行时间 (ns)
} hal_thread_t;
```

**执行顺序**：`hal_add_funct_to_thread(name, thread, position)` 将函数插入 `funct_list` 链表指定位置。运行时严格按链表顺序执行，无优先级中断。

```c
// hal_lib.c — 线程主循环
for (funct_entry = thread->funct_list;
     funct_entry != NULL;
     funct_entry = funct_entry->next) {
    start = rtapi_get_time();
    funct_entry->funct(funct_entry->arg);
    stop = rtapi_get_time();
    funct_entry->runtime = stop - start;  // 测量执行时间
}
```

**周期约束**：线程周期必须是基周期的整数倍，采用 Rate Monotonic 调度分析。

**Reentrant 标志**：`reentrant=0` → 函数只能属于一个线程（默认安全）；`reentrant≠0` → 可加入多个线程（用户需自行保证线程安全）。

**动态调整**：`halcmd` 在运行时通过共享内存增删函数、修改线程配置。

**过运行检测**：暴露为 HAL pin（线程 runtime / maxtime），不触发主动动作。

#### 5.1.2 ROS2 — 优先级轮询 + ros2_control 绕行

ROS2 有三种执行器，其中 `EventsCBGExecutor` 是现代 RT 版本：

| 执行器 | 模型 | RT 适用性 |
|--------|------|-----------|
| `SingleThreadedExecutor` | 单线程轮询 wait_set | ❌ |
| `MultiThreadedExecutor` | N 线程共享锁，回调组控制并发 | ⚠️ 优先反转风险 |
| `EventsCBGExecutor` | 事件驱动，可插拔调度器 | ✅ 最佳 |

**ROS2 的回调组不提供顺序保证**。官方文档明确声明：
> "callbacks in the executor are no longer ordered consistently, even within the same entity."

`get_next_ready_executable` 按 `timers → subscriptions → services → clients → waitables` 优先级选下一个执行项，但这是一个**类别优先级**而不是**身份优先级**。

**ros2_control 的关键洞察**：**绕过 ROS 执行器，在专用 RT 线程上运行 read→update→write 管线**：

```cpp
// ros2_control_node.cpp — 专用 RT 线程
std::thread cm_thread([cm, thread_priority]() {
    realtime_tools::configure_sched_fifo(thread_priority);  // SCHED_FIFO 50
    while (rclcpp::ok()) {
        cm->read(time, period);      // 读所有硬件状态
        cm->update(time, period);    // 顺序执行所有控制器
        cm->write(time, period);     // 写所有命令
        sleep_for_periodic_cycle();  // 频率调节（含过运行跳过）
    }
});
```

控制器 `update()` 顺序 = 加载顺序。支持子步进（不同控制器不同更新率）。

**过运行处理**：跳过迟到周期、追赶至当前时间。无 watchdog 复位。

#### 5.1.3 OpenPLC v3 — 单线程扫描周期 + I/O 屏障

```c
// main.cpp — OpenPLC 主循环
clock_gettime(CLOCK_MONOTONIC, &cycle_start);

updateBuffersIn();              // 读物理 I/O → 输入映像
updateBuffersIn_MB();           // 读 Modbus 从站 → 输入映像

pthread_mutex_lock(&bufferLock);     // ═══ 扫描屏障 ═══
    config_run__(__tick++);          // 执行全部 PLC 逻辑
pthread_mutex_unlock(&bufferLock);   // ═══ 扫描屏障 ═══

updateBuffersOut_MB();          // 写输出映像 → Modbus 从站
updateBuffersOut();             // 写输出映像 → 物理 I/O

sleep_until(&timer_start, common_ticktime__);  // 绝对时间睡眠
```

**关键设计**：`bufferLock` 是**扫描屏障**——保证 PLC 逻辑执行期间，I/O 映像不被后台线程（Modbus server、Web server）修改。这是工业 PLC 几十年的核心特性。

**单任务限制**：OpenPLC v3 无多任务调度，所有用户代码编译为单个 C 函数 `config_run__()`。

**过运行**：仅有诊断日志（cycle max/min/avg），不触发主动响应。`SCHED_FIFO 30` + `mlockall` 做基本 RT 加固。

#### 5.1.4 dora-rs — 数据驱动，无固定周期

dora-rs 是**事件驱动**的：operator 进程从 `EventStream` 读取输入事件，有数据到达时才执行，不存在固定周期。

```rust
// 典型 operator 主循环
while let Some(event) = event_stream.next().await {
    match event {
        Event::Input { id, data, metadata } => {
            let output = process(data);
            outputs.send(output)?;
        }
        Event::Stop(_) => break,
    }
}
```

**执行顺序**：无全局顺序保证。数据流 DAG 通过 YAML 描述符定义路由，但独立 operator 之间无调度排序。

**`--rt` 标志**：仅影响 daemon 主线程（`SCHED_FIFO 50`），不影响 operator 进程。CPU 亲和性通过 `cpu_affinity: [0, 1]` 逐节点声明。

**反压机制**：`QueuePolicy::DropOldest`（默认队列容量 10，满则丢弃最早）+ `QueuePolicy::Backpressure`。

### 5.2 四系统对比矩阵

| | LinuxCNC | ROS2 | OpenPLC v3 | dora-rs |
|---|---|---|---|---|
| **调度模型** | 显式有序函数列表 | 优先级轮询 + 回调组 | 单线程扫描周期 | 数据驱动，无周期 |
| **确定性** | ✅ 高（顺序显式） | ⚠️ 低（最佳努力） | ✅ 高（固定顺序） | ❌ 无保证 |
| **多任务** | ✅ N 线程，整数倍周期 | ✅ MultiThreadedExecutor | ❌ 单任务 | ✅ N 进程 |
| **I/O 屏障** | ❌ 无（信号即写即读） | ❌ 无 | ✅ bufferLock | ❌ 无 |
| **过运行处理** | ✅ 暴露 runtime pin | ✅ 跳过周期 + 追赶 | ❌ 仅诊断日志 | ✅ DropOldest 反压 |
| **动态调整** | ✅ halcmd 运行时 | ❌ 重启生效 | ❌ 编译时固定 | ✅ YAML 重新加载 |
| **函数/组件来源** | C 函数指针 | C++ 回调 | MatIEC 生成的 C | Rust async fn |
| **跨实体通信** | 共享内存 Signal | DDS topic | 单线程无需 | daemon 消息路由 |
| **周期约束** | 基周期整数倍 | 无 | 单个 tick | 无 |

### 5.3 AUDESYS 混合方案

**设计原则**：

1. **控制路径**（RT 线程）：确定性优先 — 借鉴 LinuxCNC 显式函数列表 + ROS2 control 管线
2. **I/O 路径**（I/O 线程）：一致性优先 — 借鉴 OpenPLC 扫描屏障（详见 §6）
3. **数据流路径**（Stream Worker）：吞吐优先 — 借鉴 dora-rs 事件驱动
4. **配置路径**（RPC）：安全优先 — 借鉴 LinuxCNC halcmd 动态调整（详见 §7）

**架构总览**：

```
┌──────────────────────────────────────────────────────────┐
│                  AUDESYS Thread Model                    │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  RT 线程 (SCHED_FIFO, CPU pin, mlockall)          │   │
│  │                                                    │   │
│  │  每个周期:                                         │   │
│  │  1. read_barrier()       ← OpenPLC 扫描屏障       │   │
│  │     ├─ 快照所有 IN Signal（冻结至本地缓存）        │   │
│  │     ├─ 锁定 I/O 映像表（阻塞 I/O 线程写入）       │   │
│  │     └─ 释放 I/O 锁                                │   │
│  │                                                    │   │
│  │  2. for func in funct_list:  ← LinuxCNC 显式顺序  │   │
│  │       result = func.update() ← ROS2 control 管线  │   │
│  │       if error: log & escalate                    │   │
│  │                                                    │   │
│  │  3. write_barrier()      ← OpenPLC 扫描屏障       │   │
│  │     ├─ 原子发布所有 OUT Signal（一次性推）        │   │
│  │     ├─ 锁定 I/O 映像表                            │   │
│  │     ├─ 写入变更到 I/O 映像                        │   │
│  │     └─ 释放 I/O 锁                                │   │
│  │                                                    │   │
│  │  4. sleep_until(next_period)                       │   │
│  │     ├─ 如果过运行: 跳过迟到周期 + ALARM Signal   │   │
│  │     └─ 测量耗时 → 暴露为 Signal (thread.runtime)  │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  I/O 线程 (tokio async, 事件驱动)                │   │
│  │  - 驱动通信 (Modbus, CAN, EtherCAT, ...)         │   │
│  │  - 写入共享 I/O 映像表                            │   │
│  │  - 数据驱动，事件触发 ← dora-rs 风格              │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Stream Worker Pool (线程池)                      │   │
│  │  - 高吞吐数据流 (点云, 图像, 高速采样)           │   │
│  │  - 事件驱动，无固定周期 ← dora-rs 风格            │   │
│  │  - 反压: QueuePolicy (DropOldest/Backpressure)    │   │
│  └──────────────────────────────────────────────────┘   │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Supervisor 线程 (Node.js)                        │   │
│  │  - 进程生命周期管理                               │   │
│  │  - 配置热加载                                     │   │
│  │  - HAL 快照订阅 (100ms 间隔)                      │   │
│  └──────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

### 5.4 核心数据结构

```rust
// controller/hal-core/src/thread.rs

/// 线程配置
struct HalThread {
    name: String,
    period_us: u32,
    priority: i32,
    cpu_affinity: Vec<i32>,
    is_base_period: bool,           // 是否为基周期（其他线程周期 = N × 此值）
    functions: Vec<ThreadFunction>, // ← 有序列表，LinuxCNC funct_list
    state: ThreadState,
    metrics: ThreadMetrics,
}

/// 线程中的单个函数入口
struct ThreadFunction {
    component: String,              // 组件名
    phase: FunctionPhase,           // read / update / write
    after: Vec<String>,             // 可选依赖声明
}

enum FunctionPhase {
    Read,                           // read_barrier 内
    Update,                         // 计算阶段
    Write,                          // write_barrier 内
}

enum ThreadState {
    Created,
    Running,
    Overrun { skipped_cycles: u64 },
    Error { message: String },
    Stopped,
}

struct ThreadMetrics {
    runtime_ns: u64,                // 本轮耗时
    runtime_max_ns: u64,            // 历史最大
    overrun_count: u64,             // 累计过运行次数
    cycle_count: u64,               // 累计周期数
}
```

### 5.5 线程主循环实现

```rust
// controller/hal-core/src/thread.rs

impl HalThread {
    fn run(&mut self, hal: &HalCore, image_table: &IoImageTable) {
        // 设置 RT 调度
        configure_sched_fifo(self.priority)?;
        mlockall(MCL_CURRENT | MCL_FUTURE)?;
        pin_to_cpus(&self.cpu_affinity)?;

        let period = Duration::from_micros(self.period_us as u64);
        let mut next_wake = Instant::now();

        while self.state == ThreadState::Running {
            // ═══ Phase 1: Read Barrier ═══
            let snapshot = image_table.lock_read()?;
            for func in self.functions.iter().filter(|f| f.phase == FunctionPhase::Read) {
                let comp = hal.get_component(&func.component)?;
                comp.read()?;
            }
            drop(snapshot);

            // ═══ Phase 2: 按 funct_list 顺序执行 ═══
            for func in self.functions.iter().filter(|f| f.phase == FunctionPhase::Update) {
                let t0 = Instant::now();
                let comp = hal.get_component(&func.component)?;
                let result = comp.update();
                self.metrics.runtime_ns += t0.elapsed().as_nanos() as u64;

                if let Err(e) = result {
                    log::error!("Component {} update failed: {}", func.component, e);
                }
            }

            // ═══ Phase 3: Write Barrier ═══
            let mut snapshot = image_table.lock_write()?;
            for func in self.functions.iter().filter(|f| f.phase == FunctionPhase::Write) {
                let comp = hal.get_component(&func.component)?;
                comp.write()?;
            }
            hal.flush_out_signals()?;    // 原子发布
            drop(snapshot);

            // ═══ Phase 4: Sleep ═══
            next_wake += period;
            let now = Instant::now();

            if now > next_wake {
                // 过运行: 跳过迟到周期
                let missed = ((now - next_wake).as_nanos()
                    / period.as_nanos()) as u64 + 1;
                next_wake += period * (missed as u32);

                self.metrics.overrun_count += missed;
                self.state = ThreadState::Overrun {
                    skipped_cycles: self.metrics.overrun_count,
                };

                // ALARM Signal — 过运行告警
                hal.publish_signal(
                    &format!("{}.overrun", self.name),
                    HalValue::Bool(true),
                )?;
            } else {
                hal.publish_signal(
                    &format!("{}.overrun", self.name),
                    HalValue::Bool(false),
                )?;
            }

            // 暴露运行时指标
            self.metrics.runtime_max_ns =
                self.metrics.runtime_max_ns.max(self.metrics.runtime_ns);
            self.metrics.cycle_count += 1;

            hal.publish_signal(
                &format!("{}.runtime_ns", self.name),
                HalValue::U64(self.metrics.runtime_ns),
            )?;
            hal.publish_signal(
                &format!("{}.runtime_max_ns", self.name),
                HalValue::U64(self.metrics.runtime_max_ns),
            )?;

            self.metrics.runtime_ns = 0;
            std::thread::sleep(next_wake - Instant::now());
        }
    }
}
```

### 5.6 配置文件格式

```yaml
# threads.yaml — 线程声明
threads:
  - name: servo-thread
    period_us: 1000          # 1ms
    priority: 50             # SCHED_FIFO 50
    cpu_affinity: [2, 3]     # pin 到 CPU 2-3
    base_period: true        # 基周期，其他线程周期 = N × 1ms

  - name: plc-scan-thread
    period_us: 10000         # 10ms = 10 × 基周期
    priority: 45
    cpu_affinity: [0, 1]
    functions:
      - component: plc-runtime
        phase: read
      - component: modbus-bridge-rtu
        phase: read
      - component: plc-runtime
        phase: update
        after: ["plc-runtime.read", "modbus-bridge-rtu.read"]
      - component: plc-runtime
        phase: write
      - component: modbus-bridge-rtu
        phase: write

  - name: motion-thread
    period_us: 1000          # 1ms = 基周期（同频）
    priority: 55             # 优先级高于 servo-thread
    cpu_affinity: [2]        # 与 servo-thread 共享 CPU 2，隔离 CPU 3
    functions:
      - component: motion-command-handler
        phase: update
      - component: motion-controller
        phase: update
        after: ["motion-command-handler.update"]
      - component: pid-loop
        phase: update
        after: ["motion-controller.update"]
      - component: pwmgen
        phase: update
        after: ["pid-loop.update"]
      - component: pwmgen
        phase: write
        after: ["pwmgen.update"]

  - name: safety-thread
    period_us: 5000          # 5ms
    priority: 60             # 最高优先级
    cpu_affinity: [4]
    functions:
      - component: safety-monitor
        phase: read
      - component: safety-monitor
        phase: update
```

### 5.7 与纯 LinuxCNC 的差异

| | LinuxCNC | AUDESYS |
|---|---|---|
| 执行模型 | `void funct(void *arg)` 无阶段区分 | `read()` → `update()` → `write()` 三阶段 |
| I/O 一致性 | 信号随时可读/写，无屏障 | 显式 read_barrier / write_barrier |
| 过运行 | 仅暴露 runtime pin | 跳过周期 + ALARM Signal + 降级状态 |
| 函数来源 | C 函数指针 + `hal_export_funct` | Rust `HalComponent` trait 方法 |
| 非 RT 通信 | 通过信号天然跨线程 | 独立 I/O 线程（事件驱动）+ Stream Worker Pool |
| 周期约束 | 运行时校验 `hal_create_thread` | 声明式 `after` 依赖 + `activateComponent` DAG 验证 |
| 动态调整命令 | `halcmd addf/delf` | JSON-RPC: `addFunction / removeFunction / reorderFunction` |
| 运行时查询 | `halcmd show thread` | `getSnapshot` 返回线程 + 函数 + 指标 |
| 语言 | C | Rust (`HalCore`) |

### 5.8 移植对照

| 来源系统 | 原来机制 | AUDESYS 对应 |
|----------|---------|-------------|
| LinuxCNC `addf motion-controller servo-thread` | `hal_add_funct_to_thread` | `ThreadFunction { component, phase, after }` + YAML |
| LinuxCNC `halcmd show thread` | `do_show_cmd` → 格式化 `hal_thread_t` | `getSnapshot` → `ThreadMetrics` |
| LinuxCNC `halcmd delf` | `hal_del_funct_from_thread` | JSON-RPC `removeFunction(thread, component, phase)` |
| ROS2 control `controller->update()` | `for c in rt_controller_list { c->update() }` | `for func in funct_list { func.update() }` |
| ROS2 control `sleep_for_periodic_cycle` | 绝对时间睡眠 + 周期跳过 | `sleep_until(next_period)` + `Overrun` 状态 |
| OpenPLC `pthread_mutex_lock(&bufferLock)` | 单互斥锁 | `image_table.lock_read()/lock_write()` |
| OpenPLC `config_run__(__tick++)` | MatIEC 生成的 C 函数 | `HalComponent::update()` |
| dora-rs `EventStream::next()` | 事件驱动 I/O | I/O 线程 `tokio::select!` + Stream Worker Pool |
| dora-rs `QueuePolicy::DropOldest` | 有界队列 | `StreamConfig.queue_policy` |

---

## 6. 扫描屏障

### 6.1 为什么需要扫描屏障

**LinuxCNC 的反面教材**：LinuxCNC **没有扫描屏障**。信号随时可读可写，不存在"读入→冻结→计算→写出"的阶段概念。

```
servo-thread:  读 signal "axis.0.pos" → compute → 写 signal "axis.0.cmd"
motion-thread: 读 signal "axis.0.cmd" → compute → 写 signal "axis.0.pos"
```

两个线程交错访问同一个信号，时序依赖运气。LinuxCNC 依赖单一 writer 约定和共享内存的原子性规避问题——不靠机制，靠约定。

**后台线程并发写入场景**：

```
I/O 线程 (tokio):       Modbus TCP 从站数据到达 → 写 I/O 映像表
RT 线程 (SCHED_FIFO):   PLC 逻辑正在执行，读 I/O 映像表
```

如果 I/O 映像在 PLC 逻辑执行期间被后台线程修改，结果不确定——可能读到半新半旧的数据。

**跨 Component 输出原子性**：

```
RT 线程:
  Component A.write() → 写 Signal "axis.0.pos"
  Component B.write() → 写 Signal "axis.0.cmd"
```

如果 A 的写入已推送给订阅者而 B 尚未写入，订阅者看到了半个周期的输出。**多个 OUT Signal 必须在 write_barrier 结束时一次性原子发布。**

### 6.2 双层屏障，内置在线程循环中

**屏障不暴露给 Component**：`HalComponent` 的 `read()` / `update()` / `write()` 方法是**纯计算函数**。开发 Component 的人不需要知道锁、屏障或缓存的存在：

```rust
trait HalComponent: Send + Sync {
    fn read(&mut self) -> Result<()> { Ok(()) }
    fn update(&mut self) -> Result<()>;
    fn write(&mut self) -> Result<()> { Ok(()) }
}
```

屏障是 `HalThread::run()` 的内部控制逻辑，对 Component 透明：

```rust
impl HalThread {
    fn run(&mut self, hal: &HalCore) {
        loop {
            // ═══════════════════════════════════════
            // Phase 1: READ BARRIER
            // ═══════════════════════════════════════

            // 1a. 冻结所有被订阅的 Signal 到线程本地缓存
            //     此后整个周期内，对同一 Signal 的读取返回此快照
            let signal_snapshot = hal.snapshot_in_signals(&self.subscribed_signals);

            // 1b. 锁定 I/O 映像表
            //     后台 I/O 线程等待本锁释放才能写入
            let io_guard = image_table.lock_read();

            // 1c. 按 funct_list 顺序执行 phase=Read 的组件
            for func in self.functions.iter().filter(|f| f.phase == FunctionPhase::Read) {
                let comp = hal.get_component(&func.component)?;
                comp.read()?;  // Component 读的是快照，不需要感知锁
            }

            drop(io_guard);  // 释放 I/O 锁——非 phase=Read 的 I/O 访问允许


            // ═══════════════════════════════════════
            // Phase 2: UPDATE（无屏障）
            // ═══════════════════════════════════════

            // Component 通过 HalCore API 读写信号值
            // Component A 写出的值为 Component B 所见（同一周期内）
            for func in self.functions.iter().filter(|f| f.phase == FunctionPhase::Update) {
                let comp = hal.get_component(&func.component)?;
                comp.update()?;
            }


            // ═══════════════════════════════════════
            // Phase 3: WRITE BARRIER
            // ═══════════════════════════════════════

            // 3a. 按 funct_list 顺序执行 phase=Write 的组件
            for func in self.functions.iter().filter(|f| f.phase == FunctionPhase::Write) {
                let comp = hal.get_component(&func.component)?;
                comp.write()?;
            }

            // 3b. 锁定 I/O 映像表，写入变更
            let mut io_guard = image_table.lock_write();
            hal.flush_to_io_image()?;
            drop(io_guard);

            // 3c. 原子发布所有 OUT Signal（一次性推送给所有订阅者）
            hal.flush_out_signals()?;
            //     订阅者看到的始终是一个完整周期的输出，不会看到半截


            // ═══════════════════════════════════════
            // Phase 4: SLEEP
            // ═══════════════════════════════════════
            sleep_until(next_period)?;
        }
    }
}
```

### 6.3 两层屏障

| 屏障 | 保护范围 | 锁定对象 | 持续时间 |
|------|---------|---------|---------|
| **Signal 快照** | 所有被订阅的 IN Signal | 线程本地缓存（copy-on-read） | 整个周期 |
| **I/O 映像锁** | 共享 I/O 映像表 | `IoImageTable::lock_read()` / `lock_write()` | Phase 1 + Phase 3 期间 |

Signal 快照是**轻量级的**：只复制一次值到本地缓存，后续 `read()` 调用直接读缓存。不需要持续加锁。

I/O 映像锁是**范围精确的**：仅在 `read()` 阶段和 `write()` 阶段加锁，`update()` 阶段不加锁（后台 I/O 线程可自由写入，Component 不从 I/O 映像读）。

### 6.4 为什么不暴露同步原语为 HAL 协议原语

| 如果暴露为 HAL 原语 | 后果 |
|-------------------|------|
| `Barrier::new(n).wait()` | HAL 变成分布式调度器，违反 Sans-I/O 原则。一个 Component 挂掉，全部卡死 |
| `Latch::count_down()` | 分布式协调，引入网络分区风险，Paxos/Raft 级复杂度 |
| `Semaphore` / `Mutex` 暴露给 Component | 节奏反转（优先级反转）、死锁、Component 开发者未必懂 RT 同步 |

**原则：同步是线程实现的内部细节，不是 HAL 协议的职责。** HAL 协议只表达数据流向（Signal / StreamChannel / RPC），不表达同步语义。

### 6.5 Component 开发者视角

Component 开发者**永远不碰锁**，只做三件事：

1. **声明阶段归属** —— 在 `threads.yaml` 中将 Component 方法挂到 `phase: read` / `phase: update` / `phase: write`

```yaml
# threads.yaml
threads:
  - name: plc-scan-thread
    period_us: 10000
    functions:
      - { component: plc-runtime,    phase: read }
      - { component: modbus-bridge,  phase: read }
      - { component: plc-runtime,    phase: update }
      - { component: plc-runtime,    phase: write }
      - { component: modbus-bridge,  phase: write }
```

2. **在 `read()` 里读 I/O** —— `HalCore` 自动返回快照值

3. **在 `write()` 里写 I/O** —— 写入的值在 `flush_out_signals()` 时原子生效

### 6.6 与其他系统的对照

| | LinuxCNC | OpenPLC | ROS2 control | AUDESYS |
|---|---|---|---|---|
| 信号一致性 | 无保证（信号随时可读/写） | ✅ bufferLock | ❌ 无（DDS topic 独立） | ✅ Signal 快照 |
| I/O 映像一致性 | ❌ 无 I/O 映像概念 | ✅ bufferLock | ✅ read/write 阶段分离 | ✅ IoImageTable lock |
| 多 OUT Signal 原子发布 | 逐 pin 写入 | 逐 I/O 写入 | 逐 controller write() | ✅ flush_out_signals() |
| 对开发者透明 | 无（需要知道约定） | 无（lock 在 main.cpp） | 从 controller_manager 继承 | ✅ Component 不碰锁 |

---

## 7. Config Barrier 与 LockLevel

### 7.1 设计原则

LinuxCNC 的 LockLevel 假设开发者不会在 RT 线程运行时发起结构性变更——这是信任式安全。AUDESYS 的 Supervisor 随时可能通过 RPC 发配置命令，不能依赖这种信任。

两个机制配合保证安全：

1. **Config Barrier**：所有配置变更排队，只在 RT 周期边界应用——物理上不可能 mid-cycle 注入
2. **LockLevel 强制**：`Run` 级别拒绝所有 RPC 配置请求，不需要等到 barrier

### 7.2 Config Barrier

**问题场景**：

```
Supervisor via RPC: loadComponent("new-sensor")
                          │
  RT thread mid-cycle:    │
    read()  ──────────┐   │
    update() ───┐     │   │
    write() ───┐│     │   │   ← new-sensor 被注入到这里？
               ▼▼     ▼   ▼
              funct_list 被修改 → segfault / 读到半初始化数据
```

**方案：配置队列 + 周期边界批量应用**：

```
   RT cycle boundary ──┐
                       ▼
┌──────────────────────────────────────────┐
│  apply_pending_config()                  │
│  ├─ drain pending_config 队列             │
│  ├─ 重建 Arc<FunctList>                  │
│  └─ publish Signal "config.applied"      │
├──────────────────────────────────────────┤
│  read_barrier()                          │
│  for func in funct_list { func.read() }  │
│  for func in funct_list { func.update() }│
│  for func in funct_list { func.write() } │
│  write_barrier()                         │
├──────────────────────────────────────────┤
│  sleep_until(next_period)                │
└──────────────────────────────────────────┘
```

**关键保证**：
- 配置变更只在 `apply_pending_config()` 中发生——在 `read_barrier()` **之前**
- 整个 RT 周期内 `funct_list` 是只读的（`Arc<T>`）
- Supervisor 在下一个周期开始时通过 Signal 确认变更生效

**实现**：

```rust
struct HalCore {
    /// 当前生效的配置。RT 线程只读。
    config: Arc<HalConfig>,

    /// 待应用的配置命令队列。Supervisor RPC → tx，RT 线程 drain。
    pending_config: crossbeam::channel::Receiver<ConfigCommand>,
    config_tx: crossbeam::channel::Sender<ConfigCommand>,
}

/// 可安全克隆的配置快照
struct HalConfig {
    components: Vec<Arc<dyn HalComponent>>,
    funct_list: Vec<FunctEntry>,
    signals: HashMap<String, SignalDef>,
    threads: Vec<HalThread>,
    lock_level: LockLevel,
    generation: u64,  // 递增，用于 Supervisor 确认
}

enum ConfigCommand {
    LoadComponent { name: String, comp_type: String, config: Value },
    ConfigureComponent { name: String, params: Value },
    UnloadComponent { name: String },
    LinkPin { pin: String, signal: String },
    UnlinkPin { pin: String },
    AddFunction { component: String, function: FunctionSlot, thread: String, position: Option<String> },
    RemoveFunction { component: String, function: FunctionSlot, thread: String },
    SetLockLevel { level: LockLevel },
}

impl HalCore {
    fn rt_cycle(&mut self) {
        // Phase 0: 应用所有排队的配置变更
        let mut new_config = None;
        for cmd in self.pending_config.try_iter() {
            new_config = Some(self.apply_config_command(
                new_config.unwrap_or_else(|| (*self.config).clone()),
                cmd,
            ));
        }
        if let Some(cfg) = new_config {
            self.config = Arc::new(cfg);
            // 通知 Supervisor 配置已生效
            // publish_signal("config.generation", HalValue::U64(self.config.generation));
        }

        // Phase 1–4: 正常 RT 周期（详见 §6 扫描屏障）
        self.read_barrier();
        for entry in &self.config.funct_list {
            match entry.function {
                FunctionSlot::Read   => entry.component.read(),
                FunctionSlot::Update => entry.component.update(),
                FunctionSlot::Write  => entry.component.write(),
            }
        }
        self.write_barrier();
    }

    fn apply_config_command(
        &self,
        mut cfg: HalConfig,
        cmd: ConfigCommand,
    ) -> HalConfig {
        match cmd {
            ConfigCommand::SetLockLevel { level } => {
                cfg.lock_level = level;
            }
            ConfigCommand::LoadComponent { name, comp_type, config } => {
                // 检查 lock_level
                if cfg.lock_level >= LockLevel::Run {
                    log::error!("Cannot load component in Run mode");
                    return cfg;
                }
                let component = self.instantiate_component(&name, &comp_type, &config);
                cfg.components.push(component);
            }
            ConfigCommand::LinkPin { pin, signal } => {
                if cfg.lock_level >= LockLevel::Params {
                    log::error!("Cannot link pins in Params/Run mode");
                    return cfg;
                }
                // 重建 signal 映射...
            }
            // ...
        }
        cfg.generation += 1;
        cfg
    }

    /// Supervisor 调用此方法发起配置变更
    fn submit_config(&self, cmd: ConfigCommand) -> Result<ConfigStatus> {
        self.config_tx.send(cmd)
            .map(|_| ConfigStatus::Pending {
                current_generation: self.config.generation,
            })
            .map_err(|_| Error::ConfigQueueFull)
    }
}

#[derive(Serialize)]
enum ConfigStatus {
    /// 已入队，等待下一周期应用
    Pending { current_generation: u64 },
    /// 已应用（通过 config.generation Signal 确认）
    Applied { generation: u64 },
    /// 拒绝（硬件/权限/CAPABILITY 不足）
    Rejected { reason: String },
}
```

### 7.3 LockLevel：配置权限分级

保留 LinuxCNC 的 LockLevel 概念，但语义从"运行时锁"变更为"配置权限分级"。

```rust
#[derive(Clone, Copy, Debug, PartialEq, PartialOrd)]
enum LockLevel {
    None   = 0,   // 无限制。生产环境禁止。
    Load   = 1,   // 允许结构性变更：loadComponent、unloadComponent
    Config = 2,   // 允许配置：configureComponent、linkPin、addFunction
    Params = 3,   // 仅允许参数修改：configureComponent（仅参数部分）
    Run    = 4,   // 只读。拒绝所有 RPC 配置请求。
    All    = 5,   // 特殊：完全锁定。连 configureComponent 参数修改也拒绝。
}
```

**LockLevel 执行路径**：

```
Supervisor RPC: configureComponent("motion", { "max_vel": 1000 })
                          │
                          ▼
              ┌───────────────────────┐
              │ lock_level >= Run?    │
              │  YES → reject (immediate)  ← 不经过队列，不发 pending
              │  NO  → enqueue        │
              └───────────────────────┘
                          │
                          ▼
              ┌───────────────────────┐
              │ Config Barrier        │
              │  下一周期边界应用       │
              └───────────────────────┘
```

**对比 LinuxCNC**：

| | LinuxCNC | AUDESYS |
|---|---|---|
| `Run` 级别 | 仅禁止结构性变更，允许参数修改 | 拒绝所有 RPC 配置（连参数修改也拒） |
| 执行时机 | 调用时立即（需开发者自觉） | Config Barrier 边界（强制保证） |
| 降级方法 | `hal_set_lock(LOCK_NONE)` → 修改 → `hal_set_lock(LOCK_RUN)` | `deactivateComponent` → `setLockLevel(None)` → 修改 → `setLockLevel(Run)` → `activateComponent` |
| 越权处理 | 返回错误码（信任式） | MarshaError（强制式） |

**LockLevel 状态机**：

```
                         setLockLevel(All)
                         ┌──────────────────┐
                         ▼                  │
  None ──► Load ──► Config ──► Params ──► Run ──► All
    ▲        ▲        ▲          ▲          ▲        │
    │        │        │          │          │        │
    └────────┴────────┴──────────┴──────────┴────────┘
                    setLockLevel(lower)
             （仅在 deactivateComponent 之后允许）
```

### 7.4 Config Generation 确认

Supervisor 如何确认配置已生效：

```
Supervisor                                     HalCore (RT)
    │                                              │
    │── RPC: loadComponent("new-sensor") ────────►│
    │◄── { status: "pending", generation: 42 } ────│
    │                                              │
    │── subscribe Signal "config.generation" ────►│
    │                                              │
    │                                              │── [RT cycle boundary]
    │                                              │── apply_pending_config()
    │                                              │── config.generation = 43
    │                                              │── publish Signal "config.generation" = 43
    │◄── Signal: config.generation = 43 ───────────│
    │                                              │
    │── RPC: getSnapshot ────────────────────────►│
    │◄── { components: [..., "new-sensor"] } ──────│
    │                                              │
    │   ✅ 确认: "new-sensor" 已生效                 │
```

### 7.5 与扫描屏障的关系

Config Barrier 和扫描屏障是两个独立但协同的机制：

| | Config Barrier | Scan Barrier |
|---|---|---|
| **目的** | 安全应用配置变更 | I/O 映像一致性 |
| **执行时机** | RT 周期边界（read_barrier 之前） | RT 周期内（read → ... → write） |
| **保护对象** | funct_list, signals, threads | I/O image table, Signal values |
| **LockLevel 交互** | LockLevel ≥ Run → 拒绝入队 | 无关 |
| **来源** | LinuxCNC hal_set_lock + 并发安全 | OpenPLC bufferLock |

```
RT 周期时间线:

  [apply_config] [read_barrier] [functions...] [write_barrier] [sleep]
   ▲ ▲           ▲
   │ │           └── Scan Barrier 开始
   │ └── Config Barrier：安全边界。mid-cycle 禁入。
   └── 配置队列清空，Arc<HalConfig> 重建
```

---

## 8. 实时内存与周期

### 8.1 RT 内存管理

#### 8.1.1 参考：LinuxCNC `hal_malloc()`

LinuxCNC 是所有参考系统中 RT 内存管理最成熟的方案。核心特征：

```
┌────────────────────────────────────────────────┐
│  shm segment (编译时固定大小，如 256KB)         │
│                                                │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────────┐ │
│  │ pin1 │ │ pin2 │ │ sig1 │ │      free      │ │
│  └──────┘ └──────┘ └──────┘ └────────────────┘ │
│                                                │
│  initf 阶段: hal_malloc() 从 free 区划出        │
│  RT 周期:    永不调用 hal_malloc()              │
│  shutdown:   不释放（永久分配）                  │
└────────────────────────────────────────────────┘
```

- 所有 Pin、Signal、Parameter 分配在共享内存段内
- `initf`（初始化函数）中一次性分配；RT 热路径零分配
- `mlockall(MCL_CURRENT|MCL_FUTURE)` 防缺页
- RTAPI task 创建时验证所有内存已锁定

#### 8.1.2 AUDESYS 方案：预分配池 + mlockall

借鉴 LinuxCNC 的"预分配—热路径零分配"模式，AUDESYS 用 Rust 的 `PreAllocPool` 替代 C 的共享内存段。

**数据结构**：

```rust
// controller/hal-core/src/pool.rs

use std::sync::Mutex;

/// 预分配对象池 — 类似 LinuxCNC shm segment
///
/// 关键属性:
///   1. capacity 固定，永不扩容（防止 RT 周期内的 Vec::push → realloc）
///   2. 空闲槽位追踪（LIFO free stack，O(1) alloc/free）
///   3. 无 Drop 语义（对象归还到 free_slots，内存不释放）
pub struct PreAllocPool<T> {
    items: Vec<Option<T>>,    // 固定容量数组，永不扩容
    free_slots: Vec<usize>,   // 空闲槽位栈（LIFO）
    max_capacity: usize,
}

impl<T> PreAllocPool<T> {
    /// 创建固定容量池，一次性分配所有内存
    pub fn new(capacity: usize) -> Self {
        let mut items = Vec::with_capacity(capacity);
        // 占满全部槽位（空槽）
        for _ in 0..capacity {
            items.push(None);
        }
        let free_slots: Vec<usize> = (0..capacity).rev().collect();

        PreAllocPool {
            items,
            free_slots,
            max_capacity: capacity,
        }
    }

    /// O(1) 从空闲栈取槽位（非 RT 热路径，仅在 activateComponent 调用）
    pub fn alloc(&mut self, item: T) -> Result<usize, PoolError> {
        let slot = self.free_slots.pop()
            .ok_or(PoolError::Exhausted(self.max_capacity))?;
        self.items[slot] = Some(item);
        Ok(slot)
    }

    /// O(1) 归还槽位（非 RT 热路径，仅在 deactivateComponent 调用）
    pub fn free(&mut self, slot: usize) -> Result<(), PoolError> {
        if slot >= self.items.len() || self.items[slot].is_none() {
            return Err(PoolError::DoubleFree(slot));
        }
        self.items[slot] = None;
        self.free_slots.push(slot);
        Ok(())
    }

    /// O(1) 不可变借用（RT 热路径安全 — 无分配）
    pub fn get(&self, slot: usize) -> Option<&T> {
        self.items.get(slot).and_then(|o| o.as_ref())
    }

    /// O(1) 可变借用（RT 热路径安全 — 无分配）
    pub fn get_mut(&mut self, slot: usize) -> Option<&mut T> {
        self.items.get_mut(slot).and_then(|o| o.as_mut())
    }
}

#[derive(Debug)]
pub enum PoolError {
    Exhausted(usize),      // 池满
    DoubleFree(usize),     // 重复归还
}
```

**HalCore 集成**：

```rust
// controller/hal-core/src/lib.rs

pub struct HalCore {
    // 预分配池 — 初始化时根据 hal_config 一次性分配
    pins: PreAllocPool<HalPin>,              // 默认 10000
    signals: PreAllocPool<HalSignal>,         // 默认 5000
    components: PreAllocPool<Box<dyn HalComponent>>, // 默认 200

    // 信号索引 — HashMap 可能在 activate 阶段分配
    // (非 RT 热路径，仅在 Component 生命周期回调中使用)
    pin_index: HashMap<String, usize>,
    signal_index: HashMap<String, usize>,
    component_index: HashMap<String, usize>,

    // 线程 funct_list — 初始化时 with_capacity，不 grow
    threads: HashMap<String, HalThread>,
}

impl HalCore {
    pub fn new(config: HalConfig) -> Self {
        let hal = HalCore {
            pins: PreAllocPool::new(config.max_pins),
            signals: PreAllocPool::new(config.max_signals),
            components: PreAllocPool::new(config.max_components),
            pin_index: HashMap::new(),
            signal_index: HashMap::new(),
            component_index: HashMap::new(),
            threads: HashMap::new(),
        };

        // mlockall — 防止 RT 周期缺页
        #[cfg(target_os = "linux")]
        unsafe {
            libc::mlockall(libc::MCL_CURRENT | libc::MCL_FUTURE);
        }

        hal
    }
}
```

**配置文件**：

```yaml
# hal_config.yaml
hal:
  max_pins: 10000
  max_signals: 5000
  max_components: 200
  max_threads: 16
  max_stream_channels: 256
  prealloc_pool: true    # 强制预分配，禁止热路径 Vec 扩容
```

#### 8.1.3 内存纪律

| 规则 | 机制 | 检测 |
|------|------|------|
| RT 热路径零堆分配 | Code review + CI lint 禁止 `Box::new` / `Vec::push` / `String::new` 在 `update()` 方法中 | `cargo clippy -- -W clippy::all` + 自定义 lint |
| 预分配池不可扩容 | `PreAllocPool` capacity 固定，`alloc()` 池满返回错误 | `activateComponent()` 时检查 |
| 缺页防护 | `mlockall(MCL_CURRENT\|MCL_FUTURE)` | 启动日志 + `/proc/{pid}/status` VmLck 验证 |
| 无 Drop 热路径 | 对象归还到 free_slots，内存不释放 | `deactivateComponent()` 时调用 `free()`，`drop()` 为空 |
| 栈变量大小限制 | 大对象 (>1KB) 必须放堆（预分配池）| 代码审查 |
| Vec 容量预声明 | 所有 `Vec::new()` 用 `Vec::with_capacity(n)` 替代 | clippy `vec_init_then_push` lint |
| 相邻 Signal 最小 64B padding（建议）| 同 SHM 段的两个高频 Signal 若在同一 cache line (64B) 内，写一个无效化另一个的 cache line → 假共享。建议 64B padding，高频 Signal 用独立 SHM 段 | 代码审查 |

#### 8.1.4 与 LinuxCNC 差异

| | LinuxCNC `hal_malloc` | AUDESYS `PreAllocPool` |
|---|---|---|
| 分配时机 | `initf` 初始化函数 | `activateComponent()` / YAML 配置 |
| RT 热路径 | ❌ 永不分配 | ❌ 永不分配 |
| 释放 | ❌ 不支持 | ✅ `deactivateComponent()` → `free()` 归还槽位 |
| 池大小 | 编译时共享内存段大小 | 配置文件 `hal_config.max_pins` |
| 缺页防护 | ✅ RTAPI `mlockall` | ✅ `mlockall` + `madvise(WILLNEED)` |
| 跨进程可见 | ✅ 共享内存 | ❌ 单进程（跨进程通过 Zenoh Signal） |

### 8.2 线程周期约束

#### 8.2.1 参考：LinuxCNC Rate Monotonic

LinuxCNC 要求所有线程周期必须是基周期的整数倍。这是 **Rate Monotonic Scheduling (RMS)** 可调度性分析的前提。

```c
// hal_lib.c — hal_create_thread 中的周期验证
if (period_ns % base_period_ns != 0) {
    rtapi_print("ERROR: period must be integer multiple of base period\n");
    return -EINVAL;
}
```

没有这个约束，无法保证低优先级长周期线程不被高优先级短周期线程饿死。

#### 8.2.2 AUDESYS 方案：声明式 + 编译时验证

```rust
impl HalCore {
    fn validate_periods(&self) -> Result<()> {
        // 找到基周期
        let base = self.threads.values()
            .find(|t| t.base_period)
            .ok_or(Error::NoBasePeriod)?
            .period_us;

        // 验证所有线程周期 = N × base
        for thread in self.threads.values() {
            if thread.period_us % base != 0 {
                return Err(Error::PeriodNotMultiple {
                    thread: thread.name.clone(),
                    period: thread.period_us,
                    base,
                });
            }
            // 验证周期 ≥ 1ms（低于此无实际 SCHED_FIFO 优势）
            if thread.period_us < 1000 {
                return Err(Error::PeriodTooShort {
                    thread: thread.name.clone(),
                    period: thread.period_us,
                });
            }
        }

        Ok(())
    }
}
```

#### 8.2.3 RMS 利用率分析（可选）

```rust
/// Rate Monotonic 利用率上界测试
///
/// Liu & Layland bound: U ≤ n(2^(1/n) - 1)
/// 其中 n = 线程数, U = Σ(Ci/Ti) = 各线程利用率之和
fn rms_utilization_bound(num_threads: usize) -> f64 {
    let n = num_threads as f64;
    n * (2.0_f64.powf(1.0 / n) - 1.0)
}

fn analyze_schedulability(threads: &[HalThread]) -> Result<()> {
    let total_utilization: f64 = threads.iter()
        .map(|t| t.metrics.runtime_max_ns as f64 / (t.period_us as f64 * 1000.0))
        .sum();

    let bound = rms_utilization_bound(threads.len());

    if total_utilization > bound {
        log::warn!(
            "RMS utilization {:.2}% exceeds theoretical bound {:.2}% — ",
            "system may miss deadlines under worst-case phasing",
            total_utilization * 100.0,
            bound * 100.0,
        );
        // 不阻塞激活——边界是充分非必要条件
    }

    if total_utilization > 0.69 {
        // n → ∞ 时上界 = ln(2) ≈ 0.693
        log::warn!("Utilization exceeds ln(2) threshold");
    }

    Ok(())
}
```

#### 8.2.4 完整约束清单

| 约束 | 验证时机 | 违规操作 | 来源 |
|------|---------|---------|------|
| 线程周期 = N × 基周期 | `activateComponent()` | 拒绝激活 | LinuxCNC |
| 基周期存在且唯一 | 同上 | 拒绝启动 | LinuxCNC |
| 周期 ≥ 1ms | 同上 | 拒绝激活 | ROS2 control 实践 |
| CPU 亲和性不与基线程重叠 | 同上 | 警告（允许但高风险） | LinuxCNC |
| 优先级递减（短周期高优先级）| 同上 | 警告 | RMS 定理 |
| 所有函数在基周期内完成 | 运行时 | `Overrun` 状态 + ALARM Signal | 本设计 |
| RMS 利用率 ≤ 0.69 | `activateComponent()` | 仅警告 | Liu & Layland |
| `mlockall` 成功 | RT 线程创建 | 拒绝启动 | LinuxCNC |

#### 8.2.5 配置文件示例

```yaml
# threads.yaml
scheduling:
  base_period_us: 1000       # 基周期 1ms
  rms_analysis: warn         # 可调度性分析模式: off | warn | strict

threads:
  - name: servo-thread
    period_us: 1000          # ✅ 1 × base
    priority: 50
    cpu_affinity: [2, 3]
    base_period: true

  - name: motion-thread
    period_us: 1000          # ✅ 1 × base
    priority: 55
    cpu_affinity: [2]

  - name: plc-scan-thread
    period_us: 10000         # ✅ 10 × base
    priority: 45
    cpu_affinity: [0, 1]

  - name: safety-thread
    period_us: 5000          # ✅ 5 × base
    priority: 60
    cpu_affinity: [4]

# ❌ 以下将被拒绝:
#
# bad-thread-1:
#   period_us: 7300          # ❌ 不是 1000 的整数倍
#
# bad-thread-2:
#   period_us: 500           # ❌ < 1ms
```

---

## 9. I/O 映射

### 9.1 设计原则

MODBUS 有四种地址空间（线圈、离散输入、保持寄存器、输入寄存器），EtherCAT 有结构化 PDO，PROFINET 有名片寻址。单一 `Array<S32>` 无法处理这种异构性。

IoImageTable **不是** HAL 协议的一部分——它是 I/O 层的内部路由表。HAL 协议层面只看到逻辑 Signal。I/O 映射规则可随时更改而不影响上层程序。

```
┌─────────────────────────────────────────────┐
│         PLC Program (%IW0, %QW0, M0)        │
│         (IEC 变量名，如 "conveyor_start")     │
└────────────────────┬────────────────────────┘
                     │ 逻辑 <-> 物理映射
┌────────────────────┴────────────────────────┐
│           IoImageTable (路由表)              │
│                                             │
│  "conveyor_start"  →  {                     │
│    domain: "rack0",                         │
│    channel: "coil",                         │
│    address: 0,                              │
│    type: Bool,                              │
│  }                                          │
└───────┬──────────────┬──────────────┬───────┘
        │              │              │
┌───────┴──┐   ┌───────┴──┐   ┌───────┴──────────┐
│ MODBUS   │   │ EtherCAT │   │ PROFINET          │
│ domain:  │   │ domain:  │   │ domain:           │
│  coil    │   │  pdo_1a00│   │  profinet_device_1│
│  discrete│   │  pdo_1a01│   └───────────────────┘
│  holding │   └──────────┘
│  input   │
└──────────┘
```

### 9.2 IoImageTable 核心数据结构

```rust
/// I/O 映像表：一个逻辑地址到物理 I/O 的映射系统
struct IoImageTable {
    domains: HashMap<String, IoDomain>,
    snapshot: RwLock<IoSnapshot>,
}

/// I/O 域：一组共享物理传输的 I/O 点
struct IoDomain {
    name: String,               // "rack0", "ethercat_bus_1"
    driver: String,             // "modbus-tcp", "ethercat", "profinet"
    channels: Vec<IoChannel>,   // 该域下的所有通道
    refresh_interval_ms: u64,   // 刷新周期
    connection: ConnectionConfig,
}

/// I/O 通道：一个地址空间（MODBUS 有 4 个，EtherCAT 有 N 个 PDO）
struct IoChannel {
    name: String,               // "coil", "holding_register", "pdo_1a00"
    address_space: AddressSpace,
    size: usize,                // 该通道的点数
    direction: IoDirection,
    mappings: Vec<IoMapping>,
}

struct IoMapping {
    /// 逻辑名：HAL Signal 名称
    logical: String,            // "conveyor_start"

    /// 物理地址
    physical: PhysicalAddress,

    /// 数据类型
    hal_type: HalPinType,
}

enum AddressSpace {
    Digital,       // 位寻址（MODBUS 0x/1x, PROFINET bit）
    Register,      // 16/32-bit 寄存器寻址（MODBUS 3x/4x）
    Structured,    // 结构化 PDO（EtherCAT, CANopen）
    Named,         // 名寻址（PROFINET, OPC UA）
}

enum IoDirection { In, Out, Io }

/// 物理地址：支持多种寻址方式
struct PhysicalAddress {
    start: usize,
    len: usize,    // 多寄存器合并时 >1

    // 总线特定扩展
    subindex: Option<u16>,   // EtherCAT SDO, CANopen subindex
    bit_index: Option<u8>,   // 寄存器内的位偏移
    path: Option<String>,    // PROFINET/OPC UA 路径
}

/// I/O 快照：当前周期的一致性视图
struct IoSnapshot {
    /// { "conveyor_start" → HalValue::Bool(true) }
    values: HashMap<String, HalValue>,
    timestamp: Timestamp,
}
```

### 9.3 IoDriver trait

```rust
trait IoDriver: Send + Sync {
    /// 驱动名称（"modbus-tcp", "ethercat", "profinet"）
    fn name(&self) -> &str;

    /// 从物理 I/O 读入 → IoImageTable 快照
    fn read_inputs(
        &self, domain: &IoDomain, snapshot: &mut IoSnapshot
    ) -> Result<()>;

    /// 从 IoImageTable 快照 → 物理 I/O 写出
    fn write_outputs(
        &self, domain: &IoDomain, snapshot: &IoSnapshot
    ) -> Result<()>;
}
```

### 9.4 MODBUS TCP 配置示例

```yaml
# io-mapping.yaml
domains:
  - name: rack0
    driver: modbus-tcp
    connection:
      host: 192.168.1.10
      port: 502
      unit_id: 1
      timeout_ms: 500
    refresh_interval_ms: 10
    channels:
      # ──── 线圈（0x 地址空间，位输出） ────
      - name: coil
        address_space: Digital
        direction: Out
        size: 256
        mappings:
          - logical: conveyor_start       → physical: coil[0]
          - logical: conveyor_stop        → physical: coil[1]
          - logical: vacuum_on            → physical: coil[2]
          - logical: uv_led_on            → physical: coil[3]

      # ──── 离散输入（1x 地址空间，位输入） ────
      - name: discrete_input
        address_space: Digital
        direction: In
        size: 256
        mappings:
          - logical: estop_pressed        → physical: discrete_input[0]
          - logical: light_curtain_blocked → physical: discrete_input[1]
          - logical: door_open            → physical: discrete_input[2]

      # ──── 保持寄存器（4x 地址空间，16-bit 输出） ────
      - name: holding_register
        address_space: Register
        direction: Out
        size: 256
        mappings:
          - logical: uv_power_level       → physical: holding_register[0]
          - logical: target_temperature   → physical: holding_register[1]
          - logical: lift_speed           → physical: holding_register[2]

      # ──── 输入寄存器（3x 地址空间，16-bit 输入） ────
      - name: input_register
        address_space: Register
        direction: In
        size: 256
        mappings:
          - logical: actual_temperature   → physical: input_register[0]
          - logical: z_position           → physical: { start: 1, len: 2 }
          - logical: uv_current           → physical: input_register[3]
```

**MODBUS 驱动实现**：

```rust
struct ModbusTcpDriver {
    client: modbus::TcpClient,
}

impl IoDriver for ModbusTcpDriver {
    fn read_inputs(&self, domain: &IoDomain, snapshot: &mut IoSnapshot) -> Result<()> {
        for channel in &domain.channels {
            match channel.name.as_str() {
                "discrete_input" => {
                    let bits = self.client.read_discrete_inputs(
                        0, channel.size as u16
                    )?;
                    for mapping in &channel.mappings {
                        let phys = mapping.physical.start;
                        snapshot.values.insert(
                            mapping.logical.clone(),
                            HalValue::Bool(phys < bits.len() && bits[phys]),
                        );
                    }
                }
                "input_register" => {
                    let regs = self.client.read_input_registers(
                        0, channel.size as u16
                    )?;
                    for mapping in &channel.mappings {
                        let phys = mapping.physical.start;
                        let val = if mapping.physical.len == 1 {
                            HalValue::S32(regs[phys] as i32)
                        } else {
                            // 多寄存器合并（如 z_position 占 2 个 16-bit 寄存器）
                            HalValue::S32(
                                ((regs[phys] as i32) << 16) | (regs[phys + 1] as i32)
                            )
                        };
                        snapshot.values.insert(mapping.logical.clone(), val);
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }

    fn write_outputs(
        &self, domain: &IoDomain, snapshot: &IoSnapshot
    ) -> Result<()> {
        for channel in &domain.channels {
            match channel.name.as_str() {
                "coil" => {
                    let mut bits = vec![false; channel.size];
                    for mapping in &channel.mappings {
                        if let Some(HalValue::Bool(v)) = snapshot.values.get(&mapping.logical) {
                            bits[mapping.physical.start] = *v;
                        }
                    }
                    self.client.write_multiple_coils(0, &bits)?;
                }
                "holding_register" => {
                    let mut regs = vec![0u16; channel.size];
                    for mapping in &channel.mappings {
                        if let Some(val) = snapshot.values.get(&mapping.logical) {
                            match val {
                                HalValue::S32(v) => {
                                    if mapping.physical.len == 1 {
                                        regs[mapping.physical.start] = *v as u16;
                                    } else {
                                        regs[mapping.physical.start] = (*v >> 16) as u16;
                                        regs[mapping.physical.start + 1] = (*v & 0xFFFF) as u16;
                                    }
                                }
                                HalValue::U32(v) => {
                                    regs[mapping.physical.start] = *v as u16;
                                }
                                _ => {}
                            }
                        }
                    }
                    self.client.write_multiple_registers(0, &regs)?;
                }
                _ => {}
            }
        }
        Ok(())
    }
}
```

### 9.5 EtherCAT 配置示例

```yaml
domains:
  - name: ethercat_bus_1
    driver: ethercat
    connection:
      interface: eth0
      cycle_time_us: 1000  # DC 同步周期
    channels:
      # ──── Process Data Object (PDO) 1A00 — 驱动器 A ────
      - name: pdo_1a00
        address_space: Structured
        direction: In
        size: 32              # 32 bytes
        mappings:
          - logical: drive_a_status_word    → physical: { start: 0, len: 2 }
          - logical: drive_a_actual_position → physical: { start: 2, len: 4 }
          - logical: drive_a_actual_velocity → physical: { start: 6, len: 4 }
          - logical: drive_a_actual_torque   → physical: { start: 10, len: 2 }

      # ──── PDO 1600 — 驱动器 A 输出 ────
      - name: pdo_1600
        address_space: Structured
        direction: Out
        size: 32
        mappings:
          - logical: drive_a_control_word    → physical: { start: 0, len: 2 }
          - logical: drive_a_target_position  → physical: { start: 2, len: 4 }
          - logical: drive_a_target_velocity  → physical: { start: 6, len: 4 }

      # ──── SDO — 参数访问（非周期） ────
      - name: sdo
        address_space: Structured
        direction: Io
        size: 0               # 不限大小
        mappings:
          - logical: drive_a_max_current      → physical: { start: 0x8010, subindex: 1, len: 2 }
```

### 9.6 PROFINET 配置示例

```yaml
domains:
  - name: profinet_cell_1
    driver: profinet
    connection:
      device_name: "plc-cell1"
      rt_class: 1           # 1 = RT, 3 = IRT
      cycle_time_us: 1000
    channels:
      - name: io_data
        address_space: Named
        direction: Io
        mappings:
          - logical: cell1_estop     → physical: { path: "SafetyModule.EStop" }
          - logical: cell1_light     → physical: { path: "SafetyModule.LightCurtain" }
          - logical: robot1_ready    → physical: { path: "Robot1.StatusReady" }
          - logical: robot1_speed    → physical: { path: "Robot1.ActualSpeed" }
```

### 9.7 与 HAL Protocol 的关系

IoImageTable **不是** HAL 协议的一部分。HAL 协议层面只看到逻辑 Signal：

```
IoImageTable 内部路由:
  "conveyor_start" ↔ MODBUS rack0.coil[0]
  "z_position"     ↔ MODBUS rack0.input_register[1..2]

HAL Protocol 层面:
  Signal "conveyor_start"  (Bool)
  Signal "z_position"      (S32)
```

**好处**：
- SCADA 开发人员用 `"conveyor_start"` 即可——不需要知道 MODBUS 地址
- 电气工程师改一条映射规则，HMI / PLC 程序一行代码都不用改
- 同一套 PLC 程序切换 Modbus → EtherCAT 只需换 `io-mapping.yaml`

### 9.8 与 OpenPLC image table 的对比

| | OpenPLC image table | AUDESYS IoImageTable |
|---|---|---|
| 寻址 | 仅数字索引 `%IW0` | 逻辑名 "conveyor_start" + 数字索引 |
| 总线支持 | 隐式（驱动内部处理）| 显式 domain + channel + address_space |
| 多总线 | 不支持 | 任意多个 domain |
| 映射重配置 | 需重新编译 | 热加载 YAML |
| 结构化 PDO | 不支持 | 显式 byte offset + len |
| HAL 可见性 | 裸数组穿过 HAL | 独立 Signal，HalValue 类型 |

---

## 10. 移植对接方案

每个被移植的系统功能根据自己的通信特征选择最合适的原语。下面描述"移植后的功能如何对接 AUDESYS HAL"——不是桥接外部协议。

### 10.1 移植 LinuxCNC 功能

LinuxCNC 的 HAL 和 AUDESYS HAL 高度同构（都是单写多读 Signal + 线程函数调度）。

```
LinuxCNC motion planner (移植为 AUDESYS Component)
  │
  │  pin: axis.0.position  (F64, OUT)  →  AUDESYS Signal "motion.axis.0.pos"
  │  pin: axis.0.enable    (Bool, IN)  →  AUDESYS Signal "motion.axis.0.enable"
  │  pin: axis.0.velocity  (F64, OUT)  →  AUDESYS Signal "motion.axis.0.vel"
  │
  │  function: servo-thread.update()   →  AUDESYS RT thread 调度表
  │    ┌─ read IN pins
  │    ├─ compute
  │    └─ write OUT pins
  │
  │  halcmd commands (load/unload/link/...)
  │    →  AUDESYS RPC: loadComponent / linkPin / addThread
```

- Signal 1:1 映射（LinuxCNC pin → AUDESYS Signal）
- LinuxCNC function list → AUDESYS RT 线程 `update()` 调度表
- LinuxCNC halcmd → AUDESYS RPC

| LinuxCNC halcmd | AUDESYS HAL | 说明 |
|---|---|---|
| `halcmd loadrt comp` | RPC `loadComponent(name, type, config)` | 加载实时组件 |
| `halcmd addf comp.func thread` | RPC `addFunction(component, func, thread)` | 函数加入 RT 线程 |
| `halcmd delf comp.func thread` | RPC `removeFunction(component, func, thread)` | 从线程移除函数 |
| `halcmd net sig pin1 pin2` | RPC `newSignal(name)` + `linkPin(pin, sig)` (×2) | 创建信号并连接 Pin |
| `halcmd setp pin value` | RPC `configureComponent(name, {pin: value})` | 设置 Pin 值 |
| `halcmd show thread` | RPC `getSnapshot` → `threads[].metrics` | 查看 RT 线程状态 |
| `halcmd show signal` | RPC `getSnapshot` → `signals[]` | 查看所有信号 |
| `halcmd start` / `halcmd stop` | RPC `activateComponent` / `deactivateComponent` | 启停组件 |
| `halcmd loadusr prog` | Supervisor 子进程启动 | 用户态辅助程序 |
| `halcmd unloadrt comp` | RPC `unloadComponent(name)` | 卸载组件 |

### 10.2 移植 OpenPLC 功能

OpenPLC 以扫描周期为单位运行，不适合逐 pin 映射。

```
OpenPLC IEC runtime (移植为 AUDESYS Component)
  │
  │  Task Main: 周期 10ms
  │
  │  扫描前:
  │    Signal<Array<S32>> "plc.rack0.input_image"   ← 从 I/O 驱动批量读入
  │                                    (1024 个 S32 = 4KB, 一次 Signal update)
  │
  │  执行:
  │    IEC 程序读写 %IW0..%IW1023, %QW0..%QW1023
  │    (内部通过直接内存访问 image table, 不穿越 HAL)
  │
  │  扫描后:
  │    Signal<Array<S32>> "plc.rack0.output_image"  → 写入 I/O 驱动
  │
  │  单点 I/O 监控 (选配):
  │    Signal<Bool> "plc.rack0.slot3.di5"           ← 单个数字输入
  │    (从 image table 提取, 供 HMI/SCADA 使用)
```

- 扫描周期的整表 I/O：`Array<S32>` 批量传输（2 条消息/周期，而非 8192 条）
- 单点监控（HMI 用）：从 image table 提取为独立 Signal（按需，非默认）
- IEC 程序内部：直接内存访问 image table，不穿越 HAL（最大性能）

### 10.3 移植 ROS2 功能

ROS2 有三种通信模式，分别映射到 AUDESYS 的三种原语：

```
ROS2 移植节点
  │
  ├── topic /scan (sensor_msgs/LaserScan, 40Hz, ~4KB/frame)
  │     →  StreamChannel<Array<F32>> "lidar.scan.ranges"
  │        理由: 高频、中大数据、多消费者可能
  │
  ├── topic /cmd_vel (geometry_msgs/Twist, 20Hz, 48 bytes)
  │     →  Signal "robot.cmd_vel"  (6 个 F64 的 struct)
  │        理由: 低频、小消息、单生产者、只需要最新值
  │
  ├── topic /joint_states (sensor_msgs/JointState, 100Hz)
  │     →  StreamChannel<Array<F64>> "robot.joint_states"
  │        理由: 高频、批量数组、需要完整时间序列
  │
  └── service /get_map (nav_msgs/GetMap, ~10s 一次, 响应 MB 级)
        →  RPC "get_map" → Blob (地图数据)
           理由: 请求/回复语义、低频、大载荷
```

- 控制类 topic（低速、值更新）：**Signal**
- 感知类 topic（高频、批量、大消息）：**StreamChannel**
- Service：**RPC**

### 10.4 移植 dora-rs 功能

dora-rs 的数据流模型直接映射：

```
dora 风格 operator (移植为 AUDESYS Component)
  │
  ├── 输入 stream: camera/image (Arrow IPC buffer, ~2MB/frame, 30Hz)
  │     →  StreamChannel<Blob> "camera.image"
  │        理由: 大载荷、零拷贝、需要缓冲
  │
  ├── 输出 stream: detection/bboxes (Array<F32>, ~1KB/frame)
  │     →  StreamChannel<Array<F32>> "detection.bboxes"
  │        理由: 批量输出、下游可能有多个消费者
  │
  └── 配置: runtime parameters (threshold, model_path)
        →  Signal<F32> "detector.confidence_threshold"
        →  Signal<Blob> "detector.model_path" (read-only, 启动时设置)
```

- Arrow buffer → `Blob`（零拷贝传递，HAL 不解析 Arrow 格式）
- 结构化输出 → `Array<F32>`
- 运行参数 → `Signal`（单值，最新值覆盖，支持变更通知）

### 10.5 多语言延迟预算

| 语言 | API 绑定 | Signal (延迟) | StreamChannel (延迟) | 适用场景 |
|------|---------|:---:|:---:|------|
| **Rust** | 原生 Typed API | < 1μs | 0 开销 | RT 控制 (Controller, Driver) |
| **C/C++** | FFI | 1–5μs | +5μs | RT 控制 / 遗留代码移植 |
| **Node.js** | napi-rs | 10–50μs | +50μs | 配置面 (Supervisor), HMI (Panel) |
| **Python** | PyO3 + numpy memoryview | 50–500μs | +100μs | SCADA 监控, 离线分析, 数据科学 |

**说明**：Python 延迟来自 GIL + PyO3 调用开销。StreamChannel 高吞吐（> 100 MB/s）场景建议 Rust/C++ 消费端，Python 仅用于低频监控。numpy memoryview 零拷贝路径可避免逐元素 Python 对象分配。

---

## 11. ROS2 Actions 映射

### 11.1 设计原则

ROS2 Action 不是一个新的**通信模式**，而是一个**编排模式**——它将 Goal（发起）、Feedback（周期进度）、Result（最终结果）、Cancel（取消）四个阶段组合在一起。

AUDESYS HAL 的三原语已经具备了 Action 所需的全部通信能力：
- **RPC**：Goal 发起、Cancel、Result 获取
- **StreamChannel**：周期 Feedback 流
- **Signal**：状态变更通知（running / done / cancelled / error）

新增第 4 种原语会增加 amw trait 5 个方法，但语义完全可由现有原语拼装。

### 11.2 Action 语义分解

```
                    ┌─────────────────────────┐
                    │      ROS2 Action         │
                    └───────────┬─────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        │                       │                       │
        ▼                       ▼                       ▼
┌───────────────┐    ┌─────────────────────┐    ┌──────────────┐
│     RPC       │    │    StreamChannel     │    │    Signal    │
│               │    │                     │    │              │
│ start_action  │    │ action.{id}.feedback │    │ action.{id}. │
│   → action_id │    │  周期进度更新         │    │   status     │
│               │    │                     │    │              │
│ cancel_action │    │ "homing 完成 60%"     │    │ running /    │
│               │    │ "当前轴: Y"           │    │ done /       │
│ get_result    │    │                     │    │ cancelled /  │
│   → result    │    │                     │    │ error        │
└───────────────┘    └─────────────────────┘    └──────────────┘
```

**时序图**：

```
Client                          ActionServer                       HAL
  │                                  │                              │
  │── start_action(goal) ──────────►│                              │
  │                                  │── RPC: home_axis.start ────►│
  │                                  │◄── { action_id: "H001" } ───│
  │◄── { action_id: "H001" } ───────│                              │
  │                                  │                              │
  │                                  │── Signal: action.H001.status│
  │◄── Signal "running" ────────────│   = "running"               │
  │                                  │                              │
  │                                  │── Stream: action.H001.fb ──►│
  │◄── Stream { progress: 0.4 } ────│── Stream { progress: 0.4 } ─│
  │◄── Stream { progress: 0.8 } ────│── Stream { progress: 0.8 } ─│
  │◄── Stream { progress: 1.0 } ────│── Stream { progress: 1.0 } ─│
  │                                  │                              │
  │                                  │── Signal: action.H001.status│
  │◄── Signal "done" ───────────────│   = "done"                  │
  │                                  │                              │
  │── get_result(H001) ────────────►│                              │
  │                                  │── RPC: home_axis.get_result►│
  │                                  │◄── { success: true } ───────│
  │◄── { success: true } ───────────│                              │
```

**取消时序**：

```
Client                          ActionServer                       HAL
  │                                  │                              │
  │── cancel_action(H001) ─────────►│                              │
  │                                  │── RPC: home_axis.cancel ───►│
  │                                  │◄── { accepted: true } ──────│
  │◄── { accepted: true } ──────────│                              │
  │                                  │                              │
  │                                  │── Signal: action.H001.status│
  │◄── Signal "cancelled" ──────────│   = "cancelled"             │
  │                                  │                              │
  │                                  │── Stream: action.H001.fb ──►│
  │◄── Stream { progress: 0.5 } ────│── Stream { progress: 0.5 } ─│
  │    (最后一个 feedback)            │                              │
```

### 11.3 工业场景映射

| 工业场景 | Goal | Feedback | Result | Cancel | 典型时长 |
|----------|------|----------|--------|--------|----------|
| **回零** | "轴 X 回零" | 当前位置、阶段(fast/slow) | 成功 + 零位偏移 | 急停 | 5–30s |
| **换刀** | "刀号 3" | 刀库旋转角度 | 成功 + 刀偏值 | 停止旋转 | 2–10s |
| **校准** | "传感器校准" | 采样进度、残差 | 校准参数 | 保留旧参数 | 10–120s |
| **固件升级** | "hex 文件路径" | 写入进度、扇区号 | 校验和 + 版本 | 回滚 | 30–300s |
| **轨迹执行** | "G-code 文件路径" | 当前行号、轴位置 | 完成 + 执行行数 | 暂停 → 取消 | 可变 |
| **预热** | "目标温度 200°C" | 当前温度、功率 | 到达并稳定 | 停止加热 | 30–600s |

### 11.4 ActionBuilder（应用层便利 API）

ActionBuilder **不是 HAL 协议的一部分**——它是 `packages/hal-action/` 中的可选库，组合 RPC + StreamChannel + Signal 实现 Action 语义。

```rust
/// 应用层 Action 构建器，组合三种 HAL 原语
pub struct ActionBuilder {
    amw: Arc<dyn AmwMiddleware>,
}

/// Action 句柄 — 启动后返回
pub struct ActionHandle {
    pub action_id: String,
    feedback_rx: Box<dyn StreamReader>,      // StreamChannel 反馈
    status_sub: Subscription,                 // Signal 状态变更
    result_pending: oneshot::Receiver<Result<Vec<u8>>>,
}

impl ActionBuilder {
    /// 启动一个 Action
    ///
    /// 内部：
    /// 1. RPC: {method}_start → 获取 action_id
    /// 2. subscribe Signal: action.{action_id}.status
    /// 3. open StreamChannel: action.{action_id}.feedback
    pub async fn start(
        &self,
        action_name: &str,         // "home_axis"
        goal: &[u8],               // FlatBuffers 序列化的 Goal
        timeout_ms: u64,
    ) -> Result<ActionHandle> {
        // 1. 发起 Goal
        let rpc_method = format!("{}.start", action_name);
        let response = self.amw.call_rpc(&rpc_method, goal, timeout_ms)?;
        let action_id = parse_action_id(&response)?;

        // 2. 订阅状态 Signal
        let status_signal = format!("action.{}.status", action_id);
        let status_sub = self.amw.subscribe_signal(&status_signal, |val, _ts| {
            if let HalValue::S32(status) = val {
                match status {
                    0 => log::info!("Action started"),
                    1 => log::info!("Action completed"),
                    2 => log::warn!("Action cancelled"),
                    3 => log::error!("Action error"),
                    _ => {}
                }
            }
        })?;

        // 3. 打开反馈 StreamChannel
        let feedback_stream = format!("action.{}.feedback", action_id);
        let feedback_rx = self.amw.open_stream(&feedback_stream)?;

        // 4. 挂起 Result 等待（内部通过 Signal done → RPC get_result）
        let (tx, rx) = oneshot::channel();
        // ... background task listens for status=done, then calls get_result ...

        Ok(ActionHandle {
            action_id,
            feedback_rx,
            status_sub,
            result_pending: rx,
        })
    }

    /// 取消一个 Action
    pub async fn cancel(
        &self,
        action_name: &str,
        action_id: &str,
    ) -> Result<bool> {
        let rpc_method = format!("{}.cancel", action_name);
        let response = self.amw.call_rpc(
            &rpc_method,
            &serde_json::to_vec(&json!({"action_id": action_id}))?,
            5000,
        )?;
        let result: CancelResponse = serde_json::from_slice(&response)?;
        Ok(result.accepted)
    }

    /// 获取 Action 结果
    pub async fn get_result(
        &self,
        action_name: &str,
        action_id: &str,
        timeout_ms: u64,
    ) -> Result<Vec<u8>> {
        let rpc_method = format!("{}.get_result", action_name);
        self.amw.call_rpc(&rpc_method, &serde_json::to_vec(
            &json!({"action_id": action_id})
        )?, timeout_ms)
    }
}
```

### 11.5 ActionServer 侧（Component trait 扩展）

```rust
/// 支持 Action 的 Component 实现额外的 RPC 方法
trait ActionComponent: HalComponent {
    /// 列出本组件的 Action 列表
    fn list_actions(&self) -> Vec<ActionDefinition> {
        vec![]
    }

    /// 处理 Action RPC
    fn handle_action_rpc(&self, method: &str, params: &[u8])
        -> Result<Vec<u8>>
    {
        Err(Error::NotSupported)
    }
}

struct ActionDefinition {
    name: String,           // "home_axis"
    goal_schema: String,    // FlatBuffers schema name
    result_schema: String,  // FlatBuffers schema name
    is_cancellable: bool,
}
```

**HomeAxis Action 实现示例**：

```rust
impl ActionComponent for HomeAxisComponent {
    fn list_actions(&self) -> Vec<ActionDefinition> {
        vec![ActionDefinition {
            name: "home_axis".into(),
            goal_schema: "HomeAxisGoal".into(),
            result_schema: "HomeAxisResult".into(),
            is_cancellable: true,
        }]
    }

    fn handle_action_rpc(&self, method: &str, params: &[u8])
        -> Result<Vec<u8>>
    {
        match method {
            "home_axis.start" => {
                let goal: HomeAxisGoal = flatbuffers::from_slice(params)?;
                let action_id = format!("home_axis_{}", uuid::Uuid::new_v4());

                // 启动后台 RT 回零任务
                self.start_homing(action_id.clone(), goal.axis, goal.speed);

                Ok(serde_json::to_vec(&json!({
                    "action_id": action_id,
                    "accepted": true
                }))?)
            }
            "home_axis.cancel" => {
                let req: CancelRequest = serde_json::from_slice(params)?;
                self.cancel_homing(&req.action_id);
                Ok(serde_json::to_vec(&json!({"accepted": true}))?)
            }
            "home_axis.get_result" => {
                let req: ResultRequest = serde_json::from_slice(params)?;
                let result = self.get_homing_result(&req.action_id)?;
                Ok(flatbuffers::to_vec(&result)?)
            }
            _ => Err(Error::MethodNotFound(method.into())),
        }
    }
}
```

### 11.6 命名规范

```
action.{action_id}.status     # Signal: Action 状态
action.{action_id}.feedback   # StreamChannel: Action 进度
{component}.{action}.start    # RPC: Goal 发起
{component}.{action}.cancel   # RPC: 取消
{component}.{action}.get_result # RPC: 获取结果
```

**状态码**（Signal `S32`）：

```
0 = running     # Action 执行中
1 = done        # 成功完成
2 = cancelled   # 被取消
3 = error       # 执行失败
```

### 11.7 与 ROS2 Action 的差异

| | ROS2 Action | AUDESYS Action (方案 B) |
|---|---|---|
| 抽象层 | 独立原语（rmw + rclcpp action client/server） | 组合原语（RPC + StreamChannel + Signal） |
| 服务发现 | 通过 DDS 自动发现 | 通过 amw HalDiscovery 注册 |
| 消息格式 | ROS2 `.action` IDL | FlatBuffers schema |
| Cancel 机制 | 内建 cancel service | 独立 RPC |
| 超时 | 依赖 DDS QoS | `call_rpc` 的 `timeout_ms` 参数 |
| 依赖 | 必须 ROS2 | 可选（`packages/hal-action/`） |

---

## 12. 功能安全

### 12.1 背景与边界

**诚实声明**：AUDESYS 当前为零代码规划阶段。IEC 61508（工业功能安全）和 ISO 13849（机械安全）的认证需要数百人年级别的工程、第三方认证机构（TÜV、exida）、FMEDA/FTA/DCCA 等安全分析、全生命周期文档。

**AUDESYS 不做 SIL 认证**。本设计的唯一目标是：**确保架构不堵死未来认证路径**。

**当前 HAL 的问题**：所有数据——急停信号、安全门限位、温度显示、配方参数——在 HAL 中完全等同，走相同的 Signal / StreamChannel 路径。

```
急停按钮 → HAL Signal "safety.estop" → Controller
限位开关 → HAL Signal "safety.limit" → Controller
温度显示 → HAL Signal "sensor.temp"   → Panel
```

在 SIL 系统中，这是不可接受的——安全数据必须与非安全数据隔离。

### 12.2 黑色通道（Black Channel）模型

IEC 61508 / EN 50159 的核心设计模式：**安全层叠加在非安全通道之上**。

```
┌──────────────────────────────────────────────────┐
│              Safety Layer (SIL 1-3)              │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │  Safety Protocol                    │        │
│  │  - CRC / sequence number            │        │
│  │  - Timestamp / timeout              │        │
│  │  - Dual-channel cross-check         │        │
│  │  - SIL 3 certified runtime          │        │
│  └──────────────┬───────────────────────┘        │
│                 │                                 │
│                 │ 透明字节流                       │
│                 │                                 │
└─────────────────┼─────────────────────────────────┘
                  │
┌─────────────────┼─────────────────────────────────┐
│                 │                                 │
│  ┌──────────────┴───────────────────────┐        │
│  │    AUDESYS HAL (非安全)              │        │
│  │    Signal / StreamChannel / RPC      │        │
│  │                                      │        │
│  │    HAL 职责:                         │        │
│  │    - 运输字节（Blob / Array）         │        │
│  │    - 保证时序（Signal latency）       │        │
│  │    - 不做安全判决                     │        │
│  └──────────────────────────────────────┘        │
│                                                  │
│  ┌──────────────────────────────────────┐        │
│  │    Transport (Zenoh/UDS)             │        │
│  └──────────────────────────────────────┘        │
└──────────────────────────────────────────────────┘
```

**黑色通道原则**：
- 通道（HAL + Transport）不要求安全——可以故障、丢包、延迟
- 安全层通过 CRC、序列号、超时检测通道故障
- 通道故障时安全层进入安全状态（如急停）

### 12.3 AUDESYS 现在做的三件事

#### 12.3.1 Signal 元数据标记 `safety_integrity`

```rust
struct Signal {
    name: String,
    sig_type: HalPinType,
    readers: Vec<String>,
    writer: Option<String>,
    value: HalValue,

    // ═══ 安全标记（新增） ═══
    safety_integrity: SafetyIntegrityLevel,  // 默认 SIL0
}

enum SafetyIntegrityLevel {
    SIL0,    // 非安全（如温度显示、配方参数）
    SIL1_2,  // 安全相关（如安全门监控、光幕）
    SIL3,    // 高安全（如急停、安全转矩关断）
}
```

**HAL 用此标记做什么**：只用于路由决策——安全信号可能优先传输、独立监控通道、日志级别更高。**不做安全判决**。

**HAL 不用此标记做什么**：不做 CRC 校验、不做冗余投票、不做 watchdog 判决。

#### 12.3.2 安全信号按 `Blob` 透明运输

安全层运行时将安全数据打包为带 CRC + 序列号 + 时间戳的二进制帧，HAL 作为 `Blob` 运输：

```rust
// 安全运行时 — 在 HAL 上层
let safety_frame = SafetyFrame::new(estop_state, crc, seq_num, timestamp);
let blob = safety_frame.encode();
hal.publish_blob("safety.estop_channel_1", blob)?;

// HAL — 不解析内容，只运输
// 另一端：
let blob = hal.subscribe_signal("safety.estop_channel_1")?;
let frame = SafetyFrame::decode(blob)?;
if !frame.validate_crc() {
    emergency_stop();  // 通道故障 → 安全状态
}
```

HAL 不知道它是安全数据——只知道它是一个 `Blob`。安全协议完全在安全运行时层实现。

#### 12.3.3 STO（Safe Torque Off）独立物理路径

**文档声明**：安全输出走独立继电器或安全 PLC——不通过 AUDESYS HAL。

```
┌──────────────────┐    ┌──────────────────┐
│  Safety PLC      │    │  AUDESYS HAL     │
│  (SIL 3 认证)    │    │  (SIL0)          │
│                  │    │                  │
│  急停按钮 ──→     │    │  温度显示 ──→     │
│  安全门 ──→      │    │  配方参数 ──→     │
│  光幕 ──→        │    │  轴位置 ──→       │
│                  │    │                  │
│  继电器输出 ──→   │    │                   │
│  (物理 STO)      │    │                   │
└──────────────────┘    └──────────────────┘
```

**安全 PLC 和 AUDESYS 之间是单向通信**：
- AUDESYS 读取安全 PLC 状态（显示急停状态在 HMI 上）
- AUDESYS **不写**安全 PLC 的输出（STO 由安全 PLC 直接控制）

这是典型的工业实践——安全和非安全网络物理隔离。

### 12.4 明确边界

| HAL 做 | HAL 不做 |
|--------|---------|
| 运输安全标记 `safety_integrity` 元数据 | 基于此标记做安全判决 |
| 运输安全帧为 `Blob`（透明） | 解析/校验安全帧内容 |
| 提供确定性传输延迟 | 声称任何 SIL 等级 |
| 暴露安全信号的独立监控通道 | CRC、投票、watchdog 判决 |
| 日志记录安全信号的传输事件 | 安全审计追踪 |

### 12.5 未来认证路径

当 AUDESYS 成熟到可以追求 SIL 认证时，需要：

| 阶段 | 内容 | 工作量估计 |
|------|------|-----------|
| 1 | 基于 IEC 61508-3 的 V-Model 开发流程 | 全项目周期 |
| 2 | FMEDA（失效模式影响及诊断分析） | 6-12 人月 |
| 3 | 安全运行时开发（含 CRC、序列号、双通道比较） | 12-24 人月 |
| 4 | 第三方认证（TÜV Rheinland / exida） | 6-12 个月 |
| 5 | 安全手册、使用指南、生命周期文档 | 持续 |

**当前架构的优势**：HAL 的黑色通道模型和 `safety_integrity` 元数据已为认证路径做好准备，不需要结构性重写。

---

## 13. 分阶段实施路线

| 阶段 | 里程碑 | 验证方式 |
|------|--------|---------|
| **Phase 1** | 扩展类型系统到 14 种，FlatBuffers schema 更新 | 序列化/反序列化单元测试覆盖所有类型 |
| **Phase 2** | Signal 原语实现（InProcess + UDS transport） | 两个 Component 通过 Signal 交换 Pin 值，延迟 < 10μs |
| **Phase 3** | StreamChannel 原语实现 + 三种 QueuePolicy | 生产者 10MB/s → 消费者无丢帧 |
| **Phase 4** | RPC 原语实现（timeout, idempotency） | loadComponent → configureComponent → activateComponent 流程 |
| **Phase 5** | 移植 LinuxCNC motion planner 验证 Signal 模型 | 6 轴轨迹通过 Signal 发布，RT 周期内完成 |
| **Phase 6** | 移植 OpenPLC IEC runtime 验证 Array + Blob | 梯形图扫描周期 I/O 通过 Array<S32> 传输 |
| **Phase 7** | 移植 ROS2 节点验证三种原语协同 | topic + service 全部通过 AUDESYS HAL 通信 |
| **Phase 8** | 移植 dora-rs operator 验证 StreamChannel 高吞吐 | 2MB/frame 摄像头流零拷贝传输 |

---

## 14. 协议规格 (YAML)

```yaml
hal_protocol_version: 2

primitives:
  signal:
    writers: 1
    readers: "1..N"
    semantics: latest_value
    consumer_modes: [push, pull, pull_batch]
    buffer: none
    update_on_write: true
    size_range: "1B..64KB"
    naming:
      signal:
        pattern: "component.[interface.]name"
        canonical: lowercase
        component: { charset: "[a-z0-9][a-z0-9-]*", max: 64, reserved: [hal, amw, system, _] }
        interface: { charset: "[a-z0-9][a-z0-9-]*", max: 32, optional: true }
        name: { charset: "[a-z0-9_]+", max: 64 }
      stream:
        pattern: "domain.stream_name"
        canonical: lowercase
        domain: { charset: "[a-z0-9][a-z0-9-]*", max: 32 }
        stream_name: { charset: "[a-z0-9_]+", max: 64 }

  stream_channel:
    writers: "1..N"
    readers: "1..N"
    semantics: ordered_queue
    queue_depth: configurable (default 256)
    overflow_policy: [DropOldest, Backpressure, DropNewest]
    error_policy:
      on_consumer_error: Notify
    circuit_breaker:
      enabled: false
      max_consecutive_failures: 3
      cooldown_ms: 5000
      on_open: Notify
    shm_threshold_bytes: 4096
    size_range: "1B..100MB"
    naming: "domain.stream_name"

  rpc:
    pattern: request_reply
    request_id: uint64 (auto_increment)
    timeout_ms: configurable (default 5000)
    idempotency_flag: optional boolean
    partial_failure: not_supported (all_or_nothing)

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

parameter_system:
  schema:
    per_component: ParamDef[]  # Component 声明它的参数
    fields:
      - name: 参数名（camelCase）
      - param_type: HalPinType
      - default: 默认值（可选）
      - min/max: 范围约束（数值类型可选）
      - required: 是否必填
      - version: schema 版本号（变更时递增）
  validation:
    on_configure: RPC 侧自动校验
      - required 字段是否存在
      - 类型是否匹配 param_type
      - 范围是否在 [min, max] 内
      - version 是否兼容（不匹配 → 警告）
  persistence:
    owner: Supervisor
    format: component_params.yaml
    lifecycle: loadComponent 时注入 → configureComponent 时更新
  studio_ui:
    auto_generate: 从 ParamDef[] 生成配置表单

middleware:
  amw:
    design: "参考 ROS2 rmw，传输、发现与 QoS 解耦"
    traits:
      - HalTransport: "数据面 — publish/subscribe Signal, StreamChannel create/open, expose/call RPC"
      - HalDiscovery: "控制面 — register/unregister/lookup/watch"
      - HalQoS: "服务面 — deadline/liveliness/security_domain"
    implementations:
      - name: amw_inproc
        phase: 1
        discovery: none
        qos: deadline(rt_tick_timer), liveliness(none), security_domain(none)
        transport: InProcess (typed API, no serialization)
      - name: amw_zenoh
        phase: "2..4"
        discovery: "Zenoh key-value store (hal/registry/**)"
        qos: "deadline(zenoh_timer_callback), liveliness(zenoh_token), security_domain(keyexpr_prefix)"
        transport: "UDS → Zenoh TCP → Zenoh SHM"

types:
  scalars:
    - { name: Bool, width: 1 }
    - { name: S8,   width: 8,  signed: true }
    - { name: U8,   width: 8,  signed: false }
    - { name: S16,  width: 16, signed: true }
    - { name: U16,  width: 16, signed: false }
    - { name: S32,  width: 32, signed: true }
    - { name: U32,  width: 32, signed: false }
    - { name: S64,  width: 64, signed: true }
    - { name: U64,  width: 64, signed: false }
    - { name: F32,  width: 32, float: true }
    - { name: F64,  width: 64, float: true }

  containers:
    - { name: String, schema: "byte_length(u32) + data(u8[])", note: "UTF-8 编码，与 Blob 同构但语义为文本" }
    - { name: Blob, schema: "length(u32) + data(u8[])" }
    - { name: Array, schema: "pad(u32) + count(u32) + elements(T[])", note: "pad 对齐 T 到 8 字节边界" }

metadata:
  timestamp_source: [monotonic, ptp, ntp]
    phase_1_2: monotonic   # 单机 CLOCK_MONOTONIC 足矣
    phase_3_plus: ptp       # 跨机需 PTP/IEEE 1588
    fallback: ntp           # PTP 不可用时降级 NTP (ms 级)
    field: Signal.meta.timestamp_source   # 每个 Signal 可指定

transport:
  phases:
    - phase: 1
      mode: InProcess
      serialization: none (Typed API)
      latency: "< 1μs"
      condition: "同进程函数调用, 无序列化开销"
    - phase: 2
      mode: UDS + FlatBuffers
      serialization: FlatBuffers over Unix Domain Socket
      latency: "~10μs (典型), 6–30μs (范围)"
      condition: "PREEMPT_RT 内核, 消息 < 1KB"
      scope: single_host
    - phase: 3
      mode: Zenoh TCP
      serialization: FlatBuffers over Zenoh
      latency: "~100μs (典型), 50–500μs (范围)"
      condition: "1Gbps 以太网, 消息 < 64KB"
      scope: multi_host
    - phase: 4
      mode: Zenoh SHM
      serialization: FlatBuffers (small), raw SHM (Blob/Array >= 4KB)
      latency: "~1μs* (零拷贝 Blob), ~10μs (FlatBuffers 小消息)"
      condition: "* 仅 ≥ 4KB Blob/Array 走零拷贝路径"
      guarantees:
  single_writer: "Zenoh 保证 keyexpr 同一时刻唯一 publisher；InProc 由 Arc<RwLock<>> 保证"
```

---

## 15. 延迟验证方法

延迟声明基于典型硬件和软件条件。实际部署前需通过以下方法验证：

```yaml
验证方法:
  InProcess:
    tool: criterion bench
    metric: p50 / p95 / p99
    workload: 1M 次 typed API publish/subscribe 操作

  UDS:
    tool: linux-perf + Ftrace
    metric: p50 / p95 / p99 端到端延迟
    workload: 256-byte FlatBuffers 消息, 100K 次
    kernel: PREEMPT_RT

  Zenoh TCP:
    tool: tcpdump 时间戳差值 + zenoh ping benchmark
    metric: p50 / p95 / p99 RTT
    workload: 1KB–64KB 消息, 1Gbps 以太网

  Zenoh SHM:
    tool: criterion bench + rdtsc 差值
    metric: publish → subscriber callback 的 CPU 周期数
    workload: 4KB–64MB Blob, 同一物理主机
```

**原则**：延迟数字是设计目标，不是实现保证。验证结果写入审计报告。

---

## 16. 设计决策记录

### 16.1 协议与通信原语

| 决策 | 理由 |
|------|------|
| Signal / StreamChannel 不合并 | 控制信号（零缓冲低延迟）与数据流（有缓冲高吞吐）不可调和，ROS2 十年教训 |
| RPC 不拆成一对 Signal | 拆开会丢掉超时、幂等、请求/响应关联——对配置操作不可接受 |
| 不做跨语言 RPC 统一 | RPC 只在控制面使用（JSON-RPC 2.0），数据面走 Signal / StreamChannel + FlatBuffers |
| FlatBuffers 用于 HAL-native 标量，Blob 透传 Arrow/Protobuf | 小控制报文用 FlatBuffers 零拷贝访问标量，大载荷走 Blob 透传（HAL 不解析 Arrow IPC / Protobuf / CAN frame）。参考 dora-rs 同类设计决策 |
| SHM 阈值设为 4KB | 参考 dora-rs 的 ZERO_COPY_THRESHOLD，小消息走 UDS/TCP 更简单 |

### 16.2 amw 中间件

| 决策 | 理由 |
|------|------|
| amw 抽象层（HalTransport + HalDiscovery + HalQoS）| 参考 ROS2 rmw 模式。传输/发现/QoS 实现可替换（Zenoh ↔ DDS ↔ MQTT），API 不变。Zenoh 从 Phase 2 接入，Phase 1→4 零迁移 |
| 发现用 Zenoh 而非 Supervisor | 单机 Supervisor 在 Phase 3 跨机成瓶颈。Zenoh 键表达式天然支持分层发现 + liveliness 监控 |
| HalQoS 作为独立 trait（非混入 HalTransport） | 关注面分离。Liveliness 是控制面、Security 是配置面——和 Transport 的数据面职责不同 |
| HalQoS 与 HalTransport/HalDiscovery 平齐 | 和 amw 抽象层一致——三个 trait，一个 AmwMiddleware 组合 |
| Deadline 监控在 RT 数据面 | 编码器断连 → 同 RT 周期触发，Supervisor 延迟不可接受 |
| Liveliness 在控制面 | 组件心跳丢失不是微秒级事件；Zenoh 原生处理，100ms 级足够 |
| Security Domain 在配置面 | 纯 meta 标记，zero runtime overhead；静态隔离，不参与 RT 路径 |
| 各 amw 实现自行解释 HalQoS | 同 HalTransport/HalDiscovery 哲学。inproc 无 Liveliness 是语义正确，不是缺失 |
| 不做 DDS 式 QoS 映射（reliable/best-effort 等） | AUDESYS 的 Signal 天然 latest-value, StreamChannel 有 QueuePolicy。那是另一个维度，不混合 |

### 16.3 类型系统

| 决策 | 理由 |
|------|------|
| 类型扩展为 14 种而非只加 F32 | IEC 61131-3 需要 S8/U8/S16/U16/TIME/DATE/TOD/DT，不能靠"用更大的类型兜底"——那会破坏语义、浪费带宽 |
| String 新增为独立类型 | 和 Blob 语义不同（文本 vs 不透明字节），HMI 需区分。PLC 报警消息、设备名、配方名专用 |
| WSTRING 不加 | UTF-8 统一编码，需 UTF-16 时消费端转换 |
| TIME/DATE/TOD/DT 不加，用现有数值 | 各 PLC 运行时内部表示不同，HAL 应保持编码无关；类型转换是 IEC 运行时层的职责 |
| Blob 不进类型推导 | HAL 不解析 Blob 内容，格式由生产者和消费者协商，避免 HAL 变成又一个 DDS |
| Array<T> 用 count + elements 而非 FlatBuffers vector | 保持与 Blob 一致的前缀长度格式，简化 SHM 零拷贝路径 |
| BYTE/WORD/DWORD/LWORD 不独立，用 U8/U16/U32/U64 | HAL 值有类型但无修饰符，位串语义由消费端维护 |
| 位级访问不进入 HAL 类型系统 | PLC 的 `%MW0.3`（WORD bit 3）由 Studio compiler 映射为独立 `Signal<Bool>`，HAL 不感知位偏移 |
| RETAIN 变量不在 HAL 层 | 持久化由 Component 自行管理（文件/SQLite），HAL 只传输运行时值 |

### 16.4 线程调度

| 决策 | 来源 | 理由 |
|------|------|------|
| 显式 funct_list | LinuxCNC | 工业级确定性：顺序显式声明，可审计、可验证、可查询 |
| read→update→write 三阶段 | ROS2 control | 阶段分离使 I/O 读、逻辑计算、I/O 写独立可测、可追踪 |
| 扫描屏障 read_barrier / write_barrier | OpenPLC | I/O 映像在逻辑执行期间冻结，防止后台线程并发修改 |
| 过运行跳过 + ALARM Signal | ROS2 control | 比 OpenPLC 仅日志更健壮，比 LinuxCNC 仅 pin 更主动 |
| 周期整数倍约束 | LinuxCNC | Rate Monotonic 可调度性分析前提，防止周期漂移导致的优先级反转 |
| Reentrant 标志 | LinuxCNC | `reentrant=0` 安全默认（单线程），高级用户 opt-in（`reentrant≠0`） |
| I/O 线程事件驱动 | dora-rs | 非 RT 通信不应占用 RT 周期，异步 I/O 线程独立运行 |
| Stream Worker 事件驱动 | dora-rs | 高吞吐数据流（点云、图像）不应挤占控制周期 |
| 运行时指标暴露为 Signal | LinuxCNC | `thread.runtime_ns`、`thread.runtime_max_ns`、`thread.overrun` 通过 HAL 可见 |
| dynamic 添加/移除函数 | LinuxCNC | RPC 命令 (`addFunction`, `removeFunction`, `reorderFunction`) + 配置文件 |

### 16.5 扫描屏障

| 决策 | 理由 |
|------|------|
| Signal 快照 — copy-on-read | 轻量，不需要持续加锁，与 OpenPLC bufferLock 等效但线程友好 |
| I/O 映像锁仅在 Phase 1 + 3 持有 | Phase 2 (update) 期间 I/O 线程可自由读写，最大化吞吐 |
| 多 OUT Signal 原子 push | `flush_out_signals()` 一次性推送，保证订阅者看到完整周期输出 |
| 不暴露 Barrier/Latch/Semaphore 为 HAL 原语 | HAL 协议不应承担调度或同步职责，否则违反 Sans-I/O 原则 |
| Component 不碰锁 | Component 开发者不需要懂 RT 同步——只需声明 phase 归属 |

### 16.6 Config Barrier 与 LockLevel

| 决策 | 理由 |
|------|------|
| Config Barrier 而非实时应用 | mid-cycle 配置变更 = segfault 风险。队列 + 周期边界批量应用是最小化安全保证 |
| LockLevel 从运行时锁 → 权限分级 | LinuxCNC 的 LockLevel 依赖开发者自觉在正确时机调用；AUDESYS 作为多进程系统必须强制 |
| `Run` 级别拒绝所有 RPC（含参数修改） | LinuxCNC 允许 Run 时改参数（hal_set_pin），但那是单进程模型的安全默认。多进程 Supervisor 应显式降级为 `Params` 才允许 |
| Config Generation 递增 + Signal 确认 | 异步系统必须可观测——Supervisor 不能靠"大概生效了"。G 数递增 + Signal 提供确定性确认 |
| pending_config 用 bounded channel | 防止 Supervisor 无限堆积配置命令。队列满 → ConfigQueueFull error（Supervisor 自行重试） |
| 降级路径强制 deactivateComponent | 防止运行中降锁导致半初始化组件进入 RT 周期——先停所有组件，再改配置 |

### 16.7 实时内存与调度

| 决策 | 理由 |
|------|------|
| PreAllocPool — 固定容量永不扩容 | 防止 RT 周期 `Vec::push` 触发 realloc，参考 LinuxCNC shm segment |
| 空闲槽位栈 (LIFO) | O(1) alloc/free，Cache 局部性优于 free list |
| HashMap 仅在 activate 阶段分配 | 生命周期回调非 RT 热路径，允许一次性分配 |
| `mlockall` + `madvise(WILLNEED)` | LinuxCNC 验证过的防缺页方案 |
| 周期整数倍约束 | RMS 可调度性分析前提，LinuxCNC 二十年的 DL 经验 |
| 周期 ≥ 1ms 硬限制 | SCHED_FIFO 在 < 1ms 时抖动显著增加，Linux RT_PREEMPT 实践 |
| RMS 利用率分析仅警告 | Liu & Layland bound 是充分非必要条件；严格拒绝会阻碍有效系统的部署 |
| 优先级递减（短周期高优先级）| Rate Monotonic 最优策略，所有硬 RT 系统的默认选择 |

### 16.8 I/O 映射

| 决策 | 理由 |
|------|------|
| IoImageTable 不在 HAL 协议内 | HAL 只传输值，不关心来源。映射是驱动层内部关注 |
| 逻辑-物理分离 | 更换总线时上层程序零修改 |
| AddressSpace 枚举而非仅 Array | MODBUS 离散/线圈/寄存器的语义不同，EtherCAT PDO 是结构化偏移 |
| Multi-register 合并（len > 1） | 32-bit 值跨两个 MODBUS 寄存器很常见 |
| SDO / named subindex 扩展 | EtherCAT SDO 有 subindex，PROFINET 有名路径 |
| 快照而非逐点传输 | 一致性保证——整个域在同一时刻的快照，不是逐个 pin |
| 多资源（Multi-Resource）用 security_domain 隔离 | IEC 61131-3 多个 CPU（Resource）共享同一个 Configuration。每个 Resource 映射为独立 Component，通过 `security_domain` + keyexpr 前缀天然隔离，无需 HAL 新增原语 |

### 16.9 ROS2 Actions

| 决策 | 理由 |
|------|------|
| 不引入第 4 种原语 | Action = RPC + StreamChannel + Signal 组合。新增原语会使 amw trait 膨胀 5 个方法 |
| ActionBuilder 在 packages/ 而非 HAL Core | Action 是应用层概念，不应在 HAL 协议层强制要求 |
| 状态用 Signal 而非 StreamChannel | 状态是单值（最新值覆盖），不是流。Signal 语义完全匹配 |
| 反馈用 StreamChannel 而非 Signal | 反馈需要完整时间序列（进度追踪），不能丢弃中间值 |
| ActionComponent trait 独立于 HalComponent | 不是所有 Component 都支持 Action。PLC scan 和 servo thread 不需要 Action |
| action_id 由 Server 生成（UUID v4） | 避免 Client 冲突，且支持幂等去重 |

### 16.10 功能安全

| 决策 | 理由 |
|------|------|
| 黑色通道架构 | IEC 61508 / EN 50159 标准模型。通道不可靠，安全层保证安全 |
| `safety_integrity` 仅做元数据标记 | 路由/日志/监控据此区分安全信号，但 HAL 不做安全判决 |
| 安全帧作为 Blob 运输 | 安全协议（CRC + 序列号 + 超时）由安全运行时层处理，HAL 不解析 |
| STO 走独立物理路径 | 安全输出不通过非安全系统——工业标准实践 |
| 不声称 SIL | 认证需要数千人月工程，声称会误导用户造成危险 |
| 不做 CRC / 冗余投票 / watchdog | 这些是安全层职责，HAL 层插手是安全反模式 |

### 16.11 延迟与验证

| 决策 | 理由 |
|------|------|
| 延迟声明带前提条件 | < 1μs 是设计目标不是实现保证。每行延迟必须标注前提条件（内核、消息大小、硬件）和典型范围 |
| 延迟必须可验证 | 每个传输模式的延迟声明配套验证方法（criterion bench / linux-perf / tcpdump / rdtsc），结果写入审计报告 |

### 16.12 参数系统

| 决策 | 理由 |
|------|------|
| 参数系统声明式 schema | ParamDef[] 声明参数名、类型、范围、required、version。configureComponent RPC 自动校验。Supervisor 负责持久化 |
