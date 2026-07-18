//! AUDESYS Runtime Controller
//!
//! The Controller is the hard real-time execution engine in the Runtime suite.
//! It consumes an `AmwMiddleware` instance, executes a read→compute→write cycle,
//! and enforces Config Barrier semantics for safe configuration changes.
//!
//! # Architecture (D10-D17)
//! - Sync-only architecture: no tokio, no async — compatible with SCHED_FIFO
//! - Engine: read_barrier → execute_functions → write_barrier cycle
//! - Config Barrier: all config changes applied at cycle boundary (D17)
//! - LockLevel: monotonic-increasing lock prevents unsafe reconfiguration (D17)
//!
//! # Decision references
//! - D17: Config Barrier + LockLevel
//! - D30: qa-fast / qa-full / qa-deep three-tier QA
//! - D53: Phase 0 → Phase 1 M0.3 transition

pub mod adapter_manager;
pub mod config;
pub mod engine;
pub mod health;
pub mod ipc;
pub mod lifecycle;
pub mod logging;
pub mod metrics;

pub mod signals;
pub mod simulation;
pub mod virtual_modbus;
pub mod virtual_hart;
pub use adapter_manager::AdapterManager;
pub use config::ConfigWatcher;
pub use config::RuntimeConfig;
pub use engine::Engine;
pub use health::HealthServer;
pub use ipc::IpcServer;
pub use lifecycle::LifecycleManager;
pub use metrics::RuntimeMetrics;
pub use signals::{SignalDef, SignalRegistry, SignalSnapshot, StrategyFilter, WriteStrategy};
pub use simulation::SimulationHarness;
pub use virtual_modbus::VirtualModbusTcpDevice;
pub use virtual_hart::VirtualHARTDevice;
