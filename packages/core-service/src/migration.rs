use std::collections::{BTreeMap, HashMap};
use std::fs::{self, File};
use std::io::{self, Read};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use chardetng::EncodingDetector;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use thiserror::Error;
use uuid::Uuid;
use walkdir::WalkDir;
use zip::read::ZipArchive;

use crate::models::{
    Address, Message, MessageContent, MessageEnvelope, MessagePriority, MessageSensitivity,
    MessageStatus,
};
use crate::store::StoreManager;

/// Errors that can occur during migration.
#[derive(Debug, Error)]
pub enum MigrationError {
    #[error("failed to access filesystem: {0}")]
    Io(#[from] io::Error),
    #[error("unable to open archive: {0}")]
    Archive(#[from] zip::result::ZipError),
    #[error("file does not contain legacy metadata")] 
    EmptyDocument,
    #[error("document contained an invalid record: {0}")] 
    InvalidRecord(String),
    #[error("the requested job could not be found")] 
    UnknownJob,
}

/// Legacy metadata document extracted from FileWork artifacts.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FwmDocument {
    pub source: Option<PathBuf>,
    pub values: BTreeMap<String, String>,
    pub attachments: Vec<String>,
}

impl FwmDocument {
    pub fn subject(&self) -> String {
        self.values
            .get("SUBJECT")
            .or_else(|| self.values.get("Subject"))
            .cloned()
            .unwrap_or_else(|| "Legacy message".to_string())
    }

    pub fn body(&self) -> String {
        self.values
            .get("BODY")
            .or_else(|| self.values.get("Body"))
            .cloned()
            .unwrap_or_default()
    }

    pub fn folder(&self) -> String {
        self.values
            .get("FOLDER")
            .or_else(|| self.values.get("Folder"))
            .cloned()
            .unwrap_or_else(|| "inbox".to_string())
    }

    pub fn created_at(&self) -> Option<DateTime<Utc>> {
        let value = self
            .values
            .get("CREATED_AT")
            .or_else(|| self.values.get("Created"))
            .cloned()?;
        DateTime::parse_from_rfc3339(&value)
            .map(|dt| dt.with_timezone(&Utc))
            .ok()
            .or_else(|| DateTime::parse_from_str(&value, "%Y%m%d%H%M%S").ok().map(|dt| dt.with_timezone(&Utc)))
    }

    pub fn status(&self) -> MessageStatus {
        let raw = self
            .values
            .get("STATUS")
            .or_else(|| self.values.get("Status"))
            .map(|value| value.to_ascii_uppercase())
            .unwrap_or_else(|| "UNKNOWN".to_string());

        match raw.as_str() {
            "SENT" => MessageStatus::Sent,
            "DELIVERED" => MessageStatus::Delivered,
            "READ" | "OPENED" => MessageStatus::Read,
            "FAILED" | "NDR" => MessageStatus::Failed,
            "QUEUED" => MessageStatus::Queued,
            _ => MessageStatus::Unknown,
        }
    }

    pub fn sender(&self) -> Address {
        self.values
            .get("SENDER")
            .or_else(|| self.values.get("FROM"))
            .and_then(|value| parse_address(value))
            .unwrap_or_else(Address::sample)
    }

    pub fn recipients(&self) -> Vec<Address> {
        let list = self
            .values
            .get("RECIPIENTS")
            .or_else(|| self.values.get("TO"))
            .cloned()
            .unwrap_or_default();

        let mut recipients = list
            .split(['\n', '|', ','])
            .map(str::trim)
            .filter(|entry| !entry.is_empty())
            .filter_map(parse_address)
            .collect::<Vec<_>>();

        if recipients.is_empty() {
            recipients.push(Address::sample());
        }

        recipients
    }
}

fn parse_address(input: &str) -> Option<Address> {
    let mut parts: HashMap<String, String> = HashMap::new();
    for segment in input.split(';') {
        let mut iter = segment.splitn(2, '=');
        let key = iter.next()?.trim().to_ascii_uppercase();
        let value = iter.next().unwrap_or("").trim().to_string();
        parts.insert(key, value);
    }

    Some(Address {
        country: parts
            .get("C")
            .map(String::as_str)
            .unwrap_or("DE")
            .to_string(),
        organization: parts
            .get("O")
            .or_else(|| parts.get("OU"))
            .map(String::as_str)
            .unwrap_or("Modernization")
            .to_string(),
        surname: parts
            .get("S")
            .or_else(|| parts.get("CN"))
            .map(String::as_str)
            .unwrap_or("Recipient")
            .to_string(),
    })
}

/// Decode a legacy FileWork metadata document.
pub fn parse_fwm(bytes: &[u8]) -> Result<FwmDocument, MigrationError> {
    if bytes.is_empty() {
        return Err(MigrationError::EmptyDocument);
    }

    let mut detector = EncodingDetector::new();
    detector.feed(bytes, true);
    let encoding = detector.guess(None, true);
    let (cow, _, had_errors) = encoding.decode(bytes);
    if had_errors {
        return Err(MigrationError::InvalidRecord("encoding error".into()));
    }

    let mut values = BTreeMap::new();
    let mut attachments = Vec::new();

    for line in cow.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') || trimmed.starts_with("//") {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            let key = key.trim();
            let value = value.trim().trim_matches('"');
            if key.to_ascii_uppercase().starts_with("ATTACH") {
                attachments.push(value.to_string());
            } else {
                values.insert(key.to_string(), value.to_string());
            }
        }
    }

    if values.is_empty() {
        return Err(MigrationError::EmptyDocument);
    }

    Ok(FwmDocument {
        source: None,
        values,
        attachments,
    })
}

/// Attachment summary extracted from archives.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct AttachmentSummary {
    pub name: String,
    pub size: u64,
    pub sha256: String,
}

/// Result of parsing an FWZ archive.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct FwzArchive {
    pub documents: Vec<FwmDocument>,
    pub attachments: Vec<AttachmentSummary>,
    pub checksum_ok: bool,
}

/// Read a FileWork archive (.FWZ) collecting documents and attachment metadata.
pub fn read_fwz(path: &Path) -> Result<FwzArchive, MigrationError> {
    let file = File::open(path)?;
    let mut archive = ZipArchive::new(file)?;
    let mut documents = Vec::new();
    let mut attachments = Vec::new();
    let mut checksum_ok = true;

    for index in 0..archive.len() {
        let mut entry = archive.by_index(index)?;
        let name = entry.name().to_string();

        if name.to_ascii_lowercase().ends_with(".fwm") {
            let mut buffer = Vec::new();
            entry.read_to_end(&mut buffer)?;
            let mut document = parse_fwm(&buffer)?;
            document.source = Some(PathBuf::from(name));
            documents.push(document);
        } else if name.to_ascii_uppercase().starts_with("ATTACH/") {
            let mut hasher = Sha256::new();
            let mut buffer = Vec::new();
            entry.read_to_end(&mut buffer)?;
            hasher.update(&buffer);
            attachments.push(AttachmentSummary {
                name: name.clone(),
                size: buffer.len() as u64,
                sha256: format!("{:x}", hasher.finalize()),
            });
        } else {
            // Skip other files such as traces; do not treat them as errors.
            continue;
        }
    }

    if documents.is_empty() {
        checksum_ok = false;
    }

    Ok(FwzArchive {
        documents,
        attachments,
        checksum_ok,
    })
}

/// Accepted migration modes.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MigrationMode {
    #[default]
    Auto,
    Fwm,
    Fwz,
}

/// Request parameters for launching a migration job.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MigrationRequest {
    pub path: PathBuf,
    #[serde(default)]
    pub mode: MigrationMode,
    pub dry_run: bool,
    pub resume: Option<Uuid>,
    pub limit: Option<usize>,
    pub since: Option<DateTime<Utc>>,
    pub quarantine: Option<PathBuf>,
}

/// Summary of an import run.
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct MigrationReport {
    pub job_id: Uuid,
    pub started_at: DateTime<Utc>,
    pub finished_at: DateTime<Utc>,
    pub total: usize,
    pub imported: usize,
    pub failed: usize,
    pub duplicates: usize,
    pub dry_run: bool,
    pub checksum_ok: bool,
    pub notes: Vec<String>,
    pub errors: Vec<MigrationErrorRecord>,
}

/// Progress snapshot for consumers (CLI/UI).
#[derive(Clone, Debug, Default, PartialEq, Serialize, Deserialize)]
pub struct MigrationProgress {
    pub job_id: Uuid,
    pub status: MigrationStatus,
    pub total: usize,
    pub processed: usize,
    pub imported: usize,
    pub failed: usize,
    pub duplicates: usize,
    pub dry_run: bool,
    pub checksum_ok: bool,
    pub started_at: DateTime<Utc>,
    pub finished_at: Option<DateTime<Utc>>,
    pub current_path: Option<PathBuf>,
    pub notes: Vec<String>,
}

/// Errors recorded while processing individual artifacts.
#[derive(Clone, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
pub struct MigrationErrorRecord {
    pub path: PathBuf,
    pub message: String,
}

/// Job status values exposed externally.
#[derive(Clone, Copy, Debug, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MigrationStatus {
    #[default]
    Pending,
    Running,
    Completed,
    Failed,
}

struct MigrationJob {
    request: MigrationRequest,
    progress: MigrationProgress,
    report: Option<MigrationReport>,
}

/// Main coordinator responsible for import jobs.
#[derive(Clone)]
pub struct MigrationManager {
    store: StoreManager,
    jobs: Arc<Mutex<HashMap<Uuid, MigrationJob>>>,
}

impl MigrationManager {
    pub fn new(store: StoreManager) -> Self {
        Self {
            store,
            jobs: Arc::new(Mutex::new(HashMap::new())),
        }
    }

    /// Launch a migration job. The processing is synchronous for the mock implementation,
    /// but the job bookkeeping mirrors an asynchronous interface for consumers.
    pub fn import(&self, request: MigrationRequest) -> Result<Uuid, MigrationError> {
        if let Some(resume) = request.resume {
            if self.jobs.lock().unwrap().contains_key(&resume) {
                return Ok(resume);
            }
        }

        let job_id = Uuid::new_v4();
        let started_at = Utc::now();
        let job = MigrationJob {
            request: request.clone(),
            progress: MigrationProgress {
                job_id,
                status: MigrationStatus::Running,
                total: 0,
                processed: 0,
                imported: 0,
                failed: 0,
                duplicates: 0,
                dry_run: request.dry_run,
                checksum_ok: true,
                started_at,
                finished_at: None,
                current_path: None,
                notes: Vec::new(),
            },
            report: None,
        };

        self.jobs.lock().unwrap().insert(job_id, job);

        let result = self.process_job(job_id);

        if let Err(error) = result {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(&job_id) {
                job.progress.status = MigrationStatus::Failed;
                job.progress.finished_at = Some(Utc::now());
                job.progress.notes.push(format!("Job failed: {error}"));
            }
            return Err(error);
        }

        Ok(job_id)
    }

    fn process_job(&self, job_id: Uuid) -> Result<(), MigrationError> {
        let request;
        {
            let jobs = self.jobs.lock().unwrap();
            request = jobs.get(&job_id).map(|job| job.request.clone()).ok_or(MigrationError::UnknownJob)?;
        }

        let (documents, checksum_ok) = match self.resolve_documents(&request)? {
            ResolvedDocuments::Fwm { docs } => (docs, true),
            ResolvedDocuments::Fwz { docs, checksum_ok } => (docs, checksum_ok),
        };

        let total = documents.len();
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(&job_id) {
                job.progress.total = total;
                job.progress.checksum_ok = checksum_ok;
            }
        }

        let mut imported = 0usize;
        let mut failed = 0usize;
        let mut duplicates = 0usize;
        let mut processed = 0usize;
        let mut errors = Vec::new();
        let limit = request.limit.unwrap_or(usize::MAX);

        for document in documents.into_iter() {
            if let Some(since) = request.since {
                if let Some(created_at) = document.created_at() {
                    if created_at < since {
                        continue;
                    }
                }
            }

            if processed >= limit {
                break;
            }

            processed += 1;

            let path = document
                .source
                .clone()
                .unwrap_or_else(|| request.path.clone());

            match self.import_document(&document, request.dry_run) {
                Ok(result) => {
                    imported += 1;
                    if result.is_duplicate {
                        duplicates += 1;
                    }
                    self.update_progress(job_id, Some(path), processed, imported, failed, duplicates)?;
                }
                Err(err) => {
                    failed += 1;
                    errors.push(MigrationErrorRecord {
                        path: path.clone(),
                        message: err.to_string(),
                    });
                    self.update_progress(job_id, Some(path), processed, imported, failed, duplicates)?;
                }
            }
        }

        let finished_at = Utc::now();
        {
            let mut jobs = self.jobs.lock().unwrap();
            if let Some(job) = jobs.get_mut(&job_id) {
                job.progress.status = if failed > 0 {
                    MigrationStatus::Failed
                } else {
                    MigrationStatus::Completed
                };
                job.progress.processed = processed;
                job.progress.imported = imported;
                job.progress.failed = failed;
                job.progress.duplicates = duplicates;
                job.progress.finished_at = Some(finished_at);
                job.progress.current_path = None;
                let report = MigrationReport {
                    job_id,
                    started_at: job.progress.started_at,
                    finished_at,
                    total: job.progress.total,
                    imported,
                    failed,
                    duplicates,
                    dry_run: job.progress.dry_run,
                    checksum_ok: job.progress.checksum_ok,
                    notes: job.progress.notes.clone(),
                    errors,
                };
                job.report = Some(report);
            }
        }

        Ok(())
    }

    fn update_progress(
        &self,
        job_id: Uuid,
        path: Option<PathBuf>,
        processed: usize,
        imported: usize,
        failed: usize,
        duplicates: usize,
    ) -> Result<(), MigrationError> {
        let mut jobs = self.jobs.lock().unwrap();
        let job = jobs
            .get_mut(&job_id)
            .ok_or(MigrationError::UnknownJob)?;
        job.progress.processed = processed;
        job.progress.imported = imported;
        job.progress.failed = failed;
        job.progress.duplicates = duplicates;
        job.progress.current_path = path;
        Ok(())
    }

    fn import_document(&self, document: &FwmDocument, dry_run: bool) -> Result<ImportResult, MigrationError> {
        let subject = document.subject();
        let sender = document.sender();
        let recipients = document.recipients();
        let mut envelope = MessageEnvelope::new(&subject, sender, recipients);
        envelope.folder = document.folder();
        envelope.status = document.status();
        envelope.priority = MessagePriority::Normal;
        envelope.sensitivity = MessageSensitivity::Normal;

        let message = Message {
            envelope,
            content: MessageContent {
                body: document.body(),
            },
        };

        let folder = message.envelope.folder.clone();
        let existing = self.store.list(&folder);
        let is_duplicate = existing.iter().any(|candidate| {
            candidate.envelope.subject == message.envelope.subject
                && candidate.content.body == message.content.body
        });

        if !dry_run && !is_duplicate {
            self.store.save(message);
        }

        Ok(ImportResult { is_duplicate })
    }

    fn resolve_documents(&self, request: &MigrationRequest) -> Result<ResolvedDocuments, MigrationError> {
        let path = request.path.clone();
        let mode = match request.mode {
            MigrationMode::Auto => infer_mode(&path),
            other => other,
        };

        match mode {
            MigrationMode::Fwm => {
                let mut docs = Vec::new();
                if path.is_dir() {
                    for entry in WalkDir::new(&path).into_iter().filter_map(Result::ok) {
                        if entry.file_type().is_file()
                            && entry
                                .path()
                                .extension()
                                .map(|ext| ext.eq_ignore_ascii_case("fwm"))
                                .unwrap_or(false)
                        {
                            let data = fs::read(entry.path())?;
                            let mut doc = parse_fwm(&data)?;
                            doc.source = Some(entry.path().to_path_buf());
                            docs.push(doc);
                        }
                    }
                } else {
                    let data = fs::read(&path)?;
                    let mut doc = parse_fwm(&data)?;
                    doc.source = Some(path.clone());
                    docs.push(doc);
                }

                Ok(ResolvedDocuments::Fwm { docs })
            }
            MigrationMode::Fwz => {
                let archive = read_fwz(&path)?;
                Ok(ResolvedDocuments::Fwz {
                    docs: archive.documents,
                    checksum_ok: archive.checksum_ok,
                })
            }
            MigrationMode::Auto => unreachable!("auto mode is resolved above"),
        }
    }

    pub fn progress(&self, job_id: Uuid) -> Result<MigrationProgress, MigrationError> {
        let jobs = self.jobs.lock().unwrap();
        let job = jobs.get(&job_id).ok_or(MigrationError::UnknownJob)?;
        Ok(job.progress.clone())
    }

    pub fn report(&self, job_id: Uuid) -> Result<MigrationReport, MigrationError> {
        let jobs = self.jobs.lock().unwrap();
        let job = jobs.get(&job_id).ok_or(MigrationError::UnknownJob)?;
        job.report.clone().ok_or(MigrationError::UnknownJob)
    }

    #[allow(dead_code)]
    pub fn list_jobs(&self) -> Vec<Uuid> {
        self.jobs
            .lock()
            .map(|map| map.keys().copied().collect())
            .unwrap_or_default()
    }
}

struct ImportResult {
    is_duplicate: bool,
}

enum ResolvedDocuments {
    Fwm { docs: Vec<FwmDocument> },
    Fwz { docs: Vec<FwmDocument>, checksum_ok: bool },
}

fn infer_mode(path: &Path) -> MigrationMode {
    if path
        .extension()
        .map(|ext| ext.eq_ignore_ascii_case("fwz"))
        .unwrap_or(false)
    {
        MigrationMode::Fwz
    } else {
        MigrationMode::Fwm
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_fwm_handles_basic_documents() {
        let data = b"SUBJECT=Test\nBODY=Hello\nTO=C=DE;O=Org;S=Recipient\n";
        let document = parse_fwm(data).expect("parse");
        assert_eq!(document.subject(), "Test");
        assert_eq!(document.body(), "Hello");
        assert_eq!(document.recipients().len(), 1);
    }
}
