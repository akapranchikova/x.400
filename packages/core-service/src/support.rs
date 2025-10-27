use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SupportError {
    #[error("failed to persist support bundle: {0}")]
    Io(#[from] std::io::Error),
    #[error("failed to encode metadata: {0}")]
    Serialize(#[from] serde_json::Error),
    #[error("bundle missing data")]
    EmptyBundle,
}

#[derive(Clone, Debug, Serialize, Deserialize, PartialEq, Eq)]
pub struct SupportMetadata {
    pub reporter: String,
    pub channel: String,
    pub created_at: DateTime<Utc>,
    pub notes: Option<String>,
}

impl Default for SupportMetadata {
    fn default() -> Self {
        Self {
            reporter: "unknown".into(),
            channel: "ui".into(),
            created_at: Utc::now(),
            notes: None,
        }
    }
}

#[derive(Clone)]
pub struct SupportStorage {
    base: Arc<PathBuf>,
}

impl SupportStorage {
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            base: Arc::new(path.into()),
        }
    }

    pub fn store(
        &self,
        bundle: &[u8],
        metadata: &SupportMetadata,
    ) -> Result<PathBuf, SupportError> {
        if bundle.is_empty() {
            return Err(SupportError::EmptyBundle);
        }
        let directory = self.ensure_directory()?;
        let timestamp = metadata.created_at.format("%Y%m%d%H%M%S");
        let name = format!("trace-{}-{}.zip", timestamp, metadata.channel);
        let bundle_path = directory.join(&name);
        fs::write(&bundle_path, bundle)?;

        let mut meta_path = bundle_path.clone();
        meta_path.set_extension("json");
        let mut file = File::create(meta_path)?;
        let serialized = serde_json::to_vec_pretty(metadata)?;
        file.write_all(&serialized)?;

        Ok(bundle_path)
    }

    pub fn list(&self) -> Result<Vec<PathBuf>, SupportError> {
        let directory = self.ensure_directory()?;
        let mut items = Vec::new();
        for entry in fs::read_dir(directory)? {
            let entry = entry?;
            if entry.path().extension().and_then(|value| value.to_str()) == Some("zip") {
                items.push(entry.path());
            }
        }
        items.sort();
        Ok(items)
    }

    fn ensure_directory(&self) -> Result<PathBuf, SupportError> {
        let directory = Path::new(&*self.base).join("support");
        fs::create_dir_all(&directory)?;
        Ok(directory)
    }
}
