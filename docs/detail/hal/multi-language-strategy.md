# AUDESYS HAL 多语言策略

> 生成日期：2026-07-09
> 设计目标：定义 HAL 的多语言支持分层策略，RT 线程纯 Rust，跨语言走 FlatBuffers

---

## 设计原则

工业自动化系统的语言需求是分层的，不能用同一个方案满足所有场景：

1. **RT 数据面**：微秒级确定性，只能有一种语言——Rust
2. **I/O 通信**：需要跨进程、零拷贝序列化——FlatBuffers
3. **控制面/HMI**：多语言便利性优先——FlatBuffers + 任意语言

**核心理念：Rust 是第一公民。FlatBuffers 是跨语言桥梁。不在 RT 线程中引入脚本语言。**

---

## 1. 三层语言策略

```
┌──────────────────────────────────────────────────────────┐
│                    HAL 多语言架构                          │
│                                                          │
│  ┌──────────────────────────────────────────────────┐   │
│  │        FlatBuffers Schema (.fbs)                  │   │
│  │  hal_value.fbs, signal.fbs, component.fbs, ...   │   │
│  └────────┬─────────────────────────────────────────┘   │
│           │   flatc --{lang}                             │
│           ▼                                              │
│  ┌─────────────────────────────────────────────────┐    │
│  │   生成代码: Rust | C++ | Python | Node.js | ...  │    │
│  └─────────────────────────────────────────────────┘    │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │  L1: RT 数据面 │  │  L2: I/O 通信 │  │  L3: 控制面   │  │
│  │              │  │              │  │              │  │
│  │ Rust Typed   │  │ FlatBuffers  │  │ FlatBuffers  │  │
│  │ API (InProc) │  │ over UDS     │  │ over Zenoh   │  │
│  │ < 1μs        │  │ ~10μs        │  │ ~100μs       │  │
│  │              │  │              │  │              │  │
│  │ Rust 独占    │  │ Rust + C++   │  │ 任意语言     │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└──────────────────────────────────────────────────────────┘
```

| 层 | 用途 | 语言 | 通信方式 | 延迟 | Phase |
|----|------|------|---------|------|-------|
| **L1** | RT 数据面 | Rust | Typed API（InProcess，无序列化） | < 1μs | Phase 1 |
| **L2** | I/O 通信 | Rust, C++ | FlatBuffers over UDS | ~10μs | Phase 2 |
| **L3** | 控制面 / HMI | Python, Node.js, Go, ... | FlatBuffers over Zenoh | ~100μs | Phase 3+ |

---

## 2. L1: RT 数据面 — Rust 独占

### 为什么只有 Rust

| 要求 | Rust | C++ | Python | Go |
|------|------|-----|--------|-----|
| 无 GC 暂停 | ✅ | ✅ | ❌ GC + GIL | ✅ 并发 GC |
| 编译期内存安全 | ✅ borrow checker | ❌ 手动管理 | — | — |
| SCHED_FIFO 确定性 | ✅ | ✅（需 mlockall + arena alloc） | ❌ | ❌ GC 非确定 |
| 零开销跨函数调用 | ✅ InProcess Typed API | ✅ FFI（1–5μs 开销） | ❌ 50–500μs | ❌ cgo 开销 |
| 类型安全跨越线程 | ✅ Send + Sync trait | ❌ 手动保证 | — | ❌ runtime 检查 |

**Rust 是唯一无需"信任开发者"就能达到硬实时的语言。** C++ 理论上可以（LinuxCNC 证明），但需要团队层面的内存安全规范 + arena allocator + mlockall + 严格的 code review，工作量和漏检率远高于 Rust。

### C++ FFI 桥接（仅限 L2，非 L1）

```rust
// controller/hal-ffi/src/lib.rs — C FFI 边界
#[no_mangle]
pub extern "C" fn hal_signal_read_pin(
    handle: *const HalSignalHandle,
    pin_name: *const c_char,
    value_out: *mut f64,
) -> i32 {
    // FFI 边界：C 调用进入 Rust HAL Core
    // 延迟: 1–5μs（跨 FFI 边界 + 字符串转换）
    let signal = unsafe { &*handle };
    let name = unsafe { CStr::from_ptr(pin_name) };
    match signal.read_pin(name.to_str().unwrap()) {
        Ok(v) => { unsafe { *value_out = v }; 0 }
        Err(_) => -1,
    }
}
```

**C++ 走 FFI 仅推荐用于 L2 I/O 通信（非 RT 线程）**——如果现有 C++ 驱动库（如 EtherCAT master）需要直接对接 HAL。

---

## 3. L2: I/O 通信 — FlatBuffers over UDS

### 为什么是 FlatBuffers

| | FlatBuffers | Protobuf | Cap'n Proto | 裸 struct |
|---|---|---|---|---|
| 零拷贝读取 | ✅ | ❌（需 deserialize）| ✅ | ✅ |
| 无 heap 分配（读取）| ✅ | ❌ | ✅ | ✅ |
| 跨语言代码质量 | ✅ 优秀 | ✅ 优秀 | ⚠️ 参差不齐 | ❌ 需手动 |
| 生成代码体积 | 4KB | 61KB | 中等 | 0KB（无生成器）|
| 支持语言数 | 15（官方）| 11+ | 8+ | — |
| 官方 benchmark | decode 3,700× 快于 Protobuf | — | — | — |

**来源**：flatbuffers.dev 官方 benchmark（1M 次操作）

### Phase 2 UDS 通信

```yaml
# Controller 与 Supervisor 之间的 I/O 通信
transport: UDS + FlatBuffers
latency: ~10μs (6–30μs, PREEMPT_RT)
languages: Rust, C++
data: Signal values, StreamChannel frames, RPC requests
```

### 代码生成示例

```bash
# 从 .fbs 生成多语言绑定
flatc --rust   -o src/generated/ hal_value.fbs signal.fbs
flatc --cpp    -o include/generated/ hal_value.fbs signal.fbs
flatc --python -o py_bindings/ hal_value.fbs signal.fbs
```

---

## 4. L3: 控制面 / HMI — FlatBuffers over Zenoh + 任意语言

### 支持的语言

| 语言 | FlatBuffers 代码质量 | 推荐用于 |
|------|---------------------|---------|
| **Rust** | 优秀 | L1 RT 数据面 |
| **C++** | 优秀 | L2 I/O 驱动 |
| **C** | 良好 | 嵌入式 HAL 终端 |
| **Python** | 良好 | 测试脚本、数据采集、配置工具 |
| **Node.js / TS** | 良好 | Studio IDE、HMI Panel、Web 监控 |
| **Go** | 良好 | Gateway、Remote 代理 |
| **Java / Kotlin** | 良好 | 企业集成 |
| **C#** | 良好 | Windows HMI（工业传统）|

**15 种官方支持语言完整列表**：C++, C, C#, Go, Java, JavaScript/TypeScript, Python, Rust, Dart, Kotlin, Swift, PHP, Lua, Lobster, Nim

### 语言延迟预算表

| 语言 + 绑定方式 | 典型延迟 | 适用场景 | 不适用场景 |
|----------------|---------|---------|-----------|
| **Rust Typed API** | < 1μs | 硬实时控制 | — |
| **C++ FFI** | 1–5μs | I/O 驱动（有现有 C++ 代码）| RT 线程核心逻辑 |
| **Node.js (napi-rs)** | 10–50μs | Studio 后端、配置管理 | RT 数据面 |
| **Python (PyO3+numpy)** | 50–500μs | 测试、数据采集、HMI 脚本 | RT 数据面、高吞吐流 |
| **Python (FlatBuffers)** | 100–1000μs | 跨主机配置、监控面板 | RT 数据面 |
| **Go (FlatBuffers)** | 10–100μs | Gateway、Remote 代理 | RT 数据面 |

---

## 5. 方案评估：否决项

| 方案 | 否决理由 | 来源 |
|------|---------|------|
| **WASM/WASI Component Model** | JIT 非确定性（无法 SCHED_FIFO），canonical ABI 走 copy（非零拷贝），零工业 RT 案例，WASI Preview 2 2024 Q4 才稳定 | WASI.dev |
| **gRPC (Protobuf)** | HTTP/2 + TLS 开销，50–200μs RTT，不适合微秒级控制。Python 解码慢 3,700× | gRPC 性能文档 + flatbuffers.dev benchmark |
| **纯 IPC + IDL（ROS2 模式）** | Rust 失去 InProcess < 1μs 优势——所有语言拉平到 IPC ~10μs。codegen 链（rosidl 6 后端）维护负担重 | ros2/rosidl 仓库源码 |
| **Cap'n Proto** | 跨语言零拷贝做不到（必须同语言同进程）。C/Python 插件是 partial 实现（只有序列化，没有 RPC）| capnproto.org/otherlang.html |
| **嵌入脚本（Lua/Rhai/Python）** | 只能用特定脚本语言，不是"多语言"。Python GIL 阻塞 RT。复杂算法不适合脚本 | LinuxCNC classicladder 源码 |
| **Apache Thrift** | 二进制协议不提供 RT 优势。Protobuf 轻量化更好（LITE runtime）| Thrift vs Protobuf 生态对比 |

---

## 6. 分阶段语言支持

| Phase | 新增语言 | 方式 | 场景 |
|-------|---------|------|------|
| **Phase 1** | Rust | Typed API (InProcess) | RT 线程 |
| **Phase 2** | Rust, C++ | FlatBuffers over UDS | I/O 驱动通信 |
| **Phase 3** | Python | PyO3 (L3 控制面) | 测试、配置工具 |
| **Phase 3** | Node.js, TypeScript | napi-rs (L3) | Studio IDE |
| **Phase 4** | Go | FlatBuffers over Zenoh | Gateway 代理 |
| **Phase 5** | C# (社区贡献) | FlatBuffers | Windows HMI |

---

## 7. 设计决策记录

| 决策 | 理由 |
|------|------|
| Rust 是 RT 数据面唯一语言 | 唯一无需"信任开发者"就能达到硬实时的语言。C++ 可走 FFI 但在 RT 线程外使用 |
| FlatBuffers 是跨语言桥梁 | 零拷贝、0 heap、15 种语言、3,700× 快于 Protobuf。schema 即文档即契约 |
| 不在 RT 线程引入脚本语言 | Python GIL + VM 开销 = 50–500μs，破坏微秒级确定性。LinuxCNC 同样将 Python 放在非 RT task |
| C++ FFI 仅用于 I/O 驱动层 | 给现有 C++ 驱动库（EtherCAT master 等）提供对接路径，但不建议用于 RT 核心逻辑 |
| 不引入 gRPC/Thrift | 微秒级控制无法承受 HTTP/2 + TLS 开销。非 RT 层已有 JSON-RPC 覆盖控制面 |
| 不引入 WASM 组件模型 | JIT 非确定性 + 零工业 RT 案例。作为长期跟踪（Phase 4+），非当前方向 |
| 按 Phase 逐步开放语言 | 先 Rust（L1），再 C++（L2 驱动），再 Python/Node（L3 配置），最后 Go/Java（L3 企业集成）|
