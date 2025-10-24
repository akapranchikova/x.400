use std::env;
use std::fs;
use std::path::Path;

/// Error type returned when configuration loading fails.
#[derive(Debug, PartialEq, Eq)]
pub enum ConfigError {
    MissingFile,
    InvalidFormat,
}

/// TLS settings placeholder retained for compatibility.
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct TlsConfig {
    pub enabled: bool,
    pub certificate_path: String,
    pub private_key_path: String,
}

/// Server configuration describing host/port.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub tls: TlsConfig,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "127.0.0.1".into(),
            port: 3333,
            tls: TlsConfig::default(),
        }
    }
}

/// Configuration describing where messages are persisted.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DatabaseConfig {
    pub path: String,
}

impl Default for DatabaseConfig {
    fn default() -> Self {
        Self {
            path: "data/messages.db".into(),
        }
    }
}

/// Aggregated application configuration.
#[derive(Clone, Debug, PartialEq, Eq, Default)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
}

impl AppConfig {
    /// Load configuration from the optional `CORE_CONFIG` environment variable.
    ///
    /// When the variable is unset or the file cannot be read the default
    /// configuration is returned.
    pub fn load() -> Result<Self, ConfigError> {
        match env::var("CORE_CONFIG").ok() {
            Some(path) => Self::from_file(Path::new(&path)),
            None => Ok(Self::default()),
        }
    }

    fn from_file(path: &Path) -> Result<Self, ConfigError> {
        let contents = fs::read_to_string(path).map_err(|_| ConfigError::MissingFile)?;
        let mut result = Self::default();

        for line in contents.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            let mut parts = line.splitn(2, '=');
            let key = parts.next().ok_or(ConfigError::InvalidFormat)?.trim();
            let value = parts
                .next()
                .ok_or(ConfigError::InvalidFormat)?
                .trim()
                .trim_matches('"');

            match key {
                "server.port" => {
                    result.server.port = value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                "server.host" => {
                    result.server.host = value.to_string();
                }
                "database.path" => {
                    result.database.path = value.to_string();
                }
                _ => {}
            }
        }

        Ok(result)
    }
}
