//! StreamChannel — multi-writer, multi-reader, ordered-queue semantics.
//! 来源: docs/modules/hal/hal-protocol-design.md S-CH, docs/modules/hal/thread-scheduling-design.md

use crate::types::{HalResult, StreamConfig, Subscription, Timestamp};
use crate::value::HalValue;

/// Callback invoked for each StreamChannel message. MUST NOT block.
pub type StreamCallback = Box<dyn Fn(&HalValue, Timestamp) + Send + Sync>;

/// StreamWriter trait — write side of a StreamChannel.
///
/// When the channel uses Backpressure policy, `write()` blocks when the
/// queue is full. With DropOldest/DropNewest, `write()` never blocks.
pub trait StreamWriter: Send {
    /// Write a value to the channel. May block under Backpressure policy.
    fn write(&self, value: HalValue, ts: Timestamp) -> HalResult<()>;

    /// Flush any buffered writes. No-op for non-buffered transports.
    fn flush(&self) -> HalResult<()>;
}

/// StreamReader trait — read side of a StreamChannel.
///
/// Each reader receives an independent copy of the stream (broadcast, not multicast).
pub trait StreamReader: Send {
    /// Read the next message from the queue. Returns None if queue is empty.
    fn read(&self) -> HalResult<Option<(HalValue, Timestamp)>>;

    /// Subscribe for push-mode delivery. Callback invoked for each message.
    fn subscribe(&self, cb: StreamCallback) -> HalResult<Subscription>;
}

/// Creates a new StreamChannel with the given configuration.
/// Returns independent write and read handles.
///
/// ## Config parameters (S-CH-003, S-CH-004, S-CH-005)
/// - queue_depth: default 256, min 1
/// - queue_policy: DropOldest | Backpressure | DropNewest
/// - error_policy: Block | Drop | Notify
/// - circuit_breaker: optional (Phase 2+)
pub fn create_stream_channel(
    config: StreamConfig,
) -> HalResult<(Box<dyn StreamWriter>, Box<dyn StreamReader>)> {
    // ponytail: stub — real impl in amw_inproc (Phase 1 M0.4)
    let _ = config;
    todo!("StreamChannel: amw_inproc implementation (Phase 1 M0.4)")
}

// ponytail: traits only — impl in amw_inproc
