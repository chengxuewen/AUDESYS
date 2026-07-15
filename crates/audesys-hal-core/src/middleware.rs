//! AmwMiddleware and AmwFactory — transport lifecycle and metrics.
//! 来源: docs/modules/hal/amw-middleware-design.md, S-AMW-003

use crate::discovery::HalDiscovery;
use crate::qos::HalQoS;
use crate::transport::HalTransport;

// ── AmwMiddleware ──

/// AmwMiddleware — the assembled middleware instance.
///
/// Bundles transport + discovery + QoS + lifecycle.
/// Created by AmwFactory for a specific backend (amw_inproc, amw_zenoh).
///
/// ## Super-traits
/// This trait requires `HalTransport + HalDiscovery + HalQoS`
/// because every middleware instance must provide all three.
pub trait AmwMiddleware: HalTransport + HalDiscovery + HalQoS {
    /// Return a human-readable backend name (e.g. "amw_inproc", "amw_zenoh").
    fn backend_name(&self) -> &'static str;

    /// Shut down the middleware. Components are deactivated first.
    fn shutdown(&self) -> crate::types::HalResult<()>;

    /// Collect transport metrics for observability.
    fn metrics(&self) -> AmwMetrics;
}

// ── AmwFactory ──

/// AmwFactory — creates middleware instances for a specific backend.
///
/// The factory pattern enables compile-time selection of the transport
/// backend (amw_inproc for development, amw_zenoh for production).
pub trait AmwFactory: Send + Sync {
    type Middleware: AmwMiddleware;

    /// Create a new middleware instance.
    fn create(&self, config: AmwConfig) -> crate::types::HalResult<Self::Middleware>;
}

// ── Configuration ──

/// Transport-independent middleware configuration.
#[derive(Debug, Clone)]
pub struct AmwConfig {
    /// Backend identifier (e.g. "amw_inproc").
    pub backend: String,
    /// Audit logging enabled.
    pub audit_enabled: bool,
    /// Security domain enforcement enabled (Phase 2+).
    pub security_domain_enabled: bool,
}

impl Default for AmwConfig {
    fn default() -> Self {
        Self { backend: "amw_inproc".into(), audit_enabled: true, security_domain_enabled: false }
    }
}

// ── Metrics ──

/// Transport metrics collected by the middleware.
#[derive(Debug, Clone, Default)]
pub struct AmwMetrics {
    pub signals_published: u64,
    pub signals_read: u64,
    pub stream_messages_written: u64,
    pub stream_messages_dropped: u64,
    pub rpc_calls: u64,
    pub rpc_timeouts: u64,
    pub rpc_rejected: u64,
    pub uptime_secs: u64,
}

// ── Audit ──

/// Audit event recorded for config changes and security decisions.
#[derive(Debug, Clone)]
pub struct AuditEvent {
    pub timestamp: std::time::SystemTime,
    pub user_id: String,
    pub action: String,
    pub target: String,
    pub result: AuditResult,
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AuditResult {
    Success,
    Denied,
    Failed,
}

/// Audit logging trait — records config changes for traceability.
pub trait AuditLog: Send + Sync {
    /// Record an audit event.
    fn log(&self, event: AuditEvent);

    /// Query recent audit events.
    fn query(&self, since: std::time::SystemTime) -> Vec<AuditEvent>;
}
