//! Controller connection management for the Runtime Panel.
//!
//! P1 SignalBridge: supports push-mode signal subscriptions with
//! a dedicated connection for receiving SIGNAL_PUSH (0x16) frames
//! in a background thread, plus exponential-backoff reconnect.

use audesys_controller_client::{ControllerClient, METHOD_SIGNAL_PUSH};
use audesys_runtime_common::types::Role;
use std::collections::HashMap;
use std::io;
use std::sync::mpsc::{self, Receiver, Sender, TryRecvError};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;



/// Signal cache shared between push listener thread and Tauri commands.
pub type SignalCache = Arc<Mutex<HashMap<String, String>>>;

/// Shared controller connection state.
pub struct ControllerState {
    /// Primary connection for request/response commands (read_signal, etc.).
    pub client: Option<ControllerClient>,
    pub socket_path: Option<String>,
    pub connected: bool,

    /// Push-mode: if Some, a background thread is reading SIGNAL_PUSH frames.
    pub push_thread: Option<PushListener>,
    /// Latest signal values received via push (or error strings).
    pub signal_cache: SignalCache,
}

/// Handle for the background push-receiving thread.
pub struct PushListener {
    /// Send a shutdown signal to the push thread.
    shutdown_tx: Sender<()>,
    /// Thread handle for joining on shutdown.
    handle: Option<thread::JoinHandle<()>>,
}

impl PushListener {
    /// Spawn a new push listener on a dedicated connection.
    pub fn spawn(
        socket_path: String,
        secret: Vec<u8>,
        signal_names: Vec<String>,
        cache: SignalCache,
    ) -> Result<Self, String> {
        // Open a dedicated connection for push frames.
        let mut push_client = ControllerClient::connect(&socket_path, &secret)
            .map_err(|e| format!("push connect: {e}"))?;
        push_client
            .authenticate(Role::Hmi)
            .map_err(|e| format!("push auth: {e}"))?;

        // Subscribe to each signal.
        for name in &signal_names {
            push_client
                .subscribe_signal(name)
                .map_err(|e| format!("push subscribe {name}: {e}"))?;
        }

        // ponytail: 1s poll for push frames, non-blocking reads via timeout
        push_client
            .set_read_timeout(Some(Duration::from_secs(1)))
            .map_err(|e| format!("set timeout: {e}"))?;

        let (shutdown_tx, shutdown_rx) = mpsc::channel();

        let handle = thread::spawn(move || {
            push_read_loop(push_client, cache, shutdown_rx);
        });

        Ok(PushListener {
            shutdown_tx,
            handle: Some(handle),
        })
    }

    /// Signal the push thread to stop and join it.
    pub fn stop(&mut self) {
        let _ = self.shutdown_tx.send(());
        if let Some(handle) = self.handle.take() {
            // ponytail: best-effort join, don't block UI forever
            let _ = handle.join();
        }
    }
}

impl Drop for PushListener {
    fn drop(&mut self) {
        self.stop();
    }
}

/// Background loop: poll for SIGNAL_PUSH frames, parse JSON, update cache.
fn push_read_loop(
    mut client: ControllerClient,
    cache: SignalCache,
    shutdown_rx: Receiver<()>,
) {
    loop {
        // Check for shutdown signal.
        match shutdown_rx.try_recv() {
            Ok(()) | Err(TryRecvError::Disconnected) => return,
            Err(TryRecvError::Empty) => {}
        }

        match client.read_raw_frame() {
            Ok((method_id, payload)) => {
                if method_id == METHOD_SIGNAL_PUSH {
                    // Payload is JSON: {"signal":"<name>","value":<hal-value-json>}
                    if let Ok(json) = serde_json::from_slice::<serde_json::Value>(&payload) {
                        let signal = json["signal"].as_str().unwrap_or("").to_string();
                        let value = json["value"].to_string();
                        if !signal.is_empty() {
                            let mut guard = cache.lock().unwrap();
                            guard.insert(signal, value);
                        }
                    }
                }
            }
            Err(ref e) if e.kind() == io::ErrorKind::WouldBlock || e.kind() == io::ErrorKind::TimedOut => {
                // Timeout → no push frame available, loop again.
                continue;
            }
            Err(e) => {
                eprintln!("Panel push: read error: {e}, stopping push listener");
                return;
            }
        }
    }
}

/// Create and authenticate a ControllerClient over UDS.
pub fn connect(socket_path: &str, secret: &str) -> Result<ControllerClient, String> {
    let mut client = ControllerClient::connect(socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client
        .authenticate(Role::Hmi)
        .map_err(|e| format!("auth: {e}"))?;
    Ok(client)
}
