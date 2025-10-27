# Support Toolkit

The support toolkit combines diagnostics collection from the UI and CLI with server-side storage and
analysis utilities.

## Collecting Diagnostics

### UI Diagnostics Panel

1. Open the status bar and click **Open diagnostics**.
2. Review system information, telemetry status, and recent trace events.
3. Click **Send trace to support** to upload a ZIP bundle to the `/support/upload` endpoint. The
   bundle includes:
   - `metadata.json` (environment summary, service status).
   - `snapshot.json` (telemetry metrics and sanitized errors).
   - `trace.json` (recent spans and events).
4. Optionally, follow the **View traces** link when a Jaeger URL is configured.

### CLI (`x400-cli support trace`)

```
x400-cli support trace --output support/bundle.zip --upload --endpoint http://127.0.0.1:3333/support/upload
```

- `--telemetry-dir` overrides the local telemetry directory.
- `--upload` uploads after creating the bundle; omit to work offline.

### Support Tool (`x400-support`)

```
x400-support inspect support/bundle.zip
```

The command validates that PII is redacted, prints telemetry metrics, and can output JSON reports for
automation (`--json`).

## Server Intake

The Rust core-service exposes `POST /support/upload`. Uploaded bundles are stored under `./support`
with timestamped metadata (`trace-<timestamp>-<channel>.zip`). Each bundle has a matching `.json`
file containing the submitted `SupportMetadata` (reporter, channel, notes).

## Workflow Summary

1. Customer collects diagnostics (UI or CLI) and receives a ticket number.
2. Bundle automatically uploads to the core-service support directory.
3. Support analyst pulls the bundle, inspects it with `x400-support inspect`, and updates the ticket
   with findings.
4. After resolution, bundles are purged as described in `support-runbook.md`.

All support interactions must follow the SLA matrix published in `docs/support-runbook.md`.
