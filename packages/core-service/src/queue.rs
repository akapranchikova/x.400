use crate::models::{MessageEnvelope, MessageStatus};
use chrono::Utc;
use std::collections::HashMap;
use std::sync::Arc;
use tokio::sync::RwLock;
use uuid::Uuid;

#[derive(Clone)]
pub struct QueueManager {
    inner: Arc<RwLock<HashMap<Uuid, MessageEnvelope>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(RwLock::new(HashMap::new())),
        }
    }

    pub async fn enqueue(&self, mut envelope: MessageEnvelope) {
        envelope.status = MessageStatus::Queued;
        envelope.folder = "outbox".to_string();
        envelope.updated_at = Utc::now();
        self.inner.write().await.insert(envelope.id, envelope);
    }

    pub async fn folders(&self) -> Vec<FolderInfo> {
        let guard = self.inner.read().await;
        let mut counts: HashMap<String, i64> = HashMap::new();
        for envelope in guard.values() {
            *counts.entry(envelope.folder.clone()).or_default() += 1;
        }

        let defaults = vec![
            ("inbox", "Inbox"),
            ("outbox", "Outbox"),
            ("failed", "Failed"),
            ("archive", "Archive"),
            ("followUp", "Follow-up"),
        ];

        defaults
            .into_iter()
            .map(|(id, name)| FolderInfo {
                id: id.to_string(),
                name: name.to_string(),
                unread_count: counts.get(id).copied().unwrap_or_default(),
            })
            .collect()
    }

    pub async fn move_message(&self, id: Uuid, folder: &str) -> anyhow::Result<()> {
        let mut guard = self.inner.write().await;
        if let Some(envelope) = guard.get_mut(&id) {
            envelope.folder = folder.to_string();
            envelope.updated_at = Utc::now();
            Ok(())
        } else {
            anyhow::bail!("message not found")
        }
    }

    pub async fn archive(&self, id: Uuid) -> anyhow::Result<()> {
        self.move_message(id, "archive").await
    }

    pub async fn delete(&self, id: Uuid) {
        self.inner.write().await.remove(&id);
    }

    pub async fn seed(&self, envelopes: Vec<MessageEnvelope>) {
        let mut guard = self.inner.write().await;
        for envelope in envelopes {
            guard.insert(envelope.id, envelope);
        }
    }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderInfo {
    pub id: String,
    pub name: String,
    pub unread_count: i64,
}

impl Default for QueueManager {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        MessageEnvelope, MessagePriority, MessageSensitivity, MessageStatus, OrName, X400Address,
    };
    use chrono::Utc;

    fn sample_envelope() -> MessageEnvelope {
        MessageEnvelope {
            id: Uuid::new_v4(),
            subject: "Test".to_string(),
            sender: X400Address {
                or_name: OrName {
                    c: "DE".to_string(),
                    admd: None,
                    prmd: None,
                    o: Some("Sender".to_string()),
                    ou: vec![],
                    surname: Some("Operator".to_string()),
                    given_name: None,
                },
                dda: vec![],
                routing_hints: vec![],
            },
            to: vec![],
            cc: vec![],
            bcc: vec![],
            folder: "drafts".to_string(),
            status: MessageStatus::Draft,
            priority: MessagePriority::Normal,
            sensitivity: MessageSensitivity::Normal,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            message_id: "<test@x400>".to_string(),
        }
    }

    #[tokio::test]
    async fn enqueue_moves_message_to_outbox() {
        let queue = QueueManager::new();
        let envelope = sample_envelope();
        queue.enqueue(envelope.clone()).await;

        let folders = queue.folders().await;
        let outbox = folders.into_iter().find(|f| f.id == "outbox").unwrap();
        assert_eq!(outbox.unread_count, 1);
    }

    #[tokio::test]
    async fn move_message_updates_folder() {
        let queue = QueueManager::new();
        let envelope = sample_envelope();
        let id = envelope.id;
        queue.enqueue(envelope.clone()).await;

        queue.move_message(id, "archive").await.unwrap();

        let archived = queue
            .folders()
            .await
            .into_iter()
            .find(|f| f.id == "archive")
            .unwrap();
        assert_eq!(archived.unread_count, 1);
    }

    #[tokio::test]
    async fn archive_alias_works() {
        let queue = QueueManager::new();
        let envelope = sample_envelope();
        let id = envelope.id;
        queue.enqueue(envelope.clone()).await;

        queue.archive(id).await.unwrap();

        let archive_folder = queue
            .folders()
            .await
            .into_iter()
            .find(|f| f.id == "archive")
            .unwrap();
        assert_eq!(archive_folder.unread_count, 1);
    }
}
