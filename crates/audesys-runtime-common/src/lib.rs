//! AUDESYS Runtime Common — shared types for Runtime modules.
//!
//! Defines the foundational types used across all Runtime processes:
//! Supervisor, Controller, HMI, Debug Bridge.
//!
//! # Design references
//! - `docs/modules/runtime/ipc-security-design.md` — IPC authentication & authorization
//! - `docs/modules/runtime/observability-design.md` — health checks & audit logging
//! - D45: Runtime design documents

pub mod types;

pub use types::*;
