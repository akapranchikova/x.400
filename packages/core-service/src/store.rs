use crate::models::{Message, MessageContent, MessageEnvelope, MessageStatus, Report};
use anyhow::Context;
use chrono::Utc;
use serde_json::json;
use sqlx::{Row, SqlitePool};
use uuid::Uuid;

#[derive(Clone)]
pub struct StoreManager {
    pool: SqlitePool,
}

impl StoreManager {
    pub async fn new(database_url: &str) -> anyhow::Result<Self> {
        let pool = SqlitePool::connect(database_url).await?;
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

    pub async fn get_message(&self, id: Uuid) -> anyhow::Result<Message> {
        let row = sqlx::query(
            r#"SELECT envelope, content, reports FROM messages WHERE id = ?1"#,
        )
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
