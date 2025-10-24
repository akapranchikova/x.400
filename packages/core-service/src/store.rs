use crate::models::{Message, MessageContent, MessageEnvelope, MessageStatus, Report};
use anyhow::Context;
use chrono::Utc;
use serde_json::json;
use sqlx::{sqlite::SqliteConnectOptions, Row, SqlitePool};
use std::path::Path;
use std::str::FromStr;
use tracing::warn;
use uuid::Uuid;

#[derive(Clone)]
pub struct StoreManager {
    pool: SqlitePool,
}

impl StoreManager {
    pub async fn new(database_url: &str) -> anyhow::Result<Self> {
        Self::new_secure(database_url, None).await
    }

    pub async fn new_secure(
        database_url: &str,
        sqlcipher_key: Option<&str>,
    ) -> anyhow::Result<Self> {
        ensure_sqlite_parent_exists(database_url).await?;
        let options = SqliteConnectOptions::from_str(database_url)?.create_if_missing(true);
        let pool = SqlitePool::connect_with(options).await?;

        if let Some(key) = sqlcipher_key.and_then(|value| {
            let trimmed = value.trim();
            if trimmed.is_empty() {
                None
            } else {
                Some(trimmed.to_string())
            }
        }) {
            apply_sqlcipher_key(&pool, &key).await;
        }

        Ok(Self { pool })
    }

    pub async fn init(&self) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                envelope TEXT NOT NULL,
                content TEXT NOT NULL,
                reports TEXT NOT NULL,
                folder TEXT NOT NULL,
                status TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            "#,
        )
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn save_message(&self, message: &Message) -> anyhow::Result<()> {
        sqlx::query(
            r#"
            INSERT INTO messages (id, envelope, content, reports, folder, status, created_at, updated_at)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
            ON CONFLICT(id) DO UPDATE SET
                envelope = excluded.envelope,
                content = excluded.content,
                reports = excluded.reports,
                folder = excluded.folder,
                status = excluded.status,
                updated_at = excluded.updated_at
            "#,
        )
        .bind(message.envelope.id.to_string())
        .bind(serde_json::to_string(&message.envelope)?)
        .bind(serde_json::to_string(&message.content)?)
        .bind(serde_json::to_string(&message.reports)?)
        .bind(&message.envelope.folder)
        .bind(format!("{:?}", message.envelope.status))
        .bind(message.envelope.created_at.to_rfc3339())
        .bind(Utc::now().to_rfc3339())
        .execute(&self.pool)
        .await?;
        Ok(())
    }

    pub async fn list_messages(&self, folder: &str) -> anyhow::Result<Vec<MessageEnvelope>> {
        let rows = sqlx::query(
            r#"SELECT envelope FROM messages WHERE folder = ?1 ORDER BY created_at DESC"#,
        )
        .bind(folder)
        .fetch_all(&self.pool)
        .await?;

        let mut messages = Vec::new();
        for row in rows {
            let envelope_json: String = row.get("envelope");
            let envelope: MessageEnvelope = serde_json::from_str(&envelope_json)?;
            messages.push(envelope);
        }

        Ok(messages)
    }

    pub async fn search_messages(&self, keyword: &str) -> anyhow::Result<Vec<MessageEnvelope>> {
        let pattern = format!("%{}%", keyword);
        let rows = sqlx::query(
            r#"
            SELECT envelope FROM messages
            WHERE envelope LIKE ?1 OR content LIKE ?1
            ORDER BY created_at DESC
            "#,
        )
        .bind(pattern)
        .fetch_all(&self.pool)
        .await?;

        let mut messages = Vec::new();
        for row in rows {
            let envelope_json: String = row.get("envelope");
            let envelope: MessageEnvelope = serde_json::from_str(&envelope_json)?;
            messages.push(envelope);
        }

        Ok(messages)
    }

    pub async fn get_message(&self, id: Uuid) -> anyhow::Result<Message> {
        let row = sqlx::query(r#"SELECT envelope, content, reports FROM messages WHERE id = ?1"#)
            .bind(id.to_string())
            .fetch_one(&self.pool)
            .await
            .context("message not found")?;

        let envelope: MessageEnvelope = serde_json::from_str(&row.get::<String, _>("envelope"))?;
        let content: MessageContent = serde_json::from_str(&row.get::<String, _>("content"))?;
        let reports: Vec<Report> = serde_json::from_str(&row.get::<String, _>("reports"))?;

        Ok(Message {
            envelope,
            content,
            reports,
        })
    }

    pub async fn delete_message(&self, id: Uuid) -> anyhow::Result<()> {
        sqlx::query("DELETE FROM messages WHERE id = ?1")
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn move_message(&self, id: Uuid, folder: &str) -> anyhow::Result<()> {
        sqlx::query("UPDATE messages SET folder = ?1 WHERE id = ?2")
            .bind(folder)
            .bind(id.to_string())
            .execute(&self.pool)
            .await?;
        Ok(())
    }

    pub async fn archive_message(&self, id: Uuid) -> anyhow::Result<()> {
        self.move_message(id, "archive").await
    }

    pub async fn seed_demo_data(&self) -> anyhow::Result<Vec<Message>> {
        if sqlx::query("SELECT COUNT(*) as count FROM messages")
            .fetch_one(&self.pool)
            .await?
            .get::<i64, _>("count")
            > 0
        {
            return Ok(vec![]);
        }

        let sender = json!({
            "or_name": {
                "c": "DE",
                "o": "Modernization",
                "surname": "Operator"
            },
            "dda": [],
            "routing_hints": []
        });

        let message_id = Uuid::new_v4();
        let envelope = MessageEnvelope {
            id: message_id,
            subject: "Welcome to the modernized X.400 client".to_string(),
            sender: serde_json::from_value(sender.clone())?,
            to: vec![serde_json::from_value(sender.clone())?],
            cc: vec![],
            bcc: vec![],
            folder: "inbox".to_string(),
            status: MessageStatus::Delivered,
            priority: crate::models::MessagePriority::Normal,
            sensitivity: crate::models::MessageSensitivity::Normal,
            created_at: Utc::now(),
            updated_at: Utc::now(),
            message_id: format!("<{}@modernized.x400>", message_id),
        };

        let content = MessageContent {
            text: "This is a mock message generated by the development service.".to_string(),
            attachments: vec![],
        };

        let message = Message {
            envelope: envelope.clone(),
            content: content.clone(),
            reports: vec![],
        };

        self.save_message(&message).await?;

        Ok(vec![message])
    }
}

async fn ensure_sqlite_parent_exists(database_url: &str) -> anyhow::Result<()> {
    if let Some(path) = database_url.strip_prefix("sqlite://") {
        if !path.starts_with(':') {
            let path = Path::new(path);
            if let Some(parent) = path.parent().filter(|p| !p.as_os_str().is_empty()) {
                tokio::fs::create_dir_all(parent).await?;
            }
        }
    }

    Ok(())
}

async fn apply_sqlcipher_key(pool: &SqlitePool, key: &str) {
    let sanitized = key.replace('"', "\"");
    let escaped = sanitized.replace('\'', "''");
    let pragma = format!("PRAGMA key = '{escaped}';");
    if let Err(err) = sqlx::query(&pragma).execute(pool).await {
        warn!(error = %err, "Unable to apply SQLCipher key");
        return;
    }

    if let Err(err) = sqlx::query("PRAGMA cipher_memory_security = ON;")
        .execute(pool)
        .await
    {
        warn!(error = %err, "Unable to enable SQLCipher memory security");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::models::{
        Message, MessageContent, MessageEnvelope, MessagePriority, MessageSensitivity,
        MessageStatus, OrName, X400Address,
    };
    use chrono::Utc;
    use tempfile::tempdir;
    use uuid::Uuid;

    fn sample_message(folder: &str, subject: &str) -> Message {
        let id = Uuid::new_v4();
        let now = Utc::now();
        let envelope = MessageEnvelope {
            id,
            subject: subject.to_string(),
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
            folder: folder.to_string(),
            status: MessageStatus::Delivered,
            priority: MessagePriority::Normal,
            sensitivity: MessageSensitivity::Normal,
            created_at: now,
            updated_at: now,
            message_id: format!("<{}@test>", id),
        };

        Message {
            envelope,
            content: MessageContent {
                text: format!("Message body for {}", subject),
                attachments: vec![],
            },
            reports: vec![],
        }
    }

    #[tokio::test]
    async fn save_and_get_message_roundtrip() {
        let store = StoreManager::new("sqlite::memory:").await.unwrap();
        store.init().await.unwrap();

        let message = sample_message("inbox", "Roundtrip");
        store.save_message(&message).await.unwrap();

        let fetched = store.get_message(message.envelope.id).await.unwrap();
        assert_eq!(fetched.envelope.subject, "Roundtrip");
    }

    #[tokio::test]
    async fn list_and_move_messages_between_folders() {
        let store = StoreManager::new("sqlite::memory:").await.unwrap();
        store.init().await.unwrap();

        let message = sample_message("inbox", "MoveMe");
        store.save_message(&message).await.unwrap();

        let inbox = store.list_messages("inbox").await.unwrap();
        assert_eq!(inbox.len(), 1);

        store
            .move_message(message.envelope.id, "archive")
            .await
            .unwrap();
        let archived = store.list_messages("archive").await.unwrap();
        assert_eq!(archived.len(), 1);
    }

    #[tokio::test]
    async fn search_returns_matching_messages() {
        let store = StoreManager::new("sqlite::memory:").await.unwrap();
        store.init().await.unwrap();

        let message = sample_message("inbox", "FTS Match");
        store.save_message(&message).await.unwrap();

        let results = store.search_messages("FTS").await.unwrap();
        assert_eq!(results.len(), 1);
    }

    #[tokio::test]
    async fn ensure_parent_directory_is_created_for_file_urls() {
        let temp = tempdir().unwrap();
        let db_path = temp.path().join("nested").join("db.sqlite");
        let url = format!("sqlite://{}", db_path.display());

        ensure_sqlite_parent_exists(&url).await.unwrap();

        assert!(db_path.parent().unwrap().exists());
    }

    #[tokio::test]
    async fn ensure_parent_directory_ignores_memory_urls() {
        ensure_sqlite_parent_exists("sqlite::memory:")
            .await
            .expect("memory URLs should not fail");
    }

    #[tokio::test]
    async fn new_secure_accepts_sqlcipher_keys() {
        let store = StoreManager::new_secure("sqlite::memory:", Some("topsecret"))
            .await
            .expect("store with sqlcipher key");
        store.init().await.expect("init store");
    }
}
