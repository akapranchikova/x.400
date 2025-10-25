pub mod config;
pub mod migration;
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
    pub migration: migration::MigrationManager,
}

impl AppState {
    pub fn new(config: config::AppConfig) -> Self {
        let queue = QueueManager::new();
        let store = StoreManager::new();
        let trace = TraceManager::new();
        let config = Arc::new(config);
        let migration = migration::MigrationManager::new(store.clone());

        Self {
            queue,
            store,
            trace,
            config,
            migration,
        }
    }
}
