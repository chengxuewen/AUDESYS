//! AUDESYS HAL Core — trait definitions for L1 RT data plane.
//!
//! Phase 0: trait stubs only.
//! Phase 1: concrete types + amw_inproc implementation.
//!
//! # Decision references
//! - D10: Signal / StreamChannel / RPC three primitives
//! - D12: 14-type unified type system
//! - D16: HalQoS three dimensions
//! - D19: Rust RT data plane

/// A zero-sized token proving hal-core is linked.
/// Used by the Phase 0 health check test.
pub struct HalCoreLinked;

// ── Mock Transport (Phase 0 — test infrastructure) ──

/// Mock HalTransport for unit testing Priority B tests (~37 tests).
///
/// In Phase 1, use [mockall](https://docs.rs/mockall) for auto-generation.
/// Phase 0: manual mock struct placeholder.
#[cfg(test)]
pub mod mock {
    // ponytail: mock stubs — no implementation in Phase 0
}

// ponytail: trait stubs only — implementations in Phase 1
