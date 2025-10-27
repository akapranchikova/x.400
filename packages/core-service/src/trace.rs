use std::sync::{Arc, Mutex};

use crate::models::MessageId;
use tracing::info;

#[derive(Clone, Debug, PartialEq, Eq)]
pub struct TraceEntry {
    pub event: String,
    pub message: MessageId,
}

#[derive(Clone, Default)]
pub struct TraceManager {
    inner: Arc<Mutex<Vec<TraceEntry>>>,
}

impl TraceManager {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn record(&self, event: impl Into<String>, message: MessageId) {
        if let Ok(mut entries) = self.inner.lock() {
            entries.push(TraceEntry {
                event: event.into(),
                message,
            });
        }
        info!(target = "trace", message = %message, "trace event recorded");
    }

    pub fn bundle(&self) -> Vec<TraceEntry> {
        self.inner
            .lock()
            .map(|entries| entries.clone())
            .unwrap_or_default()
    }
}
