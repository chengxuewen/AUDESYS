//! AUDESYS Middleware — In-Process Transport (Phase 1 M0.4)
//!
//! Implements HalTransport, HalDiscovery, HalQoS, and AmwMiddleware
//! for single-process deployments.
//! See D11: amw middleware abstraction layer.
//!
//! # Module Overview
//! - `transport` — InprocTransport: Signal publish/subscribe/read + RPC
//! - `discovery` — StaticDiscovery: signal registry listing, pattern matching, watchers
//! - `qos` — InprocQoS: LockLevel progression, Config Barrier, liveliness, security domains
//! - `middleware` — InprocMiddleware + InprocFactory + AuditLog

pub mod discovery;
pub mod middleware;
pub mod qos;
pub mod stream;
pub mod transport;

// Re-export hal-core types for convenience
pub use audesys_hal_core as hal_core;

// Re-export the main types from this crate
pub use discovery::StaticDiscovery;
pub use middleware::{InprocAuditLog, InprocFactory, InprocMiddleware};
pub use qos::InprocQoS;
pub use transport::InprocTransport;

pub use stream::create_stream_channel;
