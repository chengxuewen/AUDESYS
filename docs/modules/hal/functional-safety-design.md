# AUDESYS 功能安全策略（Black Channel）

> 生成日期：2026-07-09
> 设计目标：架构不堵死 IEC 61508 认证路径；HAL 不做安全判决，只做透明运输

---

## 1. 背景与边界

### 1.1 诚实声明

AUDESYS 当前为零代码规划阶段。IEC 61508（工业功能安全）和 ISO 13849（机械安全）的认证需要：

- 数百人年级别的工程
- 第三方认证机构（TÜV、exida）
- FMEDA、FTA、DCCA 等安全分析
- 全生命周期文档（从需求到退役）

**AUDESYS 不做 SIL 认证**。本设计的唯一目标是：**确保架构不堵死未来认证路径**。

### 1.2 当前 HAL 的问题

所有数据——急停信号、安全门限位、温度显示、配方参数——在 HAL 中完全等同，走相同的 Signal / StreamChannel 路径。

```
急停按钮 → HAL Signal "safety.estop" → Controller
限位开关 → HAL Signal "safety.limit" → Controller
温度显示 → HAL Signal "sensor.temp"   → Panel
```

在 SIL 系统中，这是不可接受的——安全数据必须与非安全数据隔离。

---

## 2. 黑色通道（Black Channel）模型

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

---

## 3. AUDESYS 现在做的三件事

### 3.1 Signal 元数据标记 `safety_integrity`

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

### 3.2 安全信号按 `Blob` 透明运输

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

### 3.3 STO（Safe Torque Off）独立物理路径

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

---

## 4. 明确边界

| HAL 做 | HAL 不做 |
|--------|---------|
| 运输安全标记 `safety_integrity` 元数据 | 基于此标记做安全判决 |
| 运输安全帧为 `Blob`（透明） | 解析/校验安全帧内容 |
| 提供确定性传输延迟 | 声称任何 SIL 等级 |
| 暴露安全信号的独立监控通道 | CRC、投票、watchdog 判决 |
| 日志记录安全信号的传输事件 | 安全审计追踪 |

---

## 5. 未来认证路径

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

## 6. 设计决策

| 决策 | 理由 |
|------|------|
| 黑色通道架构 | IEC 61508 / EN 50159 标准模型。通道不可靠，安全层保证安全 |
| `safety_integrity` 仅做元数据标记 | 路由/日志/监控据此区分安全信号，但 HAL 不做安全判决 |
| 安全帧作为 Blob 运输 | 安全协议（CRC + 序列号 + 超时）由安全运行时层处理，HAL 不解析 |
| STO 走独立物理路径 | 安全输出不通过非安全系统——工业标准实践 |
| 不声称 SIL | 认证需要数千人月工程，声称会误导用户造成危险 |
| 不做 CRC / 冗余投票 / watchdog | 这些是安全层职责，HAL 层插手是安全反模式 |
