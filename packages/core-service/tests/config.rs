use core_service::config::{AppConfig, ConfigError};
use std::fs;
use std::path::Path;

fn temp_file(path: &Path, contents: &str) {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(path, contents).unwrap();
}

#[test]
fn loads_default_configuration() {
    std::env::remove_var("CORE_CONFIG");
    let config = AppConfig::load().expect("configuration loads");
    assert_eq!(config.server.port, 3333);
    assert_eq!(config.server.host, "127.0.0.1");
    assert_eq!(config.migration.workspace, "workspace/migration");
}

#[test]
fn loads_configuration_from_file() {
    let path = Path::new("/tmp/core-config.cfg");
    temp_file(
        path,
        "server.port=4444\nserver.host=0.0.0.0\ndatabase.path=/tmp/messages.db\nmigration.workspace=/data/work\nmigration.quarantine=/data/quarantine\nmigration.parallelism=8\n",
    );
    std::env::set_var("CORE_CONFIG", path);
    let config = AppConfig::load().expect("configuration loads from file");
    std::env::remove_var("CORE_CONFIG");
    assert_eq!(config.server.port, 4444);
    assert_eq!(config.server.host, "0.0.0.0");
    assert_eq!(config.database.path, "/tmp/messages.db");
    assert_eq!(config.migration.workspace, "/data/work");
    assert_eq!(config.migration.quarantine, "/data/quarantine");
    assert_eq!(config.migration.parallelism, 8);
}

#[test]
fn rejects_invalid_configuration() {
    let path = Path::new("/tmp/core-config-invalid.cfg");
    temp_file(path, "not-valid-line");
    std::env::set_var("CORE_CONFIG", path);
    let err = AppConfig::load().unwrap_err();
    std::env::remove_var("CORE_CONFIG");
    assert_eq!(err, ConfigError::InvalidFormat);
}

#[test]
fn missing_file_returns_error() {
    std::env::set_var("CORE_CONFIG", "/tmp/does-not-exist");
    let err = AppConfig::load().unwrap_err();
    std::env::remove_var("CORE_CONFIG");
    assert_eq!(err, ConfigError::MissingFile);
}
