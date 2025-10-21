use core_service::config::AppConfig;
use core_service::handlers::{
    archive_message, compose, delete_message, get_folders, get_message, list_messages, move_message, submit,
    trace_bundle,
};
use core_service::queue::QueueManager;
use core_service::store::StoreManager;
use core_service::trace::TraceManager;
use core_service::AppState;
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::signal;
use tower_http::trace::TraceLayer;
use tracing::{info, warn};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let config = AppConfig::load()?;

    tracing_subscriber::fmt()
        .with_env_filter(config.tracing.log_level.clone())
        .with_target(false)
        .init();

    let store = StoreManager::new(&config.database.url).await?;
    store.init().await?;

    let queue = QueueManager::new();
    let trace = TraceManager::new();

    let seeded_messages = store.seed_demo_data().await?;
    queue
        .seed(seeded_messages.into_iter().map(|m| m.envelope).collect())
        .await;

    let state = AppState {
        queue: queue.clone(),
        store: store.clone(),
        trace: trace.clone(),
        config: Arc::new(config.clone()),
    };

    let app = axum::Router::new()
        .route("/folders", axum::routing::get(get_folders))
        .route("/messages", axum::routing::get(list_messages))
        .route(
            "/messages/:id",
            axum::routing::get(get_message).delete(delete_message),
        )
        .route(
            "/messages/:id/move",
            axum::routing::post(move_message),
        )
        .route(
            "/messages/:id/archive",
            axum::routing::post(archive_message),
        )
        .route("/compose", axum::routing::post(compose))
        .route("/submit", axum::routing::post(submit))
        .route("/trace/bundle", axum::routing::get(trace_bundle))
        .with_state(state)
        .layer(TraceLayer::new_for_http());

    if config.server.tls.enabled {
        warn!(
            "TLS is enabled in the configuration, but the mock service uses plain HTTP for development."
        );
    }

    let addr = SocketAddr::new(config.server.host.parse()?, config.server.port);
    info!(%addr, "Starting core service");

    let listener = tokio::net::TcpListener::bind(addr).await?;

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install signal handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => {},
        _ = terminate => {},
    }
}
