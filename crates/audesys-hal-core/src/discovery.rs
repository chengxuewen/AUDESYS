//! HalDiscovery — component and signal discovery abstraction.
//! 来源: docs/modules/hal/amw-middleware-design.md, S-AMW-002

use crate::types::{HalResult, Metadata, Timestamp};

/// Entry describing a discovered signal or channel.
#[derive(Debug, Clone)]
pub struct DiscoveryEntry {
    pub name: String,
    pub description: String,
    pub metadata: Metadata,
    pub created_at: Timestamp,
}

/// Lifecycle event for HalDiscovery watchers.
#[derive(Debug, Clone)]
pub enum DiscoveryEvent {
    Added(DiscoveryEntry),
    Removed { name: String },
    Modified(DiscoveryEntry),
}

/// Watch handle returned by HalDiscovery::watch().
pub struct WatchHandle {
    // ponytail: opaque — real impl holds transport callback token
}

/// Callback for discovery watch events.
pub type WatchCallback = Box<dyn Fn(DiscoveryEvent) + Send + Sync>;

/// HalDiscovery — component/service discovery trait.
///
/// Signal and StreamChannel are discoverable through this trait.
/// RPC methods are discovered through the Supervisor (not HalDiscovery).
///
/// ## Implementations
/// - Phase 1: amw_inproc (static registry)
/// - Phase 2+: amw_zenoh (Zenoh query/liveliness)
pub trait HalDiscovery: Send + Sync {
    /// List all currently registered signals and channels.
    fn list_all(&self) -> HalResult<Vec<DiscoveryEntry>>;

    /// Find an entry by name.
    fn find_by_name(&self, name: &str) -> HalResult<Option<DiscoveryEntry>>;

    /// Find entries matching a wildcard pattern (e.g. "motion.*.pos").
    fn find_by_pattern(&self, pattern: &str) -> HalResult<Vec<DiscoveryEntry>>;

    /// Watch for discovery events. Returns a handle that unregisters on drop.
    fn watch(&self, cb: WatchCallback) -> HalResult<WatchHandle>;
}
