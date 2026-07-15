//! InprocQoS — in-process Quality of Service and Config Barrier (Phase 1 M0.4).
//! 来源: docs/modules/hal/industrial-qos-design.md, docs/modules/hal/config-barrier-design.md
//!
//! Phase 1: LockLevel + Config Barrier logic (no RT deadline enforcement).

use std::collections::HashMap;
use std::sync::Mutex;
use std::sync::atomic::{AtomicU8, Ordering};

use audesys_hal_core::{
    ConfigCommand, ConfigStatus, HalQoS, HalResult, LivelinessStatus, LockLevel,
};

/// Return the minimum LockLevel required for a config command method.
///
/// Commands that load/unload components require Load (1).
/// Commands that configure/link/function require Config (2).
/// Commands that set parameters require Params (3).
/// Unknown commands default to Config (2).
fn required_lock_level(method: &str) -> LockLevel {
    let lower = method.to_lowercase();
    if lower.contains("load") || lower.contains("unload") || lower.contains("component") {
        LockLevel::Load
    } else if lower.contains("param") {
        LockLevel::Params
    } else {
        // config, link, function, and unknown commands → Config
        LockLevel::Config
    }
}

/// Check whether a command at `required` level can be queued when the system is at `current`.
fn can_queue(current: LockLevel, required: LockLevel) -> bool {
    match current {
        LockLevel::None | LockLevel::Load => true,
        LockLevel::Config => required >= LockLevel::Config,
        LockLevel::Params => required >= LockLevel::Params,
        LockLevel::Run | LockLevel::All => false,
    }
}

/// In-process QoS controller.
///
/// LockLevel is stored as `AtomicU8` for fast read-only access from the RT path.
/// Config commands are queued in a `Mutex<Vec<ConfigCommand>>` and applied at
/// the next Config Barrier boundary.
pub struct InprocQoS {
    lock_level: AtomicU8,
    config_queue: Mutex<Vec<ConfigCommand>>,
    liveliness: Mutex<HashMap<String, LivelinessStatus>>,
    security_domains: Mutex<HashMap<String, String>>,
}

impl InprocQoS {
    pub fn new() -> Self {
        Self {
            lock_level: AtomicU8::new(LockLevel::None as u8),
            config_queue: Mutex::new(Vec::new()),
            liveliness: Mutex::new(HashMap::new()),
            security_domains: Mutex::new(HashMap::new()),
        }
    }

    fn load_level(&self) -> LockLevel {
        let raw = self.lock_level.load(Ordering::Relaxed);
        match raw {
            0 => LockLevel::None,
            1 => LockLevel::Load,
            2 => LockLevel::Config,
            3 => LockLevel::Params,
            4 => LockLevel::Run,
            5 => LockLevel::All,
            _ => LockLevel::All, // ponytail: clamp invalid values
        }
    }
}

impl Default for InprocQoS {
    fn default() -> Self {
        Self::new()
    }
}

impl HalQoS for InprocQoS {
    fn lock_level(&self) -> LockLevel {
        self.load_level()
    }

    fn set_lock_level(&self, level: LockLevel) -> HalResult<ConfigStatus> {
        let current = self.load_level();
        if level < current {
            return Ok(ConfigStatus::Rejected {
                reason: format!(
                    "Cannot decrease lock level: {:?} → {:?} (monotonic-increasing constraint)",
                    current, level
                ),
            });
        }
        self.lock_level.store(level as u8, Ordering::Relaxed);
        Ok(ConfigStatus::Applied)
    }

    fn queue_config(&self, cmd: ConfigCommand) -> HalResult<ConfigStatus> {
        let current = self.load_level();
        let required = required_lock_level(&cmd.method);

        if !can_queue(current, required) {
            return Ok(ConfigStatus::Rejected {
                reason: format!(
                    "LockLevel {:?} prohibits command {:?} (requires {:?})",
                    current, cmd.method, required
                ),
            });
        }

        let mut queue = self.config_queue.lock().unwrap();
        queue.push(cmd);
        Ok(ConfigStatus::Queued)
    }

    fn apply_queued(&self) -> HalResult<Vec<ConfigStatus>> {
        let mut queue = self.config_queue.lock().unwrap();
        let cmds: Vec<ConfigCommand> = queue.drain(..).collect();
        // Phase 1: all queued commands are considered applied.
        // Phase 2+: real config barrier applies commands onto running components.
        let statuses: Vec<ConfigStatus> =
            cmds.into_iter().map(|_cmd| ConfigStatus::Applied).collect();
        Ok(statuses)
    }

    fn register_entity(&self, entity_id: &str) -> HalResult<()> {
        let mut map = self.liveliness.lock().unwrap();
        map.insert(entity_id.to_string(), LivelinessStatus::Alive);
        Ok(())
    }

    fn check_liveliness(&self, entity_id: &str) -> HalResult<LivelinessStatus> {
        let map = self.liveliness.lock().unwrap();
        Ok(map.get(entity_id).copied().unwrap_or(LivelinessStatus::Unknown))
    }

    fn tag_security_domain(&self, name: &str, domain: &str) -> HalResult<()> {
        let mut map = self.security_domains.lock().unwrap();
        map.insert(name.to_string(), domain.to_string());
        Ok(())
    }

    fn get_security_domain(&self, name: &str) -> HalResult<Option<String>> {
        let map = self.security_domains.lock().unwrap();
        Ok(map.get(name).cloned())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_level_default_none() {
        let q = InprocQoS::new();
        assert_eq!(q.lock_level(), LockLevel::None);
    }

    #[test]
    fn set_lock_level_monotonic_increasing() {
        let q = InprocQoS::new();
        assert!(matches!(q.set_lock_level(LockLevel::Load).unwrap(), ConfigStatus::Applied));
        assert_eq!(q.lock_level(), LockLevel::Load);

        // Going up is OK
        assert!(matches!(q.set_lock_level(LockLevel::Config).unwrap(), ConfigStatus::Applied));

        // Going down is rejected
        let result = q.set_lock_level(LockLevel::Load).unwrap();
        assert!(matches!(result, ConfigStatus::Rejected { .. }));
        assert_eq!(q.lock_level(), LockLevel::Config);
    }

    #[test]
    fn queue_config_at_load_allows_all() {
        let q = InprocQoS::new();
        q.set_lock_level(LockLevel::Load).unwrap();

        let cmd = ConfigCommand {
            id: 1,
            method: "loadComponent".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        };
        assert!(matches!(q.queue_config(cmd).unwrap(), ConfigStatus::Queued));
    }

    #[test]
    fn queue_config_at_run_rejects_all() {
        let q = InprocQoS::new();
        q.set_lock_level(LockLevel::Run).unwrap();

        let cmd = ConfigCommand {
            id: 1,
            method: "configureComponent".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        };
        let status = q.queue_config(cmd).unwrap();
        assert!(matches!(status, ConfigStatus::Rejected { .. }));
    }

    #[test]
    fn queue_config_at_params_allows_only_params() {
        let q = InprocQoS::new();
        q.set_lock_level(LockLevel::Params).unwrap();

        let param_cmd = ConfigCommand {
            id: 1,
            method: "setParam".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        };
        assert!(matches!(q.queue_config(param_cmd).unwrap(), ConfigStatus::Queued));

        let config_cmd = ConfigCommand {
            id: 2,
            method: "configureComponent".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        };
        assert!(matches!(q.queue_config(config_cmd).unwrap(), ConfigStatus::Rejected { .. }));
    }

    #[test]
    fn apply_queued_drains_all() {
        let q = InprocQoS::new();
        q.queue_config(ConfigCommand {
            id: 1,
            method: "test".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        })
        .unwrap();
        q.queue_config(ConfigCommand {
            id: 2,
            method: "test2".into(),
            params: vec![],
            queued_at: std::time::Instant::now(),
        })
        .unwrap();

        let statuses = q.apply_queued().unwrap();
        assert_eq!(statuses.len(), 2);
        assert!(matches!(statuses[0], ConfigStatus::Applied));

        // Second apply should be empty
        let statuses2 = q.apply_queued().unwrap();
        assert!(statuses2.is_empty());
    }

    #[test]
    fn liveliness_register_and_check() {
        let q = InprocQoS::new();
        q.register_entity("device_1").unwrap();
        assert_eq!(q.check_liveliness("device_1").unwrap(), LivelinessStatus::Alive);
        assert_eq!(q.check_liveliness("unknown").unwrap(), LivelinessStatus::Unknown);
    }

    #[test]
    fn security_domain_tag_and_get() {
        let q = InprocQoS::new();
        q.tag_security_domain("motor.speed", "l1.control.reactor_a").unwrap();
        assert_eq!(
            q.get_security_domain("motor.speed").unwrap(),
            Some("l1.control.reactor_a".into())
        );
        assert_eq!(q.get_security_domain("no.such").unwrap(), None);
    }
}
