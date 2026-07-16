//! Integration tests: Engine + LifecycleManager child restart cycle.
//!
//! Verifies that the Engine's cycle loop detects dead child processes via
//! lifecycle.health_check() and triggers auto-restart with exponential backoff.
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use audesys_amw_inproc::{
    InprocAuditLog, InprocMiddleware, InprocQoS, InprocTransport, StaticDiscovery,
};
use audesys_controller::lifecycle::ProcessState;
use audesys_controller::{Engine, LifecycleManager};

// ── helpers ──

fn build_inproc_stack() -> (Arc<InprocTransport>, InprocMiddleware) {
    let transport = Arc::new(InprocTransport::new());
    let signal_reg = transport.signal_registry();
    let discovery = Arc::new(StaticDiscovery::new(signal_reg));
    let qos = Arc::new(InprocQoS::new());
    let audit = Arc::new(InprocAuditLog::new());
    let mw = InprocMiddleware::new(Arc::clone(&transport), discovery, qos, audit);
    (transport, mw)
}

// ── tests ──

#[test]
fn test_engine_detects_and_restarts_dead_child() {
    let (_transport, mw) = build_inproc_stack();
    let lifecycle = Arc::new(LifecycleManager::new());
    let engine = Engine::new(Box::new(mw), Arc::clone(&lifecycle));

    // Spawn a child that exits after 100ms with code 1
    lifecycle.spawn("test-child", "sh", &["-c", "sleep 0.1; exit 1"]).unwrap();

    // Start engine with fast cycle (50ms)
    let handle = engine.start_with_cycle(50);
    // Sleep enough for child exit + 2-3 engine cycles
    thread::sleep(Duration::from_millis(500));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    // health_check returns Vec<ChildHealth> — find our child
    let children = lifecycle.health_check();
    let child = children.iter().find(|c| c.name == "test-child").expect("test-child should exist");
    assert!(child.restart_count > 0, "lifecycle should have restarted the child at least once");
    // ponytail: child may be Restarting (backoff) or Running. Either proves engine detected
    // the exit and triggered lifecycle restart.
    assert!(
        matches!(child.state, ProcessState::Running)
            || matches!(child.state, ProcessState::Restarting { .. }),
        "child should be running or restarting, got {:?}",
        child.state
    );
}

#[test]
fn test_child_fails_after_max_retries() {
    let (_transport, mw) = build_inproc_stack();
    let lifecycle = Arc::new(LifecycleManager::new());
    let engine = Engine::new(Box::new(mw), Arc::clone(&lifecycle));

    // Spawn a child that exits immediately with code 42
    lifecycle.spawn("fail-child", "sh", &["-c", "exit 42"]).unwrap();

    // Start engine with fast cycle
    let handle = engine.start_with_cycle(50);
    // Wait for 3 retries × (backoff: 1s → 2s → 4s) + engine cycles ≈ 10s
    thread::sleep(Duration::from_millis(10000));
    engine.stop();
    handle.join().expect("engine thread should join cleanly");

    let children = lifecycle.health_check();
    let child = children.iter().find(|c| c.name == "fail-child").expect("fail-child should exist");
    assert!(
        matches!(child.state, ProcessState::Failed { .. }),
        "child should be Failed after max retries, got {:?}",
        child.state
    );
    // ponytail: MAX_RETRIES=3 in lifecycle.rs; restart_count may be >3 if engine
    // called health_check multiple times within the window. Just verify restart happened.
    assert!(
        child.restart_count >= 3,
        "should have attempted at least 3 restarts, got {}",
        child.restart_count
    );
}
