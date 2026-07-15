//! StreamChannel — multi-writer, multi-reader, ordered-queue semantics.
//! 来源: docs/modules/hal/hal-protocol-design.md S-CH, docs/modules/hal/thread-scheduling-design.md

use crate::types::{HalResult, Subscription, Timestamp};
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

// ponytail: create_stream_channel factory lives in amw_inproc —
// hal-core only defines the StreamWriter/StreamReader traits.
