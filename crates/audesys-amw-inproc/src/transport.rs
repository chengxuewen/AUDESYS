//! InprocTransport — in-process HalTransport implementation (Phase 1 M0.4).
//! 来源: docs/modules/hal/hal-protocol-design.md §2, docs/modules/hal/amw-middleware-design.md
//!
//! Uses RwLock-protected HashMaps for signal storage and callback dispatch.
//! RPC handlers are stored as Arc-wrapped closures for thread-safe cloning.

use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, RwLock};

use audesys_hal_core::{
    HalError, HalResult, HalTransport, HalValue, RpcHandler, SignalCallback, Subscription,
    Timestamp,
};

/// Arc-wrapped RPC handler — cloneable for thread spawning.
type ArcRpcHandler = Arc<dyn Fn(&[u8]) -> HalResult<Vec<u8>> + Send + Sync>;

/// In-process transport backed by shared HashMaps.
///
/// Signal values are stored in `signals`. Callbacks (push subscribers) are stored
/// keyed by signal name with unique subscriber IDs. RPC handlers are Arc-wrapped
/// so they can be dispatched on a separate thread for timeout support.
///
/// # ponytail: no Drop for Subscription
/// Subscription is an opaque empty struct from hal-core. Implementing Drop on it
/// from this crate violates Rust coherence (inherent impls must be in the defining crate).
/// Call `unsubscribe_signal(name, sub_id)` for explicit cleanup.
pub struct InprocTransport {
    signals: Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>,
    callbacks: RwLock<HashMap<String, Vec<(u64, SignalCallback)>>>,
    rpc_handlers: RwLock<HashMap<String, ArcRpcHandler>>,
    pub signals_published: AtomicU64,
    pub signals_read: AtomicU64,
    pub rpc_calls: AtomicU64,
    pub rpc_timeouts: AtomicU64,
    pub rpc_rejected: AtomicU64,
    next_sub_id: AtomicU64,
}

impl InprocTransport {
    pub fn new() -> Self {
        Self {
            signals: Arc::new(RwLock::new(HashMap::new())),
            callbacks: RwLock::new(HashMap::new()),
            rpc_handlers: RwLock::new(HashMap::new()),
            signals_published: AtomicU64::new(0),
            signals_read: AtomicU64::new(0),
            rpc_calls: AtomicU64::new(0),
            rpc_timeouts: AtomicU64::new(0),
            rpc_rejected: AtomicU64::new(0),
            next_sub_id: AtomicU64::new(1),
        }
    }

    /// Return a handle to the signal registry for StaticDiscovery.
    pub fn signal_registry(&self) -> Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>> {
        Arc::clone(&self.signals)
    }

    /// Return a handle to the callback registry for snapshot/query.
    pub fn callback_registry(&self) -> &RwLock<HashMap<String, Vec<(u64, SignalCallback)>>> {
        &self.callbacks
    }

    /// Explicitly remove a signal subscription by ID.
    pub fn unsubscribe_signal(&self, name: &str, sub_id: u64) {
        if let Ok(mut cb) = self.callbacks.write()
            && let Some(subs) = cb.get_mut(name)
        {
            subs.retain(|(id, _)| *id != sub_id);
        }
    }

    fn next_sub_id(&self) -> u64 {
        self.next_sub_id.fetch_add(1, Ordering::Relaxed)
    }

    fn matches_pattern(name: &str, pattern: &str) -> bool {
        let prefix = pattern.trim_end_matches('*');
        name.starts_with(prefix)
    }
}

impl Default for InprocTransport {
    fn default() -> Self {
        Self::new()
    }
}

impl HalTransport for InprocTransport {
    fn publish_signal(&self, name: &str, value: HalValue, ts: Timestamp) -> HalResult<()> {
        // Write value into signal registry (auto-create on first publish)
        {
            let mut signals = self.signals.write().unwrap();
            signals.insert(name.to_string(), (value.clone(), ts));
        }
        self.signals_published.fetch_add(1, Ordering::Relaxed);

        // Invoke all registered callbacks synchronously (S-SIG-004 push mode)
        let callbacks = self.callbacks.read().unwrap();
        if let Some(subs) = callbacks.get(name) {
            for (_id, cb) in subs {
                cb(&value, ts);
            }
        }

        Ok(())
    }

    fn read_signal(&self, name: &str) -> HalResult<Option<(HalValue, Timestamp)>> {
        self.signals_read.fetch_add(1, Ordering::Relaxed);
        let signals = self.signals.read().unwrap();
        Ok(signals.get(name).cloned())
    }

    fn subscribe_signal(&self, name: &str, cb: SignalCallback) -> HalResult<Subscription> {
        let sub_id = self.next_sub_id();
        let mut callbacks = self.callbacks.write().unwrap();
        callbacks.entry(name.to_string()).or_default().push((sub_id, cb));
        // ponytail: Subscription is opaque from hal-core — Drop cannot clean up.
        // Use InprocTransport::unsubscribe_signal(name, sub_id) explicitly.
        Ok(Subscription {})
    }

    fn snapshot_signals(&self, pattern: &str) -> HalResult<Vec<(String, HalValue, Timestamp)>> {
        let signals = self.signals.read().unwrap();
        let matched: Vec<_> = signals
            .iter()
            .filter(|(name, _)| Self::matches_pattern(name, pattern))
            .map(|(name, (val, ts))| (name.clone(), val.clone(), *ts))
            .collect();
        Ok(matched)
    }

    fn rpc_call(&self, method: &str, params: &[u8], timeout_ms: u64) -> HalResult<Vec<u8>> {
        self.rpc_calls.fetch_add(1, Ordering::Relaxed);

        let handler = {
            let handlers = self.rpc_handlers.read().unwrap();
            handlers.get(method).cloned().ok_or_else(|| {
                self.rpc_rejected.fetch_add(1, Ordering::Relaxed);
                HalError::NotFound { signal: method.to_string() }
            })?
        };

        let params = params.to_vec();
        let (tx, rx) = std::sync::mpsc::channel();

        std::thread::spawn(move || {
            let result = handler(&params);
            let _ = tx.send(result);
        });

        match rx.recv_timeout(std::time::Duration::from_millis(timeout_ms)) {
            Ok(result) => result,
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                self.rpc_timeouts.fetch_add(1, Ordering::Relaxed);
                Err(HalError::Timeout { method: method.to_string(), timeout_ms })
            }
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                self.rpc_rejected.fetch_add(1, Ordering::Relaxed);
                Err(HalError::Execution {
                    method: method.to_string(),
                    reason: "RPC handler thread disconnected".into(),
                })
            }
        }
    }

    fn register_rpc_handler(&self, method: &str, handler: RpcHandler) -> HalResult<()> {
        let arc_handler: ArcRpcHandler = Arc::from(handler);
        let mut handlers = self.rpc_handlers.write().unwrap();
        handlers.insert(method.to_string(), arc_handler);
        Ok(())
    }

    fn shutdown(&self) -> HalResult<()> {
        // Clear all mutable state
        {
            let mut signals = self.signals.write().unwrap();
            signals.clear();
        }
        {
            let mut callbacks = self.callbacks.write().unwrap();
            callbacks.clear();
        }
        {
            let mut handlers = self.rpc_handlers.write().unwrap();
            handlers.clear();
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::HalValue;

    fn now_ts() -> Timestamp {
        Timestamp { secs: 1, micros: 0 }
    }

    #[test]
    fn publish_and_read_signal() {
        let t = InprocTransport::new();
        let ts = now_ts();
        t.publish_signal("motor.speed", HalValue::F32(100.0), ts).unwrap();
        let result = t.read_signal("motor.speed").unwrap();
        assert!(result.is_some());
        let (val, _) = result.unwrap();
        assert_eq!(val, HalValue::F32(100.0));
    }

    #[test]
    fn read_nonexistent_returns_none() {
        let t = InprocTransport::new();
        let result = t.read_signal("no.such").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn subscribe_receives_publish() {
        let t = InprocTransport::new();
        let received = Arc::new(std::sync::Mutex::new(Vec::new()));
        let r = Arc::clone(&received);
        t.subscribe_signal(
            "motor.speed",
            Box::new(move |val, ts| {
                r.lock().unwrap().push((val.clone(), ts));
            }),
        )
        .unwrap();

        let ts = now_ts();
        t.publish_signal("motor.speed", HalValue::F32(50.0), ts).unwrap();

        let vals = received.lock().unwrap();
        assert_eq!(vals.len(), 1);
        assert_eq!(vals[0].0, HalValue::F32(50.0));
    }

    #[test]
    fn snapshot_signals_wildcard() {
        let t = InprocTransport::new();
        let ts = now_ts();
        t.publish_signal("motion.x", HalValue::S32(10), ts).unwrap();
        t.publish_signal("motion.y", HalValue::S32(20), ts).unwrap();
        t.publish_signal("other.z", HalValue::S32(30), ts).unwrap();

        let snap = t.snapshot_signals("motion.*").unwrap();
        assert_eq!(snap.len(), 2);
    }

    #[test]
    fn rpc_call_success() {
        let t = InprocTransport::new();
        t.register_rpc_handler("echo", Box::new(|params| Ok(params.to_vec()))).unwrap();

        let result = t.rpc_call("echo", b"hello", 1000).unwrap();
        assert_eq!(result, b"hello");
    }

    #[test]
    fn rpc_call_timeout() {
        let t = InprocTransport::new();
        t.register_rpc_handler(
            "slow",
            Box::new(|_params| {
                std::thread::sleep(std::time::Duration::from_millis(500));
                Ok(vec![42])
            }),
        )
        .unwrap();

        let result = t.rpc_call("slow", b"", 50);
        assert!(matches!(result, Err(HalError::Timeout { .. })));
    }

    #[test]
    fn rpc_call_not_found() {
        let t = InprocTransport::new();
        let result = t.rpc_call("no_handler", b"", 100);
        assert!(matches!(result, Err(HalError::NotFound { .. })));
    }

    #[test]
    fn unsubscribe_stops_callback() {
        let t = InprocTransport::new();
        let received = Arc::new(std::sync::Mutex::new(Vec::new()));
        let r = Arc::clone(&received);
        const SUB_ID: u64 = 42;

        // Manually inject a subscription with a known ID
        t.callbacks.write().unwrap().entry("motor.speed".into()).or_default().push((
            SUB_ID,
            Box::new(move |val, _ts| {
                r.lock().unwrap().push(val.clone());
            }),
        ));

        let ts = now_ts();
        t.publish_signal("motor.speed", HalValue::F32(1.0), ts).unwrap();
        assert_eq!(received.lock().unwrap().len(), 1);

        t.unsubscribe_signal("motor.speed", SUB_ID);
        t.publish_signal("motor.speed", HalValue::F32(2.0), ts).unwrap();
        assert_eq!(received.lock().unwrap().len(), 1); // no new callback
    }

    #[test]
    fn shutdown_clears_state() {
        let t = InprocTransport::new();
        let ts = now_ts();
        t.publish_signal("x", HalValue::Bool(true), ts).unwrap();
        t.shutdown().unwrap();
        assert!(t.read_signal("x").unwrap().is_none());
    }
}
