use core_service::config::{AppConfig, TransportMode};
use core_service::handlers::build_router;
use core_service::queue::QueueManager;
use core_service::security::{resolve_sqlcipher_key, SmimeService};
use core_service::store::StoreManager;
use core_service::trace::TraceManager;
use core_service::transport::{tls, P7Driver, P7DriverConfig};
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

    let sqlcipher_key = if config.database.use_sqlcipher {
        resolve_sqlcipher_key(&config.database, &config.security)?
    } else {
        None
    };

    let store = StoreManager::new_secure(&config.database.url, sqlcipher_key.as_deref()).await?;
    store.init().await?;

    let queue = QueueManager::new();
    let trace = TraceManager::new();

    let tls_state = tls::validate(&config.transport);

    if config.transport.mode == TransportMode::Sdk {
        match P7Driver::new(P7DriverConfig {
            transport: config.transport.clone(),
            security: config.security.clone(),
        }) {
            Ok(driver) => {
                let status = driver.status();
                info!("P7 driver initialized", mode = ?status.mode, tls_error = ?status.tls.error);
            }
            Err(err) => {
                warn!("Failed to initialize P7 driver", error = %err);
            }
        }
    }

    if config.security.smime.enabled {
        let smime = SmimeService::new(config.security.smime.clone());
        if let Err(err) = smime.warmup() {
            warn!("S/MIME warm-up failed", error = %err);
        }
    }

    let seeded_messages = store.seed_demo_data().await?;
    queue
        .seed(seeded_messages.into_iter().map(|m| m.envelope).collect())
        .await;

    let state = AppState {
        queue: queue.clone(),
        store: store.clone(),
        trace: trace.clone(),
        config: Arc::new(config.clone()),
        transport_mode: config.transport.mode,
        tls_state,
        smime_enabled: config.security.smime.enabled,
    };

    let app = build_router(state).layer(TraceLayer::new_for_http());

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
