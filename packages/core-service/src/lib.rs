pub mod config;
pub mod mock_provider;
pub mod models;
pub mod queue;
pub mod store;
pub mod trace;

use std::sync::Arc;

use queue::QueueManager;
use store::StoreManager;
use trace::TraceManager;

/// Shared state for the simplified core service.
#[derive(Clone)]
pub struct AppState {
    pub queue: QueueManager,
    pub store: StoreManager,
    pub trace: TraceManager,
    pub config: Arc<config::AppConfig>,
}

impl AppState {
    pub fn new(config: config::AppConfig) -> Self {
        Self {
            queue: QueueManager::new(),
            store: StoreManager::new(),
            trace: TraceManager::new(),
            config: Arc::new(config),
        }
    }
}
