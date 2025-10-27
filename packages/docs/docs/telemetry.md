# Telemetry and Observability

Telemetry is opt-in and disabled by default (`telemetry.enabled = false`). When enabled, the
`core-service` records structured events and metrics using OpenTelemetry and the `tracing`
subscriber. Data is persisted locally as JSON Lines in the directory defined by
`telemetry.localPath` (default `telemetry/`).

## Configuration

Configure telemetry via the INI-style configuration file referenced by the `CORE_CONFIG`
environment variable.

```ini
telemetry.enabled=true
telemetry.endpoint=https://observability.example.com/v1/traces
telemetry.localPath=/var/lib/x400/telemetry
telemetry.sampling=0.5
telemetry.retentionDays=14
```

- **enabled** – Opt-in flag. When `false`, no spans or metrics are persisted or transmitted.
- **endpoint** – Optional remote collector accepting OTLP/HTTP payloads. When unset, traces remain
  local.
- **localPath** – Directory where JSONL logs, snapshots, and pending bundles are stored.
- **sampling** – Fractional sampling rate (`0.0`–`1.0`). Applied to span creation.
- **retentionDays** – Retention policy for local files. A maintenance task prunes files older than
  the configured value (default 7 days).

## Data Collected

| Category         | Details                                                                                |
| ---------------- | -------------------------------------------------------------------------------------- |
| Spans            | Gateway flows (`gateway.outbound`, `gateway.inbound`), migration steps, queue enqueue/ |
| dequeue actions. |
| Metrics          | `messagesSent`, `errorCount`, `queueDepth`, `averageLatency` (computed from spans).    |
| Events           | Recent trace samples stored in `trace.jsonl` with PII redaction.                       |
| Errors           | A bounded list of sanitized error messages (`snapshot.json`).                          |

Personally identifiable information is redacted before persistence using allow-listed patterns.
Email addresses and subject lines are replaced with `[REDACTED]` tokens.

## Exporting

- **Local bundles**: `telemetry.bundle()` (Rust) or `x400-cli support trace` produce a ZIP archive
  containing the snapshot, event log, and metadata.
- **Remote upload**: When `telemetry.endpoint` is configured the exporter sends OTLP payloads using
  the OTLP/HTTP protocol. Failed deliveries remain queued on disk for manual upload.

## Observability Stack

The optional `docker-compose.observability.yml` stack provisions Jaeger, Prometheus, and Grafana.
Set `VITE_JAEGER_URL` (UI) or `TELEMETRY_JAEGER_URL` (environment) to surface a “View Traces”
shortcut in the diagnostics panel.

## Privacy & Retention

- Data never leaves the workstation unless telemetry is explicitly enabled.
- Bundles uploaded via the diagnostics panel or CLI are stored under `support/` on the core service
  host with timestamped metadata.
- Support analysts must purge bundles after tickets are resolved (see
  `docs/support-runbook.md`).
