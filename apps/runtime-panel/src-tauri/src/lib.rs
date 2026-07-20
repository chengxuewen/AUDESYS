//! AUDESYS Runtime Panel — Tauri backend with Controller IPC.
//!
//! Provides commands for the HMI panel to connect to the Controller
//! via UDS, read signal values, and fetch the deployed HMI layout.

mod controller;

use std::collections::HashMap;
use std::sync::Mutex;
use tauri::State;

// ── Tauri commands ──

/// Connect to the Controller via UDS and store the authenticated client.
#[tauri::command]
fn connect_controller(
    socket_path: String,
    secret: String,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let client = controller::connect(&socket_path, &secret)?;
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    guard.client = Some(client);
    guard.socket_path = Some(socket_path);
    guard.connected = true;
    Ok("connected".into())
}

/// Read a single signal value from the Controller.
#[tauri::command]
fn read_signal(
    name: String,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    let client = guard.client.as_mut().ok_or("not connected")?;
    let value = client.read_signal(&name).map_err(|e| format!("read: {e}"))?;
    Ok(format!("{value:?}"))
}

/// Batch-read multiple signals. Returns name → value string pairs.
/// Errors for individual signals are captured as "error: ..." values.
#[tauri::command]
fn read_signals_snapshot(
    names: Vec<String>,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<HashMap<String, String>, String> {
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    let client = guard.client.as_mut().ok_or("not connected")?;
    let mut results = HashMap::new();
    for name in &names {
        match client.read_signal(name) {
            Ok(val) => {
                results.insert(name.clone(), format!("{val:?}"));
            }
            Err(e) => {
                results.insert(name.clone(), format!("error: {e}"));
            }
        }
    }
    Ok(results)
}

/// Read the deployed HMI layout YAML from disk.
/// ponytail: P1 reads from "project/hmi/layout.yaml". P2 will use IPC.
/// Returns empty string if the file does not exist.
#[tauri::command]
fn read_layout(
    _state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    match std::fs::read_to_string("project/hmi/layout.yaml") {
        Ok(content) => Ok(content),
        Err(_) => Ok(String::new()),
    }
}

/// Disconnect from the Controller (drops the client).
#[tauri::command]
fn disconnect_controller(
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    guard.client = None;
    guard.socket_path = None;
    guard.connected = false;
    Ok("disconnected".into())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(controller::ControllerState {
            client: None,
            socket_path: None,
            connected: false,
        }))
        .invoke_handler(tauri::generate_handler![
            connect_controller,
            read_signal,
            read_signals_snapshot,
            read_layout,
            disconnect_controller,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Runtime Panel");
}
