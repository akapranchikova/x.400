use crate::models::{Message, MessageStatus};
use crate::queue::QueueManager;
use crate::store::StoreManager;
use crate::trace::TraceManager;
use serde_json::json;
use tokio::time::{sleep, Duration};

#[derive(Clone)]
pub struct MockDeliveryProvider {
    queue: QueueManager,
    store: StoreManager,
    trace: TraceManager,
}

impl MockDeliveryProvider {
    pub fn new(queue: QueueManager, store: StoreManager, trace: TraceManager) -> Self {
        Self {
            queue,
            store,
            trace,
        }
    }

    pub async fn dispatch(&self, message: Message) -> anyhow::Result<()> {
        self.store.save_message(&message).await?;
        self.queue.enqueue(message.envelope.clone()).await;

        let queue = self.queue.clone();
        let store = self.store.clone();
        let trace = self.trace.clone();
        let message_id = message.envelope.id;

        tokio::spawn(async move {
            sleep(Duration::from_millis(100)).await;
            let _ = queue.move_message(message_id, "inbox").await;
            if let Ok(mut stored) = store.get_message(message_id).await {
                stored.envelope.status = MessageStatus::Delivered;
                let _ = store.save_message(&stored).await;
            }
            trace
                .record(
                    "mock.delivery",
                    json!({ "messageId": message_id, "status": "delivered" }),
                )
                .await;

            sleep(Duration::from_millis(150)).await;
            if let Ok(mut stored) = store.get_message(message_id).await {
                stored.envelope.status = MessageStatus::Read;
                let _ = store.save_message(&stored).await;
            }
            trace
                .record(
                    "mock.read",
                    json!({ "messageId": message_id, "status": "read" }),
                )
                .await;
        });

        Ok(())
    }
}
