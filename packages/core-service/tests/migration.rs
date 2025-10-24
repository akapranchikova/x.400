use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::{Duration, Utc};
use core_service::migration::{
    parse_fwm, read_fwz, MigrationManager, MigrationMode, MigrationRequest,
};
use core_service::store::StoreManager;
use encoding_rs::WINDOWS_1252;
use tempfile::tempdir;
use zip::write::FileOptions;
use zip::CompressionMethod;

fn write_fwz(base: &Path, entries: &[(&str, &[u8])]) -> PathBuf {
    let path = base.join("sample.fwz");
    let file = fs::File::create(&path).expect("create fwz");
    let mut writer = zip::ZipWriter::new(file);

    for (name, data) in entries {
        writer
            .start_file(*name, FileOptions::default().compression_method(CompressionMethod::Stored))
            .expect("start file");
        writer.write_all(data).expect("write entry");
    }

    writer.finish().expect("finish archive");
    path
}

#[test]
fn parse_fwm_decodes_cp1252_payloads() {
    let (encoded, _, _) = WINDOWS_1252.encode("SUBJECT=Übertragung\nBODY=Grüße\n");
    let document = parse_fwm(&encoded).expect("decode");
    assert_eq!(document.subject(), "Übertragung");
    assert_eq!(document.body(), "Grüße");
}

#[test]
fn read_fwz_extracts_documents_and_attachments() {
    let dir = tempdir().expect("fwz dir");
    let fwz_path = write_fwz(dir.path(), &[
        ("META/message.fwm", b"SUBJECT=Archive\nBODY=Attached\n"),
        ("ATTACH/file.txt", b"sample"),
    ]);

    let archive = read_fwz(&fwz_path).expect("read archive");
    assert_eq!(archive.documents.len(), 1);
    assert_eq!(archive.attachments.len(), 1);
    assert!(archive.checksum_ok);
}

#[test]
fn migration_manager_imports_documents_and_tracks_progress() {
    let dir = tempdir().expect("temp dir");
    let file_path = dir.path().join("message.fwm");
    let created_at = Utc::now().to_rfc3339();
    let payload = format!(
        "SUBJECT=Test Import\nBODY=Hello\nTO=C=DE;O=Org;S=User\nSTATUS=DELIVERED\nCREATED_AT={created_at}\n",
    );
    fs::write(&file_path, payload).expect("write fwm");

    let store = StoreManager::new();
    let manager = MigrationManager::new(store.clone());

    let job_id = manager
        .import(MigrationRequest {
            path: file_path,
            mode: MigrationMode::Fwm,
            dry_run: false,
            resume: None,
            limit: None,
            since: Some(Utc::now() - Duration::days(1)),
            quarantine: None,
        })
        .expect("job id");

    let progress = manager.progress(job_id).expect("progress");
    assert_eq!(progress.imported, 1);
    assert_eq!(progress.failed, 0);
    assert_eq!(progress.status, core_service::migration::MigrationStatus::Completed);

    let report = manager.report(job_id).expect("report");
    assert_eq!(report.imported, 1);
    assert!(report.errors.is_empty());

    let saved = store.list("inbox");
    assert_eq!(saved.len(), 1);
    assert_eq!(saved[0].content.body, "Hello");
}
