use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_with::serde_as;
use uuid::Uuid;

#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OrName {
    pub c: String,
    pub admd: Option<String>,
    pub prmd: Option<String>,
    pub o: Option<String>,
    #[serde(default)]
    pub ou: Vec<String>,
    pub surname: Option<String>,
    pub given_name: Option<String>,
}

#[serde_as]
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct X400Address {
    pub or_name: OrName,
    #[serde(default)]
    pub dda: Vec<Dda>,
    #[serde(default)]
    pub routing_hints: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Dda {
    pub r#type: String,
    pub value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Attachment {
    pub id: Uuid,
    pub filename: String,
    pub mime_type: String,
    pub size: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageEnvelope {
    pub id: Uuid,
    pub subject: String,
    pub sender: X400Address,
    pub to: Vec<X400Address>,
    #[serde(default)]
    pub cc: Vec<X400Address>,
    #[serde(default)]
    pub bcc: Vec<X400Address>,
    pub folder: String,
    pub status: MessageStatus,
    pub priority: MessagePriority,
    pub sensitivity: MessageSensitivity,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub message_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageStatus {
    Draft,
    Queued,
    Sent,
    Delivered,
    Read,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum MessagePriority {
    Normal,
    NonUrgent,
    Urgent,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageSensitivity {
    Normal,
    Personal,
    Private,
    Confidential,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageContent {
    pub text: String,
    pub attachments: Vec<Attachment>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Message {
    pub envelope: MessageEnvelope,
    pub content: MessageContent,
    #[serde(default)]
    pub reports: Vec<Report>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReportType {
    Delivery,
    NonDelivery,
    Read,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Report {
    pub id: Uuid,
    pub message_id: Uuid,
    pub r#type: ReportType,
    pub timestamp: DateTime<Utc>,
    #[serde(default)]
    pub diagnostic_code: Option<String>,
    #[serde(default)]
    pub supplemental_info: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ComposeRequest {
    pub sender: X400Address,
    pub recipients: Vec<X400Address>,
    pub subject: String,
    #[serde(default)]
    pub body: String,
    #[serde(default)]
    pub strategy: Option<u8>,
}

#[derive(Debug, Deserialize)]
pub struct SubmitRequest {
    pub envelope: MessageEnvelope,
    pub content: MessageContent,
    #[serde(default)]
    pub strategy: Option<u8>,
}

#[derive(Debug, Serialize)]
pub struct SubmitResponse {
    pub message_id: Uuid,
    pub queue_reference: String,
    pub status: String,
    pub strategy: u8,
}

#[derive(Debug, Deserialize)]
pub struct MoveRequest {
    pub folder_id: String,
}

#[derive(Debug, Serialize)]
pub struct TraceBundle {
    pub entries: Vec<serde_json::Value>,
}

impl Default for MessageStatus {
    fn default() -> Self {
        MessageStatus::Draft
    }
}

impl Default for MessagePriority {
    fn default() -> Self {
        MessagePriority::Normal
    }
}

impl Default for MessageSensitivity {
    fn default() -> Self {
        MessageSensitivity::Normal
    }
}
