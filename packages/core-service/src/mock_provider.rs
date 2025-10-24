use crate::models::{Message, MessageId, MessageStatus};
use crate::queue::QueueManager;
use crate::store::StoreManager;
use crate::trace::TraceManager;

/// In-memory delivery provider used to simulate message transitions.
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

    pub fn dispatch(&self, message: Message) -> MessageId {
        let id = message.envelope.id.clone();
        self.trace.record("mock.accepted", id.clone());
        self.store.save(message);
        self.queue.enqueue(id.clone());

        self.store.update_status(&id, MessageStatus::Delivered);
        self.trace.record("mock.delivered", id.clone());

        self.store.update_status(&id, MessageStatus::Read);
        self.trace.record("mock.read", id.clone());

        id
    }
}
