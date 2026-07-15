> 拆分自 docs/hal-detailed-design.md（2026-07-15）

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

/// 可观测性指标
#[derive(Clone, Debug, Default)]
struct AmwMetrics {
    pub messages_published: u64,
    pub messages_received: u64,
    pub bytes_transmitted: u64,
    pub bytes_received: u64,
    pub active_connections: u32,
    pub queue_depth_current: u32,
    pub errors_total: u64,
}

/// 审计日志 trait — 不可变追加式审计追踪
/// Phase 1: stdout/JSON，Phase 2: syslog/journald
trait AuditLog: Send + Sync {
    fn record(&self, event: AuditEvent);
    fn flush(&self) -> Result<()>;
}

/// 审计事件结构（IEC 62443 合规）
#[derive(Clone, Debug, Serialize)]
struct AuditEvent {
    pub timestamp: String,        // ISO 8601
    pub actor: String,            // 操作主体（user/service/component）
    pub action: String,           // 操作（loadComponent/configure/link/...）
    pub resource: String,         // 操作对象
    pub result: AuditResult,
    pub metadata: BTreeMap<String, String>,
}

#[derive(Clone, Debug, Serialize)]
enum AuditResult {
    Success,
    Denied { reason: String },
    Failed { error: String },
}

// AmwMiddleware trait 补充
trait AmwMiddleware: HalTransport + HalDiscovery + HalQoS {
    fn shutdown(&self) -> Result<()>;
    fn metrics(&self) -> AmwMetrics;
    fn audit_log(&self) -> &dyn AuditLog;  // 新增
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