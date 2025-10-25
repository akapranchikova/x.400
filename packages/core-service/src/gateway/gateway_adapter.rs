use crate::gateway::address_map::{AddressMapper, MappingError};
use crate::gateway::imap_client::{GatewayImapClient, InboundMessage};
use crate::gateway::report_map::{DeliveryReport, ReportMapper};
use crate::gateway::smtp_client::{GatewaySmtpClient, SmtpError, SmtpMessage, SmtpSendOutcome};
use crate::models::Address;

/// Error returned by the high level gateway adapter when an operation fails.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum GatewayError {
    #[error("address mapping failed: {0}")]
    Mapping(#[from] MappingError),
    #[error("SMTP error: {0}")]
    Smtp(#[from] SmtpError),
}

/// Result returned after processing outbound traffic.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct GatewayResult {
    pub message_id: String,
    pub recipients: Vec<String>,
    pub accepted: bool,
    pub warnings: Vec<String>,
}

/// Event emitted when gateway processes items.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum GatewayEvent {
    OutboundQueued(GatewayResult),
    InboundReady(Vec<InboundMessage>),
    ReportMapped(DeliveryReport),
}

/// High level coordinator bridging X.400 and SMTP.
#[derive(Clone, Debug)]
pub struct GatewayAdapter {
    mapper: AddressMapper,
    smtp: GatewaySmtpClient,
    imap: GatewayImapClient,
    reports: ReportMapper,
}

impl GatewayAdapter {
    pub fn new(
        mapper: AddressMapper,
        smtp: GatewaySmtpClient,
        imap: GatewayImapClient,
        reports: ReportMapper,
    ) -> Self {
        Self {
            mapper,
            smtp,
            imap,
            reports,
        }
    }

    /// Map an O/R message to SMTP and send it over the relay.
    pub fn outbound(
        &self,
        _originator: &Address,
        recipients: &[Address],
        subject: &str,
        body: &str,
    ) -> Result<GatewayResult, GatewayError> {
        let mut mapped = Vec::new();
        for recipient in recipients {
            mapped.push(self.mapper.map_or_to_rfc822(recipient)?);
        }
        let message = SmtpMessage {
            id: format!("gw-{}", subject.len()),
            to: mapped.clone(),
            subject: subject.into(),
            body: body.into(),
        };
        let outcome: SmtpSendOutcome = self.smtp.send(message)?;
        Ok(GatewayResult {
            message_id: outcome.message_id,
            recipients: mapped,
            accepted: outcome.accepted,
            warnings: outcome.warnings,
        })
    }

    /// Fetch inbound SMTP messages for conversion to X.400.
    pub fn inbound(&self, limit: usize) -> GatewayEvent {
        let messages = self.imap.fetch(limit);
        GatewayEvent::InboundReady(messages)
    }

    /// Convert a DSN payload to the internal delivery report.
    pub fn handle_dsn(&self, payload: &str, correlation_id: &str) -> GatewayEvent {
        let report = self.reports.from_dsn(payload, correlation_id);
        GatewayEvent::ReportMapped(report)
    }

    /// Convert an MDN payload to the internal representation.
    pub fn handle_mdn(&self, payload: &str, correlation_id: &str) -> GatewayEvent {
        let report = self.reports.from_mdn(payload, correlation_id);
        GatewayEvent::ReportMapped(report)
    }

    /// Perform reverse address translation when ingesting SMTP messages.
    pub fn map_sender(&self, address: &str) -> Result<Address, GatewayError> {
        let mapped = self.mapper.map_rfc822_to_or(address)?;
        Ok(mapped)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config::{GatewayImapConfig, GatewaySmtpConfig};

    fn mapper() -> AddressMapper {
        AddressMapper::new(
            vec![crate::gateway::address_map::AddressMappingRule::new(
                "{S}@example.com",
            )],
            Default::default(),
        )
    }

    fn smtp() -> GatewaySmtpClient {
        GatewaySmtpClient::new(
            GatewaySmtpConfig {
                host: "smtp.example.com".into(),
                port: 587,
                tls: true,
                username: None,
                password: None,
                rate_limit_per_minute: 10,
            },
            vec!["example.com".into()],
        )
    }

    fn imap() -> GatewayImapClient {
        GatewayImapClient::new(GatewayImapConfig {
            host: "imap.example.com".into(),
            port: 993,
            tls: true,
            mailbox: "Inbox".into(),
        })
    }

    #[test]
    fn sends_outbound_messages() {
        let adapter = GatewayAdapter::new(mapper(), smtp(), imap(), ReportMapper::default());
        let originator = Address {
            country: "DE".into(),
            organization: "Org".into(),
            surname: "Sender".into(),
        };
        let recipient = Address {
            country: "DE".into(),
            organization: "Org".into(),
            surname: "Receiver".into(),
        };
        let result = adapter
            .outbound(&originator, &[recipient], "Hello", "Body")
            .expect("should send");
        assert!(result.accepted);
        assert_eq!(result.recipients[0], "receiver@example.com");
    }

    #[test]
    fn maps_inbound_sender() {
        let adapter = GatewayAdapter::new(mapper(), smtp(), imap(), ReportMapper::default());
        let address = adapter.map_sender("receiver@example.com").unwrap();
        assert_eq!(address.surname, "Receiver");
    }
}
