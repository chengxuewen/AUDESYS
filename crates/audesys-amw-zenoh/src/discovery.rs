//! ZenohDiscovery — network service discovery skeleton for Phase 2.
//!
//! Current implementation is a static in-memory registry.
//! Phase 2 will use Zenoh liveliness tokens for network-wide discovery.
//!
//! # Phase 2 integration plan
//! - `list_all` → Zenoh query for liveliness tokens
//! - `find_by_name` → Zenoh query with exact key expression
//! - `find_by_pattern` → Zenoh query with wildcard key expression
//! - `watch` → Zenoh liveliness subscriber

use std::sync::{Arc, Mutex};

use audesys_hal_core::{
    HalError, HalResult, Metadata, Timestamp,
    discovery::{DiscoveryEntry, DiscoveryEvent, WatchCallback, WatchHandle},
};

/// Network discovery skeleton — static registry for Phase 1, Zenoh liveliness for Phase 2.
pub struct ZenohDiscovery {
    entries: Mutex<Vec<DiscoveryEntry>>,
    watchers: Mutex<Vec<WatchCallback>>,
}

impl ZenohDiscovery {
    pub fn new(_namespace: &str) -> Self {
        Self { entries: Mutex::new(Vec::new()), watchers: Mutex::new(Vec::new()) }
    }

    /// Register a signal for discovery.
    pub fn register(&self, name: &str, description: &str) {
        let entry = DiscoveryEntry {
            name: name.to_string(),
            description: description.to_string(),
            metadata: Metadata::default(),
            created_at: Timestamp { secs: 0, micros: 0 },
        };

        if let Ok(mut entries) = self.entries.lock() {
            entries.push(entry.clone());
        }

        if let Ok(watchers) = self.watchers.lock() {
            for cb in watchers.iter() {
                cb(DiscoveryEvent::Added(entry.clone()));
            }
        }
    }
}

impl audesys_hal_core::HalDiscovery for ZenohDiscovery {
    fn list_all(&self) -> HalResult<Vec<DiscoveryEntry>> {
        self.entries.lock().map(|e| e.clone()).map_err(|e| HalError::Internal(format!("lock: {e}")))
    }

    fn find_by_name(&self, name: &str) -> HalResult<Option<DiscoveryEntry>> {
        self.entries
            .lock()
            .map(|entries| entries.iter().find(|e| e.name == name).cloned())
            .map_err(|e| HalError::Internal(format!("lock: {e}")))
    }

    fn find_by_pattern(&self, pattern: &str) -> HalResult<Vec<DiscoveryEntry>> {
        self.entries
            .lock()
            .map(|entries| {
                entries
                    .iter()
                    .filter(|e| {
                        if pattern == "*" {
                            return true;
                        }
                        e.name.contains(pattern.trim_matches('*'))
                    })
                    .cloned()
                    .collect()
            })
            .map_err(|e| HalError::Internal(format!("lock: {e}")))
    }

    fn watch(&self, cb: WatchCallback) -> HalResult<WatchHandle> {
        self.watchers
            .lock()
            .map(|mut w| w.push(cb))
            .map_err(|e| HalError::Internal(format!("lock: {e}")))?;
        Ok(WatchHandle {})
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use audesys_hal_core::HalDiscovery;

    #[test]
    fn test_register_and_find() {
        let d = ZenohDiscovery::new("test");
        d.register("axis.0.pos", "X axis position");
        let found = d.find_by_name("axis.0.pos").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().name, "axis.0.pos");
    }

    #[test]
    fn test_find_by_pattern() {
        let d = ZenohDiscovery::new("test");
        d.register("axis.0.pos", "X axis");
        d.register("axis.1.pos", "Y axis");
        d.register("spindle.rpm", "Spindle RPM");
        assert_eq!(d.find_by_pattern("axis").unwrap().len(), 2);
    }

    #[test]
    fn test_watch_notification() {
        let d = ZenohDiscovery::new("test");
        let (tx, rx) = std::sync::mpsc::channel();
        d.watch(Box::new(move |ev| {
            if let DiscoveryEvent::Added(e) = ev {
                tx.send(e.name).ok();
            }
        }))
        .unwrap();
        d.register("watched", "watched signal");
        assert_eq!(rx.recv().unwrap(), "watched");
    }
}
