# AUDESYS 线程调度模型设计

> 生成日期：2026-07-09
> 设计目标：融合 LinuxCNC 函数列表 + ROS2 control 管线 + OpenPLC 扫描屏障 + dora-rs 事件驱动，形成工业确定性调度的统一模型

---

## 1. 参考系统分析

### 1.1 LinuxCNC — 显式有序函数列表

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

---

### 1.2 ROS2 — 优先级轮询 + ros2_control 绕行

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

---

### 1.3 OpenPLC v3 — 单线程扫描周期 + I/O 屏障

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

**单任务限制**：OpenPLC v3 无多任务调度，所有用户代码编译为单个 C 函数 `config_run__()`。GCD 分发器在 v4 版本中规划但尚未以独立仓库发布。

**过运行**：仅有诊断日志（cycle max/min/avg），不触发主动响应。`SCHED_FIFO 30` + `mlockall` 做基本 RT 加固。

---

### 1.4 dora-rs — 数据驱动，无固定周期

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

**执行顺序**：无全局顺序保证。数据流 DAG 通过 YAML 描述符定义路由（`camera/image → detection/image`），但独立 operator 之间无调度排序。

**`--rt` 标志**：仅影响 daemon 主线程（`SCHED_FIFO 50`），不影响 operator 进程。CPU 亲和性通过 `cpu_affinity: [0, 1]` 逐节点声明。

**反压机制**：`QueuePolicy::DropOldest`（默认队列容量 10，满则丢弃最早）+ `QueuePolicy::Backpressure`（允许增长至 10× 容量，硬上限时丢弃并记录错误）。

---

## 2. 四系统对比矩阵

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

---

## 3. AUDESYS 混合方案

### 3.1 设计原则

1. **控制路径**（RT 线程）：确定性优先 — 借鉴 LinuxCNC 显式函数列表 + ROS2 control 管线
2. **I/O 路径**（I/O 线程）：一致性优先 — 借鉴 OpenPLC 扫描屏障
3. **数据流路径**（Stream Worker）：吞吐优先 — 借鉴 dora-rs 事件驱动
4. **配置路径**（RPC）：安全优先 — 借鉴 LinuxCNC halcmd 动态调整

### 3.2 架构总览

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

### 3.3 核心数据结构

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

### 3.4 线程主循环实现

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

### 3.5 设计决策

| 决策 | 来源 | 理由 |
|------|------|------|
| **显式 funct_list** | LinuxCNC | 工业级确定性：顺序显式声明，可审计、可验证、可 halcmd 查询 |
| **read→update→write 三阶段** | ROS2 control | 阶段分离使 I/O 读、逻辑计算、I/O 写独立可测、可追踪 |
| **扫描屏障 read_barrier / write_barrier** | OpenPLC | I/O 映像在逻辑执行期间冻结，防止后台线程 (Modbus/Web) 并发修改 |
| **过运行跳过 + ALARM Signal** | ROS2 control | 比 OpenPLC 仅日志更健壮，比 LinuxCNC 仅 pin 更主动 |
| **周期整数倍约束** | LinuxCNC | Rate Monotonic 可调度性分析前提，防止周期漂移导致的优先级反转 |
| **Reentrant 标志** | LinuxCNC | `reentrant=0` 安全默认（单线程），高级用户 opt-in（`reentrant≠0`） |
| **I/O 线程事件驱动** | dora-rs | 非 RT 通信不应占用 RT 周期，异步 I/O 线程独立运行 |
| **Stream Worker 事件驱动** | dora-rs | 高吞吐数据流（点云、图像）不应挤占控制周期 |
| **运行时指标暴露为 Signal** | LinuxCNC | `thread.runtime_ns`、`thread.runtime_max_ns`、`thread.overrun` 通过 HAL 可见 |
| **dynamic 添加/移除函数** | LinuxCNC | RPC 命令 (`addFunction`, `removeFunction`, `reorderFunction`) + 配置文件 |

### 3.6 配置文件格式 (YAML)

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

### 3.7 与纯 LinuxCNC 的差异

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

### 3.8 移植对照

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
