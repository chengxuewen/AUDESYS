//! AUDESYS Runtime Supervisor
//!
//! Monitors child processes listed in a YAML config, auto-restarts
//! on exit with exponential backoff, and pushes status updates to
//! the Controller via UDS IPC.

pub mod config;
pub mod monitor;
