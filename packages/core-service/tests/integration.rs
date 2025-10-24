use core_service::config::AppConfig;
use core_service::mock_provider::MockDeliveryProvider;
use core_service::models::{Address, Message, MessageContent, MessageEnvelope, MessageStatus};
use core_service::queue::QueueManager;
use core_service::store::StoreManager;
use core_service::trace::TraceManager;

fn build_state() -> (QueueManager, StoreManager, TraceManager) {
    let queue = QueueManager::new();
    let store = StoreManager::new();
    let trace = TraceManager::new();
    (queue, store, trace)
}

#[test]
fn compose_and_fetch_message_flow() {
    let (queue, store, trace) = build_state();
    let provider = MockDeliveryProvider::new(queue.clone(), store.clone(), trace.clone());

    let mut envelope = MessageEnvelope::new(
        "Integration message",
        Address::sample(),
        vec![Address::sample()],
    );
    envelope.folder = "inbox".into();
    let message_id = envelope.id.clone();
    let message = Message {
        envelope,
        content: MessageContent {
            body: "Hello from tests".into(),
        },
    };

    provider.dispatch(message);

    let listed = store.list("inbox");
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].envelope.subject, "Integration message");

    let pending = queue.pending();
    assert_eq!(pending.len(), 1);
    assert_eq!(pending[0], message_id);

    let stored = store.get(&message_id).expect("message stored");
    assert_eq!(stored.envelope.status, MessageStatus::Read);

    let removed = store.delete(&message_id);
    assert!(removed);
    assert!(store.list("inbox").is_empty());
}

#[test]
fn seeding_demo_data_populates_store_and_queue() {
    let (queue, store, trace) = build_state();
    let ids = store.seed_demo_data();
    queue.seed(ids.clone());
    let provider = MockDeliveryProvider::new(queue.clone(), store.clone(), trace.clone());

    let summary: Vec<_> = queue.pending();
    assert_eq!(summary.len(), 3);

    let bundle = trace.bundle();
    assert!(bundle.is_empty(), "no trace entries recorded yet");

    let config = AppConfig::load().unwrap();
    assert_eq!(config.server.port, 3333);

    // Dispatch a new message to ensure the provider records trace entries.
    let envelope = MessageEnvelope::new("Trace", Address::sample(), vec![Address::sample()]);
    let id = envelope.id.clone();
    provider.dispatch(Message {
        envelope,
        content: MessageContent {
            body: "trace".into(),
        },
    });

    let bundle = trace.bundle();
    assert!(bundle
        .iter()
        .any(|entry| entry.event == "mock.read" && entry.message == id));
}
