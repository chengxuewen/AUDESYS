//! HalTransport — the core communication trait for Signals and RPC.
//! 来源: docs/modules/hal/hal-protocol-design.md §2, docs/modules/hal/amw-middleware-design.md

use crate::types::{HalResult, Subscription, Timestamp};
use crate::value::HalValue;

/// Callback invoked synchronously on Signal publish (S-SIG-004 push mode).
/// The callback receives the value and timestamp. MUST NOT block.
pub type SignalCallback = Box<dyn Fn(&HalValue, Timestamp) + Send + Sync>;

/// RPC handler: receives raw bytes, returns raw bytes.
/// Serialization handled by caller/callee (JSON-RPC 2.0 for control plane).
/// 来源: S-RPC-009
pub type RpcHandler = Box<dyn Fn(&[u8]) -> HalResult<Vec<u8>> + Send + Sync>;

/// HalTransport — the unified communication trait.
///
/// ## Primitives covered
/// - **Signal**: single-writer, multi-reader, latest-value (S-SIG-001–S-SIG-011)
/// - **RPC**: request/reply, request_id correlation, configurable timeout (S-RPC-001–S-RPC-009)
///
/// ## Implementations
/// - Phase 1: amw_inproc (in-process, no serialization)
/// - Phase 2+: amw_zenoh (networked, FlatBuffers)
///
/// ## Safety
/// - All methods are `&self` (thread-safe interior mutability expected)
/// - Push callbacks execute synchronously in publisher context
/// - Pull reads MUST NOT block the publisher
pub trait HalTransport: Send + Sync {
    // ── Signal API ──

    /// Publish a new value to a Signal. Replaces the previous value (S-SIG-003).
    /// Returns error if Signal does not exist or is not writable by this caller.
    fn publish_signal(&self, name: &str, value: HalValue, ts: Timestamp) -> HalResult<()>;

    /// Read the latest value of a Signal. Returns None if no write has occurred.
    fn read_signal(&self, name: &str) -> HalResult<Option<(HalValue, Timestamp)>>;

    /// Subscribe to push-mode updates. Callback invoked synchronously on each publish.
    fn subscribe_signal(&self, name: &str, cb: SignalCallback) -> HalResult<Subscription>;

    /// Batch-read all Signals matching a wildcard pattern.
    fn snapshot_signals(&self, pattern: &str) -> HalResult<Vec<(String, HalValue, Timestamp)>>;

    // ── RPC API ──

    /// Invoke an RPC with configurable timeout. Returns the response bytes.
    /// request_id is auto-incremented by the transport layer.
    fn rpc_call(&self, method: &str, params: &[u8], timeout_ms: u64) -> HalResult<Vec<u8>>;

    /// Register a handler for an RPC method.
    fn register_rpc_handler(&self, method: &str, handler: RpcHandler) -> HalResult<()>;

    // ── Lifecycle ──

    /// Shut down the transport. All pending operations complete before shutdown.
    fn shutdown(&self) -> HalResult<()>;
}

// ponytail: trait only — impl in amw_inproc (Phase 1 M0.4)
