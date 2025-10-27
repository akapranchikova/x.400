# Testing Telemetry and Support Features

This guide supplements `TESTING.md` with scenarios specific to telemetry, diagnostics, and support
workflows.

## Unit Tests

| Component                | Command                        | Notes                                                             |
| ------------------------ | ------------------------------ | ----------------------------------------------------------------- |
| Telemetry config parsing | `cargo test --test config`     | Confirms new `telemetry.*` keys are parsed correctly.             |
| Telemetry manager        | `cargo test --test telemetry`  | Verifies bundle creation, metrics aggregation, and PII redaction. |
| CLI support command      | `pnpm --filter @x400/cli test` | Exercises `x400-cli support trace` options via Vitest.            |

## Integration Tests

1. `cargo test --test integration -- support_storage_persists_trace_bundle` ensures the support
   storage location is created and trace bundles are indexed.
2. Launch the mock core-service, run `x400-cli support trace --upload`, and verify the bundle appears
   in the `support/` directory with metadata.

## End-to-end Tests

1. Start the desktop UI in mock mode.
2. Open the Diagnostics Panel, confirm telemetry metrics render, and click **Send trace to support**.
3. Inspect the resulting bundle with `x400-support inspect` and confirm the report identifies no PII.

## Privacy Checks

- Inspect `telemetry/trace.jsonl` and `snapshot.json` to ensure all email addresses are redacted
  (`[REDACTED]`).
- Run `x400-support inspect --json` and verify `issues` is empty.

## Performance Baseline

Use the telemetry metrics to ensure queue operations remain below the 5 ms overhead target:

1. Enable telemetry (`telemetry.enabled=true`).
2. Submit 500 mock messages (`pnpm --filter @x400/cli exec node scripts/load-test.mjs 500`).
3. Check `snapshot.json` for `average_latency_ms` < 5.

Document deviations and mitigations in the incident tracker.
