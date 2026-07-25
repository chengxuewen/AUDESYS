//! Process monitor — per-child lifecycle state machine.
//!
//! Each `ManagedProcess` wraps a `std::process::Child` with restart tracking.
//! The main loop calls `check()` to detect exits and auto-restart within the
//! retry budget. After `MAX_RETRIES` the process transitions to `Failed`.

use std::process::{Child, Command};

// ── Constants ─────────────────────────────────────────────────────────

/// Maximum automatic restarts before declaring failure.
pub const MAX_RETRIES: u32 = 3;

/// Exponential backoff base: 1s → 2s → 4s for attempts 1, 2, 3.
pub const BACKOFF_BASE_MS: u64 = 1000;

// ── Public types ──────────────────────────────────────────────────────

/// Current lifecycle state of a supervised process.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ProcessState {
    /// Process is running normally (child handle is Some).
    Running,
    /// Process exited and was restarted. `attempt` is 1-based.
    Restarting { attempt: u32, backoff_ms: u64 },
    /// Process has permanently failed — no further restart attempts.
    Failed { reason: String },
}

/// Emitted when a child process changes state (exited, restarted, or failed).
#[derive(Debug, Clone)]
pub struct StatusChange {
    pub name: String,
    pub state: ProcessState,
    pub exit_code: Option<i32>,
    pub restart_count: u32,
}

// ── ManagedProcess ────────────────────────────────────────────────────

/// Wrapper around a child process with restart tracking.
pub struct ManagedProcess {
    /// Logical name assigned at creation.
    pub name: String,
    /// The OS child process handle (None if not yet spawned or exited).
    pub child: Option<Child>,
    /// Program path stored for auto-restart.
    pub program: String,
    /// Arguments stored for auto-restart.
    pub args: Vec<String>,
    /// Number of restarts since last successful spawn.
    pub restart_count: u32,
    /// Exit code of the most recent exit, if known.
    pub exit_code: Option<i32>,
    /// Current lifecycle state.
    pub state: ProcessState,
}

impl ManagedProcess {
    /// Create a new process entry (does NOT spawn).
    pub fn new(name: String, program: String, args: Vec<String>) -> Self {
        Self {
            name,
            child: None,
            program,
            args,
            restart_count: 0,
            exit_code: None,
            state: ProcessState::Running,
        }
    }

    /// Fork+exec the child process. Returns the OS pid.
    pub fn spawn(&mut self) -> Result<u32, String> {
        let child = Command::new(&self.program)
            .args(&self.args)
            .spawn()
            .map_err(|e| format!("spawn {}: {}", self.name, e))?;
        let pid = child.id();
        self.child = Some(child);
        self.state = ProcessState::Running;
        Ok(pid)
    }

    /// Check whether the child has exited.
    ///
    /// Returns `Some(StatusChange)` when a state transition occurs:
    /// - Exited with remaining retries → auto-restart → `Restarting`
    /// - Exited with no retries left → `Failed`
    /// - `try_wait()` error → `Failed`
    ///
    /// Returns `None` if the child is still running.
    pub fn check(&mut self) -> Option<StatusChange> {
        let child = self.child.as_mut()?;

        match child.try_wait() {
            Ok(Some(status)) => {
                let exit_code = status.code();
                self.child = None;
                self.exit_code = exit_code;

                if self.restart_count < MAX_RETRIES {
                    let attempt = self.restart_count + 1;
                    match Command::new(&self.program).args(&self.args).spawn() {
                        Ok(new_child) => {
                            self.child = Some(new_child);
                            self.restart_count = attempt;
                            self.exit_code = None;
                            let backoff_ms =
                                BACKOFF_BASE_MS * (1u64 << (attempt.saturating_sub(1)));
                            self.state = ProcessState::Restarting { attempt, backoff_ms };
                        }
                        Err(e) => {
                            self.state = ProcessState::Failed {
                                reason: format!("restart spawn failed: {}", e),
                            };
                        }
                    }
                } else {
                    self.state = ProcessState::Failed {
                        reason: format!("exceeded max retries ({})", MAX_RETRIES),
                    };
                }

                Some(StatusChange {
                    name: self.name.clone(),
                    state: self.state.clone(),
                    exit_code,
                    restart_count: self.restart_count,
                })
            }
            Ok(None) => None,
            Err(_) => {
                self.child = None;
                self.state = ProcessState::Failed { reason: "try_wait() error".into() };
                Some(StatusChange {
                    name: self.name.clone(),
                    state: self.state.clone(),
                    exit_code: None,
                    restart_count: self.restart_count,
                })
            }
        }
    }

    /// Force-kill the child process (SIGKILL + wait).
    pub fn kill(&mut self) {
        if let Some(ref mut child) = self.child {
            let _ = child.kill();
            let _ = child.wait();
            self.child = None;
        }
    }
}
