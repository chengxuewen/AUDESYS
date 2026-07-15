# AUDESYS HAL 协议规格 (YAML)

> 拆分自 docs/hal-detailed-design.md（2026-07-15）

## 15. 协议规格 (YAML)

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