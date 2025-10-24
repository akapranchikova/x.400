use std::fmt;
use std::sync::atomic::{AtomicUsize, Ordering};

static MESSAGE_COUNTER: AtomicUsize = AtomicUsize::new(1);

/// Unique identifier for messages.
#[derive(Clone, Debug, PartialEq, Eq, Hash)]
pub struct MessageId(pub String);

impl MessageId {
    pub fn new() -> Self {
        let id = MESSAGE_COUNTER.fetch_add(1, Ordering::Relaxed);
        Self(format!("msg-{}", id))
    }
}

impl Default for MessageId {
    fn default() -> Self {
        Self::new()
    }
}

impl fmt::Display for MessageId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

/// Basic representation of an address.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Address {
    pub country: String,
    pub organization: String,
    pub surname: String,
}

impl Address {
    pub fn sample() -> Self {
        Self {
            country: "DE".into(),
            organization: "Modern".into(),
            surname: "Operator".into(),
        }
    }
}

/// Message priority options.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MessagePriority {
    Low,
    Normal,
    High,
}

/// Sensitivity flag for a message.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MessageSensitivity {
    Normal,
    Personal,
}

/// Tracking states of a message.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum MessageStatus {
    Queued,
    Delivered,
    Read,
}

/// Envelope metadata stored alongside message content.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MessageEnvelope {
    pub id: MessageId,
    pub subject: String,
    pub sender: Address,
    pub recipients: Vec<Address>,
    pub folder: String,
    pub status: MessageStatus,
    pub priority: MessagePriority,
    pub sensitivity: MessageSensitivity,
}

impl MessageEnvelope {
    pub fn new(subject: &str, sender: Address, recipients: Vec<Address>) -> Self {
        Self {
            id: MessageId::new(),
            subject: subject.into(),
            sender,
            recipients,
            folder: "outbox".into(),
            status: MessageStatus::Queued,
            priority: MessagePriority::Normal,
            sensitivity: MessageSensitivity::Normal,
        }
    }
}

/// Message content stored in the mock store.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct MessageContent {
    pub body: String,
}

/// Complete message representation.
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Message {
    pub envelope: MessageEnvelope,
    pub content: MessageContent,
}
