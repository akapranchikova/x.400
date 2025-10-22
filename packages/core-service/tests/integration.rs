use core_service::handlers::build_router;
use core_service::mock_provider::MockDeliveryProvider;
use core_service::queue::QueueManager;
use core_service::store::StoreManager;
use core_service::trace::TraceManager;
use core_service::AppState;
use reqwest::Client;
use serde_json::json;
use std::net::SocketAddr;
use std::sync::Arc;
use tempfile::{NamedTempFile, TempPath};
use tokio::net::TcpListener;
use uuid::Uuid;

async fn spawn_app() -> (String, tokio::task::JoinHandle<()>, TempPath) {
    let queue = QueueManager::new();
    let temp = NamedTempFile::new().unwrap();
    let temp_path = temp.into_temp_path();
    let db_url = format!("sqlite://{}", temp_path.to_string_lossy());
    let store = StoreManager::new(&db_url).await.expect("store");
    store.init().await.expect("init");
    let seeded = store.seed_demo_data().await.expect("seed");
    queue
        .seed(seeded.into_iter().map(|message| message.envelope).collect())
        .await;

    let trace = TraceManager::new();

    let state = AppState {
        queue: queue.clone(),
        store: store.clone(),
        trace: trace.clone(),
        config: Arc::new(core_service::config::AppConfig {
            server: core_service::config::ServerConfig {
                host: "127.0.0.1".to_string(),
                port: 0,
                tls: core_service::config::TlsConfig {
                    enabled: false,
                    min_version: "1.2".to_string(),
                    certificate_path: String::new(),
                    private_key_path: String::new(),
                },
            },
            database: core_service::config::DatabaseConfig {
                url: "sqlite::memory:".to_string(),
                use_sqlcipher: false,
            },
            security: core_service::config::SecurityConfig {
                require_auth: false,
                api_key: "test".to_string(),
            },
            submit: core_service::config::SubmitConfig {
                default_strategy: 1,
            },
            tracing: core_service::config::TracingConfig {
                log_level: "info".to_string(),
                trace_bundle_path: String::new(),
            },
        }),
    };

    let router = build_router(state);
    let listener = TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], 0)))
        .await
        .unwrap();
    let addr = listener.local_addr().unwrap();
    let server = tokio::spawn(async move {
        axum::serve(listener, router).await.unwrap();
    });

    (format!("http://{}", addr), server, temp_path)
}

fn sample_address() -> serde_json::Value {
    json!({
        "orName": {
            "c": "DE",
            "o": "Modern",
            "surname": "Operator"
        },
        "dda": [],
        "routingHints": []
    })
}

#[tokio::test]
async fn compose_and_fetch_message_flow() {
    let (base_url, server, temp_path) = spawn_app().await;
    let client = Client::new();

    let compose_payload = json!({
        "sender": sample_address(),
        "recipients": [sample_address()],
        "subject": "Integration message",
        "body": "Hello from tests"
    });

    let compose_response = client
        .post(format!("{}/compose", base_url))
        .json(&compose_payload)
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();

    let message_id = compose_response["message_id"].as_str().unwrap().to_string();

    let list = client
        .get(format!("{}/messages", base_url))
        .query(&[("folder", "inbox")])
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();
    assert!(list.as_array().unwrap().len() >= 1);

    let message = client
        .get(format!("{}/messages/{}", base_url, message_id))
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();
    assert_eq!(message["envelope"]["subject"], "Integration message");

    let trace = client
        .get(format!("{}/trace/bundle", base_url))
        .send()
        .await
        .unwrap()
        .json::<serde_json::Value>()
        .await
        .unwrap();
    assert!(trace["entries"].is_array());

    client
        .delete(format!("{}/messages/{}", base_url, message_id))
        .send()
        .await
        .unwrap()
        .error_for_status()
        .unwrap();

    server.abort();
    drop(temp_path);
}

#[tokio::test]
async fn contract_payload_matches_openapi() {
    let spec: serde_json::Value =
        serde_json::from_str(include_str!("../api/openapi.json")).unwrap();
    assert!(spec["paths"]["/folders"]["get"].is_object());
    assert!(spec["components"]["schemas"]["Message"].is_object());
}

#[tokio::test]
async fn mock_provider_simulates_delivery_events() {
    use chrono::Utc;
    use core_service::models::{
        Message, MessageContent, MessageEnvelope, MessagePriority, MessageSensitivity,
        MessageStatus, OrName, X400Address,
    };

    let queue = QueueManager::new();
    let store = StoreManager::new("sqlite::memory:").await.unwrap();
    store.init().await.unwrap();
    let trace = TraceManager::new();
    let provider = MockDeliveryProvider::new(queue.clone(), store.clone(), trace.clone());

    let message_id = Uuid::new_v4();
    let now = Utc::now();
    let envelope = MessageEnvelope {
        id: message_id,
        subject: "Mock provider".to_string(),
        sender: X400Address {
            or_name: OrName {
                c: "DE".to_string(),
                admd: None,
                prmd: None,
                o: Some("Provider".to_string()),
                ou: vec![],
                surname: Some("Sender".to_string()),
                given_name: None,
            },
            dda: vec![],
            routing_hints: vec![],
        },
        to: vec![],
        cc: vec![],
        bcc: vec![],
        folder: "outbox".to_string(),
        status: MessageStatus::Queued,
        priority: MessagePriority::Normal,
        sensitivity: MessageSensitivity::Normal,
        created_at: now,
        updated_at: now,
        message_id: format!("<{}@mock>", message_id),
    };

    let message = Message {
        envelope,
        content: MessageContent {
            text: "Hello".to_string(),
            attachments: vec![],
        },
        reports: vec![],
    };

    provider.dispatch(message).await.unwrap();

    tokio::time::sleep(tokio::time::Duration::from_millis(400)).await;

    let fetched = store.get_message(message_id).await.unwrap();
    assert_eq!(fetched.envelope.status, MessageStatus::Read);

    let bundle = trace.bundle().await;
    assert!(bundle.iter().any(|entry| entry["event"] == "mock.read"));
}
