use crate::config::{AppConfig, TransportMode};
use crate::models::{
    ComposeRequest, Message, MessageContent, MessageEnvelope, MessageStatus, MoveRequest,
    SubmitRequest, SubmitResponse, TraceBundle,
};
use crate::queue::{FolderInfo, QueueManager};
use crate::store::StoreManager;
use crate::trace::TraceManager;
use crate::transport::{TransportTlsState, TransportTlsSummary};
use axum::extract::{Path, Query, State};
use axum::http::StatusCode;
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::sync::Arc;
use uuid::Uuid;

#[derive(Clone)]
pub struct AppState {
    pub queue: QueueManager,
    pub store: StoreManager,
    pub trace: TraceManager,
    pub config: Arc<AppConfig>,
    pub transport_mode: TransportMode,
    pub tls_state: TransportTlsState,
    pub smime_enabled: bool,
}

#[derive(Debug, Deserialize)]
pub struct MessagesQuery {
    pub folder: Option<String>,
}

pub async fn get_folders(State(state): State<AppState>) -> Json<Vec<FolderInfo>> {
    let folders = state.queue.folders().await;
    Json(folders)
}

pub async fn list_messages(
    State(state): State<AppState>,
    Query(query): Query<MessagesQuery>,
) -> Json<Vec<MessageEnvelope>> {
    let folder = query.folder.unwrap_or_else(|| "inbox".to_string());
    let messages = state.store.list_messages(&folder).await.unwrap_or_default();
    Json(messages)
}

pub async fn get_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
) -> Result<Json<Message>, StatusCode> {
    let message = state
        .store
        .get_message(id)
        .await
        .map_err(|_| StatusCode::NOT_FOUND)?;
    Ok(Json(message))
}

pub async fn delete_message(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    state.queue.delete(id).await;
    if state.store.delete_message(id).await.is_ok() {
        state
            .trace
            .record("message.delete", json!({ "messageId": id }))
            .await;
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn move_message(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<MoveRequest>,
) -> StatusCode {
    if state
        .queue
        .move_message(id, &payload.folder_id)
        .await
        .is_ok()
    {
        let _ = state.store.move_message(id, &payload.folder_id).await;
        state
            .trace
            .record(
                "message.move",
                json!({
                    "messageId": id,
                    "targetFolder": payload.folder_id
                }),
            )
            .await;
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn archive_message(State(state): State<AppState>, Path(id): Path<Uuid>) -> StatusCode {
    if state.queue.archive(id).await.is_ok() {
        let _ = state.store.archive_message(id).await;
        state
            .trace
            .record("message.archive", json!({ "messageId": id }))
            .await;
        StatusCode::NO_CONTENT
    } else {
        StatusCode::NOT_FOUND
    }
}

pub async fn compose(
    State(state): State<AppState>,
    Json(payload): Json<ComposeRequest>,
) -> Json<SubmitResponse> {
    let message_id = Uuid::new_v4();
    let now = chrono::Utc::now();

    let envelope = MessageEnvelope {
        id: message_id,
        subject: payload.subject.clone(),
        sender: payload.sender.clone(),
        to: payload.recipients.clone(),
        cc: vec![],
        bcc: vec![],
        folder: "outbox".to_string(),
        status: MessageStatus::Queued,
        priority: crate::models::MessagePriority::Normal,
        sensitivity: crate::models::MessageSensitivity::Normal,
        created_at: now,
        updated_at: now,
        message_id: format!("<{}@modernized.x400>", message_id),
    };

    let content = MessageContent {
        text: payload.body.clone(),
        attachments: vec![],
    };

    let message = Message {
        envelope: envelope.clone(),
        content: content.clone(),
        reports: vec![],
    };

    let _ = state.store.save_message(&message).await;
    state.queue.enqueue(envelope.clone()).await;
    state
        .trace
        .record(
            "message.compose",
            json!({
                "messageId": message_id,
                "strategy": payload.strategy.unwrap_or(state.config.submit.default_strategy)
            }),
        )
        .await;

    Json(SubmitResponse {
        message_id,
        queue_reference: format!("queue://outbox/{}", message_id),
        status: "queued".to_string(),
        strategy: payload
            .strategy
            .unwrap_or(state.config.submit.default_strategy),
    })
}

pub async fn submit(
    State(state): State<AppState>,
    Json(payload): Json<SubmitRequest>,
) -> Json<SubmitResponse> {
    let strategy = payload
        .strategy
        .unwrap_or_else(|| state.config.submit.default_strategy);

    let message = Message {
        envelope: payload.envelope.clone(),
        content: payload.content.clone(),
        reports: vec![],
    };

    let _ = state.store.save_message(&message).await;
    state.queue.enqueue(payload.envelope.clone()).await;
    state
        .trace
        .record(
            "message.submit",
            json!({
                "messageId": payload.envelope.id,
                "strategy": strategy
            }),
        )
        .await;

    Json(SubmitResponse {
        message_id: payload.envelope.id,
        queue_reference: format!("queue://outbox/{}", payload.envelope.id),
        status: "queued".to_string(),
        strategy,
    })
}

pub async fn trace_bundle(State(state): State<AppState>) -> Json<TraceBundle> {
    let entries = state.trace.bundle().await;
    Json(TraceBundle { entries })
}

#[derive(Debug, Serialize)]
pub struct ServiceStatusResponse {
    pub transport_mode: TransportMode,
    pub tls: TransportTlsSummary,
    pub smime_enabled: bool,
}

pub async fn status(State(state): State<AppState>) -> Json<ServiceStatusResponse> {
    Json(ServiceStatusResponse {
        transport_mode: state.transport_mode,
        tls: TransportTlsSummary::from(&state.tls_state),
        smime_enabled: state.smime_enabled,
    })
}

pub fn build_router(state: AppState) -> Router {
    Router::new()
        .route("/folders", get(get_folders))
        .route("/messages", get(list_messages))
        .route("/messages/:id", get(get_message).delete(delete_message))
        .route("/messages/:id/move", post(move_message))
        .route("/messages/:id/archive", post(archive_message))
        .route("/compose", post(compose))
        .route("/submit", post(submit))
        .route("/trace/bundle", get(trace_bundle))
        .route("/status", get(status))
        .with_state(state)
}
