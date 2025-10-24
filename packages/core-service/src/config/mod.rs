use serde::Deserialize;

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub database: DatabaseConfig,
    pub security: SecurityConfig,
    pub submit: SubmitConfig,
    pub tracing: TracingConfig,
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
}

#[derive(Debug, Deserialize, Clone)]
pub struct SecurityConfig {
    pub require_auth: bool,
    pub api_key: String,
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

        std::env::remove_var("CORE_IPC_HOST");
        std::env::remove_var("CORE_IPC_PORT");
        std::env::remove_var("CORE_DB_PATH");

        let cfg = AppConfig::load().expect("load config defaults");
        assert_eq!(cfg.server.host, "127.0.0.1");
        assert_eq!(cfg.server.port, 3333);
        assert!(cfg.database.url.ends_with("x400.sqlite"));

        restore("CORE_IPC_HOST", prev_host);
        restore("CORE_IPC_PORT", prev_port);
        restore("CORE_DB_PATH", prev_db);
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

        restore("CORE_IPC_HOST", prev_host);
        restore("CORE_IPC_PORT", prev_port);
        restore("CORE_DB_PATH", prev_db);
    }
}
