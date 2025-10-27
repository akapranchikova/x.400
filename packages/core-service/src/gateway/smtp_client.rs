use std::sync::{Arc, Mutex};

use crate::config::GatewaySmtpConfig;

/// Representation of a message scheduled for SMTP delivery.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SmtpMessage {
    pub id: String,
    pub to: Vec<String>,
    pub subject: String,
    pub body: String,
}

/// Outcome returned by the gateway SMTP client.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct SmtpSendOutcome {
    pub accepted: bool,
    pub message_id: String,
    pub warnings: Vec<String>,
}

/// Error returned when the SMTP client cannot dispatch the message.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum SmtpError {
    #[error("recipient domain is not in the allow list: {0}")]
    DomainNotAllowed(String),
    #[error("TLS is required but disabled in configuration")]
    TlsRequired,
    #[error("rate limit exceeded")]
    RateLimited,
}

/// Lightweight SMTP client used for integration tests.
#[derive(Clone, Debug)]
pub struct GatewaySmtpClient {
    config: GatewaySmtpConfig,
    allow_list: Vec<String>,
    sent: Arc<Mutex<Vec<SmtpMessage>>>,
    max_buffer: usize,
}

impl GatewaySmtpClient {
    pub fn new(config: GatewaySmtpConfig, allow_list: Vec<String>) -> Self {
        Self {
            config,
            allow_list,
            sent: Arc::new(Mutex::new(Vec::new())),
            max_buffer: 256,
        }
    }

    fn check_domain(&self, recipient: &str) -> Result<(), SmtpError> {
        if let Some(domain) = recipient.split('@').nth(1) {
            if self
                .allow_list
                .iter()
                .any(|allowed| domain.eq_ignore_ascii_case(allowed))
            {
                return Ok(());
            }
            return Err(SmtpError::DomainNotAllowed(domain.into()));
        }
        Ok(())
    }

    fn rate_limited(&self) -> bool {
        if let Ok(sent) = self.sent.lock() {
            sent.len() >= self.max_buffer
        } else {
            false
        }
    }

    /// Submit a message to the mocked SMTP relay.
    pub fn send(&self, message: SmtpMessage) -> Result<SmtpSendOutcome, SmtpError> {
        if !self.config.tls {
            return Err(SmtpError::TlsRequired);
        }
        for recipient in &message.to {
            self.check_domain(recipient)?;
        }
        if self.rate_limited() {
            return Err(SmtpError::RateLimited);
        }
        if let Ok(mut buffer) = self.sent.lock() {
            buffer.push(message.clone());
        }
        Ok(SmtpSendOutcome {
            accepted: true,
            message_id: message.id,
            warnings: Vec::new(),
        })
    }

    /// Retrieve the messages that have been sent through the client.
    pub fn delivered(&self) -> Vec<SmtpMessage> {
        self.sent
            .lock()
            .map(|buffer| buffer.clone())
            .unwrap_or_default()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn config() -> GatewaySmtpConfig {
        GatewaySmtpConfig {
            host: "smtp.example.com".into(),
            port: 587,
            tls: true,
            username: None,
            password: None,
            rate_limit_per_minute: 10,
        }
    }

    #[test]
    fn rejects_disallowed_domains() {
        let client = GatewaySmtpClient::new(config(), vec!["example.com".into()]);
        let err = client
            .send(SmtpMessage {
                id: "1".into(),
                to: vec!["user@forbidden.com".into()],
                subject: "Test".into(),
                body: "Hello".into(),
            })
            .unwrap_err();
        assert!(matches!(err, SmtpError::DomainNotAllowed(_)));
    }

    #[test]
    fn stores_delivered_messages() {
        let client = GatewaySmtpClient::new(config(), vec!["example.com".into()]);
        let result = client
            .send(SmtpMessage {
                id: "42".into(),
                to: vec!["user@example.com".into()],
                subject: "Test".into(),
                body: "Hello".into(),
            })
            .unwrap();
        assert!(result.accepted);
        let stored = client.delivered();
        assert_eq!(stored.len(), 1);
        assert_eq!(stored[0].id, "42");
    }
}
