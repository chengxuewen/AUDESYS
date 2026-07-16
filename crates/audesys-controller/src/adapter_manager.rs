//! AdapterManager — manages lifecycle of Modbus and HART protocol adapters.
//!
//! Adapters are registered with a name and config, then started together
//! via [`start_all`](AdapterManager::start_all). They share a [`HalTransport`]
//! with the Engine — signals published by adapters are picked up by the
//! Engine's read barrier.
//!
//! # Decision references
//! - D23: Phase 1 protocol adaptation scope (Modbus RTU/TCP + HART limited)

use std::sync::Arc;
use std::thread::JoinHandle;

use audesys_hal_core::HalTransport;
use audesys_hart::{HartAdapter, HartConfig, HartError};
use audesys_modbus::{ModbusAdapter, ModbusConfig, ModbusError};

/// Manages the lifecycle of registered protocol adapters.
///
/// # Usage
/// ```ignore
/// let mut mgr = AdapterManager::new();
/// mgr.register_modbus("pump1".into(), modbus_cfg, transport.clone())?;
/// mgr.register_hart("sensor_a".into(), hart_cfg, transport.clone())?;
/// mgr.start_all();
/// // ... engine runs ...
/// mgr.stop_all();
/// ```
pub struct AdapterManager {
    modbus_adapters: Vec<(String, ModbusAdapter, Option<JoinHandle<()>>)>,
    hart_adapters: Vec<(String, HartAdapter, Option<JoinHandle<()>>)>,
}

impl AdapterManager {
    /// Create a new empty adapter manager.
    pub fn new() -> Self {
        Self { modbus_adapters: Vec::new(), hart_adapters: Vec::new() }
    }

    /// Register a Modbus adapter from config.
    ///
    /// The adapter connects to the device in `new()` but does NOT start
    /// its poll loop. Call [`start_all`](Self::start_all) to start.
    pub fn register_modbus(
        &mut self,
        name: String,
        config: ModbusConfig,
        transport: Arc<dyn HalTransport>,
    ) -> Result<(), ModbusError> {
        let adapter = ModbusAdapter::new(config, transport)?;
        self.modbus_adapters.push((name, adapter, None));
        Ok(())
    }

    /// Register a HART adapter from config.
    ///
    /// The adapter connects to the device in `new()` but does NOT start
    /// its poll loop. Call [`start_all`](Self::start_all) to start.
    pub fn register_hart(
        &mut self,
        name: String,
        config: HartConfig,
        transport: Arc<dyn HalTransport>,
    ) -> Result<(), HartError> {
        let adapter = HartAdapter::new(config, transport)?;
        self.hart_adapters.push((name, adapter, None));
        Ok(())
    }

    /// Start all registered adapters.
    ///
    /// Each adapter spawns its own dedicated poll thread. Threads
    /// publish signals into the shared [`HalTransport`]; the Engine's
    /// read barrier picks them up naturally.
    pub fn start_all(&mut self) {
        for (_name, adapter, handle) in &mut self.modbus_adapters {
            *handle = Some(adapter.start());
        }
        for (_name, adapter, handle) in &mut self.hart_adapters {
            *handle = Some(adapter.start());
        }
    }

    /// Stop all adapters and join their poll threads.
    ///
    /// Calls [`ModbusAdapter::stop`] / [`HartAdapter::stop`] on each
    /// adapter (sets the shutdown [`AtomicBool`]), then joins every
    /// thread. Threads are joined before adapters are dropped to
    /// prevent the Drop impl from racing with thread termination.
    pub fn stop_all(&mut self) {
        // Signal all adapters to stop
        for (_name, adapter, _handle) in &self.modbus_adapters {
            adapter.stop();
        }
        for (_name, adapter, _handle) in &self.hart_adapters {
            adapter.stop();
        }
        // Join all threads
        for (_name, _adapter, handle) in &mut self.modbus_adapters {
            if let Some(h) = handle.take() {
                let _ = h.join();
            }
        }
        for (_name, _adapter, handle) in &mut self.hart_adapters {
            if let Some(h) = handle.take() {
                let _ = h.join();
            }
        }
    }
}

impl Default for AdapterManager {
    fn default() -> Self {
        Self::new()
    }
}
