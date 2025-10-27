use std::collections::VecDeque;
use std::sync::{Arc, Mutex};

use crate::models::MessageId;
use crate::telemetry::TelemetryManager;

#[derive(Clone)]
pub struct QueueManager {
    inner: Arc<Mutex<VecDeque<MessageId>>>,
    telemetry: Option<TelemetryManager>,
}

impl QueueManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(VecDeque::new())),
            telemetry: None,
        }
    }

    pub fn with_telemetry(telemetry: TelemetryManager) -> Self {
        Self {
            inner: Arc::new(Mutex::new(VecDeque::new())),
            telemetry: Some(telemetry),
        }
    }

    pub fn enqueue(&self, id: MessageId) {
        if let Ok(mut queue) = self.inner.lock() {
            queue.push_back(id);
            if let Some(telemetry) = &self.telemetry {
                telemetry.record_flow(
                    "queue.enqueue",
                    std::time::Duration::from_millis(0),
                    true,
                    queue.len(),
                );
            }
        }
    }

    pub fn dequeue(&self) -> Option<MessageId> {
        self.inner.lock().ok().and_then(|mut queue| {
            let item = queue.pop_front();
            if let Some(telemetry) = &self.telemetry {
                telemetry.record_flow(
                    "queue.dequeue",
                    std::time::Duration::from_millis(0),
                    item.is_some(),
                    queue.len(),
                );
            }
            item
        })
    }

    pub fn seed(&self, ids: Vec<MessageId>) {
        if let Ok(mut queue) = self.inner.lock() {
            for id in ids {
                queue.push_back(id);
            }
            if let Some(telemetry) = &self.telemetry {
                telemetry.record_flow(
                    "queue.seed",
                    std::time::Duration::from_millis(0),
                    true,
                    queue.len(),
                );
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

impl Default for QueueManager {
    fn default() -> Self {
        Self::new()
    }
}
