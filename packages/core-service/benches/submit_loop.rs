use axum::Json;
use core_service::handlers::{compose, AppState};
use core_service::models::{OrName, X400Address};
use core_service::queue::QueueManager;
use core_service::store::StoreManager;
use core_service::trace::TraceManager;
use criterion::{criterion_group, criterion_main, Criterion};
use tokio::runtime::Runtime;

fn compose_payload() -> core_service::models::ComposeRequest {
    core_service::models::ComposeRequest {
        sender: X400Address {
            or_name: OrName {
                c: "DE".to_string(),
                admd: None,
                prmd: None,
                o: Some("Bench".to_string()),
                ou: vec![],
                surname: Some("Sender".to_string()),
                given_name: None,
            },
            dda: vec![],
            routing_hints: vec![],
        },
        recipients: vec![X400Address {
            or_name: OrName {
                c: "DE".to_string(),
                admd: None,
                prmd: None,
                o: Some("Bench".to_string()),
                ou: vec![],
                surname: Some("Recipient".to_string()),
                given_name: None,
            },
            dda: vec![],
            routing_hints: vec![],
        }],
        subject: "Benchmark message".to_string(),
        body: "Benchmark payload".to_string(),
        strategy: Some(1),
    }
}

fn criterion_submit(c: &mut Criterion) {
    let runtime = Runtime::new().unwrap();

    c.bench_function("compose_submit_round_trip", |b| {
        b.to_async(&runtime).iter(|| async {
            let queue = QueueManager::new();
            let trace = TraceManager::new();
            let store = StoreManager::new("sqlite::memory:").await.unwrap();
            store.init().await.unwrap();

            let state = AppState {
                queue,
                store,
                trace,
                config: std::sync::Arc::new(core_service::config::AppConfig {
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
                        sqlcipher_key_ref: None,
                    },
                    security: core_service::config::SecurityConfig {
                        require_auth: false,
                        api_key: "test".to_string(),
                        smime: Default::default(),
                        tls: Default::default(),
                        keychain: Default::default(),
                    },
                    submit: core_service::config::SubmitConfig {
                        default_strategy: 1,
                    },
                    tracing: core_service::config::TracingConfig {
                        log_level: "info".to_string(),
                        trace_bundle_path: String::new(),
                    },
                    transport: core_service::config::TransportConfig::default(),
                }),
                transport_mode: core_service::config::TransportMode::Mock,
                tls_state: core_service::transport::TransportTlsState::default(),
                smime_enabled: false,
            };

            let payload = compose_payload();
            let response = compose(axum::extract::State(state), Json(payload)).await;
            assert_eq!(response.0.status, "queued");
        });
    });
}

criterion_group!(benches, criterion_submit);
criterion_main!(benches);
