//! Mock HalTransport for Phase 0 testing infrastructure.
//!
//! Hand-written mock — no [mockall](https://docs.rs/mockall) auto-generation yet.
//! Real `HalTransport` trait defined in Phase 1.
//!
//! # Decision references
//! - D10: Signal / StreamChannel / RPC three primitives
//! - D33: direct TDD, AAA pattern

// ── Stub Value ──

/// Minimal value stub — replaced by `HalValue` (D12 14-type system) in Phase 1.
/// 来源: docs/modules/hal/iec-type-system-design.md
#[derive(Debug, Clone, PartialEq)]
pub enum StubValue {
    Bool(bool),
    S32(i32),
    F64(f64),
}

// ── Result type ──

pub type Result<T> = std::result::Result<T, Box<dyn std::error::Error>>;

// ── Mock Transport ──

/// Hand-written mock transport with in-memory signal store.
/// 来源: docs/modules/hal/hal-protocol-design.md Signal §
#[derive(Debug, Default)]
pub struct MockHalTransport {
    signals: Vec<(String, StubValue)>,
}

impl MockHalTransport {
    /// Create an empty mock transport.
    /// 来源: docs/modules/hal/hal-protocol-design.md Signal §
    pub fn new() -> Self {
        Self::default()
    }

    /// Write a signal value. Signal semantics: latest-value overwrite.
    /// 来源: docs/modules/hal/hal-protocol-design.md Signal §
    pub fn write_signal(&mut self, signal: &str, value: StubValue) -> Result<()> {
        if let Some(existing) = self.signals.iter_mut().find(|(s, _)| s == signal) {
            existing.1 = value;
        } else {
            self.signals.push((signal.to_string(), value));
        }
        Ok(())
    }

    /// Read the latest value of a signal. Returns `None` if not found.
    /// 来源: docs/modules/hal/hal-protocol-design.md Signal §
    pub fn read_signal(&self, signal: &str) -> Option<&StubValue> {
        self.signals.iter().find(|(s, _)| s == signal).map(|(_, v)| v)
    }

    /// Number of signals currently stored.
    /// 来源: docs/modules/hal/hal-protocol-design.md Signal §
    pub fn signal_count(&self) -> usize {
        self.signals.len()
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn write_and_read_signal() {
        let mut transport = MockHalTransport::new();
        transport.write_signal("test.value", StubValue::S32(42)).unwrap();
        assert_eq!(transport.read_signal("test.value"), Some(&StubValue::S32(42)));
    }

    #[test]
    fn missing_signal_returns_none() {
        let transport = MockHalTransport::new();
        assert_eq!(transport.read_signal("missing"), None);
    }

    #[test]
    fn signal_count_tracks_writes() {
        let mut transport = MockHalTransport::new();
        assert_eq!(transport.signal_count(), 0);
        transport.write_signal("a", StubValue::Bool(true)).unwrap();
        transport.write_signal("b", StubValue::F64(std::f64::consts::PI)).unwrap();
        assert_eq!(transport.signal_count(), 2);
    }

    #[test]
    fn write_overwrites_existing_signal() {
        let mut transport = MockHalTransport::new();
        transport.write_signal("x", StubValue::S32(1)).unwrap();
        transport.write_signal("x", StubValue::S32(99)).unwrap();
        assert_eq!(transport.signal_count(), 1);
        assert_eq!(transport.read_signal("x"), Some(&StubValue::S32(99)));
    }
}

// ponytail: manual mock with #[cfg(test)] unit tests — replace with mockall #[automock] in Phase 1
