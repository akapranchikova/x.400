use core_service::config::TelemetryConfig;
use core_service::telemetry::TelemetryManager;
use std::time::Duration;

#[test]
fn telemetry_records_metrics_and_redacts_pii() {
    let temp = tempfile::tempdir().expect("temp directory");
    let config = TelemetryConfig {
        enabled: true,
        endpoint: None,
        local_path: temp.path().to_string_lossy().to_string(),
        sampling: 1.0,
        retention_days: 7,
    };
    let telemetry = TelemetryManager::from_config(&config);
    telemetry.record_error("contact admin@example.com for help");
    telemetry.record_flow("gateway.submit", Duration::from_millis(42), true, 5);
    telemetry.record_flow("gateway.submit", Duration::from_millis(30), false, 4);

    let snapshot = telemetry.snapshot();
    assert_eq!(snapshot.metrics.messages_sent, 1);
    assert_eq!(snapshot.metrics.error_count, 1);
    assert!(snapshot
        .last_errors
        .iter()
        .any(|entry| entry.contains("[REDACTED]")));
    assert!(snapshot.average_latency_ms > 0.0);

    let bundle = telemetry.bundle().expect("bundle");
    assert!(!bundle.is_empty());
}
