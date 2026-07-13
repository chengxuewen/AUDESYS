# AUDESYS 扫描屏障与实时同步设计

> 生成日期：2026-07-09
> 设计目标：工业级 I/O 一致性——借鉴 OpenPLC 扫描屏障，内置在线程模型中，不暴露为 HAL 协议原语

---

## 1. 问题：为什么需要扫描屏障

### 1.1 LinuxCNC 的反面教材

LinuxCNC **没有扫描屏障**。信号随时可读可写，不存在"读入→冻结→计算→写出"的阶段概念。

```
servo-thread:  读 signal "axis.0.pos" → compute → 写 signal "axis.0.cmd"
motion-thread: 读 signal "axis.0.cmd" → compute → 写 signal "axis.0.pos"
```

两个线程交错访问同一个信号，时序依赖运气。LinuxCNC 依赖单一 writer 约定和共享内存的原子性规避问题——不靠机制，靠约定。

### 1.2 后台线程并发写入场景

```
I/O 线程 (tokio):       Modbus TCP 从站数据到达 → 写 I/O 映像表
RT 线程 (SCHED_FIFO):   PLC 逻辑正在执行，读 I/O 映像表
```

如果 I/O 映像在 PLC 逻辑执行期间被后台线程修改，结果不确定——可能读到半新半旧的数据。

### 1.3 跨 Component 输出原子性

```
RT 线程:
  Component A.write() → 写 Signal "axis.0.pos"
  Component B.write() → 写 Signal "axis.0.cmd"
```

如果 A 的写入已推送给订阅者而 B 尚未写入，订阅者看到了半个周期的输出。**多个 OUT Signal 必须在 write_barrier 结束时一次性原子发布。**

---

## 2. 设计：双层屏障，内置在线程循环中

### 2.1 屏障不暴露给 Component

`HalComponent` 的 `read()` / `update()` / `write()` 方法是**纯计算函数**。开发 Component 的人不需要知道锁、屏障或缓存的存在：

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

### 2.2 两层屏障

| 屏障 | 保护范围 | 锁定对象 | 持续时间 |
|------|---------|---------|---------|
| **Signal 快照** | 所有被订阅的 IN Signal | 线程本地缓存（copy-on-read） | 整个周期 |
| **I/O 映像锁** | 共享 I/O 映像表 | `IoImageTable::lock_read()` / `lock_write()` | Phase 1 + Phase 3 期间 |

Signal 快照是**轻量级的**：只复制一次值到本地缓存，后续 `read()` 调用直接读缓存。不需要持续加锁。

I/O 映像锁是**范围精确的**：仅在 `read()` 阶段和 `write()` 阶段加锁，`update()` 阶段不加锁（后台 I/O 线程可自由写入，Component 不从 I/O 映像读）。

### 2.3 为什么不暴露同步原语为 HAL 协议原语

| 如果暴露为 HAL 原语 | 后果 |
|-------------------|------|
| `Barrier::new(n).wait()` | HAL 变成分布式调度器，违反 Sans-I/O 原则。一个 Component 挂掉，全部卡死 |
| `Latch::count_down()` | 分布式协调，引入网络分区风险，Paxos/Raft 级复杂度 |
| `Semaphore` / `Mutex` 暴露给 Component | 节奏反转（优先级反转）、死锁、Component 开发者未必懂 RT 同步 |

**原则：同步是线程实现的内部细节，不是 HAL 协议的职责。** HAL 协议只表达数据流向（Signal / StreamChannel / RPC），不表达同步语义。

---

## 3. Component 开发者视角

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

---

## 4. 与其他系统的对照

| | LinuxCNC | OpenPLC | ROS2 control | AUDESYS |
|---|---|---|---|---|
| 信号一致性 | 无保证（信号随时可读/写） | ✅ bufferLock | ❌ 无（DDS topic 独立） | ✅ Signal 快照 |
| I/O 映像一致性 | ❌ 无 I/O 映像概念 | ✅ bufferLock | ✅ read/write 阶段分离 | ✅ IoImageTable lock |
| 多 OUT Signal 原子发布 | 逐 pin 写入 | 逐 I/O 写入 | 逐 controller write() | ✅ flush_out_signals() |
| 对开发者透明 | 无（需要知道约定） | 无（lock 在 main.cpp） | 从 controller_manager 继承 | ✅ Component 不碰锁 |

---

## 5. 设计决策

| 决策 | 理由 |
|------|------|
| Signal 快照 — copy-on-read | 轻量，不需要持续加锁，与 OpenPLC bufferLock 等效但线程友好 |
| I/O 映像锁仅在 Phase 1 + 3 持有 | Phase 2 (update) 期间 I/O 线程可自由读写，最大化吞吐 |
| 多 OUT Signal 原子 push | `flush_out_signals()` 一次性推送，保证订阅者看到完整周期输出 |
| 不暴露 Barrier/Latch/Semaphore 为 HAL 原语 | HAL 协议不应承担调度或同步职责，否则违反 Sans-I/O 原则 |
| Component 不碰锁 | Component 开发者不需要懂 RT 同步——只需声明 phase 归属 |
