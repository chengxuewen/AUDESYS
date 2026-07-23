//! AUDESYS Runtime Panel — Tauri backend with Controller IPC.
//!
//! Provides commands for the HMI panel to connect to the Controller
//! via UDS, read signal values, subscribe to push updates, and
//! fetch the deployed HMI layout.

mod controller;

use std::collections::HashMap;
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::State;

// ── Tauri commands ──

/// Connect to the Controller via UDS and store the authenticated client.
/// Uses Role::Hmi for panel-specific permissions.
#[tauri::command]
fn connect_controller(
    socket_path: String,
    secret: String,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let client = controller::connect(&socket_path, &secret)?;
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    guard.client = Some(client);
    guard.socket_path = Some(socket_path.clone());
    guard.connected = true;
    // Store secret for potential reconnects.
    // ponytail: secret stored in-memory, cleared on disconnect
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

/// Subscribe to push updates for a list of signal names.
///
/// Opens a dedicated connection, authenticates, subscribes, and spawns
/// a background thread that receives SIGNAL_PUSH (0x16) frames.
/// Push values land in `state.signal_cache`.
#[tauri::command]
fn subscribe_signals(
    signal_names: Vec<String>,
    secret: String,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;

    // Stop existing push listener if any.
    if let Some(mut listener) = guard.push_thread.take() {
        listener.stop();
    }

    let socket_path = guard.socket_path.clone().ok_or("not connected")?;
    let cache = guard.signal_cache.clone();

    // ponytail: drop lock before spawning thread (spawn takes ownership)
    drop(guard);

    let listener = controller::PushListener::spawn(
        socket_path,
        secret.into_bytes(),
        signal_names.clone(),
        cache,
    )?;

    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    guard.push_thread = Some(listener);

    Ok(format!("subscribed to {} signals", signal_names.len()))
}

/// Unsubscribe from all push updates (stops the push listener thread).
#[tauri::command]
fn unsubscribe_signals(
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    if let Some(mut listener) = guard.push_thread.take() {
        listener.stop();
        Ok("unsubscribed".into())
    } else {
        Ok("no active subscription".into())
    }
}

/// Read cached push values for the given signal names.
/// Returns values from `signal_cache` populated by the push listener thread.
#[tauri::command]
fn read_push_cache(
    names: Vec<String>,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<HashMap<String, String>, String> {
    let guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    let cache = guard.signal_cache.lock().map_err(|e| format!("cache lock: {e}"))?;
    let mut results = HashMap::new();
    for name in &names {
        if let Some(val) = cache.get(name) {
            results.insert(name.clone(), val.clone());
        }
    }
    Ok(results)
}

/// Disconnect from the Controller (drops the client, stops push listener).
#[tauri::command]
fn disconnect_controller(
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;
    if let Some(mut listener) = guard.push_thread.take() {
        listener.stop();
    }
    guard.client = None;
    guard.socket_path = None;
    guard.connected = false;
    guard.signal_cache.lock().unwrap().clear();
    Ok("disconnected".into())
}

/// Reconnect to the Controller with exponential backoff.
///
/// Retry schedule: 1s → 2s → 4s → 8s → 16s → 32s (max 30s per attempt).
/// Returns "reconnected" on success or the last error after all retries exhausted.
#[tauri::command]
fn reconnect_controller(
    socket_path: String,
    secret: String,
    state: State<'_, Mutex<controller::ControllerState>>,
) -> Result<String, String> {
    const MAX_RETRIES: u32 = 6;
    const BASE_MS: u64 = 1000;
    const MAX_WAIT_MS: u64 = 30_000;

    let mut guard = state.lock().map_err(|e| format!("lock: {e}"))?;

    // Stop any existing push listener before reconnect.
    if let Some(mut listener) = guard.push_thread.take() {
        listener.stop();
    }
    guard.client = None;
    guard.connected = false;

    let mut last_error = String::new();

    for attempt in 1..=MAX_RETRIES {
        match controller::connect(&socket_path, &secret) {
            Ok(client) => {
                guard.client = Some(client);
                guard.socket_path = Some(socket_path);
                guard.connected = true;
                return Ok(format!("reconnected after {} attempt(s)", attempt));
            }
            Err(e) => {
                last_error = e;
                if attempt < MAX_RETRIES {
                    let backoff_ms = (BASE_MS * (1u64 << (attempt - 1))).min(MAX_WAIT_MS);
                    // ponytail: drop lock during sleep so other threads aren't blocked
                    drop(guard);
                    std::thread::sleep(Duration::from_millis(backoff_ms));
                    guard = state.lock().map_err(|e| format!("lock: {e}"))?;
                }
            }
        }
    }

    Err(format!("reconnect failed after {} attempts: {}", MAX_RETRIES, last_error))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(Mutex::new(controller::ControllerState {
            client: None,
            socket_path: None,
            connected: false,
            push_thread: None,
            signal_cache: Arc::new(Mutex::new(HashMap::new())),
        }))
        .invoke_handler(tauri::generate_handler![
            connect_controller,
            read_signal,
            read_signals_snapshot,
            read_layout,
            disconnect_controller,
            reconnect_controller,
            subscribe_signals,
            unsubscribe_signals,
            read_push_cache,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Runtime Panel");
}
