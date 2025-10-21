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
