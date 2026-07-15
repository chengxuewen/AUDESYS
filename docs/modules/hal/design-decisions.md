> 拆分自 docs/hal-detailed-design.md（2026-07-15）

# 设计决策记录


### 17.1 协议与通信原语

| 决策 | 理由 |
|------|------|
| Signal / StreamChannel 不合并 | 控制信号（零缓冲低延迟）与数据流（有缓冲高吞吐）不可调和，ROS2 十年教训 |
| RPC 不拆成一对 Signal | 拆开会丢掉超时、幂等、请求/响应关联——对配置操作不可接受 |
| 不做跨语言 RPC 统一 | RPC 只在控制面使用（JSON-RPC 2.0），数据面走 Signal / StreamChannel + FlatBuffers |
| FlatBuffers 用于 HAL-native 标量，Blob 透传 Arrow/Protobuf | 小控制报文用 FlatBuffers 零拷贝访问标量，大载荷走 Blob 透传（HAL 不解析 Arrow IPC / Protobuf / CAN frame）。参考 dora-rs 同类设计决策 |
| SHM 阈值设为 4KB | 参考 dora-rs 的 ZERO_COPY_THRESHOLD，小消息走 UDS/TCP 更简单 |

### 17.2 amw 中间件

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

### 17.3 类型系统

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

### 17.4 线程调度

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

### 17.5 扫描屏障

| 决策 | 理由 |
|------|------|
| Signal 快照 — copy-on-read | 轻量，不需要持续加锁，与 OpenPLC bufferLock 等效但线程友好 |
| I/O 映像锁仅在 Phase 1 + 3 持有 | Phase 2 (update) 期间 I/O 线程可自由读写，最大化吞吐 |
| 多 OUT Signal 原子 push | `flush_out_signals()` 一次性推送，保证订阅者看到完整周期输出 |
| 不暴露 Barrier/Latch/Semaphore 为 HAL 原语 | HAL 协议不应承担调度或同步职责，否则违反 Sans-I/O 原则 |
| Component 不碰锁 | Component 开发者不需要懂 RT 同步——只需声明 phase 归属 |

### 17.6 Config Barrier 与 LockLevel

| 决策 | 理由 |
|------|------|
| Config Barrier 而非实时应用 | mid-cycle 配置变更 = segfault 风险。队列 + 周期边界批量应用是最小化安全保证 |
| LockLevel 从运行时锁 → 权限分级 | LinuxCNC 的 LockLevel 依赖开发者自觉在正确时机调用；AUDESYS 作为多进程系统必须强制 |
| `Run` 级别拒绝所有 RPC（含参数修改） | LinuxCNC 允许 Run 时改参数（hal_set_pin），但那是单进程模型的安全默认。多进程 Supervisor 应显式降级为 `Params` 才允许 |
| Config Generation 递增 + Signal 确认 | 异步系统必须可观测——Supervisor 不能靠"大概生效了"。G 数递增 + Signal 提供确定性确认 |
| pending_config 用 bounded channel | 防止 Supervisor 无限堆积配置命令。队列满 → ConfigQueueFull error（Supervisor 自行重试） |
| 降级路径强制 deactivateComponent | 防止运行中降锁导致半初始化组件进入 RT 周期——先停所有组件，再改配置 |

### 17.7 实时内存与调度

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

### 17.8 I/O 映射

| 决策 | 理由 |
|------|------|
| IoImageTable 不在 HAL 协议内 | HAL 只传输值，不关心来源。映射是驱动层内部关注 |
| 逻辑-物理分离 | 更换总线时上层程序零修改 |
| AddressSpace 枚举而非仅 Array | MODBUS 离散/线圈/寄存器的语义不同，EtherCAT PDO 是结构化偏移 |
| Multi-register 合并（len > 1） | 32-bit 值跨两个 MODBUS 寄存器很常见 |
| SDO / named subindex 扩展 | EtherCAT SDO 有 subindex，PROFINET 有名路径 |
| 快照而非逐点传输 | 一致性保证——整个域在同一时刻的快照，不是逐个 pin |
| 多资源（Multi-Resource）用 security_domain 隔离 | IEC 61131-3 多个 CPU（Resource）共享同一个 Configuration。每个 Resource 映射为独立 Component，通过 `security_domain` + keyexpr 前缀天然隔离，无需 HAL 新增原语 |

### 17.9 ROS2 Actions

| 决策 | 理由 |
|------|------|
| 不引入第 4 种原语 | Action = RPC + StreamChannel + Signal 组合。新增原语会使 amw trait 膨胀 5 个方法 |
| ActionBuilder 在 packages/ 而非 HAL Core | Action 是应用层概念，不应在 HAL 协议层强制要求 |
| 状态用 Signal 而非 StreamChannel | 状态是单值（最新值覆盖），不是流。Signal 语义完全匹配 |
| 反馈用 StreamChannel 而非 Signal | 反馈需要完整时间序列（进度追踪），不能丢弃中间值 |
| ActionComponent trait 独立于 HalComponent | 不是所有 Component 都支持 Action。PLC scan 和 servo thread 不需要 Action |
| action_id 由 Server 生成（UUID v4） | 避免 Client 冲突，且支持幂等去重 |

### 17.10 功能安全

| 决策 | 理由 |
|------|------|
| 黑色通道架构 | IEC 61508 / EN 50159 标准模型。通道不可靠，安全层保证安全 |
| `safety_integrity` 仅做元数据标记 | 路由/日志/监控据此区分安全信号，但 HAL 不做安全判决 |
| 安全帧作为 Blob 运输 | 安全协议（CRC + 序列号 + 超时）由安全运行时层处理，HAL 不解析 |
| STO 走独立物理路径 | 安全输出不通过非安全系统——工业标准实践 |
| 不声称 SIL | 认证需要数千人月工程，声称会误导用户造成危险 |
| 不做 CRC / 冗余投票 / watchdog | 这些是安全层职责，HAL 层插手是安全反模式 |

### 17.11 延迟与验证

| 决策 | 理由 |
|------|------|
| 延迟声明带前提条件 | < 1μs 是设计目标不是实现保证。每行延迟必须标注前提条件（内核、消息大小、硬件）和典型范围 |
| 延迟必须可验证 | 每个传输模式的延迟声明配套验证方法（criterion bench / linux-perf / tcpdump / rdtsc），结果写入审计报告 |

### 17.12 参数系统

| 决策 | 理由 |
|------|------|
| 参数系统声明式 schema | ParamDef[] 声明参数名、类型、范围、required、version。configureComponent RPC 自动校验。Supervisor 负责持久化 |