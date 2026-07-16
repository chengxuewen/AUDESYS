//! Runtime common types — IPC security, health checks, audit logging.
//!
//! All types are pure data with zero external dependencies.
//! Designed for use across Supervisor, Controller, HMI, and Debug Bridge processes.

use std::time::SystemTime;

// ─────────────────────────────────────────────
// § IPC Security Types
// ─────────────────────────────────────────────

/// Runtime process roles for authorization.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum Role {
    /// Human operator — can monitor, start/stop, acknowledge alarms
    Operator,
    /// Automation engineer — can modify configuration, deploy logic
    Engineer,
    /// Supervisory system — can manage other processes
    Supervisor,
    /// Security auditor — read-only access to audit logs
    Auditor,
    /// System daemon — full access for internal services
    System,
}

/// Identifies which process sent an IPC message.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SourceId {
    /// Human-readable process name (e.g. "supervisor", "controller")
    pub process_name: String,
    /// OS process ID
    pub pid: u32,
}

/// Milliseconds since Unix epoch, for timestamping events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub struct TimestampMs(pub u64);

impl TimestampMs {
    /// Current system time as milliseconds since Unix epoch.
    pub fn now() -> Self {
        let ms = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis() as u64;
        TimestampMs(ms)
    }
}

/// An issued session token for authenticated IPC.
#[derive(Debug, Clone)]
pub struct SessionToken {
    /// Unique token identifier
    pub token_id: String,
    /// Role granted by this token
    pub role: Role,
    /// Which process the token was issued to
    pub source: SourceId,
    /// When the token was issued
    pub issued_at: TimestampMs,
    /// When the token expires
    pub expires_at: TimestampMs,
}

/// Result of a token validation.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuthResult {
    /// Token is valid and not expired
    Valid,
    /// Token has passed its expiry time
    Expired,
    /// Token has been explicitly revoked
    Revoked,
    /// Token source does not match the connecting process
    InvalidSource,
    /// Too many tokens issued in the current window
    RateLimited,
}

/// Manages session token lifecycle across processes.
///
/// Implemented by the Supervisor process. Controller and HMI call
/// these methods over UDS RPC.
pub trait TokenManager {
    /// Issue a new session token to a process.
    fn issue_token(&self, role: Role, source: SourceId, ttl_ms: u64) -> SessionToken;

    /// Validate a token — check expiry, revocation, and source.
    fn validate_token(&self, token: &SessionToken) -> AuthResult;

    /// Revoke a single token by ID.
    fn revoke_token(&self, token_id: &str);

    /// Revoke all tokens issued to a specific source process.
    fn revoke_all_for_source(&self, source: &SourceId);
}

/// Per-role action authorizer.
///
/// Static allow-list checked at token validation time.
/// No runtime overhead on the hot path.
#[derive(Debug, Clone)]
pub struct Authorizer {
    /// The role this authorizer is checking against
    pub role: Role,
    /// Actions allowed for this role
    pub allowed_actions: Vec<String>,
}

impl Authorizer {
    /// Returns `true` if the given action is allowed for this role.
    pub fn can(&self, action: &str) -> bool {
        self.allowed_actions.iter().any(|a| a == action)
    }
}

// ─────────────────────────────────────────────
// § Health Check Types
// ─────────────────────────────────────────────

/// Health status of a Runtime module or sub-component.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum HealthStatus {
    /// Operating normally
    Healthy,
    /// Operating with degraded performance or reduced functionality
    Degraded(String),
    /// Not operational — requires intervention
    Unhealthy(String),
    /// Module is starting up, not yet ready
    Starting,
    /// Module is shutting down
    Stopping,
}

/// A single health check that a module can run.
pub trait HealthCheck {
    /// Human-readable name of this check (e.g. "rt_thread", "hal_ready").
    fn name(&self) -> &str;

    /// Run the check and return current status.
    fn check(&self) -> HealthStatus;

    /// Recommended interval between checks, in milliseconds.
    fn interval_ms(&self) -> u64;
}

/// Registry that holds multiple health checks and can aggregate results.
#[derive(Default)]
pub struct HealthCheckRegistry {
    checks: Vec<Box<dyn HealthCheck>>,
}

impl HealthCheckRegistry {
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a new health check.
    pub fn register(&mut self, check: Box<dyn HealthCheck>) {
        self.checks.push(check);
    }

    /// Run all registered checks, returning `(name, status)` pairs.
    pub fn run_all(&self) -> Vec<(&str, HealthStatus)> {
        self.checks.iter().map(|c| (c.name(), c.check())).collect()
    }

    /// Aggregate all checks into a single status.
    ///
    /// - `Healthy` if all checks are `Healthy`
    /// - `Unhealthy` if any check is `Unhealthy`
    /// - `Degraded` if any check is `Degraded` (and none `Unhealthy`)
    /// - `Starting` if any check is `Starting` (and none worse)
    /// - `Stopping` if any check is `Stopping` (and none worse)
    pub fn aggregate(&self) -> HealthStatus {
        let mut has_starting = false;
        let mut has_stopping = false;
        let mut degraded_reason: Option<String> = None;

        for check in &self.checks {
            match check.check() {
                HealthStatus::Unhealthy(reason) => return HealthStatus::Unhealthy(reason),
                HealthStatus::Degraded(reason) => {
                    degraded_reason = Some(reason);
                }
                HealthStatus::Starting => has_starting = true,
                HealthStatus::Stopping => has_stopping = true,
                HealthStatus::Healthy => {}
            }
        }

        if let Some(reason) = degraded_reason {
            HealthStatus::Degraded(reason)
        } else if has_starting {
            HealthStatus::Starting
        } else if has_stopping {
            HealthStatus::Stopping
        } else {
            HealthStatus::Healthy
        }
    }
}

// ─────────────────────────────────────────────
// § Audit Types
// ─────────────────────────────────────────────

/// Result of an authorization decision or action.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum AuditResult {
    /// Action was allowed
    Allowed,
    /// Action was denied for a specific reason
    Denied(String),
    /// Action failed during execution
    Failed(String),
}

/// A single audit record for a security-relevant event.
#[derive(Debug, Clone)]
pub struct AuditEvent {
    /// When the event occurred
    pub timestamp: TimestampMs,
    /// Which process initiated the action
    pub actor: SourceId,
    /// What action was attempted (e.g. "config.write", "token.revoke")
    pub action: String,
    /// What the action targeted (e.g. "module.controller", "token.abc123")
    pub target: String,
    /// Outcome of the action
    pub result: AuditResult,
}

/// Persistent audit log for security events.
pub trait AuditLog {
    /// Record a new audit event.
    fn log(&mut self, event: AuditEvent);

    /// Query audit events for a specific source, newest first, limited.
    fn query(&self, source: &SourceId, limit: usize) -> Vec<AuditEvent>;

    /// Query all audit events, newest first, limited.
    fn query_all(&self, limit: usize) -> Vec<AuditEvent>;
}

/// In-memory audit log implementation. Not persistent across restarts.
#[derive(Debug, Default)]
pub struct InMemoryAuditLog {
    events: Vec<AuditEvent>,
}

impl AuditLog for InMemoryAuditLog {
    fn log(&mut self, event: AuditEvent) {
        self.events.push(event);
    }

    fn query(&self, source: &SourceId, limit: usize) -> Vec<AuditEvent> {
        self.events.iter().rev().filter(|e| &e.actor == source).take(limit).cloned().collect()
    }

    fn query_all(&self, limit: usize) -> Vec<AuditEvent> {
        self.events.iter().rev().take(limit).cloned().collect()
    }
}

// ─────────────────────────────────────────────
// § Tests
// ─────────────────────────────────────────────

#[cfg(test)]
mod tests {
    use super::*;

    // Helper: create a test SourceId
    fn test_source(name: &str, pid: u32) -> SourceId {
        SourceId { process_name: name.to_string(), pid }
    }

    // Helper: create a test AuditEvent
    fn test_event(action: &str, result: AuditResult) -> AuditEvent {
        AuditEvent {
            timestamp: TimestampMs::now(),
            actor: test_source("test-process", 9999),
            action: action.to_string(),
            target: "test.target".to_string(),
            result,
        }
    }

    // ── Role ──

    #[test]
    fn test_role_equality() {
        assert_eq!(Role::Engineer, Role::Engineer);
        assert_ne!(Role::Engineer, Role::Operator);
    }

    // ── TimestampMs ──

    #[test]
    fn test_timestamp_now() {
        let ts = TimestampMs::now();
        assert!(ts.0 > 0, "timestamp should be positive ms since epoch");
    }

    #[test]
    fn test_timestamp_ordering() {
        let a = TimestampMs(1000);
        let b = TimestampMs(2000);
        assert!(a < b);
    }

    // ── AuthResult ──

    #[test]
    fn test_auth_result() {
        assert_ne!(AuthResult::Valid, AuthResult::Expired);
        assert_ne!(AuthResult::Valid, AuthResult::Revoked);
        assert_ne!(AuthResult::Expired, AuthResult::InvalidSource);
    }

    // ── Authorizer ──

    #[test]
    fn test_authorizer_can() {
        let auth = Authorizer {
            role: Role::Operator,
            allowed_actions: vec!["read".into(), "monitor".into()],
        };
        assert!(auth.can("read"));
        assert!(auth.can("monitor"));
    }

    #[test]
    fn test_authorizer_cannot() {
        let auth = Authorizer { role: Role::Operator, allowed_actions: vec!["read".into()] };
        assert!(!auth.can("write"));
    }

    // ── Session Token (using a simple test TokenManager) ──

    /// Simple test TokenManager that validates expiry but not revocation.
    struct TestTokenManager;

    impl TokenManager for TestTokenManager {
        fn issue_token(&self, role: Role, source: SourceId, ttl_ms: u64) -> SessionToken {
            let now = TimestampMs::now();
            SessionToken {
                token_id: format!("tok-{}", now.0),
                role,
                source,
                issued_at: now,
                expires_at: TimestampMs(now.0 + ttl_ms),
            }
        }

        fn validate_token(&self, token: &SessionToken) -> AuthResult {
            let now = TimestampMs::now();
            if token.expires_at <= now {
                AuthResult::Expired
            } else {
                AuthResult::Valid
            }
        }

        fn revoke_token(&self, _token_id: &str) {
            // no-op in test
        }

        fn revoke_all_for_source(&self, _source: &SourceId) {
            // no-op in test
        }
    }

    #[test]
    fn test_session_token_not_expired() {
        let mgr = TestTokenManager;
        let token = mgr.issue_token(
            Role::Engineer,
            test_source("controller", 100),
            3_600_000, // 1 hour from now
        );
        assert_eq!(mgr.validate_token(&token), AuthResult::Valid);
    }

    #[test]
    fn test_session_token_expired() {
        let mgr = TestTokenManager;
        let mut token = mgr.issue_token(Role::Engineer, test_source("controller", 100), 3_600_000);
        // Force expiry
        token.expires_at = TimestampMs(0);
        assert_eq!(mgr.validate_token(&token), AuthResult::Expired);
    }

    // ── Audit Log ──

    #[test]
    fn test_audit_log() {
        let mut log = InMemoryAuditLog::default();
        let event = test_event("token.issue", AuditResult::Allowed);
        log.log(event.clone());

        let source = test_source("test-process", 9999);
        let results = log.query(&source, 10);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].action, "token.issue");
    }

    #[test]
    fn test_audit_log_query_all() {
        let mut log = InMemoryAuditLog::default();
        log.log(test_event("action.a", AuditResult::Allowed));
        log.log(test_event("action.b", AuditResult::Denied("forbidden".into())));

        let results = log.query_all(10);
        assert_eq!(results.len(), 2);
        // newest first
        assert_eq!(results[0].action, "action.b");
        assert_eq!(results[1].action, "action.a");
    }

    #[test]
    fn test_audit_log_query_limit() {
        let mut log = InMemoryAuditLog::default();
        log.log(test_event("a", AuditResult::Allowed));
        log.log(test_event("b", AuditResult::Allowed));
        log.log(test_event("c", AuditResult::Allowed));

        assert_eq!(log.query_all(2).len(), 2);
    }

    // ── Health Check ──

    struct AlwaysHealthy;
    impl HealthCheck for AlwaysHealthy {
        fn name(&self) -> &str {
            "always_healthy"
        }
        fn check(&self) -> HealthStatus {
            HealthStatus::Healthy
        }
        fn interval_ms(&self) -> u64 {
            1000
        }
    }

    struct AlwaysDegraded;
    impl HealthCheck for AlwaysDegraded {
        fn name(&self) -> &str {
            "always_degraded"
        }
        fn check(&self) -> HealthStatus {
            HealthStatus::Degraded("low memory".into())
        }
        fn interval_ms(&self) -> u64 {
            500
        }
    }

    struct AlwaysUnhealthy;
    impl HealthCheck for AlwaysUnhealthy {
        fn name(&self) -> &str {
            "always_unhealthy"
        }
        fn check(&self) -> HealthStatus {
            HealthStatus::Unhealthy("crash detected".into())
        }
        fn interval_ms(&self) -> u64 {
            5000
        }
    }

    struct StartingCheck;
    impl HealthCheck for StartingCheck {
        fn name(&self) -> &str {
            "still_starting"
        }
        fn check(&self) -> HealthStatus {
            HealthStatus::Starting
        }
        fn interval_ms(&self) -> u64 {
            2000
        }
    }

    #[test]
    fn test_health_aggregate_all_healthy() {
        let mut registry = HealthCheckRegistry::new();
        registry.register(Box::new(AlwaysHealthy));
        registry.register(Box::new(AlwaysHealthy));
        registry.register(Box::new(AlwaysHealthy));

        assert_eq!(registry.aggregate(), HealthStatus::Healthy);
    }

    #[test]
    fn test_health_degraded() {
        let mut registry = HealthCheckRegistry::new();
        registry.register(Box::new(AlwaysHealthy));
        registry.register(Box::new(AlwaysDegraded));

        assert_eq!(registry.aggregate(), HealthStatus::Degraded("low memory".into()));
    }

    #[test]
    fn test_health_unhealthy_priority() {
        let mut registry = HealthCheckRegistry::new();
        registry.register(Box::new(AlwaysHealthy));
        registry.register(Box::new(AlwaysDegraded));
        registry.register(Box::new(AlwaysUnhealthy));

        // Unhealthy takes priority over Degraded
        assert_eq!(registry.aggregate(), HealthStatus::Unhealthy("crash detected".into()));
    }

    #[test]
    fn test_health_starting() {
        let mut registry = HealthCheckRegistry::new();
        registry.register(Box::new(AlwaysHealthy));
        registry.register(Box::new(StartingCheck));

        assert_eq!(registry.aggregate(), HealthStatus::Starting);
    }

    #[test]
    fn test_health_run_all() {
        let mut registry = HealthCheckRegistry::new();
        registry.register(Box::new(AlwaysHealthy));
        registry.register(Box::new(AlwaysDegraded));

        let results = registry.run_all();
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].0, "always_healthy");
        assert_eq!(results[1].0, "always_degraded");
    }
}
