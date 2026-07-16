//! Runtime configuration — sync, one-shot load.
//!
//! Loads controller configuration from a key=value text file (Phase 1).
//! Upgrade path: add serde + serde_yaml for YAML parsing in Phase 2.
//!
//! 来源: D24 (YAML dev config → FlatBuffers runtime), D17 (LockLevel at startup)

use std::path::Path;

/// Top-level Runtime configuration.
/// ponytail: simple struct, fields added as needed. Add serde_yaml when config gets complex.
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    /// Path to the HAL YAML configuration file
    pub hal_config_path: String,
    /// Health check endpoint port (0 = disabled)
    pub health_port: u16,
    /// Engine cycle interval in milliseconds
    pub cycle_interval_ms: u64,
    /// Children to spawn (program name → args)
    pub children: Vec<ChildConfig>,
    /// Lock level at startup (String: "none", "load", "config", "params", "run", "all")
    pub startup_lock_level: String,
    /// Shutdown timeout for child processes (ms)
    pub shutdown_timeout_ms: u64,
}

#[derive(Debug, Clone)]
pub struct ChildConfig {
    pub name: String,
    pub program: String,
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
    /// Load from a file (simple key=value format).
    pub fn from_file(path: &Path) -> Result<Self, String> {
        let content = std::fs::read_to_string(path)
            .map_err(|e| format!("Failed to read config {}: {}", path.display(), e))?;
        Self::parse_simple(&content)
    }

    /// Simple key=value parser for Phase 1.
    /// ponytail: manual parsing, add serde_yaml when config nesting exceeds 2 levels.
    fn parse_simple(content: &str) -> Result<Self, String> {
        let mut config = Self::default();
        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let (key, value) =
                line.split_once(':').ok_or_else(|| format!("Invalid config line: {}", line))?;
            let key = key.trim();
            let value = value.trim();
            match key {
                "hal_config_path" => config.hal_config_path = value.to_string(),
                "health_port" => config.health_port = value.parse().unwrap_or(9100),
                "cycle_interval_ms" => config.cycle_interval_ms = value.parse().unwrap_or(10),
                "startup_lock_level" => config.startup_lock_level = value.to_string(),
                "shutdown_timeout_ms" => config.shutdown_timeout_ms = value.parse().unwrap_or(5000),
                _ => {} // ignore unknown keys
            }
        }
        Ok(config)
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
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

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
    fn test_parse_simple() {
        let content = "\
# Controller config
hal_config_path: config/test-hal.yaml
health_port: 8080
cycle_interval_ms: 5
startup_lock_level: config
shutdown_timeout_ms: 10000
";
        let config = RuntimeConfig::parse_simple(content).expect("parsing should succeed");
        assert_eq!(config.hal_config_path, "config/test-hal.yaml");
        assert_eq!(config.health_port, 8080);
        assert_eq!(config.cycle_interval_ms, 5);
        assert_eq!(config.startup_lock_level, "config");
        assert_eq!(config.shutdown_timeout_ms, 10000);
    }

    #[test]
    fn test_parse_ignores_unknown_keys() {
        let content = "unknown_key: some_value\nhealth_port: 3000\n";
        let config = RuntimeConfig::parse_simple(content).expect("parsing should succeed");
        assert_eq!(config.health_port, 3000);
        // unknown_key is silently ignored
    }

    #[test]
    fn test_parse_empty_file() {
        let config = RuntimeConfig::parse_simple("").expect("parsing should succeed");
        let default = RuntimeConfig::default();
        assert_eq!(config.health_port, default.health_port);
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
}
