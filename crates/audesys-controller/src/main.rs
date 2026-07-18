//! AUDESYS Controller — binary entry point.
//!
//! Wires together the InprocMiddleware stack with Engine + HealthServer + IpcServer.
//! Sync-only architecture. CLI args control port/path/cycle-interval.
//!
//! 来源: D19 (sync-only architecture), D17 (Config Barrier), D11 (amw middleware)

use std::sync::{Arc, RwLock};

use audesys_amw_inproc::InprocFactory;
use audesys_controller::{Engine, HealthServer, IpcServer, LifecycleManager, logging};
use audesys_controller::{log_error, log_info, log_warn};
use audesys_hal_core::{AmwConfig, AmwFactory};
use audesys_runtime_common::types::{HealthCheck, HealthCheckRegistry, HealthStatus};

// ── Defaults ──

const DEFAULT_SOCKET_PATH: &str = "/tmp/audesys-controller.sock";
const DEFAULT_HEALTH_PORT: u16 = 9000;
const DEFAULT_CYCLE_INTERVAL_MS: u64 = 1000;

// ── Health check ──

/// Always-healthy health check for the controller /healthz endpoint.
struct AliveCheck;

impl HealthCheck for AliveCheck {
    fn name(&self) -> &str {
        "controller-alive"
    }
    fn check(&self) -> HealthStatus {
        HealthStatus::Healthy
    }
    fn interval_ms(&self) -> u64 {
        1000
    }
}

// ── Main ──

fn main() {
    logging::init();
    // Parse CLI args
    let args: Vec<String> = std::env::args().collect();
    let mut cycle_interval_ms: u64 = DEFAULT_CYCLE_INTERVAL_MS;
    let mut health_port: u16 = DEFAULT_HEALTH_PORT;
    let mut socket_path = String::from(DEFAULT_SOCKET_PATH);

    let mut i = 1;
    while i < args.len() {
        match args[i].as_str() {
            "--cycle-interval" => {
                i += 1;
                if i < args.len() {
                    cycle_interval_ms = args[i].parse().unwrap_or(DEFAULT_CYCLE_INTERVAL_MS);
                }
            }
            "--health-port" => {
                i += 1;
                if i < args.len() {
                    health_port = args[i].parse().unwrap_or(DEFAULT_HEALTH_PORT);
                }
            }
            "--socket-path" => {
                i += 1;
                if i < args.len() {
                    socket_path = args[i].clone();
                }
            }
            _ => {}
        }
        i += 1;
    }

    // ── Create middleware stack ──
    let factory = InprocFactory;
    let mw = match factory.create(AmwConfig::default()) {
        Ok(mw) => mw,
        Err(e) => {
            log_error!("main", "Failed to create middleware", "error" => e);
            eprintln!("Failed to create middleware: {}", e);
            std::process::exit(1);
        }
    };

    // ── Lifecycle ──
    let lifecycle = Arc::new(LifecycleManager::new());

    // ── Engine ──
    let engine = Arc::new(Engine::new(Box::new(mw), Arc::clone(&lifecycle)));
    engine.register_health_check(Box::new(AliveCheck));

    // ── Health server ──
    let health_registry = Arc::new(RwLock::new(HealthCheckRegistry::new()));
    health_registry
        .write()
        .expect("health_registry RwLock poisoned")
        .register(Box::new(AliveCheck));
    let health_server = HealthServer::with_metrics(Arc::clone(&health_registry), engine.metrics());

    // ── IPC server ──
    let ipc_server = IpcServer::new(&socket_path, Arc::clone(&engine));

    // ── Start services: engine → health → ipc ──
    let engine_handle = engine.start_with_cycle(cycle_interval_ms);

    let health_handle = match health_server.start(health_port) {
        Ok(h) => h,
        Err(e) => {
            log_error!("main", "Failed to start health server", "error" => e);
            engine.stop();
            let _ = engine_handle.join();
            std::process::exit(1);
        }
    };

    let ipc_handle = match ipc_server.start() {
        Ok(h) => h,
        Err(e) => {
            log_error!("main", "Failed to start IPC server", "error" => e);
            health_server.stop();
            let _ = health_handle.join();
            engine.stop();
            let _ = engine_handle.join();
            std::process::exit(1);
        }
    };

    log_info!("main", "AUDESYS Controller started", "health_port" => health_port, "socket" => socket_path, "cycle_ms" => cycle_interval_ms);
    // ── Wait for shutdown signal ──
    let mut line = String::new();
    let _ = std::io::stdin().read_line(&mut line);

    // ── Graceful shutdown: ipc → health → engine → lifecycle ──
    log_info!("main", "Shutting down");

    ipc_server.stop();
    let _ = ipc_handle.join();

    health_server.stop();
    let _ = health_handle.join();

    engine.stop();
    let _ = engine_handle.join();

    let failed = lifecycle.shutdown_all(5000);
    if !failed.is_empty() {
        log_warn!("main", "Child processes did not shut down cleanly", "failed" => format!("{:?}", failed));
    }
}
