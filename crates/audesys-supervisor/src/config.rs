//! Supervisor configuration — YAML-based process list.
//!
//! Uses the same `ChildConfig` shape as the Controller (`name`, `program`, `args`).
//! Adds supervisor-specific fields: `uds_path`, `check_interval_ms`, `shutdown_timeout_ms`.

use serde::Deserialize;
use std::path::Path;

// ── Public types ──────────────────────────────────────────────────────

/// Supervisor configuration loaded from YAML.
#[derive(Debug, Clone, Deserialize)]
pub struct SupervisorConfig {
    /// Child processes to supervise.
    pub children: Vec<ChildConfig>,
    /// Path to Controller UDS for status push.
    #[serde(default = "default_uds_path")]
    pub uds_path: String,
    /// Poll interval for health checks (ms).
    #[serde(default = "default_check_interval")]
    pub check_interval_ms: u64,
    /// Graceful shutdown timeout for child processes (ms).
    #[serde(default = "default_shutdown_timeout")]
    pub shutdown_timeout_ms: u64,
}

/// A single supervised child process definition.
///
/// Same shape as the Controller's `ChildConfig` so the same YAML
/// can feed both Controller adapter children and Supervisor-managed
/// Runtime processes.
#[derive(Debug, Clone, Deserialize)]
pub struct ChildConfig {
    /// Logical name for logs and status reports.
    pub name: String,
    /// Executable path (resolved via PATH or absolute).
    pub program: String,
    /// Command-line arguments.
    #[serde(default)]
    pub args: Vec<String>,
}

// ── Defaults ──────────────────────────────────────────────────────────

const DEFAULT_UDS_PATH: &str = "/tmp/audesys-controller.sock";

fn default_uds_path() -> String {
    DEFAULT_UDS_PATH.into()
}

fn default_check_interval() -> u64 {
    500
}

fn default_shutdown_timeout() -> u64 {
    5000
}

// ── Load ──────────────────────────────────────────────────────────────

impl SupervisorConfig {
    /// Load config from a YAML file.
    pub fn load(path: &Path) -> Result<Self, String> {
        let content =
            std::fs::read_to_string(path).map_err(|e| format!("read {}: {}", path.display(), e))?;
        serde_yaml::from_str(&content).map_err(|e| format!("parse {}: {}", path.display(), e))
    }
}
