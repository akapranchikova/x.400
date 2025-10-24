use core_service::config::AppConfig;
use core_service::AppState;

fn main() {
    let config = AppConfig::load().unwrap_or_default();
    let state = AppState::new(config);
    println!(
        "Core service initialised on {}:{} with {} queued messages",
        state.config.server.host,
        state.config.server.port,
        state.queue.pending().len()
    );
}
