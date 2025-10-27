# Support Runbook

This runbook outlines the standard operating procedure for handling customer diagnostics, service
interruptions, and escalations.

## Intake Checklist

1. **Ticket triage** – Confirm customer contact, severity, and impacted components.
2. **Gather diagnostics** – Request a UI or CLI trace bundle; ensure `/support/upload` contains the
   bundle and associated metadata (`trace-<timestamp>-<channel>.zip`).
3. **Verify telemetry consent** – Confirm telemetry was explicitly enabled by the customer before
   reviewing traces.

## Analysis Steps

1. Run `x400-support inspect <bundle>` to validate PII redaction and gather metrics.
2. Review `snapshot.json` for queue depth, error counts, and latency trends.
3. Inspect `trace.json` for failed spans (e.g. `gateway.outbound` errors) and correlate with
   timestamps reported by the user.
4. Cross-reference error codes with `docs/errors.md` for remediation guidance.

## Resolution

- Provide mitigation steps (configuration updates, retries, patches) and document them in the ticket.
- If code changes are required, create an engineering task referencing the trace bundle ID.
- For SLA purposes, record the following:
  - Time to acknowledge (within 30 minutes for Sev-1, 4 hours for Sev-2, next business day for Sev-3).
  - Time to mitigate (Sev-1: 4 hours, Sev-2: 1 business day, Sev-3: 5 business days).

## Post-resolution

1. Notify the customer and obtain confirmation.
2. Purge bundles older than the retention window (`telemetry.retentionDays`).
3. Update `CHANGELOG.md` if the fix requires a release; tag the ticket with the version once
   published.
4. Capture learnings in the weekly operations report.

## Escalation Matrix

| Severity | Example                                                  | Escalation                                                                  |
| -------- | -------------------------------------------------------- | --------------------------------------------------------------------------- |
| Sev-1    | Complete message delivery outage                         | Page on-call engineer, notify stakeholders, hourly updates.                 |
| Sev-2    | Degraded performance (queue backlog, telemetry failures) | Assign incident commander, update status page, provide twice-daily updates. |
| Sev-3    | Non-blocking UI/CLI issues                               | Address during next sprint, communicate ETA to customer.                    |

Refer to the security model for data handling rules and encryption requirements when sharing
artifacts externally.
