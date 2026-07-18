use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

/// Two-layer project model (architecture.md §7)
#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type")]
pub enum ProjectConfig {
    #[serde(rename = "engineering")]
    Engineering(EngineeringProject),
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EngineeringProject {
    pub name: String,
    pub version: String,
    pub target: Option<TargetConfig>,
    pub source: SourceConfig,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TargetConfig {
    pub firmware_project: String,
    #[serde(default)]
    pub firmware_version: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SourceConfig {
    pub entry: String,
    #[serde(default)]
    pub files: Vec<String>,
}

#[derive(Debug, Serialize)]
pub struct ProjectInfo {
    pub name: String,
    pub entry: String,
    pub files: Vec<FileEntry>,
}

#[derive(Debug, Serialize)]
pub struct FileEntry {
    pub name: String,
    pub path: String,
}

impl ProjectConfig {
    pub fn from_file(path: &str) -> Result<Self, String> {
        let content = fs::read_to_string(path).map_err(|e| format!("read: {e}"))?;
        serde_yaml::from_str(&content).map_err(|e| format!("parse: {e}"))
    }

    pub fn to_file(&self, path: &str) -> Result<(), String> {
        let content = serde_yaml::to_string(self).map_err(|e| format!("serialize: {e}"))?;
        fs::write(path, content).map_err(|e| format!("write: {e}"))
    }

    pub fn info(&self, project_path: &str) -> ProjectInfo {
        let base = Path::new(project_path).parent().unwrap_or(Path::new("."));
        match self {
            ProjectConfig::Engineering(eng) => {
                let files = std::iter::once(&eng.source.entry)
                    .chain(eng.source.files.iter())
                    .map(|f| {
                        let full = base.join(f);
                        FileEntry {
                            name: f.clone(),
                            path: full.to_string_lossy().to_string(),
                        }
                    })
                    .collect();
                ProjectInfo {
                    name: eng.name.clone(),
                    entry: eng.source.entry.clone(),
                    files,
                }
            }
        }
    }
}
