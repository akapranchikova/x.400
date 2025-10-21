use chrono::Utc;
use serde_json::json;
use std::sync::Arc;
use tokio::sync::Mutex;

#[derive(Clone)]
pub struct TraceManager {
    inner: Arc<Mutex<Vec<serde_json::Value>>>,
}

impl TraceManager {
    pub fn new() -> Self {
        Self {
            inner: Arc::new(Mutex::new(Vec::new())),
        }
    }

    pub async fn record(&self, event: &str, payload: serde_json::Value) {
        let mut guard = self.inner.lock().await;
        guard.push(json!({
            "timestamp": Utc::now().to_rfc3339(),
            "event": event,
            "payload": payload
        }));
        if guard.len() > 500 {
          let drain_end = guard.len() - 500;
          guard.drain(..drain_end);
        }
    }

    pub async fn bundle(&self) -> Vec<serde_json::Value> {
        self.inner.lock().await.clone()
    }
}

impl Default for TraceManager {
    fn default() -> Self {
        Self::new()
    }
}
