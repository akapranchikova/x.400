pub mod address_map;
pub mod gateway_adapter;
pub mod imap_client;
pub mod report_map;
pub mod smtp_client;

pub use address_map::{AddressMapper, AddressMappingRule};
pub use gateway_adapter::{GatewayAdapter, GatewayEvent, GatewayResult};
pub use imap_client::{GatewayImapClient, InboundMessage};
pub use report_map::{DeliveryReport, ReportMapper};
pub use smtp_client::{GatewaySmtpClient, SmtpMessage, SmtpSendOutcome};
