//! Runtime metrics — lock-free atomic counters.
//!
//! Collects runtime performance metrics using lock-free atomics
//! for minimal overhead in the RT data path. Exports in Prometheus
//! text format for scraping.
//!
//! 来源: docs/modules/runtime/observability-design.md

use std::sync::atomic::{AtomicU64, AtomicUsize, Ordering};

/// Lock-free ring buffer for fixed-size time-series data.
/// ponytail: simple [AtomicU64; N] with atomic write cursor.
pub struct RingBuffer<const N: usize> {
    buf: [AtomicU64; N],
    cursor: AtomicUsize,
}

impl<const N: usize> RingBuffer<N> {
    pub fn new() -> Self {
        Self {
            buf: std::array::from_fn(|_| AtomicU64::new(0)),
            cursor: AtomicUsize::new(0),
        }
    }

    /// Push a value — overwrites oldest entry when full.
    pub fn push(&self, value: u64) {
        let idx = self.cursor.fetch_add(1, Ordering::Relaxed) % N;
        self.buf[idx].store(value, Ordering::Relaxed);
    }

    /// Read all values in insertion order (oldest first).
    pub fn read(&self) -> Vec<u64> {
        let cursor = self.cursor.load(Ordering::Relaxed);
        let start = if cursor < N { 0 } else { cursor % N };
        (0..N)
            .map(|i| self.buf[(start + i) % N].load(Ordering::Relaxed))
            .collect()
    }

    /// Reset all entries to zero.
    pub fn reset(&self) {
        for entry in &self.buf {
            entry.store(0, Ordering::Relaxed);
        }
        self.cursor.store(0, Ordering::Relaxed);
    }
}

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
    /// Cycle jitter ring buffer (last 1024 cycle durations in microseconds)
    pub cycle_jitter_us: RingBuffer<1024>,
}

impl RuntimeMetrics {
    pub fn new() -> Self {
        Self {
            cycles_completed: AtomicU64::new(0),
            signals_published: AtomicU64::new(0),
            config_changes_applied: AtomicU64::new(0),
            child_restarts: AtomicU64::new(0),
            health_check_failures: AtomicU64::new(0),
            cycle_jitter_us: RingBuffer::new(),
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

    /// Record a cycle's actual duration in microseconds (for jitter analysis).
    pub fn record_cycle_jitter(&self, elapsed_us: u64) {
        self.cycle_jitter_us.push(elapsed_us);
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
        self.cycle_jitter_us.reset();
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
        for line in output.lines() {
            assert!(line.ends_with("0"), "counter should be zero: {}", line);
        }
    }

    // ── RingBuffer Tests ──

    #[test]
    fn test_ring_buffer_push_read() {
        let rb: RingBuffer<4> = RingBuffer::new();
        rb.push(10);
        rb.push(20);
        rb.push(30);
        let vals = rb.read();
        assert_eq!(vals, vec![10, 20, 30, 0]);
    }

    #[test]
    fn test_ring_buffer_wraparound() {
        let rb: RingBuffer<4> = RingBuffer::new();
        for i in 0..6u64 {
            rb.push(i);
        }
        let vals = rb.read();
        assert_eq!(vals, vec![2, 3, 4, 5]);
    }

    #[test]
    fn test_ring_buffer_reset() {
        let rb: RingBuffer<4> = RingBuffer::new();
        rb.push(42);
        assert_eq!(rb.read()[0], 42);
        rb.reset();
        assert_eq!(rb.read(), vec![0, 0, 0, 0]);
    }

    #[test]
    fn test_record_cycle_jitter() {
        let metrics = RuntimeMetrics::new();
        metrics.record_cycle_jitter(10500);
        metrics.record_cycle_jitter(9800);
        let jitter = metrics.cycle_jitter_us.read();
        assert_eq!(jitter[0], 10500);
        assert_eq!(jitter[1], 9800);
    }
}
