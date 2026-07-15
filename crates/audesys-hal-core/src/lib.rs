//! AUDESYS HAL Core — hardware abstraction layer foundation.
//!
//! # Architecture (D10-D19)
//! - Signal: single-writer, multi-reader, latest-value
//! - StreamChannel: multi-writer, multi-reader, ordered-queue
//! - RPC: request/reply with idempotency
//!
//! # Decision references
//! - D10: three-primitive design
//! - D11: amw middleware abstraction
//! - D12: 14-type unified system
//! - D13: four-system hybrid scheduling
//! - D16: industrial QoS three-layer
//! - D17: Config Barrier + LockLevel
//! - D19: multi-language FlatBuffers
//! - D33: direct TDD (no Ludwig)
//! - D50: test-harness auto-generation
//! - D53: Phase 0 → Phase 1 M0.3 transition

// Phase 0 token — proves workspace compiles & links.
// Superseded by amw_inproc crate (Phase 1 M0.4).
#[derive(Debug)]
pub struct HalCoreLinked;

// ── Layer 0-1: Foundation types ──
pub mod encoding;
pub mod types;
pub mod value;
// ── Layer 2-3: Communication primitives ──
pub mod stream;
pub mod transport;

// ── Layer 4-5: Service abstractions ──
pub mod discovery;
pub mod qos;

// ── Layer 6: Middleware ──
pub mod middleware;

// ── Phase 0 mock (removed in Phase 1 M0.4) ──

// Re-exports for convenience
pub use discovery::{DiscoveryEntry, DiscoveryEvent, HalDiscovery, WatchCallback, WatchHandle};
pub use encoding::{decode_halvalue, encode_halvalue};
pub use middleware::{
    AmwConfig, AmwFactory, AmwMetrics, AmwMiddleware, AuditEvent, AuditLog, AuditResult,
};
pub use qos::{
    ConfigCommand, ConfigStatus, DeadlineCallback, DeadlineHandle, HalQoS, LivelinessStatus,
    LockLevel,
};
pub use stream::{StreamReader, StreamWriter};
pub use transport::{HalTransport, RpcHandler, SignalCallback};
pub use types::{
    CircuitBreakerAction, CircuitBreakerConfig, ConsumerErrorPolicy, HalError, HalPinDirection,
    HalPinType, HalResult, Metadata, QueuePolicy, StreamConfig, Subscription, Timestamp,
};
pub use value::HalValue;
