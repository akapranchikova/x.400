use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub security: SecurityConfig,
    pub submit: SubmitConfig,
    pub tracing: TracingConfig,
    #[serde(default)]
    pub transport: TransportConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
    pub tls: TlsConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TlsConfig {
    pub enabled: bool,
    pub min_version: String,
    pub certificate_path: String,
    pub private_key_path: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: String,
    pub use_sqlcipher: bool,
    #[serde(default)]
    pub sqlcipher_key_ref: Option<String>,
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct SecurityConfig {
    pub require_auth: bool,
    pub api_key: String,
    #[serde(default)]
    pub smime: SmimeConfig,
    #[serde(default)]
    pub tls: SecurityTlsPolicy,
    #[serde(default)]
    pub keychain: KeychainConfig,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TransportConfig {
    #[serde(default)]
    pub mode: TransportMode,
    #[serde(default = "TransportConfig::default_profiles_dir")]
    pub profiles_dir: String,
    #[serde(default)]
    pub tls: TransportTlsConfig,
    #[serde(default)]
    pub fingerprints: Vec<String>,
    #[serde(default)]
    pub sdk: TransportSdkConfig,
}

impl TransportConfig {
    fn default_profiles_dir() -> String {
        "profiles".to_string()
    }
}

impl Default for TransportConfig {
    fn default() -> Self {
        Self {
            mode: TransportMode::Mock,
            profiles_dir: Self::default_profiles_dir(),
            tls: TransportTlsConfig::default(),
            fingerprints: Vec::new(),
            sdk: TransportSdkConfig::default(),
        }
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct TransportSdkConfig {
    #[serde(default)]
    pub library_path: Option<String>,
    #[serde(default)]
    pub preferred_profile: Option<String>,
    #[serde(default = "TransportSdkConfig::default_connect_timeout")]
    pub connect_timeout_ms: u64,
    #[serde(default = "TransportSdkConfig::default_operation_timeout")]
    pub operation_timeout_ms: u64,
}

impl TransportSdkConfig {
    const fn default_connect_timeout() -> u64 {
        10_000
    }

    const fn default_operation_timeout() -> u64 {
        30_000
    }
}

impl Default for TransportSdkConfig {
    fn default() -> Self {
        Self {
            library_path: None,
            preferred_profile: None,
            connect_timeout_ms: Self::default_connect_timeout(),
            operation_timeout_ms: Self::default_operation_timeout(),
        }
    }
}

#[derive(Debug, Deserialize, Serialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum TransportMode {
    Mock,
    Sdk,
}

impl Default for TransportMode {
    fn default() -> Self {
        TransportMode::Mock
    }
}

#[derive(Debug, Deserialize, Clone)]
pub struct TransportTlsConfig {
    #[serde(default = "TransportTlsConfig::default_enabled")]
    pub enabled: bool,
    #[serde(default = "TransportTlsConfig::default_min_version")]
    pub min_version: String,
    #[serde(default = "TransportTlsConfig::default_ca_bundle")]
    pub ca_bundle: String,
    #[serde(default = "TransportTlsConfig::default_client_cert")]
    pub client_certificate: Option<String>,
    #[serde(default = "TransportTlsConfig::default_client_key")]
    pub client_key: Option<String>,
    #[serde(default)]
    pub ocsp_responder: Option<String>,
    #[serde(default)]
    pub enforce_pinset: bool,
}

impl TransportTlsConfig {
    const fn default_enabled() -> bool {
        true
    }

    fn default_min_version() -> String {
        "TLS1_3".to_string()
    }

    fn default_ca_bundle() -> String {
        "profiles/certs/ca.pem".to_string()
    }

    fn default_client_cert() -> Option<String> {
        None
    }

    fn default_client_key() -> Option<String> {
        None
    }
}

impl Default for TransportTlsConfig {
    fn default() -> Self {
        Self {
            enabled: Self::default_enabled(),
            min_version: Self::default_min_version(),
            ca_bundle: Self::default_ca_bundle(),
            client_certificate: Self::default_client_cert(),
            client_key: Self::default_client_key(),
            ocsp_responder: None,
            enforce_pinset: false,
        }
    }
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct SmimeConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default = "SmimeConfig::default_cert_dir")]
    pub certificates_dir: String,
    #[serde(default)]
    pub default_signing_certificate: Option<String>,
    #[serde(default)]
    pub default_encryption_certificate: Option<String>,
}

impl SmimeConfig {
    fn default_cert_dir() -> String {
        "profiles/certs".to_string()
    }
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct SecurityTlsPolicy {
    #[serde(default = "SecurityTlsPolicy::default_min_version")]
    pub min_version: String,
    #[serde(default = "SecurityTlsPolicy::default_verify")]
    pub tls_verify: bool,
}

impl SecurityTlsPolicy {
    fn default_min_version() -> String {
        "TLS1_3".to_string()
    }

    const fn default_verify() -> bool {
        true
    }
}

#[derive(Debug, Deserialize, Clone, Default)]
pub struct KeychainConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub service_name: Option<String>,
    #[serde(default)]
    pub account_name: Option<String>,
    #[serde(default)]
    pub fallback_env: Option<String>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct SubmitConfig {
    pub default_strategy: u8,
}

#[derive(Debug, Deserialize, Clone)]
pub struct TracingConfig {
    pub log_level: String,
    pub trace_bundle_path: String,
}

impl AppConfig {
    pub fn load() -> anyhow::Result<Self> {
        let mut builder = config::Config::builder()
            .add_source(config::File::with_name("config/default"))
            .add_source(config::Environment::with_prefix("X400").separator("__"));

        if let Ok(custom) = std::env::var("X400_CONFIG_FILE") {
            builder = builder.add_source(config::File::with_name(&custom));
        }

        let config = builder.build()?;
        let mut app_config: AppConfig = config.try_deserialize()?;

        if let Ok(host) = std::env::var("CORE_IPC_HOST") {
            if !host.trim().is_empty() {
                app_config.server.host = host;
            }
        }

        if let Ok(port) = std::env::var("CORE_IPC_PORT") {
            if let Ok(parsed) = port.trim().parse::<u16>() {
                app_config.server.port = parsed;
            }
        }

        if let Ok(db_path) = std::env::var("CORE_DB_PATH") {
            if !db_path.trim().is_empty() {
                app_config.database.url = normalize_sqlite_url(&db_path);
            }
        }

        if let Ok(library) = std::env::var("X400_SDK_LIBRARY") {
            if !library.trim().is_empty() {
                app_config.transport.sdk.library_path = Some(library);
            }
        }

        if let Ok(profile) = std::env::var("X400_SDK_PROFILE") {
            if !profile.trim().is_empty() {
                app_config.transport.sdk.preferred_profile = Some(profile);
            }
        }

        Ok(app_config)
    }
}

fn normalize_sqlite_url(path: &str) -> String {
    let trimmed = path.trim();
    if trimmed.starts_with("sqlite://") {
        trimmed.to_string()
    } else {
        format!("sqlite://{}", trimmed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::{Mutex, OnceLock};

    fn env_lock() -> &'static Mutex<()> {
        static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
        LOCK.get_or_init(Mutex::default)
    }

    fn restore(key: &str, value: Option<String>) {
        match value {
            Some(existing) => std::env::set_var(key, existing),
            None => std::env::remove_var(key),
        }
    }

    #[test]
    fn load_uses_defaults_when_env_missing() {
        let _guard = env_lock().lock().expect("env lock");

        let prev_host = std::env::var("CORE_IPC_HOST").ok();
        let prev_port = std::env::var("CORE_IPC_PORT").ok();
        let prev_db = std::env::var("CORE_DB_PATH").ok();
        let prev_library = std::env::var("X400_SDK_LIBRARY").ok();
        let prev_profile = std::env::var("X400_SDK_PROFILE").ok();

        std::env::remove_var("CORE_IPC_HOST");
        std::env::remove_var("CORE_IPC_PORT");
        std::env::remove_var("CORE_DB_PATH");
        std::env::remove_var("X400_SDK_LIBRARY");
        std::env::remove_var("X400_SDK_PROFILE");

        let cfg = AppConfig::load().expect("load config defaults");
        assert_eq!(cfg.server.host, "127.0.0.1");
        assert_eq!(cfg.server.port, 3333);
        assert!(cfg.database.url.ends_with("x400.sqlite"));
        assert_eq!(cfg.transport.mode, TransportMode::Mock);
        assert_eq!(cfg.security.tls.min_version, "TLS1_3");
        assert!(cfg.transport.sdk.library_path.is_none());
        assert!(cfg.transport.sdk.preferred_profile.is_none());

        restore("CORE_IPC_HOST", prev_host);
        restore("CORE_IPC_PORT", prev_port);
        restore("CORE_DB_PATH", prev_db);
        restore("X400_SDK_LIBRARY", prev_library);
        restore("X400_SDK_PROFILE", prev_profile);
    }

    #[test]
    fn load_prefers_explicit_environment_values() {
        let _guard = env_lock().lock().expect("env lock");

        let prev_host = std::env::var("CORE_IPC_HOST").ok();
        let prev_port = std::env::var("CORE_IPC_PORT").ok();
        let prev_db = std::env::var("CORE_DB_PATH").ok();

        std::env::set_var("CORE_IPC_HOST", "0.0.0.0");
        std::env::set_var("CORE_IPC_PORT", "4444");
        std::env::set_var("CORE_DB_PATH", "/tmp/dev.sqlite");

        let cfg = AppConfig::load().expect("load config with env");
        assert_eq!(cfg.server.host, "0.0.0.0");
        assert_eq!(cfg.server.port, 4444);
        assert_eq!(cfg.database.url, "sqlite:///tmp/dev.sqlite");
        assert_eq!(cfg.transport.mode, TransportMode::Mock);

        restore("CORE_IPC_HOST", prev_host);
        restore("CORE_IPC_PORT", prev_port);
        restore("CORE_DB_PATH", prev_db);
    }

    #[test]
    fn sdk_env_overrides_are_applied() {
        let _guard = env_lock().lock().expect("env lock");

        let prev_library = std::env::var("X400_SDK_LIBRARY").ok();
        let prev_profile = std::env::var("X400_SDK_PROFILE").ok();

        std::env::set_var("X400_SDK_LIBRARY", "/opt/vendor/libx400.so");
        std::env::set_var("X400_SDK_PROFILE", "integration");

        let cfg = AppConfig::load().expect("load config with sdk env");
        assert_eq!(
            cfg.transport.sdk.library_path.as_deref(),
            Some("/opt/vendor/libx400.so")
        );
        assert_eq!(
            cfg.transport.sdk.preferred_profile.as_deref(),
            Some("integration")
        );

        restore("X400_SDK_LIBRARY", prev_library);
        restore("X400_SDK_PROFILE", prev_profile);
    }
}
