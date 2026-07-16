//! YAML-configurable HART device setup.
//!
//! Defines the serialised configuration types for HART device connections
//! and variable-to-Signal mappings.

// ── connection config ──────────────────────────────────────────────────

/// HART transport configuration.
#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type")]
pub enum ConnectionConfig {
    /// Serial (RS-485 / Bell 202 modem) connection.
    Serial {
        /// Device path (e.g. `/dev/ttyUSB0` on Linux, `/dev/cu.usbserial-*` on macOS).
        device: String,
    },
}

// ── variable mapping config ────────────────────────────────────────────

/// Signal direction for a variable mapping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum SignalDirection {
    Read,
    Write,
}

/// Classification of a HART variable for HalValue mapping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, serde::Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum VariableMappingType {
    /// Primary variable (float, 4-20 mA analog).
    Pv,
    /// Secondary variable (float).
    Sv,
    /// Tertiary variable (float).
    Tv,
    /// Quaternary variable (float).
    Qv,
    /// Device status byte.
    Status,
}

/// Maps one HART device variable to a HAL Signal.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct VariableMapping {
    /// HAL Signal name (e.g. `sensor.temp.pv`).
    pub signal_name: String,
    /// HART variable classification.
    #[serde(rename = "type")]
    pub variable_type: VariableMappingType,
    /// Read or write from device.
    pub direction: SignalDirection,
}

// ── top-level config ───────────────────────────────────────────────────

/// Complete HART device configuration.
#[derive(Debug, Clone, serde::Deserialize)]
pub struct HartConfig {
    /// Transport connection settings.
    pub connection: ConnectionConfig,
    /// Variable-to-Signal mappings.
    pub mappings: Vec<VariableMapping>,
    /// Poll interval in milliseconds.
    #[serde(default = "default_poll_interval_ms")]
    pub poll_interval_ms: u64,
}

fn default_poll_interval_ms() -> u64 {
    500 // HART baud rate is 1200 — short polls are impractical
}
