pub mod config;
pub mod directory;
pub mod gateway;
pub mod migration;
pub mod mock_provider;
pub mod models;
pub mod queue;
pub mod store;
pub mod support;
pub mod telemetry;
pub mod trace;

use std::sync::Arc;

use queue::QueueManager;
use store::StoreManager;
use support::SupportStorage;
use telemetry::TelemetryManager;
use trace::TraceManager;

/// Shared state for the simplified core service.
#[derive(Clone)]
pub struct AppState {
    pub queue: QueueManager,
    pub store: StoreManager,
    pub trace: TraceManager,
    pub config: Arc<config::AppConfig>,
    pub migration: migration::MigrationManager,
    pub telemetry: TelemetryManager,
    pub support: SupportStorage,
}

impl AppState {
    pub fn new(config: config::AppConfig) -> Self {
        let telemetry = TelemetryManager::from_config(&config.telemetry);
        let queue = QueueManager::with_telemetry(telemetry.clone());
        let store = StoreManager::new();
        let trace = TraceManager::new();
        let config = Arc::new(config);
        let migration = migration::MigrationManager::new(store.clone());
        let support = SupportStorage::new(".");

        Self {
            queue,
            store,
            trace,
            config,
            migration,
            telemetry,
            support,
        }
    }
}
