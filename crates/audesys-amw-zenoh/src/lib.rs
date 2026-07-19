//! AUDESYS AMW Zenoh — network HAL transport + discovery skeleton for Phase 2.
//!
//! Current implementation uses in-memory storage with the Zenoh API surface
//! prepared for future Eclipse Zenoh pub/sub + query integration.
//!
//! # Key expressions (future)
//! - Signal: `audeys/{namespace}/signal/{name}`
//! - RPC: `audeys/{namespace}/rpc/{method}`
//!
//! # Usage
//! ```ignore
//! let transport = ZenohTransport::new("site-a");
//! let discovery = ZenohDiscovery::new("site-a");
//! ```

pub mod discovery;
pub mod transport;

pub use discovery::ZenohDiscovery;
pub use transport::ZenohTransport;
