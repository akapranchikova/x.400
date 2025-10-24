use crate::config::TransportConfig;
use chrono::{DateTime, NaiveDate, NaiveDateTime, NaiveTime, Utc};
use openssl::asn1::Asn1TimeRef;
use openssl::x509::X509;
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::fs;
use std::path::Path;

#[derive(Debug, Clone, Serialize)]
pub struct TransportTlsState {
    pub enabled: bool,
    pub min_version: String,
    pub ca_loaded: bool,
    pub client_certificate_loaded: bool,
    pub fingerprint: Option<String>,
    pub fingerprint_matches: bool,
    pub expires_at: Option<DateTime<Utc>>,
    pub error: Option<String>,
    pub ocsp_responder_configured: bool,
    pub revocation_checked: bool,
    #[serde(skip_serializing_if = "Vec::is_empty", default)]
    pub warnings: Vec<String>,
}

impl Default for TransportTlsState {
    fn default() -> Self {
        Self {
            enabled: false,
            min_version: "TLS1_3".to_string(),
            ca_loaded: false,
            client_certificate_loaded: false,
            fingerprint: None,
            fingerprint_matches: true,
            expires_at: None,
            error: None,
            ocsp_responder_configured: false,
            revocation_checked: false,
            warnings: Vec::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct TransportTlsSummary {
    pub enabled: bool,
    pub min_version: String,
    pub fingerprint: Option<String>,
    pub fingerprint_matches: bool,
    pub expires_at: Option<String>,
    pub error: Option<String>,
    pub ocsp_responder_configured: bool,
    pub revocation_checked: bool,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub warnings: Vec<String>,
}

impl From<&TransportTlsState> for TransportTlsSummary {
    fn from(state: &TransportTlsState) -> Self {
        Self {
            enabled: state.enabled,
            min_version: state.min_version.clone(),
            fingerprint: state.fingerprint.clone(),
            fingerprint_matches: state.fingerprint_matches,
            expires_at: state.expires_at.map(|dt| dt.to_rfc3339()),
            error: state.error.clone(),
            ocsp_responder_configured: state.ocsp_responder_configured,
            revocation_checked: state.revocation_checked,
            warnings: state.warnings.clone(),
        }
    }
}

pub fn validate(config: &TransportConfig) -> TransportTlsState {
    let mut state = TransportTlsState {
        enabled: config.tls.enabled,
        min_version: normalize_tls_version(&config.tls.min_version),
        ..Default::default()
    };

    if !config.tls.enabled {
        return state;
    }

    let mut errors: Vec<String> = Vec::new();

    if state.min_version != "TLS1_3" {
        errors.push(format!(
            "TLS minimum version must be TLS1_3 (got '{}')",
            config.tls.min_version
        ));
    }

    match fs::read(&config.tls.ca_bundle) {
        Ok(bytes) => {
            state.ca_loaded = true;
            match X509::stack_from_pem(&bytes) {
                Ok(certs) if !certs.is_empty() => {
                    if let Some(first) = certs.first() {
                        if let Ok(fingerprint) = fingerprint(first) {
                            state.fingerprint = Some(fingerprint.clone());
                            if config.tls.enforce_pinset && !config.fingerprints.is_empty() {
                                state.fingerprint_matches =
                                    config.fingerprints.iter().any(|candidate| {
                                        normalize(candidate) == normalize(&fingerprint)
                                    });
                                if !state.fingerprint_matches {
                                    errors.push(
                                        "TLS fingerprint does not match configured pinset"
                                            .to_string(),
                                    );
                                }
                            }
                        }

                        match not_after(first.not_after()) {
                            Ok(expiry) => {
                                state.expires_at = Some(expiry);
                                if expiry < Utc::now() {
                                    errors.push("TLS certificate expired".to_string());
                                }
                            }
                            Err(err) => {
                                errors.push(format!("Failed to parse certificate expiry: {err}"))
                            }
                        }
                    }
                }
                Ok(_) => errors.push("CA bundle does not contain certificates".to_string()),
                Err(err) => errors.push(format!("Invalid CA bundle: {err}")),
            }
        }
        Err(err) => {
            errors.push(format!(
                "Unable to read CA bundle at {}: {err}",
                config.tls.ca_bundle
            ));
        }
    }

    if let Some(cert_path) = &config.tls.client_certificate {
        match fs::read(cert_path) {
            Ok(bytes) => match X509::from_pem(&bytes) {
                Ok(cert) => {
                    state.client_certificate_loaded = true;
                    if state.expires_at.is_none() {
                        if let Ok(expiry) = not_after(cert.not_after()) {
                            state.expires_at = Some(expiry);
                        }
                    }
                }
                Err(err) => errors.push(format!("Invalid client certificate {}: {err}", cert_path)),
            },
            Err(err) => errors.push(format!(
                "Unable to read client certificate {}: {err}",
                cert_path
            )),
        }
    }

    if let Some(key_path) = &config.tls.client_key {
        if !Path::new(key_path).exists() {
            errors.push(format!("Client key not found at {}", key_path));
        }
    }

    if let Some(responder) = &config.tls.ocsp_responder {
        state.ocsp_responder_configured = true;
        state.revocation_checked = false;
        state.warnings.push(format!(
            "OCSP responder configured at {responder}, but live revocation checks are not yet implemented"
        ));
    }

    if config.tls.enforce_pinset && config.fingerprints.is_empty() {
        state
            .warnings
            .push("Fingerprint pinning is enforced but no fingerprints are configured".to_string());
    }

    if !errors.is_empty() {
        state.error = Some(errors.join(", "));
    }

    state
}

fn normalize_tls_version(value: &str) -> String {
    let upper = value.trim().to_uppercase();
    match upper.as_str() {
        "TLS1.3" => "TLS1_3".to_string(),
        "TLS1_3" => "TLS1_3".to_string(),
        "TLS13" => "TLS1_3".to_string(),
        other => other.to_string(),
    }
}

fn fingerprint(cert: &X509) -> Result<String, openssl::error::ErrorStack> {
    let der = cert.to_der()?;
    Ok(format_hash(&der))
}

fn format_hash(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    digest
        .iter()
        .map(|b| format!("{:02X}", b))
        .collect::<Vec<_>>()
        .join(":")
}

fn normalize(value: &str) -> String {
    value
        .chars()
        .filter(|c| !c.is_whitespace() && *c != ':')
        .flat_map(|c| c.to_uppercase())
        .collect()
}

fn not_after(time: &Asn1TimeRef) -> Result<DateTime<Utc>, openssl::error::ErrorStack> {
    let tm = time.to_owned().to_tm()?;
    let date =
        NaiveDate::from_ymd_opt(tm.tm_year + 1900, (tm.tm_mon + 1) as u32, tm.tm_mday as u32);
    let time = NaiveTime::from_hms_opt(tm.tm_hour as u32, tm.tm_min as u32, tm.tm_sec as u32);

    match (date, time) {
        (Some(date), Some(time)) => {
            let naive = NaiveDateTime::new(date, time);
            Ok(DateTime::<Utc>::from_naive_utc_and_offset(naive, Utc))
        }
        _ => Err(openssl::error::ErrorStack::get()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{TransportMode, TransportTlsConfig};

    #[test]
    fn disabled_tls_returns_default() {
        let config = TransportConfig {
            mode: TransportMode::Mock,
            profiles_dir: "profiles".to_string(),
            tls: TransportTlsConfig {
                enabled: false,
                ..Default::default()
            },
            fingerprints: vec![],
            sdk: Default::default(),
        };
        let state = validate(&config);
        assert!(!state.enabled);
        assert!(!state.ca_loaded);
    }

    #[test]
    fn ocsp_configuration_sets_warning() {
        let config = TransportConfig {
            mode: TransportMode::Mock,
            profiles_dir: "profiles".to_string(),
            tls: TransportTlsConfig {
                enabled: true,
                ocsp_responder: Some("http://ocsp.local".to_string()),
                ..Default::default()
            },
            fingerprints: vec![],
            sdk: Default::default(),
        };

        let state = validate(&config);
        assert!(state.ocsp_responder_configured);
        assert!(!state.revocation_checked);
        assert!(!state.warnings.is_empty());
    }
}
