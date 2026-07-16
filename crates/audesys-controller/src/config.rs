//! Runtime configuration — YAML-based hot-reload with file watching.
//!
//! Loads controller configuration from YAML. `ConfigWatcher` polls file
//! mtime and pushes config changes through an mpsc channel; the caller
//! drains into Engine's config barrier (D17).
//!
//! 来源: D24 (YAML dev config → FlatBuffers runtime), D17 (Config Barrier)

use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::{
    Arc,
    atomic::{AtomicBool, Ordering},
};
use std::thread::{self, JoinHandle};
use std::time::SystemTime;

use audesys_hal_core::qos::ConfigCommand;

/// Top-level Runtime configuration.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeConfig {
    /// Path to the HAL YAML configuration file
    #[serde(default)]
    pub hal_config_path: String,
    /// Health check endpoint port (0 = disabled)
    #[serde(default)]
    pub health_port: u16,
    /// Engine cycle interval in milliseconds
    #[serde(default = "default_cycle_interval")]
    pub cycle_interval_ms: u64,
    /// Children to spawn (program name → args)
    #[serde(default)]
    pub children: Vec<ChildConfig>,
    /// Lock level at startup (String: "none", "load", "config", "params", "run", "all")
    #[serde(default = "default_startup_lock_level")]
    pub startup_lock_level: String,
    /// Shutdown timeout for child processes (ms)
    #[serde(default = "default_shutdown_timeout")]
    pub shutdown_timeout_ms: u64,
}

fn default_startup_lock_level() -> String {
    "none".into()
}

fn default_shutdown_timeout() -> u64 {
    5000
}

fn default_cycle_interval() -> u64 {
    10
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct ChildConfig {
    pub name: String,
    pub program: String,
    #[serde(default)]
    pub args: Vec<String>,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            hal_config_path: "config/hal.yaml".into(),
            health_port: 9100,
            cycle_interval_ms: 10,
            children: Vec::new(),
            startup_lock_level: "none".into(),
            shutdown_timeout_ms: 5000,
        }
    }
}

impl RuntimeConfig {
    /// Load config from a YAML file.
    pub fn load(path: &Path) -> Result<Self, String> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config {}: {}", path.display(), e))?;
        serde_yaml::from_str(&content)
            .map_err(|e| format!("Failed to parse config {}: {}", path.display(), e))
    }

    /// Backward-compat alias for `load()`.
    #[deprecated(since = "0.1.0", note = "use RuntimeConfig::load() instead")]
    pub fn from_file(path: &Path) -> Result<Self, String> {
        Self::load(path)
    }

    /// Reload config from a file (same as load — mtime check is done externally).
    pub fn reload(path: &Path) -> Result<Self, String> {
        Self::load(path)
    }

    /// Validate config values and return errors for invalid values.
    pub fn validate(&self) -> Result<(), String> {
        if self.cycle_interval_ms == 0 {
            return Err("cycle_interval_ms must be positive".into());
        }
        let valid_levels = ["none", "load", "config", "params", "run", "all"];
        if !valid_levels.contains(&self.startup_lock_level.as_str()) {
            return Err(format!(
                "Invalid startup_lock_level '{}'. Must be one of: {:?}",
                self.startup_lock_level, valid_levels,
            ));
        }
        if self.shutdown_timeout_ms == 0 {
            return Err("shutdown_timeout_ms must be positive".into());
        }
        Ok(())
    }

    /// Generate `ConfigCommand`s for fields that differ from `previous`.
    pub fn diff_commands(&self, previous: &Self) -> Vec<ConfigCommand> {
        let mut cmds = Vec::new();
        let now = std::time::Instant::now();
        let mut next_id = 1_u64;

        if self.hal_config_path != previous.hal_config_path {
            cmds.push(ConfigCommand {
                id: next_id,
                method: "loadComponent".into(),
                params: self.hal_config_path.as_bytes().to_vec(),
                queued_at: now,
            });
            next_id += 1;
        }
        if self.cycle_interval_ms != previous.cycle_interval_ms {
            cmds.push(ConfigCommand {
                id: next_id,
                method: "setCycleInterval".into(),
                params: self.cycle_interval_ms.to_le_bytes().to_vec(),
                queued_at: now,
            });
        }

        cmds
    }
}

// ── ConfigWatcher ──

/// Polls config file mtime and pushes config changes through an mpsc channel.
///
/// The caller drains the receiver and injects commands into `Engine::queue_config()`
/// at the config barrier boundary (D17).
///
/// # Usage
///
/// ```ignore
/// let (tx, rx) = std::sync::mpsc::channel();
/// let watcher = ConfigWatcher::new(config_path, tx);
/// let handle = watcher.start(500);
///
/// // In the main loop, drain the receiver into the engine:
/// while let Ok(cmd) = rx.try_recv() {
///     engine.queue_config(cmd)?;
/// }
///
/// watcher.stop();
/// handle.join().unwrap();
/// ```
pub struct ConfigWatcher {
    path: PathBuf,
    tx: std::sync::mpsc::Sender<ConfigCommand>,
    running: Arc<AtomicBool>,
}

impl ConfigWatcher {
    /// Create a new watcher for the given config path and channel sender.
    pub fn new(path: PathBuf, tx: std::sync::mpsc::Sender<ConfigCommand>) -> Self {
        Self { path, tx, running: Arc::new(AtomicBool::new(false)) }
    }

    /// Start the watcher background thread. Polls `poll_interval_ms` for mtime changes.
    /// On file change: reload config, diff with previous, push commands through channel.
    pub fn start(&self, poll_interval_ms: u64) -> JoinHandle<()> {
        self.running.store(true, Ordering::SeqCst);
        let running = Arc::clone(&self.running);
        let path = self.path.clone();
        let tx = self.tx.clone();
        // ponytail: global lock on last_mtime/last_config; per-file granularity if needed
        let last_mtime = Arc::new(std::sync::Mutex::new(None::<SystemTime>));
        let last_config = Arc::new(std::sync::Mutex::new(RuntimeConfig::default()));

        thread::spawn(move || {
            let interval = std::time::Duration::from_millis(poll_interval_ms);
            while running.load(Ordering::SeqCst) {
                thread::sleep(interval);

                match std::fs::metadata(&path) {
                    Ok(meta) => match meta.modified() {
                        Ok(current_mtime) => {
                            let mut mtime_guard = last_mtime.lock().unwrap();
                            let changed = mtime_guard.is_none_or(|prev| current_mtime != prev);
                            if changed {
                                *mtime_guard = Some(current_mtime);
                                drop(mtime_guard);

                                match RuntimeConfig::load(&path) {
                                    Ok(new_cfg) => {
                                        let mut cfg_guard = last_config.lock().unwrap();
                                        let cmds = new_cfg.diff_commands(&cfg_guard);
                                        *cfg_guard = new_cfg;
                                        drop(cfg_guard);

                                        for cmd in cmds {
                                            // ponytail: if consumer is gone, stop sending
                                            if tx.send(cmd).is_err() {
                                                return;
                                            }
                                        }
                                    }
                                    Err(_e) => {
                                        // ponytail: log parse error in Phase 2
                                    }
                                }
                            }
                        }
                        Err(_) => {
                            // ponytail: mtime unavailable, skip silently
                        }
                    },
                    Err(_) => {
                        // ponytail: file not yet created, retry next poll
                    }
                }
            }
        })
    }

    /// Stop the watcher thread.
    pub fn stop(&self) {
        self.running.store(false, Ordering::SeqCst);
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    // ── Existing test expectations preserved, updated to YAML ──

    #[test]
    fn test_default_values() {
        let config = RuntimeConfig::default();
        assert_eq!(config.hal_config_path, "config/hal.yaml");
        assert_eq!(config.health_port, 9100);
        assert_eq!(config.cycle_interval_ms, 10);
        assert_eq!(config.startup_lock_level, "none");
        assert_eq!(config.shutdown_timeout_ms, 5000);
        assert!(config.children.is_empty());
    }

    #[test]
    fn test_parse_yaml() {
        let content = "\
hal_config_path: config/test-hal.yaml
health_port: 8080
cycle_interval_ms: 5
startup_lock_level: config
shutdown_timeout_ms: 10000
";
        let config: RuntimeConfig = serde_yaml::from_str(content).expect("parsing should succeed");
        assert_eq!(config.hal_config_path, "config/test-hal.yaml");
        assert_eq!(config.health_port, 8080);
        assert_eq!(config.cycle_interval_ms, 5);
        assert_eq!(config.startup_lock_level, "config");
        assert_eq!(config.shutdown_timeout_ms, 10000);
    }

    #[test]
    fn test_load_from_file() {
        let dir = std::env::temp_dir();
        let path = dir.join("audesys-test-config.yaml");
        let yaml = "\
hal_config_path: config/test-hal.yaml
health_port: 3000
";
        std::fs::write(&path, yaml).expect("write temp file");
        let config = RuntimeConfig::load(&path).expect("load should succeed");
        assert_eq!(config.health_port, 3000);
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_parse_unknown_keys_ignored() {
        let content = "unknown_key: some_value\nhealth_port: 3000\n";
        let config: RuntimeConfig = serde_yaml::from_str(content).expect("parsing should succeed");
        assert_eq!(config.health_port, 3000);
    }

    #[test]
    fn test_parse_empty_file() {
        // serde_yaml deserializes empty string as null → uses Default
        let content = "{}";
        let config: RuntimeConfig = serde_yaml::from_str(content).expect("parsing should succeed");
        assert_eq!(config.health_port, 0); // serde default for u16
    }

    #[test]
    fn test_validate_rejects_zero_cycle() {
        let mut config = RuntimeConfig::default();
        config.cycle_interval_ms = 0;
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_rejects_invalid_lock_level() {
        let mut config = RuntimeConfig::default();
        config.startup_lock_level = "invalid".into();
        assert!(config.validate().is_err());
    }

    #[test]
    fn test_validate_accepts_all_lock_levels() {
        for level in &["none", "load", "config", "params", "run", "all"] {
            let mut config = RuntimeConfig::default();
            config.startup_lock_level = level.to_string();
            assert!(config.validate().is_ok(), "should accept level '{}'", level);
        }
    }

    #[test]
    fn test_validate_rejects_zero_shutdown_timeout() {
        let mut config = RuntimeConfig::default();
        config.shutdown_timeout_ms = 0;
        assert!(config.validate().is_err());
    }

    // ── New tests ──

    #[test]
    fn test_yaml_parse_roundtrip() {
        let original = RuntimeConfig::default();
        let yaml = serde_yaml::to_string(&original).expect("serialize should succeed");
        let parsed: RuntimeConfig =
            serde_yaml::from_str(&yaml).expect("deserialize should succeed");
        assert_eq!(parsed.hal_config_path, original.hal_config_path);
        assert_eq!(parsed.health_port, original.health_port);
        assert_eq!(parsed.cycle_interval_ms, original.cycle_interval_ms);
        assert_eq!(parsed.startup_lock_level, original.startup_lock_level);
        assert_eq!(parsed.shutdown_timeout_ms, original.shutdown_timeout_ms);
    }

    #[test]
    fn test_reload_detects_change() {
        let dir = std::env::temp_dir();
        let path = dir.join("audesys-test-reload.yaml");

        let yaml1 = "hal_config_path: config/v1.yaml\nhealth_port: 1111\n";
        std::fs::write(&path, yaml1).expect("write temp file");
        let cfg1 = RuntimeConfig::load(&path).expect("load v1");
        assert_eq!(cfg1.health_port, 1111);

        let yaml2 = "hal_config_path: config/v2.yaml\nhealth_port: 2222\n";
        std::fs::write(&path, yaml2).expect("write temp file");
        let cfg2 = RuntimeConfig::reload(&path).expect("reload v2");
        assert_eq!(cfg2.health_port, 2222);
        assert_ne!(cfg1.health_port, cfg2.health_port);

        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn test_diff_commands_generates_correct_methods() {
        let prev = RuntimeConfig {
            hal_config_path: "config/old.yaml".into(),
            cycle_interval_ms: 5,
            ..RuntimeConfig::default()
        };
        let next = RuntimeConfig {
            hal_config_path: "config/new.yaml".into(),
            cycle_interval_ms: 10,
            ..RuntimeConfig::default()
        };
        let cmds = next.diff_commands(&prev);
        assert_eq!(cmds.len(), 2);

        let has_load = cmds.iter().any(|c| c.method == "loadComponent");
        let has_cycle = cmds.iter().any(|c| c.method == "setCycleInterval");
        assert!(has_load, "should have loadComponent command");
        assert!(has_cycle, "should have setCycleInterval command");
    }

    #[test]
    fn test_diff_commands_no_changes() {
        let cfg = RuntimeConfig::default();
        let cmds = cfg.diff_commands(&cfg);
        assert!(cmds.is_empty(), "no commands when configs are identical");
    }

    #[test]
    fn test_watcher_start_stop() {
        let (tx, rx) = std::sync::mpsc::channel();
        let dir = std::env::temp_dir();
        let path = dir.join("audesys-test-watcher.yaml");

        std::fs::write(&path, "health_port: 9100\n").expect("write temp file");

        let watcher = ConfigWatcher::new(path.clone(), tx);
        let handle = watcher.start(50);
        thread::sleep(std::time::Duration::from_millis(150));

        // Ensure mtime changes (macOS HFS+ has 1s resolution)
        thread::sleep(std::time::Duration::from_secs(1));

        // Update the file to trigger reload
        std::fs::write(&path, "health_port: 9999\ncycle_interval_ms: 20\n")
            .expect("rewrite temp file");
        thread::sleep(std::time::Duration::from_millis(200));

        watcher.stop();
        handle.join().expect("watcher thread should join cleanly");

        // Drain channel — should have received a setCycleInterval command
        // (hal_config_path unchanged if not in file, health_port doesn't generate a command)
        let mut cmds: Vec<ConfigCommand> = Vec::new();
        while let Ok(cmd) = rx.try_recv() {
            cmds.push(cmd);
        }
        assert!(!cmds.is_empty(), "should have at least one config command from file change");

        let _ = std::fs::remove_file(&path);
    }
}
