//! Basic integration tests for the AUDESYS Supervisor crate.
//!
//! Tests config loading and process lifecycle struct creation.

use audesys_supervisor::config::SupervisorConfig;
use audesys_supervisor::monitor::{ManagedProcess, ProcessState};

// ── Test YAML fixture ──

const TEST_SUPERVISOR_YAML: &str = r#"
children:
  - name: controller
    program: /usr/bin/audesys-controller
    args: ["--socket-path", "/tmp/test.sock"]
  - name: health-monitor
    program: /usr/bin/audesys-health
uds_path: /tmp/audesys-controller.sock
check_interval_ms: 200
shutdown_timeout_ms: 3000
"#;

// ── Tests ──

#[test]
fn test_supervisor_config_load() {
    let dir = std::env::temp_dir().join("audesys-test-supervisor-config");
    let _ = std::fs::create_dir_all(&dir);
    let config_path = dir.join("supervisor.yaml");
    std::fs::write(&config_path, TEST_SUPERVISOR_YAML).expect("write test config");

    let config = SupervisorConfig::load(&config_path).expect("load config");

    assert_eq!(config.children.len(), 2);
    assert_eq!(config.children[0].name, "controller");
    assert_eq!(config.children[0].program, "/usr/bin/audesys-controller");
    assert_eq!(config.children[0].args, vec!["--socket-path", "/tmp/test.sock"]);
    assert_eq!(config.children[1].name, "health-monitor");
    assert_eq!(config.uds_path, "/tmp/audesys-controller.sock");
    assert_eq!(config.check_interval_ms, 200);
    assert_eq!(config.shutdown_timeout_ms, 3000);

    // Cleanup
    let _ = std::fs::remove_file(&config_path);
    let _ = std::fs::remove_dir(&dir);
}

#[test]
fn test_supervisor_singleton() {
    // The Supervisor crate uses ManagedProcess as its core lifecycle struct.
    // Verify it can be created and holds correct initial state.
    let proc = ManagedProcess::new("test-process".into(), "/bin/sleep".into(), vec!["1".into()]);

    assert_eq!(proc.name, "test-process");
    assert_eq!(proc.program, "/bin/sleep");
    assert_eq!(proc.args, vec!["1"]);
    assert_eq!(proc.restart_count, 0);
    assert!(proc.child.is_none());
    assert_eq!(proc.state, ProcessState::Running);
    assert!(proc.exit_code.is_none());
}

#[test]
fn test_managed_process_state_transitions() {
    // Verify initial state and spawn transition — no actual fork, just API shape.
    let mut proc = ManagedProcess::new(
        "transition-test".into(),
        "true".into(), // /bin/true — exits immediately with code 0
        Vec::new(),
    );

    assert_eq!(proc.state, ProcessState::Running);

    // Spawn /bin/true — it runs and exits
    let pid = proc.spawn().expect("spawn true");
    assert!(pid > 0);
    assert_eq!(proc.state, ProcessState::Running);

    // Wait for /bin/true to exit
    std::thread::sleep(std::time::Duration::from_millis(100));

    // Check should detect exit and auto-restart (backoff grows exponentially)
    let change = proc.check().expect("should detect exit");
    assert_eq!(change.name, "transition-test");
    match change.state {
        ProcessState::Restarting { attempt, .. } => assert_eq!(attempt, 1),
        ref s => panic!("expected Restarting, got {:?}", s),
    }
}
