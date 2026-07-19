//! Axis group configuration types.
//! 来源: docs/modules/cnc/axis-group-management.md

/// Axis type discriminator.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum AxisType {
    Linear,
    Rotary,
}

/// Home direction for homing sequence.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum HomeDirection {
    Positive,
    Negative,
}

impl HomeDirection {
    /// Return +1 for Positive, -1 for Negative.
    pub fn multiplier(&self) -> f64 {
        match self {
            HomeDirection::Positive => 1.0,
            HomeDirection::Negative => -1.0,
        }
    }
}

/// Coordinated plane for CNC operations.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Plane {
    G17, // XY
    G18, // ZX
    G19, // YZ
}

/// Per-axis configuration.
#[derive(Debug, Clone, PartialEq)]
pub struct AxisConfig {
    /// Axis index (0-based, within group).
    pub index: u8,
    /// Human-readable label (e.g., "X").
    pub label: String,
    /// Axis type.
    pub axis_type: AxisType,
    /// Soft limit: minimum position (mm or degrees).
    pub soft_limit_min: f64,
    /// Soft limit: maximum position (mm or degrees).
    pub soft_limit_max: f64,
    /// Whether soft limits are active.
    pub soft_limit_enable: bool,
    /// Backlash compensation distance (mm or degrees).
    pub backlash_distance: f64,
    /// Whether backlash compensation is active.
    pub backlash_enable: bool,
    /// Velocity during the SEEK phase of homing (mm/s or deg/s).
    pub home_search_vel: f64,
    /// Velocity during the LATCH phase of homing (mm/s or deg/s).
    pub home_latch_vel: f64,
    /// Backoff distance after latch is detected.
    pub home_backoff_dist: f64,
    /// Offset from home switch to axis zero.
    pub home_offset: f64,
    /// Maximum travel distance during SEEK phase.
    pub home_max_dist: f64,
    /// Maximum travel distance during LATCH phase.
    pub home_latch_max_dist: f64,
    /// Direction to search for home switch.
    pub home_direction: HomeDirection,
}

impl Default for AxisConfig {
    fn default() -> Self {
        AxisConfig {
            index: 0,
            label: String::new(),
            axis_type: AxisType::Linear,
            soft_limit_min: 0.0,
            soft_limit_max: 1000.0,
            soft_limit_enable: true,
            backlash_distance: 0.0,
            backlash_enable: false,
            home_search_vel: 50.0,
            home_latch_vel: 5.0,
            home_backoff_dist: 2.0,
            home_offset: 0.0,
            home_max_dist: 2000.0,
            home_latch_max_dist: 50.0,
            home_direction: HomeDirection::Negative,
        }
    }
}

impl AxisConfig {
    /// Create a linear axis with the given index and label.
    pub fn linear(index: u8, label: impl Into<String>) -> Self {
        AxisConfig {
            index,
            label: label.into(),
            axis_type: AxisType::Linear,
            ..Default::default()
        }
    }

    /// Create a rotary axis with the given index and label.
    pub fn rotary(index: u8, label: impl Into<String>) -> Self {
        AxisConfig {
            index,
            label: label.into(),
            axis_type: AxisType::Rotary,
            ..Default::default()
        }
    }
}

/// Configuration for an axis group.
#[derive(Debug, Clone, PartialEq)]
pub struct AxisGroupConfig {
    /// Group name (e.g., "group.0").
    pub name: String,
    /// Human-readable label.
    pub label: String,
    /// Axes in this group.
    pub axes: Vec<AxisConfig>,
    /// Kinematics type (Phase 1: "trivial" only).
    pub kinematics: String,
    /// Default working plane.
    pub default_plane: Plane,
}

impl AxisGroupConfig {
    /// Create a new axis group with the given name and axes.
    pub fn new(name: impl Into<String>, axes: Vec<AxisConfig>) -> Self {
        AxisGroupConfig {
            name: name.into(),
            label: String::new(),
            axes,
            kinematics: "trivial".into(),
            default_plane: Plane::G17,
        }
    }

    /// Build the default three-axis X/Y/Z linear configuration.
    pub fn default_xyz() -> Self {
        AxisGroupConfig {
            name: "group.0".into(),
            label: "XYZ Group".into(),
            axes: vec![
                AxisConfig::linear(0, "X"),
                AxisConfig::linear(1, "Y"),
                AxisConfig::linear(2, "Z"),
            ],
            kinematics: "trivial".into(),
            default_plane: Plane::G17,
        }
    }

    /// Return the number of axes in this group.
    pub fn axis_count(&self) -> usize {
        self.axes.len()
    }

    /// Get an axis by index.
    pub fn axis(&self, index: u8) -> Option<&AxisConfig> {
        self.axes.get(index as usize)
    }

    /// Build the HAL signal prefix for this group and axis.
    /// Convention: group.{group_name}.axis.{idx}.{signal}
    pub fn signal_prefix(&self, axis_index: u8) -> String {
        format!("group.{}.axis.{}", self.name, axis_index)
    }
}

impl Default for AxisGroupConfig {
    fn default() -> Self {
        Self::default_xyz()
    }
}

// ── Tests ──

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_xyz() {
        let cfg = AxisGroupConfig::default_xyz();
        assert_eq!(cfg.name, "group.0");
        assert_eq!(cfg.axis_count(), 3);
        assert_eq!(cfg.axes[0].label, "X");
        assert_eq!(cfg.axes[1].label, "Y");
        assert_eq!(cfg.axes[2].label, "Z");
        assert_eq!(cfg.kinematics, "trivial");
    }

    #[test]
    fn test_axis_default() {
        let axis = AxisConfig::default();
        assert_eq!(axis.index, 0);
        assert_eq!(axis.axis_type, AxisType::Linear);
        assert!(axis.soft_limit_enable);
        assert!(!axis.backlash_enable);
        assert_eq!(axis.soft_limit_min, 0.0);
        assert_eq!(axis.soft_limit_max, 1000.0);
    }

    #[test]
    fn test_home_direction_multiplier() {
        assert_eq!(HomeDirection::Positive.multiplier(), 1.0);
        assert_eq!(HomeDirection::Negative.multiplier(), -1.0);
    }

    #[test]
    fn test_signal_prefix() {
        let cfg = AxisGroupConfig::default_xyz();
        assert_eq!(cfg.signal_prefix(0), "group.group.0.axis.0");
        assert_eq!(cfg.signal_prefix(2), "group.group.0.axis.2");
    }

    #[test]
    fn test_axis_lookup() {
        let cfg = AxisGroupConfig::default_xyz();
        assert!(cfg.axis(0).is_some());
        assert_eq!(cfg.axis(0).unwrap().label, "X");
        assert!(cfg.axis(3).is_none());
    }

    #[test]
    fn test_linear_constructor() {
        let axis = AxisConfig::linear(0, "X");
        assert_eq!(axis.index, 0);
        assert_eq!(axis.label, "X");
        assert_eq!(axis.axis_type, AxisType::Linear);
    }

    #[test]
    fn test_rotary_constructor() {
        let axis = AxisConfig::rotary(4, "A");
        assert_eq!(axis.index, 4);
        assert_eq!(axis.label, "A");
        assert_eq!(axis.axis_type, AxisType::Rotary);
    }
}
