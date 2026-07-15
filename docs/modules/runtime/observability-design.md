# AUDESYS Runtime 可观测性设计

> 生成日期：2026-07-15
> 设计目标：为 Runtime 六模块（Supervisor/Controller/Panel/Gateway/Remote/Edge）定义统一的可观测性架构——健康检查端点、Prometheus 指标、结构化日志、告警路由、以及 AmwMetrics 核心结构

---

## 设计原则

工业控制系统的可观测性不同于互联网后端。一个 RT 控制循环不能在指标采集时触发堆分配，不能因日志写入阻塞周期中断。

1. **零侵入 RT 路径** — Controller 的 SCHED_FIFO 线程不参与任何可观测性 IO。指标采样发生在周期结束后的非 RT 回调中
2. **多级采样** — RT 路径用原子计数器（无锁），非 RT 路径用 Prometheus 直写，控制面用结构化日志
3. **离线容忍** — 采集器（Prometheus）短暂不可用不影响 Runtime 运行。指标暂存于 ring buffer，断连后自动丢弃
4. **语义稳定** — 指标名和标签在 MAJOR 版本内不变。Metric 变更跟随 D24 的 FlatBuffers Schema 版本化合约

参考：D16（工业 QoS 三层执行）、D30（三层 QA 体系）、`docs/modules/hal/industrial-qos-design.md` §Deadline

---

## 1. 架构总览

```
                     ┌─────────────────────────────────────┐
                     │          Observability Stack         │
                     │                                     │
                     │  ┌──────────┐  ┌──────────────────┐ │
                     │  │ Prometheus│  │  Alertmanager     │ │
                     │  │  (pull)   │  │  (routing)        │ │
                     │  └────┬─────┘  └─────────┬─────────┘ │
                     │       │                   │           │
                     │       ▼                   ▼           │
                     │  ┌─────────────────────────────────┐  │
                     │  │       Unified Metrics Bus        │  │
                     │  │   (amw StreamChannel + UDS)      │  │
                     │  └────┬────┬────┬────┬────┬────┬────┘  │
                     │       │    │    │    │    │    │        │
                     │       ▼    ▼    ▼    ▼    ▼    ▼        │
                     │  ┌────┬────┬────┬────┬────┬────┐       │
                     │  │Sup │Ctrl│Panel│Gate│Rem │Edge│       │
                     │  └────┴────┴────┴────┴────┴────┘       │
                     │                                     │
                     │  ┌──────────────────────────────────┐│
                     │  │  Structured Log Pipeline          ││
                     │  │  (module -> stdout -> journald    ││
                     │  │   -> Loki/Splunk)                 ││
                     │  └──────────────────────────────────┘│
                     └─────────────────────────────────────┘
```

三个独立数据面：

| 数据面 | 传输 | 用途 | RT 影响 |
|--------|------|------|---------|
| **指标** | amw StreamChannel + Prometheus pull | 数值型时间序列（CPU/周期/温度） | 仅在周期外采集 |
| **日志** | stdout -> journald -> 聚合器 | 事件型文本（启动/告警/错误） | 非 RT 线程写入 |
| **告警** | Alertmanager | 阈值触发 -> 通知 | 完全异步 |

---

## 2. 健康检查端点

每个 Runtime 模块暴露一个 HTTP health endpoint，由 Supervisor 统一聚合。

### 2.1 通用端点格式

```
GET /healthz  → 200 OK + JSON body

HTTP/1.1 200 OK
Content-Type: application/json

{
  "module": "controller",
  "status": "healthy",
  "uptime_seconds": 84321,
  "version": "0.1.0",
  "checks": {
    "rt_thread": { "status": "ok", "jitter_ns": 1230 },
    "hal_ready":  { "status": "ok" },
    "streams":    { "status": "ok", "active": 7 }
  },
  "last_config_barrier": "2026-07-15T10:30:00Z"
}
```

### 2.2 各模块端点

| 模块 | 端点 | 自定义检查 | 失败后果 |
|------|------|-----------|---------|
| **Supervisor** | `GET /healthz` | 所有子进程存活、systemd watchdog 注册 | 触发 systemd 重启 |
| **Controller** | `GET /healthz` | RT 线程 jitter < 50μs、周期无 overrun、所有 Signal 在 deadline 内 | 紧急停止->安全状态 |
| **Panel** | `GET /healthz` | Tauri 窗口响应、StructuredStream 连接正常 | 重启 Panel 进程 |
| **Gateway** | `GET /healthz` | 对外连接数、消息队列深度 < 1000 | 自动重连 |
| **Remote** | `GET /healthz` | WebRTC 信令正常 | 断开远程会话 |
| **Edge** | `GET /healthz` | 采集周期正常、本地缓存水位 < 80% | 降级采集 |

### 2.3 健康状态

```
healthy   → 所有检查通过
degraded  → 部分非关键检查失败（如远程不可用）
critical  → 关键检查失败（如 RT 线程过载）
```

Supervisor 每 5 秒聚合一次全模块健康状态，更新到 `health.supervisor.system` Signal。

---

## 3. Prometheus 指标

### 3.1 架构说明

Prometheus 采用 pull 模式。每个模块暴露一个 HTTP metrics 端点（默认 `:9100` + `各模块偏移`），Supervisor 负责汇总 exporter 地址。

```
模块         端口偏移    示例端口
Supervisor   +0          :9100
Controller   +1          :9101
Panel        +2          :9102
Gateway      +3          :9103
Remote       +4          :9104
Edge         +5          :9105
```

所有指标以 `audesys_` 为命名空间前缀。

### 3.2 通用指标

```
# HELP audesys_build_info 构建版本和编译时间
# TYPE audesys_build_info gauge
audesys_build_info{version="0.1.0", commit="36de3e7", rustc="1.85.0"} 1

# HELP audesys_uptime_seconds 进程启动后的运行时间
# TYPE audesys_uptime_seconds counter
audesys_uptime_seconds{module="controller"} 84321

# HELP audesys_health_status 当前健康状态 (1=healthy, 2=degraded, 3=critical)
# TYPE audesys_health_status gauge
audesys_health_status{module="controller"} 1

# HELP audesys_memory_bytes 进程 RSS 内存
# TYPE audesys_memory_bytes gauge
audesys_memory_bytes{module="controller"} 16777216
```

### 3.3 Controller 专有指标

```
# HELP audesys_rt_cycle_jitter_ns RT 线程周期 jitter（纳秒）
# TYPE audesys_rt_cycle_jitter_ns gauge
audesys_rt_cycle_jitter_ns{thread="control_loop"} 1230

# HELP audesys_rt_cycle_duration_ns RT 线程单周期实际执行时间（纳秒）
# TYPE audesys_rt_cycle_duration_ns gauge
audesys_rt_cycle_duration_ns{thread="control_loop"} 87500

# HELP audesys_rt_overrun_total RT 线程周期超限累计次数
# TYPE audesys_rt_overrun_total counter
audesys_rt_overrun_total{thread="control_loop"} 0

# HELP audesys_signal_deadline_miss_total Signal 更新超时累计次数
# TYPE audesys_signal_deadline_miss_total counter
audesys_signal_deadline_miss_total{signal="encoder.position"} 0

# HELP audesys_config_barrier_total Config Barrier 应用累计次数
# TYPE audesys_config_barrier_total counter
audesys_config_barrier_total{status="applied"} 42

# HELP audesys_func_list_call_count 函数列表中单个函数的调用计数
# TYPE audesys_func_list_call_count counter
audesys_func_list_call_count{function="pid_update"} 123456
```

### 3.4 Supervisor 专有指标

```
# HELP audesys_supervisor_subprocess_up 子进程存活状态 (1=up, 0=down)
# TYPE audesys_supervisor_subprocess_up gauge
audesys_supervisor_subprocess_up{module="controller"} 1
audesys_supervisor_subprocess_up{module="panel"} 1
audesys_supervisor_subprocess_up{module="gateway"} 1

# HELP audesys_supervisor_subprocess_restarts_total 子进程重启累计次数
# TYPE audesys_supervisor_subprocess_restarts_total counter
audesys_supervisor_subprocess_restarts_total{module="controller"} 1

# HELP audesys_health_aggregate 全模块聚合健康等级 (1=all_healthy, 2=any_degraded, 3=any_critical)
# TYPE audesys_health_aggregate gauge
audesys_health_aggregate{cluster="production"} 1
```

### 3.5 Gateway 专有指标

```
# HELP audesys_gateway_upstream_latency_ms 上游 MES/ERP 延迟（毫秒）
# TYPE audesys_gateway_upstream_latency_ms gauge
audesys_gateway_upstream_latency_ms{upstream="mes"} 42

# HELP audesys_gateway_message_queue_depth 内部消息队列深度
# TYPE audesys_gateway_message_queue_depth gauge
audesys_gateway_message_queue_depth{queue="to_mes"} 128

# HELP audesys_gateway_connection_up 对外连接状态
# TYPE audesys_gateway_connection_up gauge
audesys_gateway_connection_up{target="mes.plant1"} 1
```

### 3.6 Panel / Remote / Edge 专有指标

```
# HELP audesys_panel_fps Panel HMI 渲染帧率
# TYPE audesys_panel_fps gauge
audesys_panel_fps{window="main"} 60

# HELP audesys_edge_collector_gap_ns 采集周期偏离预期值的最大偏差
# TYPE audesys_edge_collector_gap_ns gauge
audesys_edge_collector_gap_ns{collector="temperature"} 5000

# HELP audesys_edge_cache_bytes 边缘缓存占用字节数
# TYPE audesys_edge_cache_bytes gauge
audesys_edge_cache_bytes{collector="temperature"} 4194304
```

---

## 4. 结构化日志

### 4.1 日志格式

所有模块统一输出 JSON 结构化日志到 stdout。Supervisor 负责采集和转发到集中式日志平台（Loki / Splunk）。

```
{
  "ts": "2026-07-15T10:30:00.123456Z",
  "level": "info",
  "module": "controller",
  "thread": "control_loop",
  "msg": "Config barrier applied",
  "fields": {
    "barrier_id": 42,
    "lock_level": "config",
    "changes": 3
  }
}
```

### 4.2 日志级别

| 级别 | 含义 | 示例场景 |
|------|------|---------|
| `error` | 功能不可用，需人工介入 | Controller 周期 overrun、Signal deadline miss |
| `warn` | 功能降级，能自动恢复 | Gateway 断连后重连、Panel 帧率骤降 |
| `info` | 正常事件，记录状态切换 | Config Barrier 应用、子进程启动/停止 |
| `debug` | 调试细节，生产环境关闭 | 单个函数执行时间、Signal 值变更 |

### 4.3 日志采样与限流

RT 路径日志必须采样——一次周期 overrun 可能每秒产生数千条日志。

```
// Controller 日志采样策略
// - error 级别不过滤（发生率本来就低）
// - warn 级别每 10 秒最多 1 条（rate limit）
// - info 级别仅在状态切换时输出
// - debug 级别生产环境关闭
```

### 4.4 日志聚合

```
Controller  ──stdout──┐
Panel       ──stdout──┤
Gateway     ──stdout──┤→ Supervisor 采集 ──→ Fluentd/Loki ──→ Grafana
Remote      ──stdout──┤
Edge        ──stdout──┘
```

Supervisor 为每条日志注入 `cluster` / `host` / `instance_id` 标签后再转发。

---

## 5. 告警路由

### 5.1 告警分类

| 等级 | 响应时间 | 通知方式 | 示例 |
|------|---------|---------|------|
| **P0** | 立即 | 电话 + SMS + 工单 | Controller 崩溃、设备失控 |
| **P1** | 5 分钟 | SMS + IM | RT 线程 overrun、关键 Signal 丢失 |
| **P2** | 30 分钟 | IM | Gateway 断连、内存超阈值 |
| **P3** | 工作日 | 工单 | Panel 帧率低、Edge 缓存水位高 |

### 5.2 Prometheus Alerting Rules

```yaml
# prometheus-rules.yaml — AUDESYS 告警规则

groups:
  - name: audesys_controller
    interval: 10s
    rules:
      - alert: ControllerOverrun
        expr: audesys_rt_overrun_total > 0
        for: 5s
        labels:
          severity: p1
          module: controller
        annotations:
          summary: "Controller RT 线程周期超限"
          description: "module={{ $labels.module }} thread={{ $labels.thread }} overrun"

      - alert: ControllerJitterHigh
        expr: audesys_rt_cycle_jitter_ns > 50000
        for: 10s
        labels:
          severity: p2
          module: controller
        annotations:
          summary: "RT 线程 jitter 过高"
          description: "当前 {{ $value }}ns，阈值 50000ns"

      - alert: SignalDeadlineMiss
        expr: audesys_signal_deadline_miss_total > 0
        for: 5s
        labels:
          severity: p1
          module: controller
        annotations:
          summary: "Signal 更新超时"

  - name: audesys_supervisor
    interval: 10s
    rules:
      - alert: SubprocessDown
        expr: audesys_supervisor_subprocess_up == 0
        for: 5s
        labels:
          severity: p0
          module: supervisor
        annotations:
          summary: "子进程 {{ $labels.module }} 不在运行"

      - alert: HealthAggregateCritical
        expr: audesys_health_aggregate == 3
        for: 5s
        labels:
          severity: p0
          module: supervisor
        annotations:
          summary: "Runtime 集群健康状态为 critical"

  - name: audesys_gateway
    interval: 15s
    rules:
      - alert: GatewayDisconnected
        expr: audesys_gateway_connection_up == 0
        for: 30s
        labels:
          severity: p2
          module: gateway
        annotations:
          summary: "Gateway 到 {{ $labels.target }} 连接断开"
```

### 5.3 Alertmanager 路由

```yaml
# alertmanager.yaml — 告警静默与路由
route:
  receiver: default
  group_by: ['module', 'severity']
  group_wait: 10s
  group_interval: 5m
  repeat_interval: 1h
  routes:
    - match:
        severity: p0
      receiver: p0-phone
      repeat_interval: 5m
    - match:
        severity: p1
      receiver: p1-sms
    - match:
        severity: p2
      receiver: p2-im

receivers:
  - name: default
    webhook_configs:
      - url: 'http://ops-manager:9093/webhook'

  - name: p0-phone
    webhook_configs:
      - url: 'http://phone-gateway:8080/call'
    # 实际集成 Twilio / 阿里云语音通知

  - name: p1-sms
    webhook_configs:
      - url: 'http://sms-gateway:8080/send'

  - name: p2-im
    webhook_configs:
      - url: 'http://im-bot:8080/alert'
    # 企业微信 / Slack / 钉钉机器人
```

---

## 6. AmwMetrics 核心结构

AmwMetrics 是嵌入 amw_inproc 的指标收集器，为 RT safe 设计——所有统计使用原子操作和 lock-free ring buffer。

### 6.1 Rust 结构定义

```rust
/// 嵌入 amw_inproc 的指标收集器。
///
/// 设计约束：
/// - 不分配堆内存（pre-allocated slab）
/// - 不阻塞 RT 线程（所有写操作是 relaxed atomic store）
/// - 采样读取在非 RT 线程完成（Prometheus exporter goroutine）
pub struct AmwMetrics {
    // === 通用计数器 (relaxed atomic, RT safe) ===

    /// 自进程启动后的 RT 周期执行次数
    cycles_completed: AtomicU64,

    /// RT 周期 overrun 累计次数
    overrun_count: AtomicU64,

    /// Signal deadline miss 累计次数
    deadline_miss_count: AtomicU64,

    /// Config Barrier 成功应用次数
    config_barriers_applied: AtomicU64,

    // === 环形缓存 (lock-free read/write) ===

    /// 最近 N 个周期的 jitter 采样（ns）
    /// write: RT 线程每周期写入当前槽位
    /// read:  Prometheus exporter 读取整个 buffer 计算 p50/p95/p99
    jitter_ring: RingBuffer<u64, 1024>,

    /// 最近 N 个周期的执行时间采样（ns）
    duration_ring: RingBuffer<u64, 1024>,

    // === 状态 (relaxed atomic, 瞬时快照) ===

    /// 当前健康等级
    health_status: AtomicU8,

    /// 子进程存活状态位图 (Supervisor 特有)
    subprocess_bitmap: AtomicU64,

    /// 绑定到 Controller 的活跃 StreamChannel 数量
    active_streams: AtomicU32,
}
```

### 6.2 关键方法

```rust
impl AmwMetrics {
    /// 创建新实例。pre-allocated，不触发后续堆分配。
    pub fn new() -> Self { /* ... */ }

    // ═══ RT 线程调用 (lock-free, O(1)) ═══

    /// 记录周期完成。RT 线程每周期末尾调用一次。
    /// duration_ns: 本周期实际执行时间
    #[inline]
    pub fn record_cycle(&self, duration_ns: u64) {
        self.cycles_completed.fetch_add(1, Ordering::Relaxed);
        self.duration_ring.write(duration_ns);
        // jitter = |实际周期 - 期望周期|
        let jitter = duration_ns.abs_diff(self.expected_period_ns.load(Ordering::Relaxed));
        self.jitter_ring.write(jitter);
        if jitter > self.expected_period_ns.load(Ordering::Relaxed) {
            self.overrun_count.fetch_add(1, Ordering::Relaxed);
        }
    }

    /// 记录 Signal deadline miss。RT 线程中 HalQoS 回调触发。
    #[inline]
    pub fn record_deadline_miss(&self) {
        self.deadline_miss_count.fetch_add(1, Ordering::Relaxed);
    }

    // ═══ 非 RT 线程调用 (exporter goroutine) ═══

    /// 收集并导出 Prometheus 指标。
    /// 此方法在专用 exporter 线程调用，非 RT 上下文。
    pub fn export_prometheus(&self) -> String {
        // 读取原子计数器 + 环形缓存快照
        // 返回 Prometheus text format
    }

    /// 重置所有计数器（用于健康状态转换后清零）
    pub fn reset(&self) {
        // atomic store 0 + ring buffer clear
    }
}
```

### 6.3 RingBuffer 设计

```rust
/// Lock-free 单写多读环形缓存。
/// write: RT 线程（唯一生产者）。
/// read:  Prometheus exporter（唯一消费者）。
struct RingBuffer<T, const N: usize> {
    slots: [UnsafeCell<MaybeUninit<T>>; N],
    write_index: AtomicU64,
}

impl<T: Copy, const N: usize> RingBuffer<T, N> {
    /// RT 线程写入。O(1)，relaxed atomic，永不阻塞。
    fn write(&self, value: T) {
        let idx = self.write_index.fetch_add(1, Ordering::Relaxed) % N as u64;
        unsafe { (*self.slots[idx as usize].get()).write(value); }
    }

    /// 读取当前 snapshot。返回有序数组 + 有效写入计数。
    fn snapshot(&self) -> Vec<T> {
        let count = min(self.write_index.load(Ordering::Acquire), N as u64);
        (0..count).map(|i| {
            unsafe { (*self.slots[i as usize].get()).assume_init() }
        }).collect()
    }
}
```

---

## 7. 各模块集成矩阵

| 模块 | 健康端点 | Prometheus | 结构化日志 | 告警参与 | AmwMetrics |
|------|---------|-----------|-----------|---------|-----------|
| Supervisor | ✅ `/healthz` | ✅ port +0 | ✅ stdout JSON | ✅ P0-P3 | ✅ subprocess bitmap |
| Controller | ✅ `/healthz` | ✅ port +1 | ✅ stdout JSON（采样） | ✅ P0-P2 | ✅ core struct |
| Panel | ✅ `/healthz` | ✅ port +2 | ✅ stdout JSON | ❌（仅消费） | ❌ |
| Gateway | ✅ `/healthz` | ✅ port +3 | ✅ stdout JSON | ✅ P2-P3 | ❌ |
| Remote | ✅ `/healthz` | ✅ port +4 | ✅ stdout JSON | ❌ | ❌ |
| Edge | ✅ `/healthz` | ✅ port +5 | ✅ stdout JSON | ✅ P3 | ❌ |

---

## 8. 实施阶段

| Phase | 增量 | 依赖 |
|-------|------|------|
| **Phase 1** | 结构化日志（所有模块 stdout JSON）+ Controller AmwMetrics 基础版 | Runtime 模块骨架 |
| **Phase 2** | Supervisor health endpoint + Prometheus exporter（Controller 指标） | amw_inproc StreamChannel |
| **Phase 3** | 全模块 health endpoint + Prometheus 指标 + Alertmanager 规则 | Gateway 对外通信 |
| **Phase 4** | Loki 日志聚合 + Grafana dashboard + 告警历史沉淀 | 日志基础设施 |

---

## 9. 相关文档

- `docs/architecture.md` §二 Runtime 套件 — Runtime 模块全景
- `docs/modules/hal/industrial-qos-design.md` — HalQoS deadline 与可观测性联动
- `docs/modules/hal/amw-middleware-design.md` — amw StreamChannel 作为指标传输通道
- `docs/modules/runtime/upgrade-strategy.md` — 指标和告警规则的版本化策略
- `docs/modules/hal/thread-scheduling-design.md` — RT 线程调度与周期测量