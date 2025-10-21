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
        Ok(config.try_deserialize()?)
    }
}
