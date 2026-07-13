# AUDESYS I/O 映射设计

> 生成日期：2026-07-09
> 设计目标：逻辑-物理分离的 I/O 映射系统，支持 MODBUS / EtherCAT / PROFINET / CANopen 等多种现场总线

---

## 设计原则

MODBUS 有四种地址空间（线圈、离散输入、保持寄存器、输入寄存器），EtherCAT 有结构化 PDO，PROFINET 有名片寻址。单一 `Array<S32>` 无法处理这种异构性。

IoImageTable **不是** HAL 协议的一部分——它是 I/O 层的内部路由表。HAL 协议层面只看到逻辑 Signal。I/O 映射规则可随时更改而不影响上层程序。

```
┌─────────────────────────────────────────────┐
│         PLC Program (%IW0, %QW0, M0)        │
│         (IEC 变量名，如 "conveyor_start")     │
└────────────────────┬────────────────────────┘
                     │ 逻辑 <-> 物理映射
┌────────────────────┴────────────────────────┐
│           IoImageTable (路由表)              │
│                                             │
│  "conveyor_start"  →  {                     │
│    domain: "rack0",                         │
│    channel: "coil",                         │
│    address: 0,                              │
│    type: Bool,                              │
│  }                                          │
└───────┬──────────────┬──────────────┬───────┘
        │              │              │
┌───────┴──┐   ┌───────┴──┐   ┌───────┴──────────┐
│ MODBUS   │   │ EtherCAT │   │ PROFINET          │
│ domain:  │   │ domain:  │   │ domain:           │
│  coil    │   │  pdo_1a00│   │  profinet_device_1│
│  discrete│   │  pdo_1a01│   └───────────────────┘
│  holding │   └──────────┘
│  input   │
└──────────┘
```

---

## 1. IoImageTable 核心数据结构

```rust
/// I/O 映像表：一个逻辑地址到物理 I/O 的映射系统
struct IoImageTable {
    domains: HashMap<String, IoDomain>,
    snapshot: RwLock<IoSnapshot>,
}

/// I/O 域：一组共享物理传输的 I/O 点
struct IoDomain {
    name: String,               // "rack0", "ethercat_bus_1"
    driver: String,             // "modbus-tcp", "ethercat", "profinet"
    channels: Vec<IoChannel>,   // 该域下的所有通道
    refresh_interval_ms: u64,   // 刷新周期
    connection: ConnectionConfig,
}

/// I/O 通道：一个地址空间（MODBUS 有 4 个，EtherCAT 有 N 个 PDO）
struct IoChannel {
    name: String,               // "coil", "holding_register", "pdo_1a00"
    address_space: AddressSpace,
    size: usize,                // 该通道的点数
    direction: IoDirection,
    mappings: Vec<IoMapping>,
}

struct IoMapping {
    /// 逻辑名：HAL Signal 名称
    logical: String,            // "conveyor_start"

    /// 物理地址
    physical: PhysicalAddress,

    /// 数据类型
    hal_type: HalPinType,
}

enum AddressSpace {
    Digital,       // 位寻址（MODBUS 0x/1x, PROFINET bit）
    Register,      // 16/32-bit 寄存器寻址（MODBUS 3x/4x）
    Structured,    // 结构化 PDO（EtherCAT, CANopen）
    Named,         // 名寻址（PROFINET, OPC UA）
}

enum IoDirection { In, Out, Io }

/// 物理地址：支持多种寻址方式
struct PhysicalAddress {
    start: usize,
    len: usize,    // 多寄存器合并时 >1

    // 总线特定扩展
    subindex: Option<u16>,   // EtherCAT SDO, CANopen subindex
    bit_index: Option<u8>,   // 寄存器内的位偏移
    path: Option<String>,    // PROFINET/OPC UA 路径
}

/// I/O 快照：当前周期的一致性视图
struct IoSnapshot {
    /// { "conveyor_start" → HalValue::Bool(true) }
    values: HashMap<String, HalValue>,
    timestamp: Timestamp,
}
```

---

## 2. IoDriver trait

```rust
trait IoDriver: Send + Sync {
    /// 驱动名称（"modbus-tcp", "ethercat", "profinet"）
    fn name(&self) -> &str;

    /// 从物理 I/O 读入 → IoImageTable 快照
    fn read_inputs(
        &self, domain: &IoDomain, snapshot: &mut IoSnapshot
    ) -> Result<()>;

    /// 从 IoImageTable 快照 → 物理 I/O 写出
    fn write_outputs(
        &self, domain: &IoDomain, snapshot: &IoSnapshot
    ) -> Result<()>;
}
```

---

## 3. MODBUS TCP 配置示例

```yaml
# io-mapping.yaml
domains:
  - name: rack0
    driver: modbus-tcp
    connection:
      host: 192.168.1.10
      port: 502
      unit_id: 1
      timeout_ms: 500
    refresh_interval_ms: 10
    channels:
      # ──── 线圈（0x 地址空间，位输出） ────
      - name: coil
        address_space: Digital
        direction: Out
        size: 256
        mappings:
          - logical: conveyor_start       → physical: coil[0]
          - logical: conveyor_stop        → physical: coil[1]
          - logical: vacuum_on            → physical: coil[2]
          - logical: uv_led_on            → physical: coil[3]

      # ──── 离散输入（1x 地址空间，位输入） ────
      - name: discrete_input
        address_space: Digital
        direction: In
        size: 256
        mappings:
          - logical: estop_pressed        → physical: discrete_input[0]
          - logical: light_curtain_blocked → physical: discrete_input[1]
          - logical: door_open            → physical: discrete_input[2]

      # ──── 保持寄存器（4x 地址空间，16-bit 输出） ────
      - name: holding_register
        address_space: Register
        direction: Out
        size: 256
        mappings:
          - logical: uv_power_level       → physical: holding_register[0]
          - logical: target_temperature   → physical: holding_register[1]
          - logical: lift_speed           → physical: holding_register[2]

      # ──── 输入寄存器（3x 地址空间，16-bit 输入） ────
      - name: input_register
        address_space: Register
        direction: In
        size: 256
        mappings:
          - logical: actual_temperature   → physical: input_register[0]
          - logical: z_position           → physical: { start: 1, len: 2 }
          - logical: uv_current           → physical: input_register[3]
```

### MODBUS 驱动实现

```rust
struct ModbusTcpDriver {
    client: modbus::TcpClient,
}

impl IoDriver for ModbusTcpDriver {
    fn read_inputs(&self, domain: &IoDomain, snapshot: &mut IoSnapshot) -> Result<()> {
        for channel in &domain.channels {
            match channel.name.as_str() {
                "discrete_input" => {
                    let bits = self.client.read_discrete_inputs(
                        0, channel.size as u16
                    )?;
                    for mapping in &channel.mappings {
                        let phys = mapping.physical.start;
                        snapshot.values.insert(
                            mapping.logical.clone(),
                            HalValue::Bool(phys < bits.len() && bits[phys]),
                        );
                    }
                }
                "input_register" => {
                    let regs = self.client.read_input_registers(
                        0, channel.size as u16
                    )?;
                    for mapping in &channel.mappings {
                        let phys = mapping.physical.start;
                        let val = if mapping.physical.len == 1 {
                            HalValue::S32(regs[phys] as i32)
                        } else {
                            // 多寄存器合并（如 z_position 占 2 个 16-bit 寄存器）
                            HalValue::S32(
                                ((regs[phys] as i32) << 16) | (regs[phys + 1] as i32)
                            )
                        };
                        snapshot.values.insert(mapping.logical.clone(), val);
                    }
                }
                _ => {}
            }
        }
        Ok(())
    }

    fn write_outputs(
        &self, domain: &IoDomain, snapshot: &IoSnapshot
    ) -> Result<()> {
        for channel in &domain.channels {
            match channel.name.as_str() {
                "coil" => {
                    let mut bits = vec![false; channel.size];
                    for mapping in &channel.mappings {
                        if let Some(HalValue::Bool(v)) = snapshot.values.get(&mapping.logical) {
                            bits[mapping.physical.start] = *v;
                        }
                    }
                    self.client.write_multiple_coils(0, &bits)?;
                }
                "holding_register" => {
                    let mut regs = vec![0u16; channel.size];
                    for mapping in &channel.mappings {
                        if let Some(val) = snapshot.values.get(&mapping.logical) {
                            match val {
                                HalValue::S32(v) => {
                                    if mapping.physical.len == 1 {
                                        regs[mapping.physical.start] = *v as u16;
                                    } else {
                                        regs[mapping.physical.start] = (*v >> 16) as u16;
                                        regs[mapping.physical.start + 1] = (*v & 0xFFFF) as u16;
                                    }
                                }
                                HalValue::U32(v) => {
                                    regs[mapping.physical.start] = *v as u16;
                                }
                                _ => {}
                            }
                        }
                    }
                    self.client.write_multiple_registers(0, &regs)?;
                }
                _ => {}
            }
        }
        Ok(())
    }
}
```

---

## 4. EtherCAT 配置示例

```yaml
domains:
  - name: ethercat_bus_1
    driver: ethercat
    connection:
      interface: eth0
      cycle_time_us: 1000  # DC 同步周期
    channels:
      # ──── Process Data Object (PDO) 1A00 — 驱动器 A ────
      - name: pdo_1a00
        address_space: Structured
        direction: In
        size: 32              # 32 bytes
        mappings:
          - logical: drive_a_status_word    → physical: { start: 0, len: 2 }
          - logical: drive_a_actual_position → physical: { start: 2, len: 4 }
          - logical: drive_a_actual_velocity → physical: { start: 6, len: 4 }
          - logical: drive_a_actual_torque   → physical: { start: 10, len: 2 }

      # ──── PDO 1600 — 驱动器 A 输出 ────
      - name: pdo_1600
        address_space: Structured
        direction: Out
        size: 32
        mappings:
          - logical: drive_a_control_word    → physical: { start: 0, len: 2 }
          - logical: drive_a_target_position  → physical: { start: 2, len: 4 }
          - logical: drive_a_target_velocity  → physical: { start: 6, len: 4 }

      # ──── SDO — 参数访问（非周期） ────
      - name: sdo
        address_space: Structured
        direction: Io
        size: 0               # 不限大小
        mappings:
          - logical: drive_a_max_current      → physical: { start: 0x8010, subindex: 1, len: 2 }
```

---

## 5. PROFINET 配置示例

```yaml
domains:
  - name: profinet_cell_1
    driver: profinet
    connection:
      device_name: "plc-cell1"
      rt_class: 1           # 1 = RT, 3 = IRT
      cycle_time_us: 1000
    channels:
      - name: io_data
        address_space: Named
        direction: Io
        mappings:
          - logical: cell1_estop     → physical: { path: "SafetyModule.EStop" }
          - logical: cell1_light     → physical: { path: "SafetyModule.LightCurtain" }
          - logical: robot1_ready    → physical: { path: "Robot1.StatusReady" }
          - logical: robot1_speed    → physical: { path: "Robot1.ActualSpeed" }
```

---

## 6. 与 HAL Protocol 的关系

IoImageTable **不是** HAL 协议的一部分。HAL 协议层面只看到逻辑 Signal：

```
IoImageTable 内部路由:
  "conveyor_start" ↔ MODBUS rack0.coil[0]
  "z_position"     ↔ MODBUS rack0.input_register[1..2]

HAL Protocol 层面:
  Signal "conveyor_start"  (Bool)
  Signal "z_position"      (S32)
```

**好处**：
- SCADA 开发人员用 `"conveyor_start"` 即可——不需要知道 MODBUS 地址
- 电气工程师改一条映射规则，HMI / PLC 程序一行代码都不用改
- 同一套 PLC 程序切换 Modbus → EtherCAT 只需换 `io-mapping.yaml`

---

## 7. 与 OpenPLC image table 的对比

| | OpenPLC image table | AUDESYS IoImageTable |
|---|---|---|
| 寻址 | 仅数字索引 `%IW0` | 逻辑名 "conveyor_start" + 数字索引 |
| 总线支持 | 隐式（驱动内部处理）| 显式 domain + channel + address_space |
| 多总线 | 不支持 | 任意多个 domain |
| 映射重配置 | 需重新编译 | 热加载 YAML |
| 结构化 PDO | 不支持 | 显式 byte offset + len |
| HAL 可见性 | 裸数组穿过 HAL | 独立 Signal，HalValue 类型 |

---

## 8. 设计决策记录

| 决策 | 理由 |
|------|------|
| IoImageTable 不在 HAL 协议内 | HAL 只传输值，不关心来源。映射是驱动层内部关注 |
| 逻辑-物理分离 | 更换总线时上层程序零修改 |
| AddressSpace 枚举而非仅 Array | MODBUS 离散/线圈/寄存器的语义不同，EtherCAT PDO 是结构化偏移 |
| Multi-register 合并（len > 1） | 32-bit 值跨两个 MODBUS 寄存器很常见 |
| SDO / named subindex 扩展 | EtherCAT SDO 有 subindex，PROFINET 有名路径 |
| 快照而非逐点传输 | 一致性保证——整个域在同一时刻的快照，不是逐个 pin |

| 多资源（Multi-Resource）用 security_domain 隔离 | IEC 61131-3 多个 CPU（Resource）共享同一个 Configuration。每个 Resource 映射为独立 Component，通过 `security_domain` + keyexpr 前缀天然隔离，无需 HAL 新增原语 |
