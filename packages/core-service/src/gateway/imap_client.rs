use std::sync::{Arc, Mutex};

use crate::config::GatewayImapConfig;

/// Simplified inbound message representation fetched from IMAP.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct InboundMessage {
    pub uid: String,
    pub subject: String,
    pub from: String,
    pub raw: String,
}

/// Minimal IMAP client abstraction used by tests and the gateway adapter.
#[derive(Clone, Debug)]
pub struct GatewayImapClient {
    config: GatewayImapConfig,
    mailbox: Arc<Mutex<Vec<InboundMessage>>>,
}

impl GatewayImapClient {
    pub fn new(config: GatewayImapConfig) -> Self {
        Self {
            config,
            mailbox: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub fn enqueue(&self, message: InboundMessage) {
        if let Ok(mut queue) = self.mailbox.lock() {
            queue.push(message);
        }
    }

    /// Fetch unseen messages up to the requested limit.
    pub fn fetch(&self, limit: usize) -> Vec<InboundMessage> {
        let mut drained = Vec::new();
        if let Ok(mut queue) = self.mailbox.lock() {
            let take = limit.min(queue.len());
            for _ in 0..take {
                if let Some(message) = queue.pop() {
                    drained.push(message);
                }
            }
        }
        drained
    }

    pub fn config(&self) -> &GatewayImapConfig {
        &self.config
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fetches_messages_in_fifo_order() {
        let client = GatewayImapClient::new(GatewayImapConfig {
            host: "imap.example.com".into(),
            port: 993,
            tls: true,
            mailbox: "Inbox".into(),
        });
        client.enqueue(InboundMessage {
            uid: "1".into(),
            subject: "First".into(),
            from: "user@example.com".into(),
            raw: "raw1".into(),
        });
        client.enqueue(InboundMessage {
            uid: "2".into(),
            subject: "Second".into(),
            from: "user@example.com".into(),
            raw: "raw2".into(),
        });

        let fetched = client.fetch(1);
        assert_eq!(fetched.len(), 1);
        assert_eq!(fetched[0].uid, "2");
    }
}
