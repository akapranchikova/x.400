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
    pub migration: MigrationConfig,
    pub gateway: GatewayConfig,
    pub directory: DirectoryConfig,
}

/// Migration related configuration.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MigrationConfig {
    pub workspace: String,
    pub quarantine: String,
    pub charset_fallback: String,
    pub parallelism: usize,
}

impl Default for MigrationConfig {
    fn default() -> Self {
        Self {
            workspace: "workspace/migration".into(),
            quarantine: "workspace/quarantine".into(),
            charset_fallback: "utf-8".into(),
            parallelism: 4,
        }
    }
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
                "migration.workspace" => {
                    result.migration.workspace = value.to_string();
                }
                "migration.quarantine" => {
                    result.migration.quarantine = value.to_string();
                }
                "migration.charsetFallback" => {
                    result.migration.charset_fallback = value.to_string();
                }
                "migration.parallelism" => {
                    result.migration.parallelism =
                        value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                "gateway.smtp.host" => {
                    result.gateway.smtp.host = value.to_string();
                }
                "gateway.smtp.port" => {
                    result.gateway.smtp.port =
                        value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                "gateway.smtp.tls" => {
                    result.gateway.smtp.tls =
                        value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                "gateway.imap.host" => {
                    result.gateway.imap.host = value.to_string();
                }
                "gateway.imap.port" => {
                    result.gateway.imap.port =
                        value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                "gateway.imap.mailbox" => {
                    result.gateway.imap.mailbox = value.to_string();
                }
                "gateway.mapping.rules" => {
                    result.gateway.mapping.rules = value
                        .split(',')
                        .map(|item| item.trim().to_string())
                        .filter(|item| !item.is_empty())
                        .collect();
                }
                "gateway.security.allow" => {
                    result.gateway.security.domain_allow_list = value
                        .split(',')
                        .map(|item| item.trim().to_string())
                        .filter(|item| !item.is_empty())
                        .collect();
                }
                "directory.ldap.url" => {
                    result.directory.ldap.url = value.to_string();
                }
                "directory.ldap.baseDN" => {
                    result.directory.ldap.base_dn = value.to_string();
                }
                "directory.ldap.filterPerson" => {
                    result.directory.ldap.filter_person = value.to_string();
                }
                "directory.cache.ttlSeconds" => {
                    result.directory.cache.ttl_seconds =
                        value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                "directory.cache.capacity" => {
                    result.directory.cache.capacity =
                        value.parse().map_err(|_| ConfigError::InvalidFormat)?;
                }
                _ => {}
            }
        }

        Ok(result)
    }
}

/// Gateway specific configuration describing SMTP/IMAP behaviour.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GatewayConfig {
    pub smtp: GatewaySmtpConfig,
    pub imap: GatewayImapConfig,
    pub mapping: GatewayMappingConfig,
    pub security: GatewaySecurityConfig,
}

impl Default for GatewayConfig {
    fn default() -> Self {
        Self {
            smtp: GatewaySmtpConfig::default(),
            imap: GatewayImapConfig::default(),
            mapping: GatewayMappingConfig::default(),
            security: GatewaySecurityConfig::default(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GatewaySmtpConfig {
    pub host: String,
    pub port: u16,
    pub tls: bool,
    pub username: Option<String>,
    pub password: Option<String>,
    pub rate_limit_per_minute: u32,
}

impl Default for GatewaySmtpConfig {
    fn default() -> Self {
        Self {
            host: "smtp.example.com".into(),
            port: 587,
            tls: true,
            username: None,
            password: None,
            rate_limit_per_minute: 120,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GatewayImapConfig {
    pub host: String,
    pub port: u16,
    pub tls: bool,
    pub mailbox: String,
}

impl Default for GatewayImapConfig {
    fn default() -> Self {
        Self {
            host: "imap.example.com".into(),
            port: 993,
            tls: true,
            mailbox: "Inbox".into(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GatewayMappingConfig {
    pub rules: Vec<String>,
    pub allow_list_domains: Vec<String>,
}

impl Default for GatewayMappingConfig {
    fn default() -> Self {
        Self {
            rules: vec!["{G}.{S}@{O}.{C}.example".into()],
            allow_list_domains: vec!["example.com".into()],
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GatewaySecurityConfig {
    pub enforce_tls: bool,
    pub domain_allow_list: Vec<String>,
}

impl Default for GatewaySecurityConfig {
    fn default() -> Self {
        Self {
            enforce_tls: true,
            domain_allow_list: vec!["example.com".into()],
        }
    }
}

/// Directory configuration describing LDAP/X.500 connectivity.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryConfig {
    pub ldap: LdapConfig,
    pub cache: DirectoryCacheConfig,
}

impl Default for DirectoryConfig {
    fn default() -> Self {
        Self {
            ldap: LdapConfig::default(),
            cache: DirectoryCacheConfig::default(),
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct LdapConfig {
    pub url: String,
    pub base_dn: String,
    pub bind_dn: Option<String>,
    pub bind_password: Option<String>,
    pub filter_person: String,
    pub tls_verify: bool,
}

impl Default for LdapConfig {
    fn default() -> Self {
        Self {
            url: "ldaps://ldap.example.com".into(),
            base_dn: "dc=example,dc=com".into(),
            bind_dn: None,
            bind_password: None,
            filter_person: "(&(objectClass=person)(mail=*))".into(),
            tls_verify: true,
        }
    }
}

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct DirectoryCacheConfig {
    pub ttl_seconds: u64,
    pub capacity: usize,
}

impl Default for DirectoryCacheConfig {
    fn default() -> Self {
        Self {
            ttl_seconds: 300,
            capacity: 512,
        }
    }
}
