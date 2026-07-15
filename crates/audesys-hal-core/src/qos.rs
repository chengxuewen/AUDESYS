//! HalQoS — industrial Quality of Service and security domain control.
//! 来源: docs/modules/hal/industrial-qos-design.md, docs/modules/hal/config-barrier-design.md

use crate::types::HalResult;

// ── LockLevel State Machine ──

/// LockLevel — 6-level linear progression controlling config mutability.
/// 来源: docs/modules/hal/config-barrier-design.md §3, S-CFG-001
///
/// Default progression: None → Load → Config → Params → Run → All.
/// Levels are monotonic-increasing except through the deactivation cycle.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum LockLevel {
    /// All operations allowed. Production environments MUST NOT use this.
    None = 0,
    /// Allow structural changes: loadComponent, unloadComponent.
    Load = 1,
    /// Allow configuration: configureComponent, linkPin, addFunction, removeFunction.
    Config = 2,
    /// Allow parameter changes only: configureComponent (params portion).
    Params = 3,
    /// Read-only. Reject ALL RPC config requests. Normal run state.
    Run = 4,
    /// Fully locked. Reject even parameter reads from untrusted sources.
    All = 5,
}

/// Status of a Config Barrier command.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConfigStatus {
    Queued,
    Applied,
    Rejected { reason: String },
    Failed { reason: String },
}

/// A single config command queued at the Config Barrier.
#[derive(Debug, Clone)]
pub struct ConfigCommand {
    pub id: u64,
    pub method: String,
    pub params: Vec<u8>,
    pub queued_at: std::time::Instant,
}

// ── HalQoS Trait ──

/// Deadline monitoring handle. Created by HalQoS::monitor_deadline().
pub struct DeadlineHandle {
    // ponytail: opaque — real impl manages RT timer
}

/// Liveliness status of a remote entity.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LivelinessStatus {
    Alive,
    Missing,
    Unknown,
}

/// Callback invoked when a deadline is missed.
pub type DeadlineCallback = Box<dyn Fn(&str) + Send + Sync>;

/// HalQoS — Quality of Service control for HAL primitives.
///
/// ## Dimensions (D16)
/// - **Deadline**: checked in RT data plane (amw tick)
/// - **Liveliness**: checked in control plane (Zenoh native)
/// - **Security Domain**: checked at config time (static keyexpr)
///
/// ## Phase plan
/// - Phase 1: LockLevel + Config Barrier logic (no RT enforcement)
/// - Phase 2+: deadline monitoring + security domain enforcement
pub trait HalQoS: Send + Sync {
    // ── Config Barrier ──

    /// Get current lock level.
    fn lock_level(&self) -> LockLevel;

    /// Set lock level. Subject to monotonic-increasing constraint.
    /// Returns Rejected if target < current without deactivation cycle.
    fn set_lock_level(&self, level: LockLevel) -> HalResult<ConfigStatus>;

    /// Queue a config command. Applied at next Config Barrier boundary.
    /// Rejected if current LockLevel prohibits the command.
    fn queue_config(&self, cmd: ConfigCommand) -> HalResult<ConfigStatus>;

    /// Apply all queued config commands (called at RT period boundary).
    fn apply_queued(&self) -> HalResult<Vec<ConfigStatus>>;

    // ── Liveliness ──

    /// Register a remote entity for liveliness monitoring.
    fn register_entity(&self, entity_id: &str) -> HalResult<()>;

    /// Check liveliness of a registered entity.
    fn check_liveliness(&self, entity_id: &str) -> HalResult<LivelinessStatus>;

    // ── Security Domain ──

    /// Tag a signal/channel with a security domain label.
    /// Format: `{level}.{domain}.{subdomain}` (e.g. "l1.control.reactor_a").
    fn tag_security_domain(&self, name: &str, domain: &str) -> HalResult<()>;

    /// Check the security domain of a registered signal/channel.
    fn get_security_domain(&self, name: &str) -> HalResult<Option<String>>;
}
