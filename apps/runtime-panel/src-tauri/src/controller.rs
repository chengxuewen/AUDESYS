//! Controller connection management for the Runtime Panel.
//!
//! ponytail: minimal P1 — no reconnect, no middleware.

use audesys_controller_client::ControllerClient;
use audesys_runtime_common::types::Role;

/// Shared controller connection state.
pub struct ControllerState {
    pub client: Option<ControllerClient>,
    pub socket_path: Option<String>,
    pub connected: bool,
}

/// Create and authenticate a ControllerClient over UDS.
/// ponytail: no reconnect, caller manages lifetime.
pub fn connect(socket_path: &str, secret: &str) -> Result<ControllerClient, String> {
    let mut client = ControllerClient::connect(socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::System)
        .map_err(|e| format!("auth: {e}"))?;
    Ok(client)
}
