# AUDESYS HAL Protocol Specification

**Spec ID**: HAL-PROTOCOL-v1
**Status**: Draft
**Source**: `docs/modules/hal/hal-protocol-design.md`
**Date**: 2026-07-15

This document defines the normative specification for AUDESYS HAL
communication primitives: Signal, StreamChannel, and RPC. Each spec
item is numbered and serves as a single source of truth for
implementation, testing, and conformance verification.

---

## S-SIG: Signal Primitive

Single-writer, multi-reader, latest-value semantics. Designed for
minimum latency control signals.

### S-SIG-001: Single Writer Constraint

A Signal MUST have exactly one writer at any time. Concurrent writes
from multiple sources are not permitted and the amw layer MUST enforce
this. InProcess: exclusive Arc<RwLock<>> writer slot. Zenoh: keyexpr
uniqueness verified at publisher registration.

### S-SIG-002: Multi-Reader Support

A Signal MUST support N concurrent readers (N >= 1). Readers consume
the latest value independently. Adding or removing a reader MUST NOT
affect other readers or the writer.

### S-SIG-003: Latest-Value Semantics

A Signal stores exactly one value: the most recently published value.
No history is retained. A reader that subscribes later receives the
latest buffered value (not a null) if a write has occurred. A reader
that reads faster than the writer always sees the current value. A
reader that reads slower than the writer skips intermediate values.

Rationale: Control signals (position setpoint, limit switch state)
only care about the latest value. History buffering adds latency
overhead with zero benefit.

### S-SIG-004: Consumer Modes

A Signal MUST support three consumer access modes:

| Mode | API | Use Case |
|------|-----|----------|
| push | subscribe_signal(callback) | RT thread: callback invoked synchronously on publish |
| pull | read_signal(name) | Supervisor/HMI: reads latest value on demand |
| pull_batch | snapshot_signals(pattern) | Monitoring: wildcard-pattern batch read |

Push mode callbacks MUST execute synchronously in the publisher's
context (zero additional latency). Pull and pull_batch modes MUST NOT
block the publisher.

### S-SIG-005: Update-on-Write

A Signal MUST deliver the new value to all push subscribers when the
writer publishes. The delivery MUST be synchronous and non-batched:
each publish call triggers delivery before returning.

### S-SIG-006: Signal Naming Pattern

Signal names MUST follow the pattern `component.[interface.]name`:

```
motion.axis.0.pos          # component= motion,    name= axis.0.pos
motion.axis.0.enable       # component= motion,    name= axis.0.enable
io.digital.input.0         # component= io,        name= digital.input.0
plc.rack0.slot3.di5        # component= plc,       name= rack0.slot3.di5
robot.cmd_vel              # component= robot,     name= cmd_vel
```

The interface segment is OPTIONAL. When present, it separates the
component from the logical interface, enabling structured naming.

### S-SIG-007: Signal Name Component Constraints

| Segment | Charset | Max Length | Notes |
|---------|---------|-----------|-------|
| component | `[a-z0-9][a-z0-9-]*` | 64 | Reserved: hal, amw, system, _ |
| interface | `[a-z0-9][a-z0-9-]*` | 32 | Optional segment |
| name | `[a-z0-9_]+` | 64 | Underscore delimited |

All segments MUST be lowercase. The full name (including dots) MUST
NOT exceed 192 characters.

### S-SIG-008: Push Mode Callback Type

```rust
type SignalCallback = Box<dyn Fn(&HalValue, Timestamp) + Send + Sync>;
```

The callback receives a shared reference to the value and the
timestamp. The callback MUST NOT mutate the HalValue. The callback
SHOULD NOT block.

### S-SIG-009: Signal Size Constraints

| Property | Constraint |
|----------|-----------|
| Typical payload | < 1 KB |
| Maximum payload | 64 KB |
| Payload types | All 13 HAL types (Bool, S8..F64, Blob, Array<T>) |

Payloads exceeding 64 KB MUST use StreamChannel instead.

### S-SIG-010: Signal Latency Budget

| Transport | Budget | Conditions |
|-----------|--------|-----------|
| InProcess | < 1 us | Typed API, no serialization, same process |
| UDS | ~10 us (6-30 us typical) | PREEMPT_RT kernel, < 1KB message |
| Zenoh | ~100 us (50-500 us typical) | 1Gbps Ethernet, < 64KB message |

Latency budgets are design targets. Production deployments MUST
measure and report using the methods in S-SIG-011.

### S-SIG-011: Latency Verification Method

| Transport | Tool | Metric | Workload |
|-----------|------|--------|----------|
| InProcess | criterion bench | p50/p95/p99 | 1M publish/subscribe ops |
| UDS | linux-perf + Ftrace | p50/p95/p99 | 256-byte msg, 100K iterations |
| Zenoh TCP | tcpdump + zenoh ping | p50/p95/p99 RTT | 1KB-64KB msg, 1Gbps Ethernet |

Results MUST be recorded in the audit report. Measurements MUST name
the kernel version, CPU model, and memory configuration.

---

## S-CH: StreamChannel Primitive

Multi-writer, multi-reader, ordered-queue semantics. Designed for
high-throughput data streaming.

### S-CH-001: Multi-Writer, Multi-Reader

A StreamChannel MUST support 1..N writers and 1..N readers
concurrently. Writers and readers are independent: adding or removing
either MUST NOT affect the others.

### S-CH-002: Ordered-Queue Semantics

A StreamChannel maintains an ordered FIFO queue. Messages are
delivered to each reader in the order they were published. Each reader
receives an independent copy of the stream (broadcast, not multicast).

### S-CH-003: Queue Depth Configuration

The queue depth MUST be configurable at channel creation time. The
default depth is 256 messages. The minimum depth is 1. There is no
maximum depth (memory bound).

```yaml
stream_channel:
  queue_depth: configurable
  default: 256
  minimum: 1
  maximum: unbounded
```

### S-CH-004: Overflow Policies (QueuePolicy)

When the queue is full, the behavior MUST follow one of three
configured policies:

| Policy | Behavior | Use Case |
|--------|----------|----------|
| DropOldest | Discard the oldest message, append the new one | Sensor data: tolerate frame drops |
| Backpressure | Block the writer until space is available | Control commands: must not lose |
| DropNewest | Discard the new message, keep the queue intact | Logging: keep recent history |

The policy MUST be chosen at channel creation and MUST NOT change
during the channel's lifetime.

### S-CH-005: Error Policy on Consumer Error

When a reader callback fails, the behavior follows this policy:

```yaml
error_policy:
  on_consumer_error: Notify  # Block | Drop | Notify
```

- Block: pause delivery to all readers until the failing reader recovers
- Drop: silently discard the message for the failing reader only
- Notify: drop the message for the failing reader AND publish an
  alarm Signal

Default: Notify. Rationale: silent data loss is worse than a dropped
frame with an alert.

### S-CH-006: Circuit Breaker

A StreamChannel MAY support an optional circuit breaker to protect
against cascading failures:

```yaml
circuit_breaker:
  enabled: false               # Phase 1-2 default: off
  max_consecutive_failures: 3
  cooldown_ms: 5000
  on_open: Notify              # Notify | Panic | Ignore
```

When enabled: after `max_consecutive_failures` consecutive consumer
errors, the channel enters the OPEN state for `cooldown_ms`. While
open, messages are handled per `on_open` policy. After cooldown, the
channel transitions to HALF-OPEN and resumes normal delivery.

### S-CH-007: SHM Threshold

Messages >= `shm_threshold_bytes` (default: 4096) MUST use shared
memory zero-copy transfer when the transport supports it (Zenoh SHM
Phase 4+).

```yaml
shm_threshold_bytes: 4096
```

Below this threshold, messages use the transport's normal serialized
path (UDS + FlatBuffers or Zenoh TCP).

### S-CH-008: StreamChannel Naming Pattern

StreamChannel names MUST follow the pattern `domain.stream_name`:

```
lidar.scan.ranges            # domain= lidar,    stream_name= scan.ranges
camera.image                 # domain= camera,   stream_name= image
robot.joint_states           # domain= robot,    stream_name= joint_states
detection.bboxes             # domain= detection, stream_name= bboxes
plc.rack0.input_image        # domain= plc,      stream_name= rack0.input_image
```

| Segment | Charset | Max Length |
|---------|---------|-----------|
| domain | `[a-z0-9][a-z0-9-]*` | 32 |
| stream_name | `[a-z0-9_]+` | 64 |

All segments MUST be lowercase. Total name length MUST NOT exceed 128
characters.

### S-CH-009: StreamChannel Size Constraints

| Property | Constraint |
|----------|-----------|
| Payload range | 1B to 100MB |
| SHM zero-copy threshold | >= 4KB (Blob/Array) |
| Typical throughput | 100+ MB/s (Zenoh SHM) |

### S-CH-010: Reader and Writer Traits

```rust
trait StreamWriter: Send {
    fn write(&self, data: HalValue) -> Result<()>;
    fn flush(&self) -> Result<()>;
}

trait StreamReader: Send {
    fn read(&self) -> Result<Option<(HalValue, Timestamp)>>;
    fn subscribe(&self, cb: Box<dyn Fn(&HalValue, Timestamp) + Send + Sync>) -> Result<Subscription>;
}
```

`write()` on a StreamChannel with Backpressure policy MUST block when
the queue is full. `write()` on DropOldest/DropNewest MUST NOT block.

---

## S-RPC: RPC Primitive

Request/reply pattern for configuration, service calls, and lifecycle
management.

### S-RPC-001: Request/Reply Pattern

RPC MUST follow the request/reply pattern. A caller sends a request
and receives exactly one response. There is no support for streaming
responses (use StreamChannel for that) or one-way fire-and-forget (use
Signal for that).

### S-RPC-002: Correlation via Request ID

Every RPC request MUST carry an auto-incrementing uint64 request_id.
The response MUST echo the same request_id to enable correlation in
the presence of concurrent calls.

```yaml
rpc:
  request_id: uint64 (auto_increment)
```

The request_id namespace is per-caller. Different callers MAY use
overlapping IDs without conflict because the response routing is
scoped to the caller's transport connection.

### S-RPC-003: Configurable Timeout

Every RPC call MUST support a configurable timeout. The default is
5000 ms. When the timeout expires without a response, the caller MUST
receive a Timeout error and MAY retry (subject to idempotency rules,
see S-RPC-004).

```yaml
timeout_ms: configurable
default: 5000
```

### S-RPC-004: Idempotency Flag

Every RPC method MUST declare an idempotency flag:

| Flag | Methods | Retry Safety |
|------|---------|-------------|
| idempotent: true | readSnapshot, getStatus | Safe to retry on timeout |
| idempotent: false | activateComponent, deployConfig | NOT safe to retry |

The idempotency flag is a boolean attached to the method declaration,
not per-call. The RPC runtime MUST reject retries for non-idempotent
methods unless the caller explicitly overrides.

### S-RPC-005: All-or-Nothing Semantics

RPC does NOT support partial failure. A request either completes fully
(success response) or fails entirely (error response with reason).
There is no partial-commit scenario.

### S-RPC-006: Concurrent Calls

An RPC handler MUST support concurrent invocations. The handler
implementation is responsible for internal synchronization. The RPC
runtime MUST NOT serialize calls unless the method is declared
non-reentrant.

A caller MAY issue concurrent calls with different method names. A
caller MAY issue concurrent calls with the same method name, using
request_id for correlation.

### S-RPC-007: Error Handling

RPC responses MUST distinguish three error categories:

| Category | Cause | Response |
|----------|-------|----------|
| Timeout | No response within timeout_ms | Err(Timeout { method, timeout_ms }) |
| Rejected | Method not found, invalid params | Err(Rejected { code, reason }) |
| Execution | Handler internal failure | Err(Execution { method, reason }) |

The error response MUST include a human-readable `reason` string for
diagnosis. Error codes follow HTTP-inspired ranges: 4xx for client
errors, 5xx for server errors.

### S-RPC-008: Method Naming

RPC method names MUST follow `verbNoun` convention in camelCase:

```
loadComponent
unloadComponent
configureComponent
activateComponent
deactivateComponent
linkPin
addFunction
removeFunction
getSnapshot
newSignal
```

All methods MUST be lowercase-initial camelCase (e.g. not
`LoadComponent`). Method names MUST be unique per scope (component or
global, depending on deployment).

### S-RPC-009: Handler Type

```rust
type RpcHandler = Box<dyn Fn(&[u8]) -> Result<Vec<u8>> + Send + Sync>;
```

Handlers receive raw bytes and return raw bytes. Serialization is
handled by the caller/callee (JSON-RPC 2.0 for control plane). The
transport layer does not inspect payload content.

---

## Cross-Cutting Spec Items

### S-AMW-001: Transport Abstraction (HalTransport)

All three primitives (Signal, StreamChannel, RPC) MUST be implementable
on top of the `HalTransport` trait. The trait defines the API contract;
concrete implementations (`amw_inproc`, `amw_zenoh`) fulfill it.

See `docs/modules/hal/hal-protocol-design.md` section 2 for the trait
definition.

### S-AMW-002: Discovery Abstraction (HalDiscovery)

Signal and StreamChannel MUST be discoverable through the
`HalDiscovery` trait. RPC methods are discovered through the
Supervisor (not HalDiscovery).

### S-AMW-003: AmwFactory Pattern

Each transport implementation MUST provide an `AmwFactory` that
creates an `AmwMiddleware` (HalTransport + HalDiscovery + shutdown +
metrics). The factory pattern enables compile-time selection of the
transport backend.

### S-TYPE-001: Supported Types

All primitives support the unified HAL type system: 11 scalars (Bool,
S8, U8, S16, U16, S32, U32, S64, U64, F32, F64) and 2 containers
(Blob, Array<T>). See `docs/modules/hal/hal-protocol-design.md`
section 3 for the full type definitions.

### S-TYPE-002: Blob Transparency

Blob content is opaque to the HAL layer. The HAL transports the bytes
but does not interpret the schema. Format negotiation is between
producer and consumer.

### S-NAME-001: General Naming Rules

- All names MUST be lowercase (canonical form)
- Component/domain segments use hyphen-delimited kebab-case
- Name segments use underscore-delimited snake_case
- Dots separate hierarchy levels
- Leading underscore is reserved for internal system names
- Names are case-sensitive (after canonicalization to lowercase)

### S-LATENCY-001: Measurement Principles

- Every latency declaration MUST include a precondition (kernel,
  message size, hardware)
- Every latency declaration MUST include a typical range, not a single
  number
- Every latency declaration MUST reference a verification method
- Measurement results MUST be written to the audit report

---

## Spec Item Index

| ID | Category | Title |
|----|----------|-------|
| S-SIG-001 | Signal | Single Writer Constraint |
| S-SIG-002 | Signal | Multi-Reader Support |
| S-SIG-003 | Signal | Latest-Value Semantics |
| S-SIG-004 | Signal | Consumer Modes |
| S-SIG-005 | Signal | Update-on-Write |
| S-SIG-006 | Signal | Signal Naming Pattern |
| S-SIG-007 | Signal | Name Component Constraints |
| S-SIG-008 | Signal | Push Mode Callback Type |
| S-SIG-009 | Signal | Size Constraints |
| S-SIG-010 | Signal | Latency Budget |
| S-SIG-011 | Signal | Latency Verification Method |
| S-CH-001 | StreamChannel | Multi-Writer, Multi-Reader |
| S-CH-002 | StreamChannel | Ordered-Queue Semantics |
| S-CH-003 | StreamChannel | Queue Depth Configuration |
| S-CH-004 | StreamChannel | Overflow Policies |
| S-CH-005 | StreamChannel | Error Policy on Consumer Error |
| S-CH-006 | StreamChannel | Circuit Breaker |
| S-CH-007 | StreamChannel | SHM Threshold |
| S-CH-008 | StreamChannel | Naming Pattern |
| S-CH-009 | StreamChannel | Size Constraints |
| S-CH-010 | StreamChannel | Reader and Writer Traits |
| S-RPC-001 | RPC | Request/Reply Pattern |
| S-RPC-002 | RPC | Correlation via Request ID |
| S-RPC-003 | RPC | Configurable Timeout |
| S-RPC-004 | RPC | Idempotency Flag |
| S-RPC-005 | RPC | All-or-Nothing Semantics |
| S-RPC-006 | RPC | Concurrent Calls |
| S-RPC-007 | RPC | Error Handling |
| S-RPC-008 | RPC | Method Naming |
| S-RPC-009 | RPC | Handler Type |
| S-AMW-001 | Cross | Transport Abstraction (HalTransport) |
| S-AMW-002 | Cross | Discovery Abstraction (HalDiscovery) |
| S-AMW-003 | Cross | AmwFactory Pattern |
| S-TYPE-001 | Cross | Supported Types |
| S-TYPE-002 | Cross | Blob Transparency |
| S-NAME-001 | Cross | General Naming Rules |
| S-LATENCY-001 | Cross | Measurement Principles |