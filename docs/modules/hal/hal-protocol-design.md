# AUDESYS HAL 协议设计

> 生成日期：2026-07-09
> 设计目标：统一原生 HAL 协议，支持后续移植 LinuxCNC / OpenPLC / ROS2 / dora-rs 功能时原生对接

---

## 设计原则

AUDESYS HAL 协议不桥接外部协议——它本身是一个足够表达力的原生协议。移植 LinuxCNC、OpenPLC、ROS2、dora-rs 功能时，被移植的代码改造后以 AUDESYS HAL 为原生通信层。

**核心理念：用最少数量的正交原语，覆盖四种系统的全部通信模式。**

---

## 1. 三种通信原语

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
│  │  + 变长 Blob / Array<T>                   │  │
│  └──────────────────────┬────────────────────┘  │
│                         │                       │
│  ┌──────────────────────┴────────────────────┐  │
│  │         amw (AUDESYS Middleware)           │  │
│  │    HalTransport  +  HalDiscovery          │  │
│  └──────────────────────┬────────────────────┘  │
│                         │                       │
│  ┌───────┬──────────────┼──────────────┬──────┐ │
│  │InProc │  amw_zenoh   │  amw_dds     │ amw_*│ │
│  │Phase1 │  Phase2+     │  (未来)       │(未来)│ │
│  └───────┴──────────────┴──────────────┴──────┘ │
└─────────────────────────────────────────────────┘
```

### Signal — 控制信号

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
  buffer: none              # 无队列缓冲
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

### StreamChannel — 数据流

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
    DropOldest:    "队列满时丢弃最旧消息"
    Backpressure:  "队列满时阻塞写入者"
    DropNewest:    "队列满时丢弃最新消息"
  typical_size: 1B ~ 100MB
    DropOldest:    "队列满时丢弃最旧消息"
    Backpressure:  "队列满时阻塞写入者"
    DropNewest:    "队列满时丢弃最新消息"
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

### RPC — 请求/回复

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

### 为什么不合并 Signal 和 StreamChannel？

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

## 2. 中间件抽象层 (amw)

### 设计目标

参考 ROS2 `rmw`（ROS Middleware）的设计哲学，AUDESYS 定义 `amw`（AUDESYS Middleware）抽象层，将 HAL 的三种通信原语和发现机制与具体传输实现解耦。换实现不换 API，为未来替换 Zenoh（如 DDS、MQTT）预留空间。

```
        ┌──────────────────────────────────┐
        │         amw API (trait)           │
        │  HalTransport + HalDiscovery      │
        └──────────┬───────────────────────┘
                   │
     ┌─────────────┼─────────────┐
     │             │             │
┌────┴─────┐ ┌─────┴──────┐ ┌───┴──────────┐
│ amw_inproc│ │ amw_zenoh  │ │ amw_* (未来)  │
│ (Phase 1) │ │ (Phase 2+) │ │  DDS / MQTT   │
└──────────┘ └────────────┘ └───────────────┘
```

### HalTransport — 传输抽象（数据面）

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

### HalDiscovery — 发现抽象（控制面）

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

### AmwFactory — 统一入口

```rust
/// 工厂 trait — 每个 amw 实现提供一个工厂
trait AmwFactory: Send + Sync {
    fn create(&self, config: AmwConfig) -> Result<Box<dyn AmwMiddleware>>;
    fn name(&self) -> &str;  // "inproc" | "zenoh" | "dds" | ...
}

/// 组合 trait — 使用时取这个
trait AmwMiddleware: HalTransport + HalDiscovery {
    fn shutdown(&self) -> Result<()>;
    fn metrics(&self) -> AmwMetrics;
}
```

### 分阶段实现

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

## 3. 统一类型系统

当前 FlatBuffers schema 只有 6 种标量类型，不足以表达 IEC 61131-3 全类型 + LinuxCNC HAL_PORT + 裸字节流。

### 扩展方案：14 种类型

```
HALValue (FlatBuffers union) {

  // ═══ 标量（11 种） ═══
  Bool       // 布尔
             //   IEC 61131-3: BOOL
             //   LinuxCNC:    HAL_BIT

  S8         // 有符号 8-bit
             //   IEC 61131-3: SINT

  U8         // 无符号 8-bit
             //   IEC 61131-3: USINT, BYTE

  S16        // 有符号 16-bit
             //   IEC 61131-3: INT

  U16        // 无符号 16-bit
             //   IEC 61131-3: UINT, WORD

  S32        // 有符号 32-bit
             //   IEC 61131-3: DINT
             //   LinuxCNC:    HAL_S32

  U32        // 无符号 32-bit
             //   IEC 61131-3: UDINT, DWORD
             //   LinuxCNC:    HAL_U32, HAL_PORT

  S64        // 有符号 64-bit
             //   IEC 61131-3: LINT
             //   LinuxCNC:    HAL_S64

  U64        // 无符号 64-bit
             //   IEC 61131-3: ULINT, LWORD
             //   LinuxCNC:    HAL_U64

  F32        // 32-bit 浮点
             //   IEC 61131-3: REAL
             //   LinuxCNC:    HAL_FLOAT

  F64        // 64-bit 浮点
             //   IEC 61131-3: LREAL


  // ═══ 变长容器（2 种） ═══
  Blob       // 裸字节块
             //   格式: u32 length + u8[length] payload
             //   承载:
             //     - OpenPLC image table (IEC_BOOL*[BUFFER_SIZE][8])
             //     - dora-rs Arrow IPC buffer
             //     - 自定义协议帧 (Modbus PDU, CAN frame)
             //     - 无 schema 的二进制载荷
             //   Zero-copy: 走 Zenoh SHM 时，Blob 数据直接在共享内存中，读端不来拷贝

  Array<T>   // 同构批量数组
             //   格式: u32 pad(4B) + u32 count + T[count] elements
             //         pad 保证 T[0] 在 8 字节边界对齐（F64 需要）
             //   承载:
             //     - ROS2 sequence<float64> (批量关节角)
             //     - 多轴位置同步 (6 轴 F64 × N 步)
             //     - 高速采样时序列 (1000 个 ADC 读数)
             //     - OpenPLC rack I/O 映像 (批量 S32)
}
```

### 为什么加 Blob？

OpenPLC 的 image table 本质是 `IEC_BOOL *bool_input[1024][8]`——一块位图，不是结构化数据。如果 HAL 要求逐个 Pin 映射，1024 × 8 = 8192 个 `Bool` Signal，太重。`Blob` 让移植的 OpenPLC runtime 说："这块 8KB 内存是 rack 0 的输入映像"，然后通过共享内存直接读，不需要逐个 pin 穿越 HAL。

dora-rs 的 Arrow IPC buffer 同理——格式由上游协商，HAL 不解析，只负责传输。

### 为什么加 Array<T>？

三个场景需要批量传输：

1. **ROS2 `sequence<float64>`**：64 个关节角批量发布，一条消息搞定
2. **多轴位置同步**：6 轴 RT 周期内原子更新，不能拆开
3. **高速采样**：1ms 采集 1000 个 ADC 读数，一条 `Array<U16>` 而非 1000 个 Signal

---

## 4. 移植对接方案

每个被移植的系统功能根据自己的通信特征选择最合适的原语。下面描述"移植后的功能如何对接 AUDESYS HAL"——不是桥接外部协议。

### 移植 LinuxCNC 功能

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

### 移植 OpenPLC 功能

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

### 移植 ROS2 功能

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

### 移植 dora-rs 功能

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

---

## 5. 分阶段实施路线

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

### 多语言延迟预算

| 语言 | API 绑定 | Signal (延迟) | StreamChannel (延迟) | 适用场景 |
|------|---------|:---:|:---:|------|
| **Rust** | 原生 Typed API | < 1μs | 0 开销 | RT 控制 (Controller, Driver) |
| **C/C++** | FFI | 1–5μs | +5μs | RT 控制 / 遗留代码移植 |
| **Node.js** | napi-rs | 10–50μs | +50μs | 配置面 (Supervisor), HMI (Panel) |
| **Python** | PyO3 + numpy memoryview | 50–500μs | +100μs | SCADA 监控, 离线分析, 数据科学 |

**说明**：Python 延迟来自 GIL + PyO3 调用开销。StreamChannel 高吞吐（> 100 MB/s）场景建议 Rust/C++ 消费端，Python 仅用于低频监控。numpy memoryview 零拷贝路径可避免逐元素 Python 对象分配。

---

## 6. 协议规格 (YAML)

```yaml
hal_protocol_version: 2

primitives:
  signal:
    writers: 1
    readers: "1..N"
    semantics: latest_value
    consumer_modes: [push, pull, pull_batch]
    buffer: none
    buffer: none
    update_on_write: true
    buffer: none
    buffer: none
    update_on_write: true
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
    shm_threshold_bytes: 4096
    shm_threshold_bytes: 4096
    size_range: "1B..100MB"
    naming: "domain.stream_name"

  rpc:
    pattern: request_reply
    request_id: uint64 (auto_increment)
    timeout_ms: configurable (default 5000)
    idempotency_flag: optional boolean
    partial_failure: not_supported (all_or_nothing)

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
    design: "参考 ROS2 rmw，传输与发现解耦"
    traits:
      - HalTransport: "数据面 — publish/subscribe Signal, StreamChannel create/open, expose/call RPC"
      - HalDiscovery: "控制面 — register/unregister/lookup/watch"
      - HalQoS: "服务面 — deadline/liveliness/security_domain"
      - HalTransport: "数据面 — publish/subscribe Signal, StreamChannel create/open, expose/call RPC"
      - HalDiscovery: "控制面 — register/unregister/lookup/watch"
      - HalTransport: "数据面 — publish/subscribe Signal, StreamChannel create/open, expose/call RPC"
      - HalDiscovery: "控制面 — register/unregister/lookup/watch"
    implementations:
      - name: amw_inproc
        phase: 1
        discovery: none
        qos: deadline(rt_tick_timer), liveliness(none), security_domain(none)
        transport: InProcess (typed API, no serialization)
        phase: 1
        discovery: none
        transport: InProcess (typed API, no serialization)
        phase: 1
        discovery: none
        transport: InProcess (typed API, no serialization)
      - name: amw_zenoh
        phase: "2..4"
        discovery: "Zenoh key-value store (hal/registry/**)"
        qos: "deadline(zenoh_timer_callback), liveliness(zenoh_token), security_domain(keyexpr_prefix)"
        transport: "UDS → Zenoh TCP → Zenoh SHM"
        phase: "2..4"
        discovery: "Zenoh key-value store (hal/registry/**)"
        transport: "UDS → Zenoh TCP → Zenoh SHM"
        phase: "2..4"
        discovery: "Zenoh key-value store (hal/registry/**)"
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
    - { name: Blob, schema: "length(u32) + data(u8[])" }
    - { name: Array, schema: "pad(u32) + count(u32) + elements(T[])", note: "pad 对齐 T 到 8 字节边界" }

metadata:
  timestamp_source: [monotonic, ptp, ntp]
    phase_1_2: monotonic   # 单机 CLOCK_MONOTONIC 足矣
    phase_3_plus: ptp       # 跨机需 PTP/IEEE 1588
    fallback: ntp           # PTP 不可用时降级 NTP (ms 级)
    field: Signal.meta.timestamp_source   # 每个 Signal 可指定
    - { name: Blob, schema: "length(u32) + data(u8[])" }
    - { name: Array, schema: "pad(u32) + count(u32) + elements(T[])", note: "pad 对齐 T 到 8 字节边界" }
    - { name: Blob, schema: "length(u32) + data(u8[])" }
    - { name: Array, schema: "pad(u32) + count(u32) + elements(T[])", note: "pad 对齐 T 到 8 字节边界" }

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
```

---

## 7. 延迟验证方法

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

## 8. 设计决策记录

| 决策 | 理由 |
|------|------|
| Signal / StreamChannel 不合并 | 控制信号（零缓冲低延迟）与数据流（有缓冲高吞吐）不可调和，ROS2 十年教训 |
| 类型扩展为 14 种而非只加 F32 | IEC 61131-3 需要 S8/U8/S16/U16，不能靠"用更大的类型兜底"——那会破坏语义、浪费带宽 |
| Blob 不进类型推导 | HAL 不解析 Blob 内容，格式由生产者和消费者协商，避免 HAL 变成又一个 DDS |
| Array<T> 用 count + elements 而非 FlatBuffers vector | 保持与 Blob 一致的前缀长度格式，简化 SHM 零拷贝路径 |
| HalQoS 作为 amw 第三极 | Deadline/Liveliness/Security Domain 是工业 QoS 的核心，不属于 DDS 式的 reliable/best-effort。作为独立 trait 与 HalTransport/HalDiscovery 平齐 |
| RPC 不拆成一对 Signal | 拆开会丢掉超时、幂等、请求/响应关联——对配置操作不可接受 |
| 不做跨语言 RPC 统一 | RPC 只在控制面使用（JSON-RPC 2.0），数据面走 Signal / StreamChannel + FlatBuffers |
| SHM 阈值设为 4KB | 参考 dora-rs 的 ZERO_COPY_THRESHOLD，小消息走 UDS/TCP 更简单 |
| amw 抽象层（HalTransport + HalDiscovery + HalQoS）| 参考 ROS2 rmw 模式。传输/发现/QoS 实现可替换（Zenoh ↔ DDS ↔ MQTT），API 不变。Zenoh 从 Phase 2 接入，Phase 1→4 零迁移 |
| FlatBuffers 用于 HAL-native 标量，Blob 透传 Arrow/Protobuf | 小控制报文用 FlatBuffers 零拷贝访问标量，大载荷走 Blob 透传（HAL 不解析 Arrow IPC / Protobuf / CAN frame）。参考 dora-rs 同类设计决策 |
| 发现用 Zenoh 而非 Supervisor | 单机 Supervisor 在 Phase 3 跨机成瓶颈。Zenoh 键表达式天然支持分层发现 + liveliness 监控 |
| 延迟声明带前提条件 | < 1μs 是设计目标不是实现保证。每行延迟必须标注前提条件（内核、消息大小、硬件）和典型范围 |
| 延迟必须可验证 | 每个传输模式的延迟声明配套验证方法（criterion bench / linux-perf / tcpdump / rdtsc），结果写入审计报告 |
| HalQoS 三个维度分三层执行 | Deadline 在 RT 数据面（同周期触发），Liveliness 在控制面（Zenoh 原生），Security Domain 在配置面（静态标记） |
| 参数系统声明式 schema | ParamDef[] 声明参数名、类型、范围、required、version。configureComponent RPC 自动校验。Supervisor 负责持久化 |
