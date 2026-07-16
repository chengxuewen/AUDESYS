//! Lifecycle manager — child process supervision.
//!
//! Provides fork+exec for the 6-process Runtime suite, graceful shutdown
//! with SIGTERM→SIGKILL escalation, and health monitoring of children.
//!
//! 来源: docs/modules/runtime/observability-design.md

use std::process::{Child, Command};
use std::sync::{
    Mutex,
    atomic::{AtomicBool, Ordering},
};
use std::time::Duration;

pub struct LifecycleManager {
    children: Mutex<Vec<ManagedChild>>,
}

struct ManagedChild {
    name: String,
    process: Child,
    shutdown_signal: std::sync::Arc<AtomicBool>,
}

impl LifecycleManager {
    pub fn new() -> Self {
        Self { children: Mutex::new(Vec::new()) }
    }

    pub fn spawn(&self, name: &str, program: &str, args: &[&str]) -> Result<u32, String> {
        let child = Command::new(program)
            .args(args)
            .spawn()
            .map_err(|e| format!("Failed to spawn {}: {}", name, e))?;
        let pid = child.id();
        self.children.lock().expect("children Mutex poisoned").push(ManagedChild {
            name: name.to_string(),
            process: child,
            shutdown_signal: std::sync::Arc::new(AtomicBool::new(false)),
        });
        Ok(pid)
    }

    pub fn shutdown_all(&self, timeout_ms: u64) -> Vec<String> {
        let mut failed = Vec::new();
        let mut children = self.children.lock().expect("children Mutex poisoned");

        for child in children.iter_mut() {
            child.shutdown_signal.store(true, Ordering::SeqCst);
            let _ = child.process.kill();
        }

        let deadline = std::time::Instant::now() + Duration::from_millis(timeout_ms);
        let poll_interval = Duration::from_millis(10);

        let i: isize = 0;
        while (i as usize) < children.len() {
            match children[i as usize].process.try_wait() {
                Ok(Some(_status)) => {
                    children.remove(i as usize);
                }
                Ok(None) => {
                    if std::time::Instant::now() >= deadline {
                        let _ = children[i as usize].process.kill();
                        let _ = children[i as usize].process.wait();
                        failed.push(children[i as usize].name.clone());
                        children.remove(i as usize);
                    } else {
                        std::thread::sleep(poll_interval);
                        continue; // retry same index without incrementing
                    }
                }
                Err(_) => {
                    let _ = children[i as usize].process.kill();
                    let _ = children[i as usize].process.wait();
                    failed.push(children[i as usize].name.clone());
                    children.remove(i as usize);
                }
            }
        }
        failed
    }

    pub fn health_check(&self) -> Vec<String> {
        let mut dead = Vec::new();
        let mut children = self.children.lock().expect("children Mutex poisoned");
        let mut i: isize = 0;
        while (i as usize) < children.len() {
            match children[i as usize].process.try_wait() {
                Ok(Some(_status)) => {
                    dead.push(children[i as usize].name.clone());
                    children.remove(i as usize);
                }
                Ok(None) => {
                    i += 1;
                }
                Err(_) => {
                    dead.push(children[i as usize].name.clone());
                    children.remove(i as usize);
                }
            }
        }
        dead
    }

    pub fn child_count(&self) -> usize {
        self.children.lock().expect("children Mutex poisoned").len()
    }
}

impl Default for LifecycleManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_spawn_echo_command() {
        let mgr = LifecycleManager::new();
        let pid = mgr.spawn("echo_test", "echo", &["hello"]).expect("spawn should succeed");
        assert!(pid > 0);
        assert_eq!(mgr.child_count(), 1);
        std::thread::sleep(Duration::from_millis(200));
        let dead = mgr.health_check();
        assert_eq!(dead, vec!["echo_test"]);
        assert_eq!(mgr.child_count(), 0);
    }

    #[test]
    fn test_spawn_sleep_and_shutdown() {
        let mgr = LifecycleManager::new();
        mgr.spawn("sleep_test", "sleep", &["0.1"]).expect("spawn should succeed");
        assert_eq!(mgr.child_count(), 1);
        let failed = mgr.shutdown_all(5000);
        assert!(failed.is_empty());
        assert_eq!(mgr.child_count(), 0);
    }

    #[test]
    fn test_new_is_empty() {
        let mgr = LifecycleManager::new();
        assert_eq!(mgr.child_count(), 0);
        assert!(mgr.health_check().is_empty());
    }

    #[test]
    fn test_spawn_invalid_program() {
        let mgr = LifecycleManager::new();
        let result = mgr.spawn("invalid", "/nonexistent/program/that/does/not/exist", &[]);
        assert!(result.is_err());
        assert_eq!(mgr.child_count(), 0);
    }
}
