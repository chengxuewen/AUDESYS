//! Runtime metrics — lock-free atomic counters.
//!
//! Collects runtime performance metrics using lock-free atomics
//! for minimal overhead in the RT data path. Exports in Prometheus
//! text format for scraping.
//!
//! 来源: docs/modules/runtime/observability-design.md

use std::sync::atomic::{AtomicU64, Ordering};

/// Runtime-internal metrics collected via lock-free atomics.
///
/// Bridges to hal-core's AmwMetrics for HAL-level metrics.
/// ponytail: atomic counters, upgrade to ring buffers for latency metrics.
pub struct RuntimeMetrics {
    /// Total number of engine cycles completed
    pub cycles_completed: AtomicU64,
    /// Total number of signals published this cycle
    pub signals_published: AtomicU64,
    /// Total number of configuration changes applied
    pub config_changes_applied: AtomicU64,
    /// Number of child process restarts
    pub child_restarts: AtomicU64,
    /// Number of health check failures
    pub health_check_failures: AtomicU64,
}

impl RuntimeMetrics {
    pub fn new() -> Self {
        Self {
            cycles_completed: AtomicU64::new(0),
            signals_published: AtomicU64::new(0),
            config_changes_applied: AtomicU64::new(0),
            child_restarts: AtomicU64::new(0),
            health_check_failures: AtomicU64::new(0),
        }
    }

    /// Increment a counter by 1.
    fn inc(counter: &AtomicU64) {
        counter.fetch_add(1, Ordering::Relaxed);
    }

    /// Record a completed engine cycle.
    pub fn record_cycle(&self) {
        Self::inc(&self.cycles_completed);
    }

    /// Record a published signal.
    pub fn record_signal_published(&self) {
        Self::inc(&self.signals_published);
    }

    /// Record a config change applied.
    pub fn record_config_applied(&self) {
        Self::inc(&self.config_changes_applied);
    }

    /// Record a child process restart.
    pub fn record_child_restart(&self) {
        Self::inc(&self.child_restarts);
    }

    /// Record a health check failure.
    pub fn record_health_failure(&self) {
        Self::inc(&self.health_check_failures);
    }

    /// Export metrics as Prometheus text format string.
    pub fn export_prometheus(&self) -> String {
        format!(
            "audesys_controller_cycles_completed_total {}\n\
             audesys_controller_signals_published_total {}\n\
             audesys_controller_config_changes_total {}\n\
             audesys_controller_child_restarts_total {}\n\
             audesys_controller_health_failures_total {}\n",
            self.cycles_completed.load(Ordering::Relaxed),
            self.signals_published.load(Ordering::Relaxed),
            self.config_changes_applied.load(Ordering::Relaxed),
            self.child_restarts.load(Ordering::Relaxed),
            self.health_check_failures.load(Ordering::Relaxed),
        )
    }

    /// Reset all counters to zero.
    /// ponytail: reset for testing; remove if we need monotonic counters in production.
    pub fn reset(&self) {
        self.cycles_completed.store(0, Ordering::Relaxed);
        self.signals_published.store(0, Ordering::Relaxed);
        self.config_changes_applied.store(0, Ordering::Relaxed);
        self.child_restarts.store(0, Ordering::Relaxed);
        self.health_check_failures.store(0, Ordering::Relaxed);
    }
}

impl Default for RuntimeMetrics {
    fn default() -> Self {
        Self::new()
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_counter_increment() {
        let metrics = RuntimeMetrics::new();
        assert_eq!(metrics.cycles_completed.load(Ordering::Relaxed), 0);

        metrics.record_cycle();
        assert_eq!(metrics.cycles_completed.load(Ordering::Relaxed), 1);

        metrics.record_cycle();
        metrics.record_cycle();
        assert_eq!(metrics.cycles_completed.load(Ordering::Relaxed), 3);
    }

    #[test]
    fn test_all_counters_independent() {
        let metrics = RuntimeMetrics::new();
        metrics.record_cycle();
        metrics.record_signal_published();
        metrics.record_signal_published();
        metrics.record_config_applied();
        metrics.record_child_restart();
        metrics.record_health_failure();
        metrics.record_health_failure();
        metrics.record_health_failure();

        assert_eq!(metrics.cycles_completed.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.signals_published.load(Ordering::Relaxed), 2);
        assert_eq!(metrics.config_changes_applied.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.child_restarts.load(Ordering::Relaxed), 1);
        assert_eq!(metrics.health_check_failures.load(Ordering::Relaxed), 3);
    }

    #[test]
    fn test_prometheus_format() {
        let metrics = RuntimeMetrics::new();
        metrics.record_cycle();
        metrics.record_signal_published();

        let output = metrics.export_prometheus();
        assert!(output.contains("audesys_controller_cycles_completed_total 1"));
        assert!(output.contains("audesys_controller_signals_published_total 1"));
        assert!(output.contains("audesys_controller_config_changes_total 0"));
    }

    #[test]
    fn test_reset() {
        let metrics = RuntimeMetrics::new();
        metrics.record_cycle();
        metrics.record_signal_published();
        assert_eq!(metrics.cycles_completed.load(Ordering::Relaxed), 1);

        metrics.reset();
        assert_eq!(metrics.cycles_completed.load(Ordering::Relaxed), 0);
        assert_eq!(metrics.signals_published.load(Ordering::Relaxed), 0);
    }

    #[test]
    fn test_prometheus_format_after_reset() {
        let metrics = RuntimeMetrics::new();
        metrics.reset();
        let output = metrics.export_prometheus();
        assert!(output.contains("audesys_controller_cycles_completed_total 0"));
    }

    #[test]
    fn test_new_metrics_all_zero() {
        let metrics = RuntimeMetrics::new();
        let output = metrics.export_prometheus();
        // All counters should be 0
        for line in output.lines() {
            assert!(line.ends_with("0"), "counter should be zero: {}", line);
        }
    }
}
