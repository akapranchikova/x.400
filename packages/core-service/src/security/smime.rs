use crate::config::SmimeConfig;
use anyhow::{Context, Result};
use openssl::pkcs7::{Pkcs7, Pkcs7Flags};
use openssl::pkey::PKey;
use openssl::stack::Stack;
use openssl::symm::Cipher;
use openssl::x509::{store::X509StoreBuilder, X509};
use std::fs;
use std::path::{Path, PathBuf};
use tracing::{info, warn};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SmimeOperation {
    Sign,
    Encrypt,
    Verify,
}

#[derive(Debug, Clone)]
pub struct SmimeResult {
    pub operation: SmimeOperation,
    pub success: bool,
    pub payload: Option<Vec<u8>>,
    pub message: Option<String>,
}

impl SmimeResult {
    pub fn completed(operation: SmimeOperation, payload: Vec<u8>) -> Self {
        Self {
            operation,
            success: true,
            payload: Some(payload),
            message: None,
        }
    }

    pub fn skipped(operation: SmimeOperation, reason: impl Into<String>) -> Self {
        Self {
            operation,
            success: false,
            payload: None,
            message: Some(reason.into()),
        }
    }

    pub fn failed(operation: SmimeOperation, reason: impl Into<String>) -> Self {
        Self {
            operation,
            success: false,
            payload: None,
            message: Some(reason.into()),
        }
    }
}

#[derive(Clone)]
pub struct SmimeService {
    config: SmimeConfig,
}

impl SmimeService {
    pub fn new(config: SmimeConfig) -> Self {
        Self { config }
    }

    pub fn warmup(&self) -> Result<()> {
        if !self.config.enabled {
            return Ok(());
        }

        let (cert_path, key_path, _, _) = self.load_signing_material()?;

        let encryption_path = self.default_encryption_cert_path()?;
        if encryption_path.exists() {
            let _ = load_certificate(&encryption_path)?;
        } else {
            warn!(
                path = %encryption_path.display(),
                "S/MIME encryption certificate missing"
            );
        }

        info!(
            signing_cert = %cert_path.display(),
            signing_key = %key_path.display(),
            "S/MIME materials validated"
        );

        Ok(())
    }

    pub fn sign(&self, data: &[u8]) -> Result<SmimeResult> {
        if !self.config.enabled {
            return Ok(SmimeResult::skipped(
                SmimeOperation::Sign,
                "S/MIME disabled in configuration",
            ));
        }

        let (cert_path, _, certificate, private_key) = self.load_signing_material()?;

        let flags = Pkcs7Flags::STREAM | Pkcs7Flags::DETACHED;
        let stack = Stack::new()?;
        let pkcs7 = Pkcs7::sign(&certificate, &private_key, &stack, data, flags)
            .context("failed to generate PKCS#7 signature")?;
        let signature = pkcs7.to_der()?;
        info!(cert = %cert_path.display(), "Generated S/MIME signature");
        Ok(SmimeResult::completed(SmimeOperation::Sign, signature))
    }

    pub fn encrypt(&self, data: &[u8]) -> Result<SmimeResult> {
        if !self.config.enabled {
            return Ok(SmimeResult::skipped(
                SmimeOperation::Encrypt,
                "S/MIME disabled in configuration",
            ));
        }

        let cert_path = self.default_encryption_cert_path()?;
        let recipient = load_certificate(&cert_path)?;
        let mut stack = Stack::new()?;
        stack
            .push(recipient)
            .context("failed to push recipient certificate")?;

        let pkcs7 = Pkcs7::encrypt(&stack, data, Cipher::aes_256_cbc(), Pkcs7Flags::STREAM)
            .context("failed to encrypt payload")?;
        let encrypted = pkcs7.to_der()?;
        info!(
            cert = %cert_path.display(),
            "Encrypted message with recipient certificate"
        );
        Ok(SmimeResult::completed(SmimeOperation::Encrypt, encrypted))
    }

    pub fn verify(&self, signature: &[u8], payload: &[u8]) -> Result<SmimeResult> {
        if !self.config.enabled {
            return Ok(SmimeResult::skipped(
                SmimeOperation::Verify,
                "S/MIME disabled in configuration",
            ));
        }

        let pkcs7 = match Pkcs7::from_der(signature) {
            Ok(value) => value,
            Err(error) => {
                warn!(error = %error, "Invalid PKCS#7 signature");
                return Ok(SmimeResult::failed(
                    SmimeOperation::Verify,
                    format!("invalid signature: {error}"),
                ));
            }
        };

        let mut stack = Stack::new()?;
        let store = X509StoreBuilder::new()?.build();
        // We do not provide additional certificates for now to avoid strict dependency
        // on vendor PKI bundles. The verify call ensures structural validation.
        let mut output = Vec::new();
        match pkcs7.verify(
            &stack,
            &store,
            Some(payload),
            Some(&mut output),
            Pkcs7Flags::NOVERIFY | Pkcs7Flags::BINARY | Pkcs7Flags::DETACHED,
        ) {
            Ok(()) => {
                info!("S/MIME signature structure verified");
                Ok(SmimeResult::completed(SmimeOperation::Verify, Vec::new()))
            }
            Err(error) => {
                warn!(error = %error, "S/MIME verification failed");
                Ok(SmimeResult::failed(
                    SmimeOperation::Verify,
                    format!("verification failed: {error}"),
                ))
            }
        }
    }

    fn signing_material_paths(&self) -> Result<(PathBuf, PathBuf)> {
        let dir = Path::new(&self.config.certificates_dir);
        let cert_path = self
            .config
            .default_signing_certificate
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| dir.join("signing.pem"));
        let key_path = dir.join("signing.key");
        Ok((cert_path, key_path))
    }

    fn default_encryption_cert_path(&self) -> Result<PathBuf> {
        let dir = Path::new(&self.config.certificates_dir);
        Ok(self
            .config
            .default_encryption_certificate
            .as_ref()
            .map(PathBuf::from)
            .unwrap_or_else(|| dir.join("encryption.pem")))
    }

    fn load_signing_material(
        &self,
    ) -> Result<(PathBuf, PathBuf, X509, PKey<openssl::pkey::Private>)> {
        let (cert_path, key_path) = self.signing_material_paths()?;
        let certificate = load_certificate(&cert_path)?;
        let private_key = load_private_key(&key_path)?;
        Ok((cert_path, key_path, certificate, private_key))
    }
}

fn load_certificate(path: &Path) -> Result<X509> {
    let bytes = fs::read(path)
        .with_context(|| format!("unable to read certificate: {}", path.display()))?;
    X509::from_pem(&bytes).with_context(|| format!("invalid certificate at {}", path.display()))
}

fn load_private_key(path: &Path) -> Result<PKey<openssl::pkey::Private>> {
    let bytes = fs::read(path)
        .with_context(|| format!("unable to read private key: {}", path.display()))?;
    PKey::private_key_from_pem(&bytes)
        .with_context(|| format!("invalid private key at {}", path.display()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use openssl::asn1::Asn1Time;
    use openssl::hash::MessageDigest;
    use openssl::rsa::Rsa;
    use openssl::x509::X509NameBuilder;
    use tempfile::tempdir;

    #[test]
    fn skip_when_disabled() {
        let service = SmimeService::new(SmimeConfig {
            enabled: false,
            certificates_dir: "certs".to_string(),
            default_signing_certificate: None,
            default_encryption_certificate: None,
        });

        let result = service.sign(b"hello").unwrap();
        assert!(!result.success);
        assert_eq!(result.operation, SmimeOperation::Sign);

        let verify = service.verify(b"deadbeef", b"payload").unwrap();
        assert!(!verify.success);
        assert_eq!(verify.operation, SmimeOperation::Verify);
    }

    #[test]
    fn warmup_and_sign_with_generated_material() {
        let dir = tempdir().unwrap();
        let (cert_path, key_path, encryption_path) = generate_test_material(dir.path());

        let service = SmimeService::new(SmimeConfig {
            enabled: true,
            certificates_dir: dir.path().to_string_lossy().into_owned(),
            default_signing_certificate: Some(cert_path.to_string_lossy().into_owned()),
            default_encryption_certificate: Some(encryption_path.to_string_lossy().into_owned()),
        });

        service.warmup().expect("warmup succeeds");
        let signature = service.sign(b"hello-world").expect("sign");
        assert!(signature.success);
        let signature_bytes = signature.payload.clone().expect("signature bytes");
        let verify = service
            .verify(&signature_bytes, b"hello-world")
            .expect("verify");
        assert!(verify.success);

        // Ensure encryption uses same certificate and succeeds structurally
        let encrypted = service.encrypt(b"hello-world").expect("encrypt");
        assert!(encrypted.success);

        drop(key_path); // ensure tempdir lives until end
    }

    fn generate_test_material(base: &Path) -> (PathBuf, PathBuf, PathBuf) {
        let rsa = Rsa::generate(2048).expect("rsa");
        let pkey = PKey::from_rsa(rsa).expect("pkey");
        let mut name = X509NameBuilder::new().expect("name builder");
        name.append_entry_by_text("CN", "Test Certificate")
            .expect("name entry");
        let name = name.build();

        let mut builder = X509::builder().expect("builder");
        builder.set_version(2).expect("version");
        builder.set_subject_name(&name).expect("subject");
        builder.set_issuer_name(&name).expect("issuer");
        builder.set_pubkey(&pkey).expect("set public key");
        builder
            .set_not_before(&Asn1Time::days_from_now(0).expect("not before"))
            .expect("set not before");
        builder
            .set_not_after(&Asn1Time::days_from_now(365).expect("not after"))
            .expect("set not after");
        builder
            .sign(&pkey, MessageDigest::sha256())
            .expect("sign cert");
        let cert = builder.build();

        let cert_path = base.join("signing.pem");
        let key_path = base.join("signing.key");
        let encryption_path = base.join("encryption.pem");

        fs::write(&cert_path, cert.to_pem().expect("cert pem")).expect("write cert");
        fs::write(&key_path, pkey.private_key_to_pem_pkcs8().expect("key pem")).expect("write key");
        fs::write(&encryption_path, cert.to_pem().expect("enc pem")).expect("write enc");

        (cert_path, key_path, encryption_path)
    }
}
