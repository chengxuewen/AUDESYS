//! AUDESYS Studio — Tauri backend commands.
//!
//! Provides commands for:
//! - `compile_st`: IEC 61131-3 ST → HAL IR compilation
//! - `run_program`: Execute compiled program on register VM
//! - `deploy_program`: Deploy ST program to running Controller
//! - `load_hal_config`: Load HAL config to running Controller
//! - `read_controller_signal`: Read signal from running Controller
//! - `connect_controller` / `disconnect_controller`: Persistent debug connection
//! - `controller_pause` / `controller_resume` / `controller_step`: Execution control
//! - `controller_add_breakpoint` / `controller_remove_breakpoint` / `controller_get_breakpoints`: Breakpoint CRUD
//! - `controller_get_registers` / `controller_get_debug_state`: Debug inspection
use audesys_controller_client::ControllerClient;
use audesys_gcode_compiler::gcode_compile;
use audesys_hal_binding_gen::compile;
use audesys_il_compiler::il_compile;
use audesys_ld_compiler::ld_compile;
use audesys_runtime_common::types::Role;
use serde::Serialize;
use std::sync::Mutex;
use audesys_controller::SimulationHarness;
use audesys_hal_core::value::HalValue;
use audesys_hal_ir::Executor;
use audesys_hal_ir::program::HalProgram;
pub mod project;
use crate::project::{ProjectConfig, ProjectInfo};
/// Signal state returned to the frontend after execution.
#[derive(Serialize)]
struct SignalState {
    name: String,
    value: serde_json::Value,
    pin_type: String,
}

/// Shared controller client state for the debug panel.
struct ControllerState {
    client: Mutex<Option<ControllerClient>>,
}

/// Shared simulator state for offline simulation panel.
struct SimState {
    harness: Mutex<Option<SimulationHarness>>,
}

/// Compile an IEC 61131-3 Structured Text source into a HAL IR program (JSON).
#[tauri::command]
fn compile_st(source: String) -> Result<String, String> {
    let program = compile(&source).map_err(|e| e.to_string())?;
    serde_json::to_string(&program).map_err(|e| e.to_string())
}

/// Compile an IEC 61131-3 IL (Instruction List) source into HAL IR.
#[tauri::command]
fn compile_il(source: String) -> Result<String, String> {
    let program = il_compile(&source).map_err(|e| e.to_string())?;
    serde_json::to_string(&program).map_err(|e| e.to_string())
}

/// Compile an IEC 61131-3 LD (Ladder Diagram) source into HAL IR (via IL).
#[tauri::command]
fn compile_ld(source: String) -> Result<String, String> {
    let il = ld_compile(&source).map_err(|e| e.to_string())?;
    let program = il_compile(&il).map_err(|e| e.to_string())?;
    serde_json::to_string(&program).map_err(|e| e.to_string())
}

/// Compile G-code (RS274/NGC) source into a HAL IR program (JSON).
#[tauri::command]
fn compile_gcode(source: String) -> Result<String, String> {
    let program = gcode_compile(&source).map_err(|e| e.to_string())?;
    serde_json::to_string(&program).map_err(|e| e.to_string())
}

/// Run a compiled HalProgram on the register VM and return signal states.
///
/// `cycle_ms` is reserved for Phase 2 (multi-cycle execution); currently ignored.
#[tauri::command]
fn run_program(program_json: String, _cycle_ms: u64) -> Result<String, String> {
    let program: HalProgram =
        serde_json::from_str(&program_json).map_err(|e| format!("deserialize: {e}"))?;

    // Clone signal bindings before Executor takes ownership of the program.
    let signal_bindings = program.signals.clone();
    let mut executor = Executor::new(program);
    executor.run_to_halt();

    // ponytail: cycle_ms ignored in Phase 1, single run-to-halt
    let signals: Vec<SignalState> = signal_bindings
        .iter()
        .map(|s| {
            let value = executor
                .vm()
                .read_signal(&s.hal_signal_name)
                .map(|v| serde_json::to_value(v).unwrap_or(serde_json::Value::Null))
                .unwrap_or(serde_json::Value::Null);
            SignalState {
                name: s.hal_signal_name.clone(),
                value,
                pin_type: format!("{:?}", s.hal_pin_type),
            }
        })
        .collect();

    serde_json::to_string(&signals).map_err(|e| e.to_string())
}

/// Deploy a compiled ST program to a running Controller via IPC.
#[tauri::command]
fn deploy_program(socket_path: String, secret: String, program_bytes: Vec<u8>) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::Engineer)
        .map_err(|e| format!("auth: {e}"))?;
    client.load_program(&program_bytes)
        .map_err(|e| format!("deploy: {e}"))
}

/// Load a HAL config (YAML) to a running Controller via IPC.
#[tauri::command]
fn load_hal_config(socket_path: String, secret: String, yaml_bytes: Vec<u8>) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::Engineer)
        .map_err(|e| format!("auth: {e}"))?;
    client.load_hal_config(&yaml_bytes)
        .map_err(|e| format!("config: {e}"))
}

/// Read a signal value from a running Controller via IPC (one-shot connection).
#[tauri::command]
fn read_controller_signal(socket_path: String, secret: String, signal_name: String) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client.authenticate(Role::Operator)
        .map_err(|e| format!("auth: {e}"))?;
    let value = client.read_signal(&signal_name)
        .map_err(|e| format!("read: {e}"))?;
    serde_json::to_string(&value).map_err(|e| e.to_string())
}

/// Read a signal value from the persistent Controller connection (debug panel).
/// Returns the raw HalValue Debug-format string.
#[tauri::command]
fn controller_read_signal(
    state: tauri::State<'_, ControllerState>,
    signal_name: String,
) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    let client = guard.as_mut().ok_or("not connected")?;
    let value = client.read_signal(&signal_name).map_err(|e| format!("read: {e}"))?;
    Ok(format!("{value:?}"))
}

/// Connect to a running Controller and authenticate as Engineer.
#[tauri::command]
fn connect_controller(
    state: tauri::State<'_, ControllerState>,
    socket_path: String,
    secret: String,
) -> Result<String, String> {
    let mut client = ControllerClient::connect(&socket_path, secret.as_bytes())
        .map_err(|e| format!("connect: {e}"))?;
    client
        .authenticate(Role::Engineer)
        .map_err(|e| format!("auth: {e}"))?;
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    *guard = Some(client);
    Ok("connected".into())
}

/// Disconnect from the Controller (drops the client).
#[tauri::command]
fn disconnect_controller(state: tauri::State<'_, ControllerState>) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    *guard = None;
    Ok("disconnected".into())
}

/// Pause cycle execution on the Controller.
#[tauri::command]
fn controller_pause(state: tauri::State<'_, ControllerState>) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.pause()
}

/// Resume cycle execution on the Controller.
#[tauri::command]
fn controller_resume(state: tauri::State<'_, ControllerState>) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.resume()
}

/// Single-step one cycle on the Controller.
#[tauri::command]
fn controller_step(state: tauri::State<'_, ControllerState>) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.step_cycle()
}

/// Set a breakpoint at the given instruction pointer.
#[tauri::command]
fn controller_add_breakpoint(
    state: tauri::State<'_, ControllerState>,
    ip: u32,
) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.set_breakpoint(ip)
}

/// Clear a breakpoint at the given instruction pointer.
#[tauri::command]
fn controller_remove_breakpoint(
    state: tauri::State<'_, ControllerState>,
    ip: u32,
) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.clear_breakpoint(ip)
}

/// List all active breakpoints (comma-separated IP addresses).
#[tauri::command]
fn controller_get_breakpoints(
    state: tauri::State<'_, ControllerState>,
) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.list_breakpoints()
}

/// Read VM register values (r0–r13). Returns Vec of (name, value) pairs.
#[tauri::command]
fn controller_get_registers(
    state: tauri::State<'_, ControllerState>,
) -> Result<Vec<(String, String)>, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    let client = guard.as_mut().ok_or("not connected")?;
    let names = ["r0", "r1", "r2", "r3", "r4", "r5", "r6", "r7", "r8", "r9", "r10", "r11", "r12", "r13"];
    let mut regs = Vec::new();
    for (i, name) in names.iter().enumerate() {
        let val = client.read_register(i as u8).unwrap_or_else(|_| "?".into());
        // Strip "rN=" prefix if present, keep just the value.
        let v = val.splitn(2, '=').nth(1).unwrap_or(&val).to_string();
        regs.push((name.to_string(), v));
    }
    Ok(regs)
}

/// Get full debug state as a JSON string from the Controller.
#[tauri::command]
fn controller_get_debug_state(
    state: tauri::State<'_, ControllerState>,
) -> Result<String, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    guard.as_mut().ok_or("not connected")?.debug_state()
}

/// Fetch Prometheus metrics from the Controller's HTTP /metrics endpoint.
#[tauri::command]
fn fetch_controller_metrics(health_port: String) -> Result<String, String> {
    use std::io::{Read, Write};
    let addr = format!("127.0.0.1:{health_port}");
    let mut stream = std::net::TcpStream::connect(&addr).map_err(|e| format!("connect: {e}"))?;
    let request = "GET /metrics HTTP/1.0\r\nHost: localhost\r\n\r\n";
    stream.write_all(request.as_bytes()).map_err(|e| format!("write: {e}"))?;
    let mut response = String::new();
    stream.read_to_string(&mut response).map_err(|e| format!("read: {e}"))?;
    Ok(response.split("\r\n\r\n").nth(1).unwrap_or("").to_string())
}

/// Snapshot all signals from the Controller. Returns Vec of (name, value) pairs.
#[tauri::command]
fn controller_signal_snapshot(
    state: tauri::State<'_, ControllerState>,
    pattern: String,
) -> Result<Vec<(String, String)>, String> {
    let mut guard = state.client.lock().map_err(|e| format!("lock: {e}"))?;
    let client = guard.as_mut().ok_or("not connected")?;
    let signals = client.signal_snapshot(&pattern).map_err(|e| format!("snapshot: {e}"))?;
    Ok(signals.into_iter().map(|(name, val)| (name, format!("{val:?}"))).collect())
}
#[cfg_attr(mobile, tauri::mobile_entry_point)]

/// Open a project by reading its .audesys-project.yaml file.
#[tauri::command]
fn open_project(project_path: String) -> Result<ProjectInfo, String> {
    let config = ProjectConfig::from_file(&project_path)?;
    Ok(config.info(&project_path))
}

/// Create a new engineering project with a default entry file.
#[tauri::command]
fn create_project(name: String, dir: String) -> Result<String, String> {
    use std::fs;
    fs::create_dir_all(&dir).map_err(|e| format!("mkdir: {e}"))?;
    let config = ProjectConfig::Engineering(crate::project::EngineeringProject {
        name: name.clone(),
        version: "0.1.0".into(),
        target: None,
        source: crate::project::SourceConfig {
            entry: "src/main.st".into(),
            files: vec![],
        },
    });
    let project_file = format!("{dir}/{name}.audesys-project.yaml");
    // Create src dir and default entry file
    let src_dir = format!("{dir}/src");
    fs::create_dir_all(&src_dir).map_err(|e| format!("mkdir src: {e}"))?;
    fs::write(format!("{src_dir}/main.st"), "PROGRAM main\nEND_PROGRAM").map_err(|e| format!("write: {e}"))?;
    config.to_file(&project_file)?;
    Ok(project_file)
}

/// Create a new simulation environment with the given cycle interval (ms).
#[tauri::command]
fn sim_create(state: tauri::State<'_, SimState>, cycle_ms: u64) -> Result<String, String> {
    let mut guard = state.harness.lock().map_err(|e| format!("lock: {e}"))?;
    *guard = Some(SimulationHarness::new(cycle_ms));
    Ok("created".into())
}

/// Destroy the current simulation environment.
#[tauri::command]
fn sim_destroy(state: tauri::State<'_, SimState>) -> Result<String, String> {
    let mut guard = state.harness.lock().map_err(|e| format!("lock: {e}"))?;
    *guard = None;
    Ok("destroyed".into())
}

/// Inject a signal value into the simulation.
/// `value_str` uses HalValue Debug format: "Bool(true)", "U32(42)", "F32(3.14)".
#[tauri::command]
fn sim_set_signal(state: tauri::State<'_, SimState>, name: String, value_str: String) -> Result<String, String> {
    let guard = state.harness.lock().map_err(|e| format!("lock: {e}"))?;
    let sim = guard.as_ref().ok_or("no simulation")?;
    let value = parse_hal_value_str(&value_str).ok_or_else(|| format!("invalid value: {value_str}"))?;
    sim.set_signal(&name, value);
    Ok("ok".into())
}

/// Get all signal states as a JSON array.
#[tauri::command]
fn sim_get_signals(state: tauri::State<'_, SimState>) -> Result<String, String> {
    let guard = state.harness.lock().map_err(|e| format!("lock: {e}"))?;
    let sim = guard.as_ref().ok_or("no simulation")?;
    let snapshot = sim.signal_snapshot();
    serde_json::to_string(&snapshot).map_err(|e| e.to_string())
}

/// Step exactly one simulation cycle.
#[tauri::command]
fn sim_step(state: tauri::State<'_, SimState>) -> Result<String, String> {
    let guard = state.harness.lock().map_err(|e| format!("lock: {e}"))?;
    let sim = guard.as_ref().ok_or("no simulation")?;
    sim.step_cycle();
    Ok("stepped".into())
}

/// Run N simulation cycles (blocks until complete).
#[tauri::command]
fn sim_run(state: tauri::State<'_, SimState>, cycles: u64) -> Result<String, String> {
    let mut guard = state.harness.lock().map_err(|e| format!("lock: {e}"))?;
    let sim = guard.as_mut().ok_or("no simulation")?;
    sim.run_cycles(cycles);
    Ok("done".into())
}

/// Parse a HalValue from Debug format string (e.g., "Bool(true)", "U32(42)", "F32(3.14)").
fn parse_hal_value_str(s: &str) -> Option<HalValue> {
    let s = s.trim();
    if let Some(inner) = s.strip_prefix("Bool(").and_then(|r| r.strip_suffix(')')) {
        return Some(HalValue::Bool(inner == "true"));
    }
    if let Some(inner) = s.strip_prefix("U32(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::U32);
    }
    if let Some(inner) = s.strip_prefix("S32(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::S32);
    }
    if let Some(inner) = s.strip_prefix("F32(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::F32);
    }
    if let Some(inner) = s.strip_prefix("F64(").and_then(|r| r.strip_suffix(')')) {
        return inner.parse().ok().map(HalValue::F64);
    }
    None
}
/// List .st files in the project source directory.
#[tauri::command]
fn list_project_files(project_path: String) -> Result<Vec<String>, String> {
    use std::fs;
    let base = std::path::Path::new(&project_path).parent().unwrap_or(std::path::Path::new("."));
    let src_dir = base.join("src");
    let mut files = Vec::new();
    if src_dir.exists() {
        for entry in fs::read_dir(&src_dir).map_err(|e| format!("read_dir: {e}"))? {
            let entry = entry.map_err(|e| format!("entry: {e}"))?;
            if entry.file_type().map(|t| t.is_file()).unwrap_or(false) {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.ends_with(".st") {
                    files.push(entry.path().to_string_lossy().to_string());
                }
            }
        }
    }
    Ok(files)
}
/// Save HMI layout YAML to a file.
#[tauri::command]
fn save_hmi_layout(path: String, yaml: String) -> Result<String, String> {
    std::fs::write(&path, &yaml).map_err(|e| format!("write: {e}"))?;
    Ok("saved".into())
}

/// Load HMI layout YAML from a file.
#[tauri::command]
fn load_hmi_layout(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("read: {e}"))
}


/// Read a project source file.
#[tauri::command]
fn read_project_file(file_path: String) -> Result<String, String> {
    std::fs::read_to_string(&file_path).map_err(|e| format!("read: {e}"))
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(ControllerState {
            client: Mutex::new(None),
        })
        .manage(SimState {
            harness: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            compile_st,
            compile_il,
            compile_ld,
            compile_gcode,
            run_program,
            deploy_program,
            load_hal_config,
            read_controller_signal,
            connect_controller,
            disconnect_controller,
            controller_pause,
            controller_resume,
            controller_step,
            controller_add_breakpoint,
            controller_remove_breakpoint,
            controller_get_breakpoints,
            controller_get_registers,
            controller_get_debug_state,
            controller_signal_snapshot,
            controller_read_signal,
            fetch_controller_metrics,
            open_project,
            create_project,
            list_project_files,
            read_project_file,
            sim_create,
            sim_destroy,
            sim_set_signal,
            sim_get_signals,
            sim_step,
            sim_run,
            save_hmi_layout,
            load_hmi_layout,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
