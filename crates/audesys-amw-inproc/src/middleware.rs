//! InprocMiddleware and InprocFactory — lifecycle, metrics, and audit logging.
//! 来源: docs/modules/hal/amw-middleware-design.md, S-AMW-003
//!
//! Bundles transport, discovery, and QoS into a single AmwMiddleware instance.

use std::sync::atomic::Ordering;
use std::sync::{Arc, Mutex};
use std::time::Instant;

use audesys_hal_core::{
    AmwConfig, AmwFactory, AmwMetrics, AmwMiddleware, AuditEvent, AuditLog, ConfigCommand,
    ConfigStatus, DiscoveryEntry, HalDiscovery, HalQoS, HalResult, HalTransport, HalValue,
    LivelinessStatus, LockLevel, RpcHandler, SignalCallback, Subscription, Timestamp,
    WatchCallback, WatchHandle,
};

use crate::discovery::StaticDiscovery;
use crate::qos::InprocQoS;
use crate::transport::InprocTransport;

// ── Audit Log ──

/// In-process audit log backed by a Mutex-protected Vec.
pub struct InprocAuditLog {
    events: Mutex<Vec<AuditEvent>>,
}

impl InprocAuditLog {
    pub fn new() -> Self {
        Self { events: Mutex::new(Vec::new()) }
    }
}

impl Default for InprocAuditLog {
    fn default() -> Self {
        Self::new()
    }
}

impl AuditLog for InprocAuditLog {
    fn log(&self, event: AuditEvent) {
        if let Ok(mut events) = self.events.lock() {
            events.push(event);
        }
    }

    fn query(&self, since: std::time::SystemTime) -> Vec<AuditEvent> {
        if let Ok(events) = self.events.lock() {
            events.iter().filter(|e| e.timestamp >= since).cloned().collect()
        } else {
            Vec::new()
        }
    }
}

// ── Middleware ──

/// Assembled in-process middleware instance.
///
/// Wraps InprocTransport + StaticDiscovery + InprocQoS in Arc for shared ownership.
/// Implements AmwMiddleware via delegation to inner types.
pub struct InprocMiddleware {
    transport: Arc<InprocTransport>,
    discovery: Arc<StaticDiscovery>,
    qos: Arc<InprocQoS>,
    audit: Arc<InprocAuditLog>,
    start_time: Instant,
}

impl InprocMiddleware {
    pub fn new(
        transport: Arc<InprocTransport>,
        discovery: Arc<StaticDiscovery>,
        qos: Arc<InprocQoS>,
        audit: Arc<InprocAuditLog>,
    ) -> Self {
        Self { transport, discovery, qos, audit, start_time: Instant::now() }
    }

    /// Access the audit log for external recording.
    pub fn audit_log(&self) -> &Arc<InprocAuditLog> {
        &self.audit
    }

    /// Access the transport (for unsubscribe, signal registry, etc.).
    pub fn transport(&self) -> &Arc<InprocTransport> {
        &self.transport
    }

    /// Access the discovery layer.
    pub fn discovery(&self) -> &Arc<StaticDiscovery> {
        &self.discovery
    }

    /// Access the QoS controller.
    pub fn qos(&self) -> &Arc<InprocQoS> {
        &self.qos
    }
}

// ── Delegation impls ──

impl HalTransport for InprocMiddleware {
    fn publish_signal(&self, name: &str, value: HalValue, ts: Timestamp) -> HalResult<()> {
        self.transport.publish_signal(name, value, ts)
    }

    fn read_signal(&self, name: &str) -> HalResult<Option<(HalValue, Timestamp)>> {
        self.transport.read_signal(name)
    }

    fn subscribe_signal(&self, name: &str, cb: SignalCallback) -> HalResult<Subscription> {
        self.transport.subscribe_signal(name, cb)
    }

    fn snapshot_signals(&self, pattern: &str) -> HalResult<Vec<(String, HalValue, Timestamp)>> {
        self.transport.snapshot_signals(pattern)
    }

    fn rpc_call(&self, method: &str, params: &[u8], timeout_ms: u64) -> HalResult<Vec<u8>> {
        self.transport.rpc_call(method, params, timeout_ms)
    }

    fn register_rpc_handler(&self, method: &str, handler: RpcHandler) -> HalResult<()> {
        self.transport.register_rpc_handler(method, handler)
    }

    fn shutdown(&self) -> HalResult<()> {
        self.transport.shutdown()
    }
}

impl HalDiscovery for InprocMiddleware {
    fn list_all(&self) -> HalResult<Vec<DiscoveryEntry>> {
        self.discovery.list_all()
    }

    fn find_by_name(&self, name: &str) -> HalResult<Option<DiscoveryEntry>> {
        self.discovery.find_by_name(name)
    }

    fn find_by_pattern(&self, pattern: &str) -> HalResult<Vec<DiscoveryEntry>> {
        self.discovery.find_by_pattern(pattern)
    }

    fn watch(&self, cb: WatchCallback) -> HalResult<WatchHandle> {
        self.discovery.watch(cb)
    }
}

impl HalQoS for InprocMiddleware {
    fn lock_level(&self) -> LockLevel {
        self.qos.lock_level()
    }

    fn set_lock_level(&self, level: LockLevel) -> HalResult<ConfigStatus> {
        self.qos.set_lock_level(level)
    }

    fn queue_config(&self, cmd: ConfigCommand) -> HalResult<ConfigStatus> {
        self.qos.queue_config(cmd)
    }

    fn apply_queued(&self) -> HalResult<Vec<ConfigStatus>> {
        self.qos.apply_queued()
    }

    fn register_entity(&self, entity_id: &str) -> HalResult<()> {
        self.qos.register_entity(entity_id)
    }

    fn check_liveliness(&self, entity_id: &str) -> HalResult<LivelinessStatus> {
        self.qos.check_liveliness(entity_id)
    }

    fn tag_security_domain(&self, name: &str, domain: &str) -> HalResult<()> {
        self.qos.tag_security_domain(name, domain)
    }

    fn get_security_domain(&self, name: &str) -> HalResult<Option<String>> {
        self.qos.get_security_domain(name)
    }
}

impl AmwMiddleware for InprocMiddleware {
    fn backend_name(&self) -> &'static str {
        "audesys-amw-inproc"
    }

    fn shutdown(&self) -> HalResult<()> {
        self.transport.shutdown()
    }

    fn metrics(&self) -> AmwMetrics {
        let uptime = self.start_time.elapsed();
        AmwMetrics {
            signals_published: self.transport.signals_published.load(Ordering::Relaxed),
            signals_read: self.transport.signals_read.load(Ordering::Relaxed),
            stream_messages_written: 0,
            stream_messages_dropped: 0,
            rpc_calls: self.transport.rpc_calls.load(Ordering::Relaxed),
            rpc_timeouts: self.transport.rpc_timeouts.load(Ordering::Relaxed),
            rpc_rejected: self.transport.rpc_rejected.load(Ordering::Relaxed),
            uptime_secs: uptime.as_secs(),
        }
    }
}

// ── Factory ──

/// Factory that creates InprocMiddleware instances.
///
/// Validates that the requested backend is "amw_inproc".
/// Constructs a fresh stack: InprocTransport → StaticDiscovery → InprocQoS → InprocMiddleware.
pub struct InprocFactory;

impl AmwFactory for InprocFactory {
    type Middleware = InprocMiddleware;

    fn create(&self, config: AmwConfig) -> HalResult<Self::Middleware> {
        if config.backend != "amw_inproc" {
            return Err(audesys_hal_core::HalError::Rejected {
                code: 400,
                reason: format!(
                    "InprocFactory only supports backend 'amw_inproc', got '{}'",
                    config.backend
                ),
            });
        }

        let transport = Arc::new(InprocTransport::new());
        let signal_reg = transport.signal_registry();
        let discovery = Arc::new(StaticDiscovery::new(signal_reg));
        let qos = Arc::new(InprocQoS::new());
        let audit = Arc::new(InprocAuditLog::new());

        Ok(InprocMiddleware::new(transport, discovery, qos, audit))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::{AmwConfig, AuditEvent, AuditResult, HalValue};

    #[test]
    fn factory_creates_valid_middleware() {
        let factory = InprocFactory;
        let mw = factory
            .create(AmwConfig { backend: "amw_inproc".into(), ..Default::default() })
            .unwrap();

        assert_eq!(mw.backend_name(), "audesys-amw-inproc");
    }

    #[test]
    fn factory_rejects_wrong_backend() {
        let factory = InprocFactory;
        let result =
            factory.create(AmwConfig { backend: "amw_zenoh".into(), ..Default::default() });
        assert!(result.is_err());
    }

    #[test]
    fn metrics_reflect_transport_activity() {
        let factory = InprocFactory;
        let mw = factory.create(AmwConfig::default()).unwrap();

        let ts = Timestamp { secs: 1, micros: 0 };
        mw.publish_signal("test", HalValue::Bool(true), ts).unwrap();
        mw.read_signal("test").unwrap();

        let metrics = mw.metrics();
        assert_eq!(metrics.signals_published, 1);
        assert_eq!(metrics.signals_read, 1);
        assert!(metrics.uptime_secs < 5);
    }

    #[test]
    fn audit_log_records_and_queries() {
        let log = InprocAuditLog::new();
        let now = std::time::SystemTime::now();
        log.log(AuditEvent {
            timestamp: now,
            user_id: "admin".into(),
            action: "configure".into(),
            target: "motor.speed".into(),
            result: AuditResult::Success,
            detail: None,
        });

        let results = log.query(now);
        assert_eq!(results.len(), 1);

        let future = now + std::time::Duration::from_secs(3600);
        let results2 = log.query(future);
        assert!(results2.is_empty());
    }

    #[test]
    fn middleware_delegates_qos() {
        let factory = InprocFactory;
        let mw = factory.create(AmwConfig::default()).unwrap();

        assert_eq!(mw.lock_level(), LockLevel::None);
        mw.set_lock_level(LockLevel::Load).unwrap();
        assert_eq!(mw.lock_level(), LockLevel::Load);
    }

    #[test]
    fn middleware_delegates_discovery() {
        let factory = InprocFactory;
        let mw = factory.create(AmwConfig::default()).unwrap();

        let ts = Timestamp { secs: 1, micros: 0 };
        mw.publish_signal("disco.test", HalValue::S32(42), ts).unwrap();

        let found = mw.find_by_name("disco.test").unwrap();
        assert!(found.is_some());
    }
}
