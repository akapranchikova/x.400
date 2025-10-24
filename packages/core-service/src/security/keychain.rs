use crate::config::{DatabaseConfig, KeychainConfig, SecurityConfig};
use anyhow::{anyhow, Context, Result};
use keyring::{Entry, Error as KeyringError};
use std::env;
use tracing::warn;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SqlCipherKeySource {
    pub service: String,
    pub account: String,
}

pub fn resolve_sqlcipher_key(
    database: &DatabaseConfig,
    security: &SecurityConfig,
) -> Result<Option<String>> {
    if !database.use_sqlcipher {
        return Ok(None);
    }

    let keychain_cfg = &security.keychain;
    let fallback_ref = database.sqlcipher_key_ref.clone();

    let key_source = if keychain_cfg.enabled {
        Some(resolve_source(&fallback_ref, keychain_cfg)?)
    } else {
        None
    };

    if let Some(source) = key_source {
        match fetch_from_keychain(&source) {
            Ok(Some(secret)) => {
                return Ok(Some(secret));
            }
            Ok(None) => {
                warn!(
                    service = source.service,
                    account = source.account,
                    "SQLCipher key not found in keychain"
                );
            }
            Err(err) => {
                warn!(
                    service = source.service,
                    account = source.account,
                    error = %err,
                    "Failed to access keychain entry"
                );
            }
        }
    }

    if let Some(env_key) = keychain_cfg.fallback_env.as_ref().and_then(|key| {
        if key.trim().is_empty() {
            None
        } else {
            Some(key.trim())
        }
    }) {
        if let Ok(value) = env::var(env_key) {
            if !value.trim().is_empty() {
                return Ok(Some(value));
            }
        }
    }

    Ok(None)
}

fn resolve_source(reference: &Option<String>, cfg: &KeychainConfig) -> Result<SqlCipherKeySource> {
    let reference_values = reference
        .as_ref()
        .and_then(|value| parse_reference(value).ok());

    let service = cfg
        .service_name
        .clone()
        .or_else(|| {
            reference_values
                .as_ref()
                .map(|(service, _)| service.clone())
        })
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "x400-core".to_string());

    let account = cfg
        .account_name
        .clone()
        .or_else(|| reference_values.map(|(_, account)| account))
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| "default".to_string());

    Ok(SqlCipherKeySource { service, account })
}

fn parse_reference(value: &str) -> Result<(String, String)> {
    let trimmed = value.trim();
    if trimmed.is_empty() {
        return Err(anyhow!("empty reference"));
    }

    let mut parts = trimmed.splitn(2, '/');
    let service = parts
        .next()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .ok_or_else(|| anyhow!("missing service name"))?;
    let account = parts
        .next()
        .map(str::trim)
        .filter(|s| !s.is_empty())
        .unwrap_or("default");
    Ok((service.to_string(), account.to_string()))
}

fn fetch_from_keychain(source: &SqlCipherKeySource) -> Result<Option<String>> {
    let entry = Entry::new(&source.service, &source.account)
        .with_context(|| format!("failed to create keychain entry for {}", source.service))?;

    match entry.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(KeyringError::NoEntry) => Ok(None),
        Err(other) => Err(other.into()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_db() -> DatabaseConfig {
        DatabaseConfig {
            url: "sqlite://memory".to_string(),
            use_sqlcipher: true,
            sqlcipher_key_ref: Some("service/account".to_string()),
        }
    }

    fn disabled_security() -> SecurityConfig {
        SecurityConfig {
            require_auth: false,
            api_key: "test".to_string(),
            smime: Default::default(),
            tls: Default::default(),
            keychain: KeychainConfig {
                enabled: false,
                service_name: None,
                account_name: None,
                fallback_env: None,
            },
        }
    }

    #[test]
    fn returns_none_when_sqlcipher_disabled() {
        let db = DatabaseConfig {
            url: "sqlite://memory".to_string(),
            use_sqlcipher: false,
            sqlcipher_key_ref: None,
        };
        let security = disabled_security();
        let result = resolve_sqlcipher_key(&db, &security).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn uses_environment_fallback_when_set() {
        let _guard = std::sync::Mutex::new(()).lock().unwrap();
        let db = sample_db();
        let mut security = disabled_security();
        security.keychain.fallback_env = Some("SQLCIPHER_ENV_TEST".to_string());
        std::env::set_var("SQLCIPHER_ENV_TEST", "secret");
        let result = resolve_sqlcipher_key(&db, &security).unwrap();
        std::env::remove_var("SQLCIPHER_ENV_TEST");
        assert_eq!(result.as_deref(), Some("secret"));
    }

    #[test]
    fn parse_reference_handles_defaults() {
        let parsed = parse_reference("svc").unwrap();
        assert_eq!(parsed.0, "svc");
        assert_eq!(parsed.1, "default");
    }
}
