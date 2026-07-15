# AUDESYS HAL 类型系统规范

> **来源**: `docs/modules/hal/iec-type-system-design.md` (v1.0, 2026-07-09)
> **总类型数**: 14 (11 标量 + 3 容器)
> **传输格式**: FlatBuffers union `HALValue`
> **编码**: 小端 (Little-Endian)

---

## 1. 类型总表

| ID | HAL 类型 | IEC 源 | 位宽 | FlatBuffers 表示 |
|----|---------|--------|------|-----------------|
| T01 | `Bool` | BOOL | 1 | `bool` |
| T02 | `S8` | SINT | 8 | `int8` |
| T03 | `U8` | USINT, BYTE | 8 | `uint8` |
| T04 | `S16` | INT | 16 | `int16` |
| T05 | `U16` | UINT, WORD | 16 | `uint16` |
| T06 | `S32` | DINT, IEC TIME | 32 | `int32` |
| T07 | `U32` | UDINT, DWORD, IEC DATE, IEC TOD | 32 | `uint32` |
| T08 | `S64` | LINT | 64 | `int64` |
| T09 | `U64` | ULINT, LWORD, IEC DT | 64 | `uint64` |
| T10 | `F32` | REAL | 32 | `float` |
| T11 | `F64` | LREAL | 64 | `double` |
| T12 | `Blob` | — | 变长 | `[uint8]` (length-prefixed) |
| T13 | `Array<T>` | — | 变长 | `[T]` (count-prefixed) |
| T14 | `String` | STRING | 变长 | `string` (UTF-8) |

---

## 2. 序列化往返 (Serialization Round-Trip)

### S-TYPE-001: Bool 序列化往返
- **前置条件**: 一个 `Bool = true` 值，一个 `Bool = false` 值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `true` 编码后解码得 `true`，`false` 编码后解码得 `false`
- **边界条件**: 无（布尔仅两个值）
- **测试映射**: `test_type_01_bool_roundtrip`

### S-TYPE-002: S8 序列化往返
- **前置条件**: 一个 `S8` 值 `-128`，精确位于 int8 最小值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `-128` 往返后仍是 `-128`
- **边界条件**: 测试 `-128`, `-1`, `0`, `1`, `127` 五个关键值
- **测试映射**: `test_type_02_s8_roundtrip`

### S-TYPE-003: U8 序列化往返
- **前置条件**: 一个 `U8` 值 `255`，精确位于 uint8 最大值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `255` 往返后仍是 `255`
- **边界条件**: 测试 `0`, `1`, `127`, `254`, `255` 五个关键值
- **测试映射**: `test_type_03_u8_roundtrip`

### S-TYPE-004: S16 序列化往返
- **前置条件**: 一个 `S16` 值 `-32768`，精确位于 int16 最小值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `-32768` 往返后仍是 `-32768`
- **边界条件**: 测试 `-32768`, `-1`, `0`, `1`, `32767` 五个关键值
- **测试映射**: `test_type_04_s16_roundtrip`

### S-TYPE-005: U16 序列化往返
- **前置条件**: 一个 `U16` 值 `65535`，精确位于 uint16 最大值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `65535` 往返后仍是 `65535`
- **边界条件**: 测试 `0`, `1`, `32768`, `65534`, `65535` 五个关键值
- **测试映射**: `test_type_05_u16_roundtrip`

### S-TYPE-006: S32 序列化往返
- **前置条件**: 一个 `S32` 值 `-2147483648`，精确位于 int32 最小值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `-2147483648` 往返后仍是 `-2147483648`
- **边界条件**: 测试最小值、`-1`, `0`, `1`、最大值 `2147483647`，共五个值
- **测试映射**: `test_type_06_s32_roundtrip`

### S-TYPE-007: U32 序列化往返
- **前置条件**: 一个 `U32` 值 `4294967295`，精确位于 uint32 最大值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `4294967295` 往返后仍是 `4294967295`
- **边界条件**: 测试 `0`, `1`, `2147483648`, `4294967294`, `4294967295` 五个关键值
- **测试映射**: `test_type_07_u32_roundtrip`

### S-TYPE-008: S64 序列化往返
- **前置条件**: 一个 `S64` 值 `-9223372036854775808`，精确位于 int64 最小值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `-9223372036854775808` 往返后仍是 `-9223372036854775808`
- **边界条件**: 测试最小值、`-1`, `0`, `1`、最大值 `9223372036854775807`，共五个值
- **测试映射**: `test_type_08_s64_roundtrip`

### S-TYPE-009: U64 序列化往返
- **前置条件**: 一个 `U64` 值 `18446744073709551615`，精确位于 uint64 最大值
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: `18446744073709551615` 往返后仍是 `18446744073709551615`
- **边界条件**: 测试 `0`, `1`, `9223372036854775808`, `18446744073709551614`, `18446744073709551615` 五个关键值
- **测试映射**: `test_type_09_u64_roundtrip`

### S-TYPE-010: F32 序列化往返
- **前置条件**: 一组 `F32` 值包含正负零、无穷、NaN、最大正数、最小正规数
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: 所有值往返后 bitwise 一致。NaN 的 payload 和 sign bit 不变
- **边界条件**: `0.0`, `-0.0`, `+inf`, `-inf`, `NaN` (quiet), `NaN` (signaling), `FLT_MAX`, `FLT_MIN`, `-FLT_MAX`, `-FLT_MIN`
- **测试映射**: `test_type_10_f32_roundtrip`

### S-TYPE-011: F64 序列化往返
- **前置条件**: 一组 `F64` 值包含正负零、无穷、NaN、最大正数、最小正规数
- **操作**: 编码 → 解码，比较原始值与解码值
- **期望结果**: 所有值往返后 bitwise 一致。NaN 的 payload 和 sign bit 不变
- **边界条件**: `0.0`, `-0.0`, `+inf`, `-inf`, `NaN`, `DBL_MAX`, `DBL_MIN`, `-DBL_MAX`, `-DBL_MIN`
- **测试映射**: `test_type_11_f64_roundtrip`

### S-TYPE-012: Blob 空载荷序列化往返
- **前置条件**: 一个长度为 0 的 `Blob`
- **操作**: 编码 → 解码，比较原始长度和数据
- **期望结果**: 解码后 Blob 长度为 0，数据指针非空或为空（取决于语言），无内存泄漏
- **边界条件**: 空 Blob、单字节 Blob (`0x00`)、典型 Blob（64B, 1KB, 64KB）
- **测试映射**: `test_type_12_blob_roundtrip`

### S-TYPE-013: Array<T> 序列化往返
- **前置条件**: 一个 `Array<S32>` 包含 5 个元素 `[0, -1, 2147483647, -2147483648, 42]`
- **操作**: 编码 → 解码，比较每个元素值与原始值
- **期望结果**: 所有元素值完整恢复，顺序不变
- **边界条件**: 空数组、单元素数组、每种标量类型作为元素类型、嵌套数组（Array<Array<S32>> 是否允许？设计规定 Array<T> 元素 T 可否为容器类型——需明确）
- **测试映射**: `test_type_13_array_roundtrip`

### S-TYPE-014: String 序列化往返
- **前置条件**: 一个 UTF-8 字符串 `"报警消息: 温度超限 #3"`（含中文、冒号、空格、井号）
- **操作**: 编码 → 解码，比较原始字符串与解码结果
- **期望结果**: 解码后的字符串与原始字符串 byte-by-byte 一致
- **边界条件**: 空字符串、纯 ASCII（127 字节）、3 字节 UTF-8 字符（中/日/韩）、4 字节 UTF-8 字符（emoji）、混合长度字符串
- **测试映射**: `test_type_14_string_roundtrip`

---

## 3. 验证 (Validation)

### S-TYPE-015: Blob 长度字段校验
- **前置条件**: 构造一个编码后的 FlatBuffers buffer，其中 Blob 的 length 字段声明为 `4294967295`，但实际 payload 只有 32 字节
- **操作**: 解码器尝试解析该 Blob
- **期望结果**: 解码器检测到长度字段与实际可用数据不符，返回 `Err(InvalidBlobLength)` 或等价错误
- **边界条件**: length=0 合法、length=实际字节数合法、length < 实际字节数、length > 实际字节数
- **测试映射**: `test_type_15_blob_length_validation`

### S-TYPE-016: Array<T> 元素类型一致性校验
- **前置条件**: 构造一个 FlatBuffers buffer，union 字段声明为 `Array<S32>` 但实际元素类型为 `F64`
- **操作**: 解码器尝试解析该 Array
- **期望结果**: 解码器拒绝不匹配的类型，返回 `Err(TypeMismatch)` 或等价错误
- **边界条件**: T 与存储类型完全匹配、T 与存储类型完全无关、T 是兼容类型（S32 vs U32——不应该容差）
- **测试映射**: `test_type_16_array_element_type_check`

### S-TYPE-017: String UTF-8 编码校验
- **前置条件**: 构造一个含有非法 UTF-8 序列（如 `0xFF 0xFE`）的 String
- **操作**: 解码器尝试解析该 String
- **期望结果**: 解码器检测到非法 UTF-8 序列，返回 `Err(InvalidUtf8)` 或等价错误（如果设计强制 UTF-8 有效性）；或解码器通过但不保证下游显示正确（如果设计允许透传）
- **边界条件**: 合法 UTF-8 通过、非法 UTF-8 被拒绝、BOM 前缀被视为非法或合法（需决策）、截断的多字节序列（如单独 `0xE4` 无后续字节）
- **测试映射**: `test_type_17_string_utf8_validation`

### S-TYPE-018: 未知 union 类型拒绝
- **前置条件**: 构造一个 FlatBuffers buffer，其中 `HALValue` union 的 type 字段设为 `15`（超出 0-14 范围）
- **操作**: 解码器尝试解析该 HALValue
- **期望结果**: 解码器拒绝未知的 union type，返回 `Err(UnknownHalType)` 或等价错误
- **边界条件**: type=0（第一个类型）、type=14（最后一个类型）、type=15（越界）、负 type 值
- **测试映射**: `test_type_18_unknown_union_type`

### S-TYPE-019: 多层嵌套 Array 深度限制
- **前置条件**: 构造一个深度超过实现限制的嵌套 Array（如 `Array<Array<Array<Array<S32>>>>`）
- **操作**: 解码器尝试解析该嵌套 Array
- **期望结果**: 解码器拒绝超出最大嵌套深度的结构，返回 `Err(MaxNestingDepthExceeded)` 或等价错误
- **边界条件**: 深度恰好等于限制值（通过）、深度超出限制值（拒绝）、零深度（普通 Array——通过）
- **测试映射**: `test_type_19_array_nesting_limit`

---

## 4. 边界条件 (Edge Cases)

### S-TYPE-020: IEC 时态类型边界——TIME 映射为 S32
- **前置条件**: IEC TIME 值 `T#24D20H31M23S647MS` 对应 S32 最大值 `2147483647`（ms）
- **操作**: 将 TIME 编码为 `S32`，解码后与原始 ms 值比较
- **期望结果**: 原始 ms 值解码后精确恢复
- **边界条件**: TIME `T#0MS` → S32 `0`；TIME `T#24D20H31M23S647MS` → S32 `2147483647`（最大值）；负 TIME（某些 PLC 允许）也要正确处理
- **测试映射**: `test_type_20_time_s32_boundary`

### S-TYPE-021: IEC 时态类型边界——DATE 映射为 U32
- **前置条件**: IEC DATE 值 `D#2106-02-07` 对应 U32 最大值 `4294967295`（days since epoch）
- **操作**: 将 DATE 编码为 `U32`，解码后与原始 days 值比较
- **期望结果**: 原始 days 值解码后精确恢复
- **边界条件**: `D#1984-01-01` → U32 `0`；`D#2106-02-07` → U32 `4294967295`；溢出年份应被拒绝或截断
- **测试映射**: `test_type_21_date_u32_boundary`

### S-TYPE-022: IEC 时态类型边界——TOD 映射为 U32
- **前置条件**: IEC TOD 值 `TOD#23:59:59.999` 对应 U32 `86399999`（ms since midnight）
- **操作**: 将 TOD 编码为 `U32`，解码后与原始 ms 值比较
- **期望结果**: 原始 ms 值解码后精确恢复
- **边界条件**: `TOD#00:00:00.000` → U32 `0`；`TOD#23:59:59.999` → U32 `86399999`；`TOD#24:00:00.000` 是否允许（IEC 规定 24:00 是合法的）→ 映射为 `86400000` 或拒绝
- **测试映射**: `test_type_22_tod_u32_boundary`

### S-TYPE-023: IEC 时态类型边界——DT 映射为 U64
- **前置条件**: IEC DT 值 `DT#2106-02-07-06:28:15.999` 对应 U64
- **操作**: 将 DT 编码为 `U64`（Unix epoch ms），解码后与原始 ms 值比较
- **期望结果**: 原始 ms 值解码后精确恢复
- **边界条件**: Unix epoch `1970-01-01T00:00:00.000Z` → U64 `0`；`2106-02-07T06:28:15.999Z` → U64 接近 uint32 上限；`1969-12-31T23:59:59.999Z` → 负 Unix epoch ms，能否被 U64 表示？需确认设计如何处理 DT 负值
- **测试映射**: `test_type_23_dt_u64_boundary`

### S-TYPE-024: Bool 位串语义——非零值窄化
- **前置条件**: 一个 `U8` 值 `0xFF` 被写为 `Bool`（底层 I/O 层可能产生非规范布尔值）
- **操作**: HAL 层将 `0xFF` 作为 Bool 接收并转发
- **期望结果**: 非零值被窄化为 `true`；仅 `0x00` 被窄化为 `false`
- **边界条件**: `0x00` → false；`0x01` → true；`0xFF` → true；`0x00` 以外的任何值 → true
- **测试映射**: `test_type_24_bool_narrowing`

### S-TYPE-025: Blob 零拷贝零长度指针
- **前置条件**: 一个零长度 Blob 通过 SHM (Shared Memory) 零拷贝路径传输
- **操作**: 接收端获取 Blob 的数据指针
- **期望结果**: 数据指针在零长度时可以为 NULL（与 flatbuffers 默认行为一致），不触发未定义行为
- **边界条件**: 零长度 SHM Blob、零长度栈上 Blob、零长度堆上 Blob
- **测试映射**: `test_type_25_blob_zero_length_ptr`

### S-TYPE-026: Array<T> 大数组内存边界
- **前置条件**: 一个 `Array<S32>` 包含 1000000 个元素（约 4MB 数据）
- **操作**: 编码此大数组
- **期望结果**: 编码成功，解码后所有元素值正确
- **边界条件**: `count=0`（空数组）、`count=1`（最小非空）、`count=1000000`（大型）、`count` 声明远大于实际数据可用量（内存越界保护）
- **测试映射**: `test_type_26_array_large_boundary`

### S-TYPE-027: String 空字符串与长字符串
- **前置条件**: 一个空字符串 `""` 和一个超长字符串（>64KB）
- **操作**: 编码 → 解码
- **期望结果**: 空字符串解码后长度为 0，内容为空；超长字符串完整恢复
- **边界条件**: 空字符串、单字符、接近 FlatBuffers 最大向量长度（2^31-1 字节边界在实际中不可达，但应测试 1MB）、含 null 字符的字符串（`"\0embedded\0null"`——字符串中间含 `\0` 能否正确处理）
- **测试映射**: `test_type_27_string_length_boundary`

### S-TYPE-028: F32/F64 特殊值透明传输
- **前置条件**: 一个包含 `NaN`（quiet NaN 和 signaling NaN）的 `F32` 信号
- **操作**: 编码 → 解码 → 检查 NaN 的 bitwise 表示
- **期望结果**: NaN 的 sign bit 和 payload bits 完全保持，不因序列化而丢失或静默改变
- **边界条件**: Quiet NaN（`0x7FC00001`）、Signaling NaN（`0x7F800001`）、负 NaN（`0xFFC00000`）、正无穷、负无穷、负零
- **测试映射**: `test_type_28_fp_special_values`

### S-TYPE-029: 类型转换——标量互转安全边界
- **前置条件**: 一个 U32 值 `4294967295`（uint32 最大值）被强制解释为 S32
- **操作**: 在不同类型间进行 retagging（编译时已知的语义转换，非运行时 cast）
- **期望结果**: 位模式不变，但语义解释改变。HAL 层不执行数值转换，仅传递位模式
- **边界条件**: U32→S32（位不变，值溢出）；U64→S64（同上）；F32→U32（位重解释，非数值转换）；Array<S32> 被误标记为 Array<F32> 应被拒绝
- **测试映射**: `test_type_29_scalar_retagging_safety`

### S-TYPE-030: IEC 类型——BYTE/WORD/DWORD/LWORD 位串保留
- **前置条件**: 一个 IEC BYTE 值 `16#A5`，映射到 U8
- **操作**: 以 U8 编码 → 解码 → 作为 BYTE 恢复
- **期望结果**: `16#A5` 的位模式 `10100101` 完全保留，无值语义改变
- **边界条件**: `16#00`、`16#FF`、`16#A5`、`16#0F` 四种位模式均保持
- **测试映射**: `test_type_30_bitstring_preservation`

---

## 5. HAValue Union 序列化布局

```
table HALValue {
  value_type: HalType;           // union type discriminator (uint8)
  value: HALValueUnion;          // union data
}

union HALValueUnion {
  Bool:      bool,               // 1 byte
  S8:        int8,               // 1 byte
  U8:        uint8,              // 1 byte
  S16:       int16,              // 2 bytes, 2-aligned
  U16:       uint16,             // 2 bytes, 2-aligned
  S32:       int32,              // 4 bytes, 4-aligned
  U32:       uint32,             // 4 bytes, 4-aligned
  S64:       int64,              // 8 bytes, 8-aligned
  U64:       uint64,             // 8 bytes, 8-aligned
  F32:       float,              // 4 bytes, 4-aligned
  F64:       double,             // 8 bytes, 8-aligned
  Blob:      [uint8],            // u32 length + u8[] payload
  Array<T>:  [T],                // u32 count + T[] elements
  String:    string,             // UTF-8 encoded
}
```

---

## 6. 测试覆盖矩阵

| 规范项 | 类别 | 测试名称 | 优先级 |
|--------|------|---------|--------|
| S-TYPE-001 | Serialization | `test_type_01_bool_roundtrip` | P0 |
| S-TYPE-002 | Serialization | `test_type_02_s8_roundtrip` | P0 |
| S-TYPE-003 | Serialization | `test_type_03_u8_roundtrip` | P0 |
| S-TYPE-004 | Serialization | `test_type_04_s16_roundtrip` | P0 |
| S-TYPE-005 | Serialization | `test_type_05_u16_roundtrip` | P0 |
| S-TYPE-006 | Serialization | `test_type_06_s32_roundtrip` | P0 |
| S-TYPE-007 | Serialization | `test_type_07_u32_roundtrip` | P0 |
| S-TYPE-008 | Serialization | `test_type_08_s64_roundtrip` | P0 |
| S-TYPE-009 | Serialization | `test_type_09_u64_roundtrip` | P0 |
| S-TYPE-010 | Serialization | `test_type_10_f32_roundtrip` | P0 |
| S-TYPE-011 | Serialization | `test_type_11_f64_roundtrip` | P0 |
| S-TYPE-012 | Serialization | `test_type_12_blob_roundtrip` | P0 |
| S-TYPE-013 | Serialization | `test_type_13_array_roundtrip` | P0 |
| S-TYPE-014 | Serialization | `test_type_14_string_roundtrip` | P0 |
| S-TYPE-015 | Validation | `test_type_15_blob_length_validation` | P0 |
| S-TYPE-016 | Validation | `test_type_16_array_element_type_check` | P0 |
| S-TYPE-017 | Validation | `test_type_17_string_utf8_validation` | P1 |
| S-TYPE-018 | Validation | `test_type_18_unknown_union_type` | P0 |
| S-TYPE-019 | Validation | `test_type_19_array_nesting_limit` | P1 |
| S-TYPE-020 | Edge | `test_type_20_time_s32_boundary` | P0 |
| S-TYPE-021 | Edge | `test_type_21_date_u32_boundary` | P0 |
| S-TYPE-022 | Edge | `test_type_22_tod_u32_boundary` | P0 |
| S-TYPE-023 | Edge | `test_type_23_dt_u64_boundary` | P0 |
| S-TYPE-024 | Edge | `test_type_24_bool_narrowing` | P1 |
| S-TYPE-025 | Edge | `test_type_25_blob_zero_length_ptr` | P1 |
| S-TYPE-026 | Edge | `test_type_26_array_large_boundary` | P1 |
| S-TYPE-027 | Edge | `test_type_27_string_length_boundary` | P1 |
| S-TYPE-028 | Edge | `test_type_28_fp_special_values` | P0 |
| S-TYPE-029 | Edge | `test_type_29_scalar_retagging_safety` | P1 |
| S-TYPE-030 | Edge | `test_type_30_bitstring_preservation` | P0 |

---

## 7. 对其他模块的依赖/影响

| 依赖方 | 影响 | 说明 |
|--------|------|------|
| hal-flatbuffers schema | `.fbs` 文件必须定义 `HALValue` union | 类型清单直接决定 schema |
| hal-core Rust crate | `HalValue` enum 定义 | 与 `.fbs` 保持同步 |
| amw transport | Signal/StreamChannel 载荷必须符合 HALValue | 载荷 union 一致性 |
| IEC 61131-3 compiler | 类型映射表（§1）决定编译目标 | ST 编译器按此表产生产出 |
| Thin Client (Python/JS) | 类型系统决定 Thin Client SDK API | 每种类型需有 getter/setter |
| FlatBuffers codegen | 所有语言的 flatc 产出需包含 14 种类型 | build.rs 集成 flatc |