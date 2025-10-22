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

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn records_are_buffered_and_trimmed() {
        let trace = TraceManager::new();

        for idx in 0..510 {
            trace.record("event", json!({ "idx": idx })).await;
        }

        let bundle = trace.bundle().await;
        assert_eq!(bundle.len(), 500);
        assert!(bundle.first().unwrap()["payload"]["idx"].as_i64().unwrap() >= 10);
    }
}
