//! ZenohTransport — network HalTransport skeleton for Phase 2.
//!
//! Current implementation is a thin wrapper over in-memory storage,
//! with the structure prepared for future Zenoh pub/sub + query integration.
//!
//! # Phase 2 integration plan
//! - `publish_signal` → `session.put(key, payload)`
//! - `read_signal` → local cache (Zenoh get() for cross-node reads)
//! - `subscribe_signal` → `session.declare_subscriber(key).callback(...)`
//! - `rpc_call` → `session.get(key).timeout(...)` query-based RPC
//! - `register_rpc_handler` → `session.declare_queryable(key).callback(...)`
//!
//! # Key expression namespace
//! - Signal: `audeys/{namespace}/signal/{name}`
//! - RPC: `audeys/{namespace}/rpc/{method}`

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};

use audesys_hal_core::{
    HalError, HalResult, HalTransport, HalValue, RpcHandler, SignalCallback, Subscription,
    Timestamp,
};

/// Network transport skeleton — in-memory storage with Zenoh-shaped API surfaces.
pub struct ZenohTransport {
    signals: RwLock<HashMap<String, (HalValue, Timestamp)>>,
    rpc_handlers: RwLock<HashMap<String, Arc<RpcHandler>>>,
    /// Namespace prefix for Zenoh key expressions (future use)
    pub namespace: String,
    // Metrics
    pub signals_published: AtomicU64,
    pub signals_read: AtomicU64,
    pub rpc_calls: AtomicU64,
    next_sub_id: AtomicU64,
}

impl ZenohTransport {
    pub fn new(namespace: &str) -> Self {
        Self {
            signals: RwLock::new(HashMap::new()),
            rpc_handlers: RwLock::new(HashMap::new()),
            namespace: namespace.to_string(),
            signals_published: AtomicU64::new(0),
            signals_read: AtomicU64::new(0),
            rpc_calls: AtomicU64::new(0),
            next_sub_id: AtomicU64::new(1),
        }
    }

    fn signal_key(&self, name: &str) -> String {
        format!("audeys/{}/signal/{}", self.namespace, name)
    }
}

impl HalTransport for ZenohTransport {
    fn publish_signal(&self, name: &str, value: HalValue, ts: Timestamp) -> HalResult<()> {
        // TODO Phase 2: session.put(signal_key(name), payload)
        let mut signals =
            self.signals.write().map_err(|e| HalError::Internal(format!("lock: {e}")))?;
        signals.insert(name.to_string(), (value, ts));
        self.signals_published.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    fn read_signal(&self, name: &str) -> HalResult<Option<(HalValue, Timestamp)>> {
        let signals = self.signals.read().map_err(|e| HalError::Internal(format!("lock: {e}")))?;
        self.signals_read.fetch_add(1, Ordering::Relaxed);
        Ok(signals.get(name).cloned())
    }

    fn subscribe_signal(&self, _name: &str, _cb: SignalCallback) -> HalResult<Subscription> {
        // TODO Phase 2: session.declare_subscriber(key).callback(...)
        let _id = self.next_sub_id.fetch_add(1, Ordering::Relaxed);
        Ok(Subscription {})
    }

    fn snapshot_signals(&self, pattern: &str) -> HalResult<Vec<(String, HalValue, Timestamp)>> {
        let signals = self.signals.read().map_err(|e| HalError::Internal(format!("lock: {e}")))?;
        let results: Vec<_> = signals
            .iter()
            .filter(|(name, _)| match_pattern(name, pattern))
            .map(|(name, (val, ts))| (name.clone(), val.clone(), *ts))
            .collect();
        Ok(results)
    }

    fn rpc_call(&self, method: &str, params: &[u8], _timeout_ms: u64) -> HalResult<Vec<u8>> {
        self.rpc_calls.fetch_add(1, Ordering::Relaxed);
        let handlers =
            self.rpc_handlers.read().map_err(|e| HalError::Internal(format!("lock: {e}")))?;
        let handler = handlers.get(method).ok_or_else(|| HalError::Rejected {
            code: 404,
            reason: format!("no handler for method {method}"),
        })?;
        // ponytail: synchronous dispatch — Phase 2 will spawn with timeout
        handler(params)
    }

    fn register_rpc_handler(&self, method: &str, handler: RpcHandler) -> HalResult<()> {
        let mut handlers =
            self.rpc_handlers.write().map_err(|e| HalError::Internal(format!("lock: {e}")))?;
        handlers.insert(method.to_string(), Arc::new(handler));
        Ok(())
    }

    fn shutdown(&self) -> HalResult<()> {
        Ok(())
    }
}

/// Simple wildcard matching: '*' matches any sequence
fn match_pattern(name: &str, pattern: &str) -> bool {
    if pattern == "*" {
        return true;
    }
    name.contains(pattern.trim_matches('*'))
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::HalTransport;

    #[test]
    fn test_publish_and_read() {
        let t = ZenohTransport::new("test");
        t.publish_signal("axis.0.pos", HalValue::F64(10.5), Timestamp { secs: 0, micros: 1000 })
            .unwrap();
        let val = t.read_signal("axis.0.pos").unwrap();
        assert!(val.is_some());
        let (v, ts) = val.unwrap();
        assert_eq!(v, HalValue::F64(10.5));
        assert_eq!(ts, Timestamp { secs: 0, micros: 1000 });
        assert_eq!(t.signals_published.load(Ordering::Relaxed), 1);
    }

    #[test]
    fn test_snapshot_with_pattern() {
        let t = ZenohTransport::new("test");
        t.publish_signal("axis.0.pos", HalValue::F64(0.0), Timestamp { secs: 0, micros: 0 })
            .unwrap();
        t.publish_signal("axis.1.pos", HalValue::F64(1.0), Timestamp { secs: 0, micros: 0 })
            .unwrap();
        t.publish_signal("spindle.rpm", HalValue::U64(1000), Timestamp { secs: 0, micros: 0 })
            .unwrap();

        let results = t.snapshot_signals("axis").unwrap();
        assert_eq!(results.len(), 2);
    }

    #[test]
    fn test_rpc_register_and_call() {
        let t = ZenohTransport::new("test");
        t.register_rpc_handler("ping", Box::new(|_| Ok(b"pong".to_vec()))).unwrap();
        let resp = t.rpc_call("ping", b"{}", 1000).unwrap();
        assert_eq!(resp, b"pong");
    }

    #[test]
    fn test_rpc_rejected_when_no_handler() {
        let t = ZenohTransport::new("test");
        let err = t.rpc_call("missing", b"{}", 1000).unwrap_err();
        match err {
            HalError::Rejected { .. } => {}
            e => panic!("expected Rejected, got {e}"),
        }
    }

    #[test]
    fn test_signal_key_format() {
        let t = ZenohTransport::new("site-a");
        assert_eq!(t.signal_key("axis.0.pos"), "audeys/site-a/signal/axis.0.pos");
    }
}
