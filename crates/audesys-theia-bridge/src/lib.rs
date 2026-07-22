//! AUDESYS Theia Bridge — napi-rs bindings for Studio ↔ Rust compiler/runtime.
//!
//! Exposes ~25 functions mapping from the original 34 Tauri commands
//! to napi-rs (Node.js native addon) for Theia backend consumption.
//!
//! ## Function mapping
//!
//! | Category     | Count | Status     |
//! |-------------|-------|------------|
//! | Compilers    | 6     | 2 real, 4 stub |
//! | Controller   | 7     | 4 IPC + 3 lifecycle |
//! | Debug        | 9     | all stub   |
//! | Simulation   | 3     | all stub   |
//! | Project      | 2     | all stub   |
//! | Config/HMI   | 2     | all stub   |

use napi_derive::napi;
use audesys_hal_binding_gen::compile;
use audesys_il_compiler::il_compile;
use audesys_ld_compiler::ld_compile;
use audesys_controller_client::ControllerClient;
use audesys_runtime_common::types::Role;
use std::fs;
use std::os::unix::net::UnixStream;
use std::process::{Child, Command};
use std::sync::Mutex;
use std::time::Instant;
use std::{thread, time::Duration};

// ── Controller process state ────────────────────────────────────────────

struct ControllerHandle {
    child: Child,
    started_at: Instant,
}

static CONTROLLER: Mutex<Option<ControllerHandle>> = Mutex::new(None);
// ponytail: separate mutex for socket path avoids holding controller lock during cleanup.
static SOCKET_PATH: Mutex<Option<String>> = Mutex::new(None);
// ── Helpers ──────────────────────────────────────────────────────────────

/// Serialize a serde-compatible value to JSON, mapping failure to napi::Error.
fn to_json<T: serde::Serialize>(value: &T) -> napi::Result<String> {
    serde_json::to_string(value).map_err(|e| napi::Error::from_reason(format!("serialize: {e}")))
}

/// Create a one-shot controller connection, authenticate, run `f`, disconnect.
/// `role_str`: "operator" | "engineer" | "supervisor" | "auditor" | "system"
fn with_controller<F>(
    socket_path: &str,
    secret: &str,
    role: Role,
    f: F,
) -> napi::Result<String>
where
    F: FnOnce(&mut ControllerClient) -> Result<String, String>,
{
    let mut client = ControllerClient::connect(socket_path, secret.as_bytes())
        .map_err(|e| napi::Error::from_reason(format!("connect: {e}")))?;
    client
        .authenticate(role)
        .map_err(|e| napi::Error::from_reason(format!("auth: {e}")))?;
    let result = f(&mut client).map_err(|e| napi::Error::from_reason(e))?;
    Ok(result)
}

#[allow(dead_code)]
fn parse_role(s: &str) -> napi::Result<Role> {
    match s.to_lowercase().as_str() {
        "operator" => Ok(Role::Operator),
        "engineer" => Ok(Role::Engineer),
        "supervisor" => Ok(Role::Supervisor),
        "auditor" => Ok(Role::Auditor),
        "system" => Ok(Role::System),
        other => Err(napi::Error::from_reason(format!("unknown role: {other}"))),
    }
}

/// Stub helper — signal a "not yet implemented" function.
fn stub(name: &str) -> napi::Result<String> {
    Err(napi::Error::from_reason(format!(
        "not implemented: {name} is a stub for a future phase"
    )))
}

// ── PHASE 1 CORE — Compilers ─────────────────────────────────────────────

/// Compile IEC 61131-3 Structured Text source into a HalProgram JSON string.
///
/// Returns the serialized `HalProgram` on success, or a JSON diagnostic array
/// on compile error.
#[napi]
pub fn compile_st(source: String) -> napi::Result<String> {
    let program = compile(&source).map_err(|e| napi::Error::from_reason(e.to_string()))?;
    to_json(&program)
}

/// Compile IEC 61131-3 Instruction List source into a HalProgram JSON string.
#[napi]
pub fn compile_il(source: String) -> napi::Result<String> {
    let program = il_compile(&source).map_err(|e| napi::Error::from_reason(e))?;
    to_json(&program)
}

/// Compile IEC 61131-3 Ladder Diagram source into a HalProgram JSON string.
///
/// LD is compiled via IL: LD source → IL text → HalProgram.
#[napi]
pub fn compile_ld(source: String) -> napi::Result<String> {
    let il = ld_compile(&source).map_err(|e| napi::Error::from_reason(e))?;
    let program = il_compile(&il).map_err(|e| napi::Error::from_reason(e))?;
    to_json(&program)
}

/// Compile IEC 61131-3 Function Block Diagram source into HalProgram JSON.
///
/// Stub — FBD compiler → IL → HalProgram pipeline available in Phase 2a.
#[napi]
pub fn compile_fbd(_source: String) -> napi::Result<String> {
    stub("compile_fbd")
}

/// Compile IEC 61131-3 Sequential Function Chart source into HalProgram JSON.
///
/// Stub — SFC compiler → IL → HalProgram pipeline available in Phase 2b.
#[napi]
pub fn compile_sfc(_source: String) -> napi::Result<String> {
    stub("compile_sfc")
}

/// Compile G-code (RS274/NGC subset) source into a HalProgram JSON string.
///
/// Stub — G-code compiler available; enable when CNC Phase 2 begins.
#[napi]
pub fn compile_gcode(_source: String) -> napi::Result<String> {
    stub("compile_gcode")
}

// ── PHASE 1 CORE — Controller IPC ────────────────────────────────────────

/// Read a signal value from a running Controller via one-shot UDS connection.
///
/// Merges the old `read_controller_signal` + `controller_read_signal` Tauri
/// commands. Returns the HalValue as a JSON string.
#[napi]
pub fn read_signal(
    socket_path: String,
    secret: String,
    signal_name: String,
) -> napi::Result<String> {
    with_controller(&socket_path, &secret, Role::Operator, |client| {
        let value = client.read_signal(&signal_name)?;
        serde_json::to_string(&value).map_err(|e| format!("serialize: {e}"))
    })
}

/// Snapshot all signals matching `pattern` from the Controller.
///
/// Returns a JSON array of `{name, value}` objects.
#[napi]
pub fn signal_snapshot(
    socket_path: String,
    secret: String,
    pattern: String,
) -> napi::Result<String> {
    with_controller(&socket_path, &secret, Role::Operator, |client| {
        let signals = client.signal_snapshot(&pattern)?;
        serde_json::to_string(&signals).map_err(|e| format!("serialize: {e}"))
    })
}

/// Deploy a compiled program (HalProgram JSON) to a running Controller.
///
/// Merges the old `deploy_program` + `run_program` Tauri commands.
/// The program is loaded via IPC method 0x07 (LOAD_PROGRAM).
#[napi]
pub fn deploy_program(
    socket_path: String,
    secret: String,
    program_json: String,
) -> napi::Result<String> {
    with_controller(&socket_path, &secret, Role::Engineer, |client| {
        client.load_program(program_json.as_bytes())
    })
}

/// Query the Controller health status via UDS method 0x05 (HEALTH_QUERY).
///
/// Merges the old `health_query` + `fetch_controller_metrics` Tauri commands.
/// Returns a health-report JSON string. Timeout: 2s.
#[napi]
pub fn health_query(socket_path: String, secret: String) -> napi::Result<String> {
    with_controller(&socket_path, &secret, Role::Operator, |client| {
        client.health_query()
    })
}

// ── PHASE 1 CORE — Controller Lifecycle ─────────────────────────────────

/// Start the AUDESYS Controller as a child process.
///
/// Spawns the binary at `binary_path`, then polls for the UDS socket at
/// `socket_path` to become available (100ms interval, 10s timeout).
/// Returns JSON: `{"pid": 12345, "socket": "/tmp/...", "status": "running"}`
#[napi]
pub fn controller_start(socket_path: String, binary_path: String) -> napi::Result<String> {
    let mut guard = CONTROLLER.lock().unwrap();
    if guard.is_some() {
        return Err(napi::Error::from_reason(
            "controller already running. Call controller_stop() first.",
        ));
    }

    if !std::path::Path::new(&binary_path).exists() {
        return Err(napi::Error::from_reason(format!("binary not found: {binary_path}")));
    }

    let mut child = Command::new(&binary_path)
        .spawn()
        .map_err(|e| napi::Error::from_reason(format!("spawn failed: {e}")))?;

    let pid = child.id();
    let started_at = Instant::now();
    let deadline = started_at + Duration::from_secs(10);
    let poll_interval = Duration::from_millis(100);

    // Poll for UDS socket to appear
    loop {
        if Instant::now() >= deadline {
            // Timeout: kill spawned process, don't leave orphans
            let _ = child.kill();
            let _ = child.wait();
            return Err(napi::Error::from_reason(
                "controller start timeout: UDS socket not ready after 10s",
            ));
        }
        if UnixStream::connect(&socket_path).is_ok() {
            break;
        }
        thread::sleep(poll_interval);
    }

    // Socket is ready — store state
    *SOCKET_PATH.lock().unwrap() = Some(socket_path.clone());
    *guard = Some(ControllerHandle { child, started_at });

    to_json(&serde_json::json!({
        "pid": pid,
        "socket": &socket_path,
        "status": "running"
    }))
}

/// Stop the running Controller process.
///
/// Sends SIGKILL to the child process and cleans up the UDS socket file.
/// Returns JSON: `{"status": "stopped"}`
///
/// ponytail: SIGTERM-first graceful shutdown is not implemented — the
/// Controller is a local dev process, not a production server. Add SIGTERM
/// when the Controller has a signal handler for in-flight program save.
#[napi]
pub fn controller_stop() -> napi::Result<String> {
    let mut guard = CONTROLLER.lock().unwrap();
    let mut h = guard
        .take()
        .ok_or_else(|| napi::Error::from_reason("no controller running"))?;
    drop(guard);

    // Kill child process
    let _ = h.child.kill();
    let _ = h.child.wait();

    // Clean up UDS socket file
    let mut socket_guard = SOCKET_PATH.lock().unwrap();
    if let Some(ref path) = *socket_guard {
        let _ = fs::remove_file(path);
    }
    *socket_guard = None;

    Ok(serde_json::json!({"status": "stopped"}).to_string())
}

/// Check whether the Controller process is alive.
///
/// Attempts a UDS connection to the stored socket path.
/// Returns JSON: `{"alive": true, "pid": 12345, "uptime_sec": 120}`
#[napi]
pub fn controller_health() -> napi::Result<String> {
    let guard = CONTROLLER.lock().unwrap();
    let socket_guard = SOCKET_PATH.lock().unwrap();

    let (alive, pid, uptime_sec) = match (&*guard, &*socket_guard) {
        (Some(h), Some(path)) => {
            let socket_ok = UnixStream::connect(path).is_ok();
            (socket_ok, Some(h.child.id()), h.started_at.elapsed().as_secs())
        }
        (Some(h), None) => {
            // Socket path lost but we still have the handle
            (false, Some(h.child.id()), h.started_at.elapsed().as_secs())
        }
        (None, _) => (false, None, 0),
    };

    to_json(&serde_json::json!({
        "alive": alive,
        "pid": pid,
        "uptime_sec": uptime_sec
    }))
}

// ── PHASE 1 AUXILIARY — Deploy ───────────────────────────────────────────

/// Deploy HMI layout YAML to a running Controller via IPC method 0x17.
///
/// Stub — DEPLOY_HMI_LAYOUT IPC available in Phase 1 follow-up.
#[napi]
pub fn deploy_hmi_layout(
    _socket_path: String,
    _secret: String,
    _yaml: String,
) -> napi::Result<String> {
    stub("deploy_hmi_layout")
}

/// Load a HAL configuration (YAML) to a running Controller via IPC.
///
/// Stub — config manager module deferred.
#[napi]
pub fn load_hal_config(
    _socket_path: String,
    _secret: String,
    _yaml: String,
) -> napi::Result<String> {
    stub("load_hal_config")
}

// ── PHASE 3 — Debug (all stubs) ──────────────────────────────────────────

/// Connect to Controller for a persistent debug session.
#[napi]
pub fn debug_connect(_socket_path: String, _secret: String) -> napi::Result<String> {
    stub("debug_connect")
}

/// Disconnect the persistent debug session.
#[napi]
pub fn debug_disconnect() -> napi::Result<String> {
    stub("debug_disconnect")
}

/// Pause cycle execution on the Controller.
#[napi]
pub fn debug_pause() -> napi::Result<String> {
    stub("debug_pause")
}

/// Resume cycle execution on the Controller.
#[napi]
pub fn debug_resume() -> napi::Result<String> {
    stub("debug_resume")
}

/// Single-step one cycle on the Controller.
#[napi]
pub fn debug_step() -> napi::Result<String> {
    stub("debug_step")
}

/// Read VM register values (r0–r13) from the Controller.
#[napi]
pub fn debug_get_registers() -> napi::Result<String> {
    stub("debug_get_registers")
}

/// Set a breakpoint at the given instruction pointer.
#[napi]
pub fn debug_add_breakpoint(_ip: u32) -> napi::Result<String> {
    stub("debug_add_breakpoint")
}

/// Clear a breakpoint at the given instruction pointer.
#[napi]
pub fn debug_remove_breakpoint(_ip: u32) -> napi::Result<String> {
    stub("debug_remove_breakpoint")
}

/// List all active breakpoints.
#[napi]
pub fn debug_get_breakpoints() -> napi::Result<String> {
    stub("debug_get_breakpoints")
}

/// Get full debug state as a JSON string from the Controller.
#[napi]
pub fn debug_get_state() -> napi::Result<String> {
    stub("debug_get_state")
}

// ── Simulation (stubs) ────────────────────────────────────────────────────

/// Create a new simulation environment.
#[napi]
pub fn sim_create(_cycle_ms: i64) -> napi::Result<String> {
    stub("sim_create")
}

/// Destroy the current simulation environment.
#[napi]
pub fn sim_destroy() -> napi::Result<String> {
    stub("sim_destroy")
}

/// Step one simulation cycle. Returns signal states as JSON.
#[napi]
pub fn sim_step() -> napi::Result<String> {
    stub("sim_step")
}

// ── Project management (stubs) ────────────────────────────────────────────

/// Open a project by reading its .audesys-project.yaml file.
#[napi]
pub fn open_project(_project_path: String) -> napi::Result<String> {
    stub("open_project")
}

/// Read a project source file.
#[napi]
pub fn read_project_file(_file_path: String) -> napi::Result<String> {
    stub("read_project_file")
}

// ── HMI layout (stubs) ────────────────────────────────────────────────────

/// Save HMI layout YAML to a local file.
#[napi]
pub fn save_hmi_layout(_path: String, _yaml: String) -> napi::Result<String> {
    stub("save_hmi_layout")
}

/// Load HMI layout YAML from a local file.
#[napi]
pub fn load_hmi_layout(_path: String) -> napi::Result<String> {
    stub("load_hmi_layout")
}
