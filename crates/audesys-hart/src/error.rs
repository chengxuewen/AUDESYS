//! HART error types and HalError conversion.
//!
//! Maps HART protocol errors to AUDESYS [`HalError`] variants.

use audesys_hal_core::HalError;

// ── HART error ────────────────────────────────────────────────────────

/// Errors that can occur during HART device communication.
#[derive(Debug, thiserror::Error)]
pub enum HartError {
    #[error("connection failed: {0}")]
    Connection(String),

    #[error("I/O error: {0}")]
    Io(String),

    #[error("protocol error: {0}")]
    Protocol(String),

    #[error("timeout: {0}")]
    Timeout(String),

    #[error("invalid polling address: {0}")]
    InvalidAddress(u8),

    #[error("invalid data: {0}")]
    InvalidData(String),

    #[error("device not connected")]
    NotConnected,

    #[error("unsupported operation: {0}")]
    Unsupported(String),

    #[error("internal error: {0}")]
    Internal(String),
}

// ── HalError conversion ───────────────────────────────────────────────

impl From<HartError> for HalError {
    fn from(err: HartError) -> Self {
        match err {
            HartError::Connection(msg) => {
                HalError::Execution { method: "hart_connect".into(), reason: msg }
            }
            HartError::Io(msg) => HalError::Execution { method: "hart_io".into(), reason: msg },
            HartError::Protocol(msg) => {
                HalError::Execution { method: "hart_protocol".into(), reason: msg }
            }
            HartError::Timeout(msg) => {
                HalError::Execution { method: "hart_timeout".into(), reason: msg }
            }
            HartError::InvalidAddress(addr) => HalError::Execution {
                method: "hart_set_address".into(),
                reason: format!("invalid polling address: {addr}"),
            },
            HartError::InvalidData(msg) => {
                HalError::Execution { method: "hart_data".into(), reason: msg }
            }
            HartError::NotConnected => HalError::Execution {
                method: "hart_operation".into(),
                reason: "device not connected".into(),
            },
            HartError::Unsupported(msg) => {
                HalError::Execution { method: "hart_unsupported".into(), reason: msg }
            }
            HartError::Internal(msg) => HalError::Internal(msg),
        }
    }
}
