# AUDESYS HAL 类型系统：IEC 61131-3 类型映射

> 生成日期：2026-07-09
> 设计目标：完整映射 IEC 61131-3 类型到 AUDESYS HAL，合理取舍文本/时态类型

---

## 1. IEC 61131-3 全类型清单

| IEC 类型 | 语义 | 位宽 | 用途 |
|----------|------|------|------|
| `BOOL` | 布尔 | 1 | 开关量、触点、线圈 |
| `SINT` | 短整数（有符号） | 8 | 小计数器 |
| `USINT` | 短整数（无符号） | 8 | 字节 |
| `BYTE` | 位串（8位） | 8 | 原始字节 |
| `INT` | 整数（有符号） | 16 | 模拟量、计数器 |
| `UINT` | 整数（无符号） | 16 | 地址、ID |
| `WORD` | 位串（16位） | 16 | 位掩码 |
| `DINT` | 双整数（有符号） | 32 | 位置、速度 |
| `UDINT` | 双整数（无符号） | 32 | 大地址、哈希 |
| `DWORD` | 位串（32位） | 32 | 长掩码 |
| `LINT` | 长整数（有符号） | 64 | 高精度计数 |
| `ULINT` | 长整数（无符号） | 64 | 大值 |
| `LWORD` | 位串（64位） | 64 | 超长掩码 |
| `REAL` | 浮点（单精度） | 32 | 模拟量、PID |
| `LREAL` | 浮点（双精度） | 64 | 高精度计算 |
| **`STRING`** | ASCII/UTF-8 字符串 | 变长 | 报警消息、设备名、配方名 |
| **`WSTRING`** | UTF-16 字符串 | 变长 | 多语言 HMI 文本 |
| **`TIME`** | 持续时间 | 32 (ms) | 定时器预设、周期 |
| **`DATE`** | 日历日期 | 16 (days) | 生产日期 |
| **`TIME_OF_DAY`** | 时刻 | 32 (ms) | 班次开始、定时启停 |
| **`DATE_AND_TIME`** | 日期+时刻 | 64 (ms) | 事件时间戳、日志 |

---

## 2. 分类决策

### 2.1 数值/位类型（11 种）→ 全部直接映射 ✅

| IEC 类型 | AUDESYS HAL 类型 | 理由 |
|----------|-----------------|------|
| BOOL | `Bool` | 1:1 |
| SINT | `S8` | 语义等价 |
| USINT / BYTE | `U8` | USINT=值, BYTE=位串, 同宽 |
| INT | `S16` | 语义等价 |
| UINT / WORD | `U16` | 同上 |
| DINT | `S32` | 语义等价 |
| UDINT / DWORD | `U32` | 同上 |
| LINT | `S64` | 语义等价 |
| ULINT / LWORD | `U64` | 同上 |
| REAL | `F32` | 语义等价 |
| LREAL | `F64` | 语义等价 |

**总计：11 IEC 类型 → 11 AUDESYS 标量类型，一个不差。**

---

### 2.2 字符串类型 → 只加 STRING，不加 WSTRING ✅

**为什么加 STRING：**

STRING 在 PLC 生态中是**一等类型**。HMI 面板直接显示来自 PLC 的 STRING 变量值：报警消息、设备名称、配方名称、操作提示。这些信息必须穿透 HAL 到达 HMI/Panel，HAL 需要知道"这是一个可显示的文本"。

如果像 Blob 那样不区分语义，HMI 收到 `Blob` 后不知道是该显示为文本还是当作二进制帧丢弃。

**典型场景**：
```
Signal<STRING> "conveyor.alarm.message"   →  HMI Panel 直接显示
Signal<STRING> "batch.recipe_name"        →  Studio 编辑器显示
Signal<Blob>   "camera.jpeg_frame"        →  图像解码器消费（HAL 不感知）
```

STRING 和 Blob 的位布局相同（`u32 length + u8[] data`），但**语义标签不同**——消费端据此区别对待。

**为什么不加 WSTRING：**

- AUDESYS 统一用 UTF-8 编码（ASCII 兼容 + 支持中文/日文/韩文）
- 需要 UTF-16 的场景（Windows legacy COM 接口等）由消费端自行转换
- 减少 FlatBuffers schema / Rust HalType / Thin Client 三层的类型爆炸

---

### 2.3 时态类型 → 全部用现有数值类型映射，不加 ❌

**核心洞察**：TIME、DATE、TOD、DT 在运行时都是**编码后的整数**，HAL 传输层不需要感知它们是"时间"。

| IEC 类型 | 内部存储 | AUDESYS 映射 | 精度 | 理由 |
|----------|---------|-------------|------|------|
| TIME | i32 (ms) | `S32` | 1ms | OpenPLC 用 `unsigned long long common_ticktime__` (ns)，TwinCAT 用 100ns ticks。不同运行时表示不同，HAL 不应绑定单一解释 |
| DATE | u16 (days since 1984-01-01) | `U32` | 1 天 | 足够 |
| TOD | u32 (ms since midnight) | `U32` | 1ms | 足够 |
| DT | u32 date + u32 tod | `U64` (Unix epoch ms) | 1ms | 统一 epoch 避免各厂商混乱（Rockwell 用 1970, Siemens 用 1990, B&R 用 2000） |

**不加原生时态类型的理由**：

1. 不同 PLC 运行时对 TIME/DATE 的内部表示不同（IEC 61131-3 只规定行为，不规定 bit layout）
2. 如果在 HAL 层添加 TIME 类型，则 FlatBuffers schema、Rust HalType、Python Thin Client、Node.js Thin Client 全部需要新增序列化/反序列化逻辑——而这一切只是为了搬运一个编码后和 `S64` 等价的整数
3. 类型转换逻辑应由 IEC 运行时层统一处理（`TIME → S64(ns) → TIME`），而不是散落在 HAL 的每一层
4. 如果你需要在 Studio 中显示 "T#500ms" 而非 "500000000"，这是 Studio 的渲染职责，不是 HAL 的传输职责

---

## 3. 最终类型系统：14 种

```
HALValue (FlatBuffers union) {

  // ═══ 标量（11 种） ═══
  Bool       // IEC: BOOL
  S8         // IEC: SINT
  U8         // IEC: USINT, BYTE
  S16        // IEC: INT
  U16        // IEC: UINT, WORD
  S32        // IEC: DINT  |  LinuxCNC: HAL_S32  |  IEC TIME → S32
  U32        // IEC: UDINT, DWORD  |  LinuxCNC: HAL_U32, HAL_PORT  |  IEC DATE/TOD → U32
  S64        // IEC: LINT  |  LinuxCNC: HAL_S64
  U64        // IEC: ULINT, LWORD  |  LinuxCNC: HAL_U64  |  IEC DT → U64
  F32        // IEC: REAL  |  LinuxCNC: HAL_FLOAT
  F64        // IEC: LREAL


  // ═══ 变长容器（3 种） ═══
  Blob       // 裸字节块（格式: u32 length + u8[length] payload）
             //   - OpenPLC image table
             //   - dora-rs Arrow IPC buffer
             //   - 自定义协议帧 (Modbus PDU, CAN frame)
             //   - 二进制载荷
             //   Zero-copy: Zenoh SHM

  Array<T>   // 同构批量数组（格式: u32 count + T[count] elements）
             //   - ROS2 sequence<float64>
             //   - 多轴位置同步
             //   - 高速采样时序列
             //   - OpenPLC rack I/O 映像

  String     // UTF-8 字符串（格式: u32 byte_length + u8[byte_length]，与 Blob 同构）
             //   - 报警消息
             //   - 设备名称
             //   - 配方名称
             //   - 操作提示
             //   HMI/Panel 直接消费，不解析为二进制
}
```

---

## 4. 完整映射表

| IEC 61131-3 | AUDESYS HAL |
|-------------|------------|
| BOOL | `Bool` |
| SINT | `S8` |
| USINT | `U8` |
| BYTE | `U8` |
| INT | `S16` |
| UINT | `U16` |
| WORD | `U16` |
| DINT | `S32` |
| UDINT | `U32` |
| DWORD | `U32` |
| LINT | `S64` |
| ULINT | `U64` |
| LWORD | `U64` |
| REAL | `F32` |
| LREAL | `F64` |
| STRING | `String` ⬅︎ 新增 |
| WSTRING | `String` 统一 UTF-8，消费端自行转换 |
| TIME | `S32` (ms) 或 `S64` (ns)，运行时层映射 |
| DATE | `U32` (days since epoch) |
| TIME_OF_DAY | `U32` (ms since midnight) |
| DATE_AND_TIME | `U64` (Unix epoch ms) |

---

## 5. 设计决策

| 决策 | 理由 |
|------|------|
| STRING ← 新增为独立类型 | 和 Blob 语义不同（文本 vs 不透明字节），HMI 需区分 |
| String ← 新增 | PLC 报警消息、设备名、配方名专用，语义 ≠ Blob（HAL 不解析的内容） |
| WSTRING ← 不加 | UTF-8 统一编码，需 UTF-16 时消费端转换 |
| TIME/DATE/TOD/DT ← 不加，用现有数值 | 各 PLC 运行时内部表示不同，HAL 应保持编码无关；类型转换是 IEC 运行时层的职责 |
| BYTE/WORD/DWORD/LWORD ← 不独立，用 U8/U16/U32/U64 | HAL 值有类型但无修饰符，位串语义由消费端维护 |
| 类型总数 13 → 14 | 仅新增 `String` |
| 位级访问不进入 HAL 类型系统 | PLC 的 `%MW0.3`（WORD bit 3）由 Studio compiler 映射为独立 `Signal<Bool>`，HAL 不感知位偏移 |
| RETAIN 变量不在 HAL 层 | 持久化由 Component 自行管理（文件/SQLite），HAL 只传输运行时值 |
