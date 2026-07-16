//! Signal registry — managing signal definitions and values.
//! ponytail: minimal stubs for engine.rs compilation.
//! 来源: docs/modules/hal/hal-protocol-design.md §2

use audesys_hal_core::types::HalPinType;
use audesys_hal_core::value::HalValue;
use std::collections::HashMap;
use std::sync::RwLock;

#[derive(Debug, Clone, PartialEq)]
pub enum WriteStrategy {
    Own,
    Monitored,
    Computed(ComputeFn),
}

pub struct ComputeFn(Box<dyn Fn() -> HalValue + Send + Sync>);

impl Clone for ComputeFn {
    fn clone(&self) -> Self {
        ComputeFn(Box::new(|| HalValue::F32(0.0)))
    }
}

impl ComputeFn {
    pub fn new(f: impl Fn() -> HalValue + Send + Sync + 'static) -> Self {
        Self(Box::new(f))
    }
    pub fn call(&self) -> HalValue {
        (self.0)()
    }
}

impl std::fmt::Debug for ComputeFn {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.write_str("ComputeFn")
    }
}

impl PartialEq for ComputeFn {
    fn eq(&self, _other: &Self) -> bool {
        false
    }
}

#[derive(Debug, Clone, PartialEq)]
pub struct SignalDef {
    pub name: String,
    pub pin_type: HalPinType,
    pub value: HalValue,
    pub strategy: WriteStrategy,
}

impl SignalDef {
    pub fn new(
        name: impl Into<String>,
        pin_type: HalPinType,
        value: HalValue,
        strategy: WriteStrategy,
    ) -> Self {
        Self { name: name.into(), pin_type, value, strategy }
    }
}

/// Snapshot of a signal's state for IPC and monitoring.
#[derive(Debug, Clone, PartialEq)]
pub struct SignalSnapshot {
    pub name: String,
    pub pin_type: HalPinType,
    pub value: HalValue,
    pub strategy: WriteStrategy,
}

/// Filter for selecting signals by strategy.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum StrategyFilter {
    Own,
    Monitored,
    Computed,
    All,
}

pub struct SignalRegistry {
    signals: RwLock<HashMap<String, SignalDef>>,
}

impl SignalRegistry {
    pub fn new() -> Self {
        Self { signals: RwLock::new(HashMap::new()) }
    }

    pub fn register(&self, def: SignalDef) -> Result<(), String> {
        let mut map = self.signals.write().expect("poisoned");
        if map.contains_key(&def.name) {
            return Err(format!("already registered: {}", def.name));
        }
        map.insert(def.name.clone(), def);
        Ok(())
    }

    pub fn get(&self, name: &str) -> Option<SignalDef> {
        self.signals.read().expect("poisoned").get(name).cloned()
    }

    pub fn list(&self) -> Vec<SignalDef> {
        self.signals.read().expect("poisoned").values().cloned().collect()
    }

    pub fn update_value(&self, name: &str, value: HalValue) -> Result<(), String> {
        let mut map = self.signals.write().expect("poisoned");
        match map.get_mut(name) {
            Some(def) => {
                def.value = value;
                Ok(())
            }
            None => Err(format!("not found: {}", name)),
        }
    }

    pub fn filter_by_strategy(&self, strategy: &WriteStrategy) -> Vec<SignalDef> {
        let map = self.signals.read().expect("poisoned");
        map.values()
            .filter(|def| {
                matches!(
                    (&def.strategy, strategy),
                    (WriteStrategy::Own, WriteStrategy::Own)
                        | (WriteStrategy::Monitored, WriteStrategy::Monitored)
                        | (WriteStrategy::Computed(_), WriteStrategy::Computed(_))
                )
            })
            .cloned()
            .collect()
    }

    pub fn computed_signal_names(&self) -> Vec<String> {
        let map = self.signals.read().expect("poisoned");
        map.values()
            .filter(|def| matches!(def.strategy, WriteStrategy::Computed(_)))
            .map(|def| def.name.clone())
            .collect()
    }

    pub fn len(&self) -> usize {
        self.signals.read().expect("poisoned").len()
    }

    pub fn is_empty(&self) -> bool {
        self.len() == 0
    }

    // ── Methods needed by engine.rs ──

    pub fn snapshots_by_strategy(&self, filter: StrategyFilter) -> Vec<SignalSnapshot> {
        let map = self.signals.read().expect("poisoned");
        map.values()
            .filter(|def| match filter {
                StrategyFilter::Own => matches!(def.strategy, WriteStrategy::Own),
                StrategyFilter::Monitored => matches!(def.strategy, WriteStrategy::Monitored),
                StrategyFilter::Computed => matches!(def.strategy, WriteStrategy::Computed(_)),
                StrategyFilter::All => true,
            })
            .map(|def| SignalSnapshot {
                name: def.name.clone(),
                pin_type: def.pin_type,
                value: def.value.clone(),
                strategy: def.strategy.clone(),
            })
            .collect()
    }

    pub fn list_names(&self) -> Vec<String> {
        self.signals.read().expect("poisoned").keys().cloned().collect()
    }

    pub fn compute_signal(&self, name: &str) -> Result<HalValue, String> {
        let map = self.signals.read().expect("poisoned");
        let def = map.get(name).ok_or_else(|| format!("not found: {}", name))?;
        match &def.strategy {
            WriteStrategy::Computed(f) => Ok(f.call()),
            _ => Ok(def.value.clone()),
        }
    }

    pub fn list_snapshots(&self) -> Vec<SignalSnapshot> {
        self.snapshots_by_strategy(StrategyFilter::All)
    }
}

impl Default for SignalRegistry {
    fn default() -> Self {
        Self::new()
    }
}
