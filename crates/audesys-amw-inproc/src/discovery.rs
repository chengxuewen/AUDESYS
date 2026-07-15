//! StaticDiscovery — static signal registry discovery (Phase 1 M0.4).
//! 来源: docs/modules/hal/amw-middleware-design.md, S-AMW-002
//!
//! Backed by a reference to InprocTransport's signal registry.
//! Watch callbacks fire on signal publish (via the transport layer).

use std::collections::HashMap;
use std::sync::{Arc, RwLock};

use audesys_hal_core::{
    DiscoveryEntry, DiscoveryEvent, HalDiscovery, HalResult, HalValue, Metadata, Timestamp,
    WatchCallback, WatchHandle,
};

/// Static discovery backed by the transport's signal map.
///
/// Each signal in the transport registry becomes a `DiscoveryEntry`.
/// `find_by_pattern` uses the same prefix-matching as `snapshot_signals`.
///
/// # ponytail: WatchHandle is opaque from hal-core — Drop cannot clean up.
/// Use `unwatch(id)` explicitly.
pub struct StaticDiscovery {
    signals: Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>,
    watchers: RwLock<HashMap<u64, WatchCallback>>,
    next_watch_id: std::sync::atomic::AtomicU64,
}

impl StaticDiscovery {
    pub fn new(signals: Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>>) -> Self {
        Self {
            signals,
            watchers: RwLock::new(HashMap::new()),
            next_watch_id: std::sync::atomic::AtomicU64::new(1),
        }
    }

    fn next_id(&self) -> u64 {
        self.next_watch_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed)
    }

    /// Explicitly remove a watch registration by its handle ID.
    pub fn unwatch(&self, watch_id: u64) {
        if let Ok(mut w) = self.watchers.write() {
            w.remove(&watch_id);
        }
    }

    /// Notify all registered watchers of an event.
    pub fn notify_watchers(&self, event: DiscoveryEvent) {
        let watchers = self.watchers.read().unwrap();
        for cb in watchers.values() {
            cb(event.clone());
        }
    }

    fn matches_pattern(name: &str, pattern: &str) -> bool {
        let prefix = pattern.trim_end_matches('*');
        name.starts_with(prefix)
    }

    fn signal_to_entry(name: &str, _val: &HalValue, ts: &Timestamp) -> DiscoveryEntry {
        DiscoveryEntry {
            name: name.to_string(),
            description: String::new(),
            metadata: Metadata::default(),
            created_at: *ts,
        }
    }
}

impl HalDiscovery for StaticDiscovery {
    fn list_all(&self) -> HalResult<Vec<DiscoveryEntry>> {
        let signals = self.signals.read().unwrap();
        let entries: Vec<_> = signals
            .iter()
            .map(|(name, (_val, ts))| Self::signal_to_entry(name, _val, ts))
            .collect();
        Ok(entries)
    }

    fn find_by_name(&self, name: &str) -> HalResult<Option<DiscoveryEntry>> {
        let signals = self.signals.read().unwrap();
        Ok(signals.get(name).map(|(_val, ts)| Self::signal_to_entry(name, _val, ts)))
    }

    fn find_by_pattern(&self, pattern: &str) -> HalResult<Vec<DiscoveryEntry>> {
        let signals = self.signals.read().unwrap();
        let entries: Vec<_> = signals
            .iter()
            .filter(|(name, _)| Self::matches_pattern(name, pattern))
            .map(|(name, (_val, ts))| Self::signal_to_entry(name, _val, ts))
            .collect();
        Ok(entries)
    }

    fn watch(&self, cb: WatchCallback) -> HalResult<WatchHandle> {
        let id = self.next_id();
        let mut watchers = self.watchers.write().unwrap();
        watchers.insert(id, cb);
        // ponytail: WatchHandle is opaque from hal-core — Drop cannot clean up.
        // Use StaticDiscovery::unwatch(id) explicitly.
        Ok(WatchHandle {})
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_registry() -> Arc<RwLock<HashMap<String, (HalValue, Timestamp)>>> {
        let mut map = HashMap::new();
        let ts = Timestamp { secs: 1, micros: 0 };
        map.insert("motor.speed".into(), (HalValue::F32(100.0), ts));
        map.insert("motor.torque".into(), (HalValue::F32(50.0), ts));
        map.insert("pump.flow".into(), (HalValue::F32(10.0), ts));
        Arc::new(RwLock::new(map))
    }

    #[test]
    fn list_all_returns_all_signals() {
        let reg = test_registry();
        let d = StaticDiscovery::new(reg);
        let entries = d.list_all().unwrap();
        assert_eq!(entries.len(), 3);
    }

    #[test]
    fn find_by_name_exact_match() {
        let reg = test_registry();
        let d = StaticDiscovery::new(reg);
        let entry = d.find_by_name("motor.speed").unwrap();
        assert!(entry.is_some());
        assert_eq!(entry.unwrap().name, "motor.speed");
    }

    #[test]
    fn find_by_name_missing_returns_none() {
        let reg = test_registry();
        let d = StaticDiscovery::new(reg);
        let entry = d.find_by_name("no.such").unwrap();
        assert!(entry.is_none());
    }

    #[test]
    fn find_by_pattern_wildcard() {
        let reg = test_registry();
        let d = StaticDiscovery::new(reg);
        let entries = d.find_by_pattern("motor.*").unwrap();
        assert_eq!(entries.len(), 2);
    }

    #[test]
    fn watch_receives_events() {
        let reg = test_registry();
        let d = StaticDiscovery::new(reg);
        let events = Arc::new(std::sync::Mutex::new(Vec::new()));
        let e = Arc::clone(&events);

        d.watch(Box::new(move |ev| {
            e.lock().unwrap().push(ev);
        }))
        .unwrap();

        d.notify_watchers(DiscoveryEvent::Added(DiscoveryEntry {
            name: "new.signal".into(),
            description: "test".into(),
            metadata: Metadata::default(),
            created_at: Timestamp { secs: 2, micros: 0 },
        }));

        assert_eq!(events.lock().unwrap().len(), 1);
    }
}
