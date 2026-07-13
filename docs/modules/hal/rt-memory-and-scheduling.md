# AUDESYS 实时内存与可调度性设计

> 生成日期：2026-07-09
> 设计目标：RT 热路径零堆分配 + Rate Monotonic 可调度性保证

---

## 1. RT 内存管理

### 1.1 参考：LinuxCNC `hal_malloc()`

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

### 1.2 AUDESYS 方案：预分配池 + mlockall

借鉴 LinuxCNC 的"预分配—热路径零分配"模式，AUDESYS 用 Rust 的 `PreAllocPool` 替代 C 的共享内存段。

#### 数据结构

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

#### HalCore 集成

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

#### 配置文件

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

### 1.3 内存纪律

| 规则 | 机制 | 检测 |
|------|------|------|
| RT 热路径零堆分配 | Code review + CI lint 禁止 `Box::new` / `Vec::push` / `String::new` 在 `update()` 方法中 | `cargo clippy -- -W clippy::all` + 自定义 lint |
| 预分配池不可扩容 | `PreAllocPool` capacity 固定，`alloc()` 池满返回错误 | `activateComponent()` 时检查 |
| 缺页防护 | `mlockall(MCL_CURRENT\|MCL_FUTURE)` | 启动日志 + `/proc/{pid}/status` VmLck 验证 |
| 无 Drop 热路径 | 对象归还到 free_slots，内存不释放 | `deactivateComponent()` 时调用 `free()`，`drop()` 为空 |
| 栈变量大小限 | 大对象 (>1KB) 必须放堆（预分配池）| 代码审查 |
| Vec 容量预声明 | 所有 `Vec::new()` 用 `Vec::with_capacity(n)` 替代 | clippy `vec_init_then_push` lint |

### 1.4 与 LinuxCNC 差异

| | LinuxCNC `hal_malloc` | AUDESYS `PreAllocPool` |
|---|---|---|
| 分配时机 | `initf` 初始化函数 | `activateComponent()` / YAML 配置 |
| RT 热路径 | ❌ 永不分配 | ❌ 永不分配 |
| 释放 | ❌ 不支持 | ✅ `deactivateComponent()` → `free()` 归还槽位 |
| 池大小 | 编译时共享内存段大小 | 配置文件 `hal_config.max_pins` |
| 缺页防护 | ✅ RTAPI `mlockall` | ✅ `mlockall` + `madvise(WILLNEED)` |
| 跨进程可见 | ✅ 共享内存 | ❌ 单进程（跨进程通过 Zenoh Signal） |

---

## 2. 线程周期约束

### 2.1 参考：LinuxCNC Rate Monotonic

LinuxCNC 要求所有线程周期必须是基周期的整数倍。这是 **Rate Monotonic Scheduling (RMS)** 可调度性分析的前提。

```c
// hal_lib.c — hal_create_thread 中的周期验证
if (period_ns % base_period_ns != 0) {
    rtapi_print("ERROR: period must be integer multiple of base period\n");
    return -EINVAL;
}
```

没有这个约束，无法保证低优先级长周期线程不被高优先级短周期线程饿死。

### 2.2 AUDESYS 方案：声明式 + 编译时验证

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

### 2.3 RMS 利用率分析（可选）

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

### 2.4 完整约束清单

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

### 2.5 配置文件示例

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

## 3. 设计决策

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

| 相邻 Signal 最小 64B padding（建议）| 同 SHM 段的两个高频 Signal 若在同一 cache line (64B) 内，写一个无效化另一个的 cache line → 假共享。建议 64B padding，高频 Signal 用独立 SHM 段 |
