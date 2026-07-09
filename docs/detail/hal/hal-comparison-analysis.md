# AUDESYS HAL 架构汇总对比分析

> 生成日期：2026-07-09
> 对比参考系统：LinuxCNC、ROS2/ros2_control、dora-rs、OpenPLC、CODESYS、TwinCAT
> 对比维度：数据类型、Pin/Signal 模型、组件生命周期、串行化、传输层、线程模型、Sans-I/O、锁模型、多语言支持、PLC 架构

---

## 1. 数据类型与 Pin/Signal 模型

### 现状

AUDESYS 用 **FlatBuffers HALValue**（6 种：Bit/Float/S32/U32/S64/U64）+ **Pin → Signal** 单向多读者模型。

### 对比

| 维度 | LinuxCNC | ROS2 | dora-rs | OpenPLC | **AUDESYS** |
|------|----------|------|---------|---------|-------------|
| 类型数 | **8 种**（含 HAL_PORT） | CDR 自动生成 | Arrow 列式 | IEC 类型（BOOL/BYTE/WORD/DWORD/LREAL） | **6 种** |
| Pin 方向 | IN/OUT/IO 三态 | Command(写) vs State(读) 分离 | 输入/输出端口 | LOCATED VAR（%I/%Q/%M） | **IN/OUT/IO** |
| Signal 语义 | **共享内存**，单写多读 | DDS topic，多写多读 | Arrow 流，多写多读 | 无 signal 概念（直接 I/O 映射） | **类似 LinuxCNC**，单写多读 |

**LinuxCNC signal 源码（`hal.h:296-300`）**：
> "only one HAL_OUT pin is permitted per signal"

### 判断

✅ **从 LinuxCNC 借鉴"单写多读"模型** → 合理。PLC 的 LOCATED 变量模型更适合梯形图，不适合通用自动化。ROS2 的多写模型（DDS）增加了不必要的复杂性。

⚠️ **缺少 HAL_PORT 类型？** LinuxCNC 的 `HAL_PORT`（端口并行 I/O）对工业控制有用。但 FlatBuffers 设计可后续扩展，当前不阻塞实现。

---

## 2. 组件生命周期

### 现状

AUDESYS 用 **ROS2 生命周期模型**：`Unconfigured → Inactive → Active → Error → Finalized`，6 个回调。

### 对比

| 系统 | 生命周期 | 复杂度 |
|------|----------|--------|
| **LinuxCNC** | `init()` / `exit()` | **极简**（加载即用） |
| **ROS2** | 6 状态：Unconfigured → Inactive → Active → Finalized | **标准** |
| **dora-rs** | 注册→订阅→处理循环→完成 + 重启策略 | **中等** |
| **OpenPLC** | 无显式生命周期，plugin `init()`/`start_loop()`/`stop_loop()` | **简单** |
| **AUDESYS** | 同 ROS2 | **标准** |

**LinuxCNC 的简单性来源**：机器启动时加载 HAL 配置，运行到关机。根本没有"中间停止再启动"的需求。

### 判断

⚠️ **ROS2 生命周期可能过重。** 工业控制场景不同于机器人：你很少需要运行时"停用再激活"一个驱动。建议：

- 保留 `onConfigure/onActivate/onDeactivate` → 对热插拔有用
- **考虑砍掉 `Error → Recover` 路径** → LinuxCNC 的做法是：出错直接 `exit()`，让 Supervisor 重启整个 Controller 进程。这比组件级恢复更可靠，因为错误状态可能污染共享内存。
- **参考 dora-rs 的重启策略**（Never / OnFailure / Always）→ 比 ROS2 的 Error 恢复更务实。

---

## 3. 串行化格式

### 现状

AUDESYS 选择 **FlatBuffers**。

### 对比

| 系统 | 串行化 | 零解析耗时 | Schema 演化 | 零拷贝 | 生态 |
|------|--------|-----------|------------|--------|------|
| **LinuxCNC** | **无串行化**（共享内存裸指针） | N/A | 无 | ✅ | — |
| **ROS2** | CDR（IDL 生成） | ❌ 需反序列化 | 脆弱 | 有限（进程内） | 庞大 |
| **dora-rs** | **Apache Arrow**（列式） | ✅ 零反序列化 | 弱 | ✅ Zenoh SHM | 增长中 |
| **OpenPLC** | 无（直接 `IEC_BOOL*` 指针） | N/A | 无 | N/A | — |
| **AUDESYS** | **FlatBuffers** | ✅ 零解析 | ✅ 强 | Phase 4 用 Zenoh SHM | 较小 |

### 判断

✅ **FlatBuffers 是正确的选择。** 理由：
- **vs Arrow**：Arrow 更适合数据流/ML 场景（列式聚合），FlatBuffers 更适合控制消息（小型结构化数据包）。AUDESYS 的控制信号（Pin 更新）是小消息，不是大数组流。
- **vs CDR**：FlatBuffers 有 schema 演化能力，CDR 没有（改 `.msg` 文件需重新生成所有代码）。
- **vs 零串行化（LinuxCNC 方式）**：LinuxCNC 不需要串行化因为所有组件在**同一地址空间共享内存**中。AUDESYS 有跨进程/跨主机需求，串行化不可避免。

⚠️ **最大瓶颈是 Phase 1（In-Process）为什么不也用裸指针？** LinuxCNC 的高性能恰恰来自于"零拷贝共享内存"。AUDESYS 的 Typed API 已经做到了进程内无序列化，但文档中应更明确声明："In-Process 模式不走 FlatBuffers，直接读写 Rust 内存。"

---

## 4. 实时线程模型

### 现状

AUDESYS：**I/O 线程（tokio CPU0-1）+ RT 线程（sync SCHED_FIFO CPU2-3）**，ThreadConfig 含 period_us + priority + cpu_affinity。

### 对比

| 系统 | 线程模型 | RT 保证 |
|------|----------|---------|
| **LinuxCNC** | RTAPI 函数列表，硬件定时器触发，线程周期必须是整数倍 | **硬实时**（PREEMPT_RT/RTAI/Xenomai） |
| **ROS2** | nanosleep while 循环 + PREEMPT_RT 内核 | **软实时**（实测 <100μs jitter） |
| **dora-rs** | tokio async + mlockall + SCHED_FIFO | **软实时**（10-17x ROS2，但非硬实时） |
| **OpenPLC** | GCD 调度器 + SCHED_FIFO 99 + mlockall | **软实时** |
| **TwinCAT** | **内核模式定时器**，抢占 Windows 调度器 | **硬实时**（μs 级） |
| **AUDESYS** | 分离 I/O + RT 线程，CPU 隔离 | **软实时**（目标子毫秒） |

**LinuxCNC 的"线程周期必须是整数倍"约束（`hal.h:747-763`）**：
> "threads must be created in order from fastest to slowest, and all periods must be integer multiples of the fastest"

### 判断

✅ **I/O 与 RT 线程分离是对的。** dora-rs 也这么做（tokio async 处理事件 + `--rt` 标记的 RT 线程）。

⚠️ **缺少 LinuxCNC 的"线程函数列表"概念。** LinuxCNC 的 HAL 线程本质上是一个**执行顺序表**（function list），组件注册函数到线程，线程按序调用。这个模型比"独立线程 + channel 通信"更确定——没有上下文切换开销。建议在 doc 中补充：RT 线程内部也是一个**函数调度表**（类似 LinuxCNC），而不是独立 task。

⚠️ **线程周期约束？** LinuxCNC 强制所有周期是整数倍。AUDESYS 未提此约束。在单进程 Controller 内这容易保证；跨进程多 Controller 时需要考虑。建议在文档中标注此限制。

---

## 5. 传输层

### 现状

AUDESYS 4 阶段传输：In-Process <1μs → UDS+FlatBuffers ~10μs → Zenoh TCP ~100μs → Zenoh SHM ~1μs。

### 对比

| 系统 | 同机 IPC | 跨机 | 零拷贝 |
|------|----------|------|--------|
| **LinuxCNC** | **共享内存**（全部组件同一进程空间） | ❌ 不支持 | ✅ |
| **ROS2** | DDS（进程内优化仅同节点） | ✅ DDS | ❌ |
| **dora-rs** | Zenoh SHM（≥4KB）+ TCP（<4KB） | ✅ Zenoh | ✅ |
| **OpenPLC** | **裸指针**（image table 共享内存） | ❌ 不支持 | ✅ |
| **AUDESYS** | UDS+FlatBuffers | ✅ Zenoh TCP | Phase 4 |

### 判断

✅ **4 阶段演进路径清晰合理。** 学 dora-rs 的 Zenoh SHM 是对的——dora-rs 已经在生产环境中验证了 10-17x 延迟优势。

⚠️ **LinuxCNC 的启示：单机场景不需要序列化。** LinuxCNC 证明了"所有组件在同一地址空间共享内存"是最快的。AUDESYS 的 `HalCore`（Sans-I/O）设计正确捕捉了这一点：Typed API 进程内调用不需要 FlatBuffers。

⚠️ **dora-rs 的 4KB 零拷贝阈值值得参考。** dora-rs 对小于 4KB 的消息用 TCP，大于才走 SHM。AUDESYS 可以类似地：控制信号（几十字节）走 UDS，视频/点云（几 MB+）走 SHM。

---

## 6. Sans-I/O 设计

### 现状

AUDESYS 的 `HalCore` 明确采用 **Sans-I/O**（无 I/O 核心，I/O 由外部 Transport 层处理）。

### 对比

| 系统 | Sans-I/O？ | 证据 |
|------|-----------|------|
| **dora-rs** | ✅ operator trait 是纯同步 `on_input` 回调 | `architecture.md` |
| **LinuxCNC** | ✅ HAL 核心无 socket，I/O 由 `halcmd` / `halrmt` 处理 | `hal_lib.c` |
| **AUDESYS** | ✅ 明确声明 Sans-I/O | `architecture.md:498-515` |

### 判断

✅ **完全正确。** Sans-I/O 是 dora-rs 和 LinuxCNC 共同验证过的模式。可测试性 + RT 安全 + 传输无关。

---

## 7. 锁定模型

### 现状

AUDESYS：`LockLevel` 枚举（None/Load/Config/Params/Run/All），参考 LinuxCNC。

### 对比

**LinuxCNC 没有形式化锁级别。** 搜索 LinuxCNC 源码未发现 LockLevel 概念。它的"锁"是隐式的：`hal_malloc()` 无 free（整个 HAL 仅在最后一个组件退出时销毁），`hal_exit()` 原子移除所有 pin/parameter/function。

### 判断

⚠️ **LockLevel 是 AUDESYS 的创新，但需验证必要性。** LinuxCNC 不需要形式化锁级别因为：
- 配置通过 `halcmd` 脚本在启动时完成（一次性）
- 运行时只有 RT 线程读/写 pin，无并发修改
- 无组件被"中间状态停用"

AUDESYS 引入 LockLevel 是因为**支持运行时动态重配置**（热加载驱动）。如果确实有这个需求，LockLevel 就是合理的。但如果 Phase 1-2 不实现热重配置，可以简化为 LinuxCNC 模型：停止 Controller → 重配置 → 重启。

**建议：**
- Phase 1-2：砍掉 LockLevel，用 LinuxCNC 的"init 时配置，运行时不可变"
- Phase 3+：需要热重配置时再引入 LockLevel

---

## 8. 多语言支持

### 对比

| 系统 | 语言 | 跨语言机制 |
|------|------|-----------|
| **LinuxCNC** | C（核心）+ Python（用户态组件） | 共享内存指针（同机） |
| **dora-rs** | Rust + Python(PyO3) + C/C++(FFI) | **Apache Arrow**（零拷贝跨语言） |
| **OpenPLC** | C++（核心）+ Python（插件） | Image table 裸指针 |
| **AUDESYS** | Rust（核心）+ Node.js(napi-rs) + Python(PyO3) + C/C++(FFI) | **FlatBuffers**（零解析）+ Thin Client |

### 判断

✅ **Thin Client 设计正确。** dora-rs 的成功验证了"Rust 核心 + 多语言绑定"模式的可行性。

⚠️ **dora-rs 的 Arrow 跨语言零拷贝值得研究。** Arrow 的最大优势是：Python/PyO3 和 Rust 可以共享同一块内存数据，不需要复制。AUDESYS 的 FlatBuffers 对 Node.js 很好（napi-rs），对 Python 也不错。关键区别：Arrow 更适合批量数据流，FlatBuffers 更适合离散消息。

---

## 9. PLC 架构 vs AUDESYS HAL

### OpenPLC I/O 映射模型

```
Ladder/ST → IECVar(.so) ←LOCATED→ image table ←mutex→ Plugin driver ←bus→ 硬件
```

优势：声明式，PLC 程序只看到变量，底层的 Modbus/EtherCAT 栈由驱动透明处理。

劣势：**不灵活** — 不能直接控制协议栈行为，不能实现自定义的 HAL 拓扑。

### 判断

✅ **AUDESYS 不应该用 PLC I/O 映射模型。** 原因：
- AUDESYS 不是纯 PLC——它覆盖机器人、测控、上位机
- PLC 的"LOCATED 变量"模型对通用自动化是枷锁
- AUDESYS 的 Typed HAL API + FlatBuffers 更灵活

✅ **但借鉴 PLC 的"驱动注册表"概念**：AUDESYS 的 DriverRegistry（7 种驱动）对应了 OpenPLC 的 Plugin 系统和 TwinCAT 的 IO Device 注册。这个方向正确。

---

## 10. 综合评判

### ✅ 做对的设计

| 设计 | 借鉴来源 | 为什么对 |
|------|----------|---------|
| **单写多读 Signal 模型** | LinuxCNC | 避免 ROS2 DDS 多写的复杂性 |
| **FlatBuffers 序列化** | 自研 | 零解析 + Schema 演化 > CDR；更适合控制消息 > Arrow |
| **Sans-I/O 核心** | dora-rs + LinuxCNC | 可测试 + RT 安全 + 传输无关 |
| **4 阶段传输演进** | dora-rs（Zenoh SHM） | 已验证的低延迟路径 |
| **多语言 Thin Client** | dora-rs（PyO3 + FFI） | 已验证的生产模式 |
| **I/O + RT 线程分离** | dora-rs + ROS2 | RT 线程必须是同步的 |

### ⚠️ 需修正的设计

| 问题 | 建议 | 参考 |
|------|------|------|
| **ROS2 生命周期过重**（6 状态 + Error 恢复） | Phase 1-2 简化为 `init → active → exit`；砍掉 Error→Recover，让 Supervisor 重启 | LinuxCNC `init/exit` |
| **LockLevel 过早引入** | Phase 1-2 用"启动时配置不可变"模式，Phase 3+ 再加 LockLevel | LinuxCNC 隐式锁 |
| **缺 RT 线程函数列表** | 明确声明 RT 线程内部是函数调度表（不是 async task），组件注册 `update()` 到线程 | LinuxCNC function list |
| **线程周期约束未声明** | 添加约束：所有线程周期必须是基准线程周期的整数倍 | LinuxCNC `hal_create_thread` |
| **4KB SHM 阈值** | 参考 dora-rs：小于阈值用 UDS/TCP，大于才走 SHM | dora-rs `ZERO_COPY_THRESHOLD` |
| **缺监督器控制面访问权** | 参考 dora-rs Daemon 模型：Supervisor 应有只读访问 HAL 快照的能力 | dora-rs Daemon + Coordinator |

### 🔴 需要补的空白

| 空白 | 为什么重要 | 参考 |
|------|-----------|------|
| **PLC 集成路径不清晰** | AUDESYS 声称覆盖软 PLC 但无 IEC 61131-3 运行时计划 | OpenPLC `strucpp` / CODESYS |
| **EtherCAT 驱动规划缺失** | 硬实时控制的标配总线 | TwinCAT ESC / OpenPLC ethercat proc |
| **确定性内存分配无方案** | RT 线程不能 `malloc`，文档未提及预分配策略 | LinuxCNC `hal_malloc()`（一次性分配，永不释放） |

---

## 总结

AUDESYS 的 HAL 设计方向正确——从 LinuxCNC（单写多读 Signal）、dora-rs（Sans-I/O + Zenoh SHM）、ROS2（生命周期）各取精华。主要问题是**阶段性过度设计**：ROS2 的复杂生命周期和形式化 LockLevel 在 Phase 1-2 不需要，建议先简化到 LinuxCNC 的"启动配置 + 运行 + 退出"模型，后续再扩展。

需要补充：RT 内存预分配策略、EtherCAT 规划、PLC 运行时集成路径。
