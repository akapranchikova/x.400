use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use crate::models::MessageId;

#[derive(Clone, Default)]
pub struct QueueManager {
    inner: Arc<Mutex<VecDeque<MessageId>>>,
}

impl QueueManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn enqueue(&self, id: MessageId) {
        if let Ok(mut queue) = self.inner.lock() {
            queue.push_back(id);
        }
    }

    pub fn dequeue(&self) -> Option<MessageId> {
        self.inner
            .lock()
            .ok()
            .and_then(|mut queue| queue.pop_front())
    }

    pub fn seed(&self, ids: Vec<MessageId>) {
        if let Ok(mut queue) = self.inner.lock() {
            for id in ids {
                queue.push_back(id);
            }
        }
    }

    pub fn pending(&self) -> Vec<MessageId> {
        self.inner
            .lock()
            .map(|queue| queue.iter().cloned().collect())
            .unwrap_or_default()
    }
}
