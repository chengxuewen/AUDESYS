//! Modbus error types.
//! 来源: docs/modules/hal/hal-protocol-design.md §D23 (Modbus RTU/TCP)

use std::ffi::CStr;

use audesys_hal_core::HalError;

/// Errors that can occur during Modbus operations.
#[derive(Debug, thiserror::Error)]
pub enum ModbusError {
    /// Failed to create or open a connection.
    #[error("Modbus connection error: {0}")]
    Connection(String),

    /// I/O operation failed (read/write/flush).
    #[error("Modbus I/O error: {0}")]
    Io(String),

    /// Protocol-level error (invalid response, exception code).
    #[error("Modbus protocol error: {0}")]
    Protocol(String),

    /// Operation timed out.
    #[error("Modbus timeout: {0}")]
    Timeout(String),

    /// Address out of valid range.
    #[error("Modbus invalid address: {0}")]
    InvalidAddress(u16),

    /// Data validation failed.
    #[error("Modbus invalid data: {0}")]
    InvalidData(String),

    /// Operation attempted on a closed/not-connected context.
    #[error("Modbus not connected")]
    NotConnected,

    /// Unsupported operation or feature.
    #[error("Modbus unsupported: {0}")]
    Unsupported(String),

    /// Internal error (adapter-level, not from libmodbus).
    #[error("Modbus internal error: {0}")]
    Internal(String),
}

impl From<ModbusError> for HalError {
    fn from(e: ModbusError) -> Self {
        match e {
            ModbusError::Timeout(msg) => HalError::Internal(format!("Modbus timeout: {msg}")),
            ModbusError::Connection(msg) => {
                HalError::Execution { method: "modbus_connect".into(), reason: msg }
            }
            ModbusError::Io(msg) => HalError::Execution { method: "modbus_io".into(), reason: msg },
            ModbusError::Protocol(msg) => {
                HalError::Execution { method: "modbus_protocol".into(), reason: msg }
            }
            ModbusError::InvalidAddress(addr) => {
                HalError::Execution { method: "modbus_address".into(), reason: format!("{addr}") }
            }
            ModbusError::InvalidData(msg) => {
                HalError::Execution { method: "modbus_data".into(), reason: msg }
            }
            ModbusError::NotConnected => {
                HalError::Execution { method: "modbus_op".into(), reason: "not connected".into() }
            }
            ModbusError::Unsupported(msg) => {
                HalError::Execution { method: "modbus_unsupported".into(), reason: msg }
            }
            ModbusError::Internal(msg) => {
                HalError::Execution { method: "modbus_internal".into(), reason: msg }
            }
        }
    }
}

/// Read the last libmodbus error string from errno.
///
/// # Safety
///
/// Calls `modbus_strerror(0)` which reads the current thread's errno.
/// The returned string is a copy, so no dangling pointer issues.
pub fn last_modbus_error() -> String {
    // SAFETY: modbus_strerror(0) reads errno and returns a static string.
    // Passing 0 is the documented way to get the last error.
    let ptr = unsafe { audesys_modbus_sys::modbus_strerror(std::os::raw::c_int::default()) };
    if ptr.is_null() {
        return String::from("unknown modbus error");
    }
    // SAFETY: ptr is non-null, points to a valid C string from libmodbus.
    unsafe { CStr::from_ptr(ptr) }.to_string_lossy().into_owned()
}
