//! YAML-serializable Modbus configuration types.
//! 来源: docs/modules/hal/hal-protocol-design.md §D23, D24

use crate::error::ModbusError;
use audesys_hal_core::HalPinDirection;
use std::fs;

fn default_poll_interval_ms() -> u64 {
    100
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct ModbusConfig {
    pub connection: ConnectionConfig,
    pub mappings: Vec<RegisterMapping>,
    #[serde(default = "default_poll_interval_ms")]
    pub poll_interval_ms: u64,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type")]
pub enum ConnectionConfig {
    #[serde(rename = "tcp")]
    Tcp { host: String, port: u16 },
    #[serde(rename = "rtu")]
    Rtu { device: String, baud: u32, parity: char, data_bits: u8, stop_bits: u8 },
}

#[derive(Debug, Clone, serde::Deserialize)]
pub struct RegisterMapping {
    pub signal_name: String,
    pub register_type: RegisterMappingType,
    pub address: u16,
    pub count: u16,
    pub direction: SignalDirection,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum RegisterMappingType {
    Coil,
    DiscreteInput,
    HoldingRegister,
    InputRegister,
}

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SignalDirection {
    Read,
    Write,
}

impl ModbusConfig {
    /// Load configuration from a YAML file.
    pub fn from_yaml(path: &str) -> Result<Self, ModbusError> {
        let content = fs::read_to_string(path)
            .map_err(|e| ModbusError::Io(format!("Failed to read config {path}: {e}")))?;
        serde_yaml::from_str(&content)
            .map_err(|e| ModbusError::InvalidData(format!("YAML parse error: {e}")))
    }
}

impl RegisterMapping {
    /// Map the config-level SignalDirection to HAL-level HalPinDirection.
    pub fn signal_direction(&self) -> HalPinDirection {
        match self.direction {
            SignalDirection::Read => HalPinDirection::In,
            SignalDirection::Write => HalPinDirection::Out,
        }
    }
}
