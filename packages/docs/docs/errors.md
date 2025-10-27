# Error Reference

| Code      | Message                       | Description                                                          | Suggested Action                                                                            |
| --------- | ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `GW-001`  | `SMTP relay rejected message` | SMTP adapter received a `550` or similar rejection.                  | Verify recipient domain mappings and relay credentials, retry after remediation.            |
| `GW-002`  | `Address mapping failed`      | Gateway could not translate an O/R address to RFC822.                | Update mapping rules (`gateway.mapping.rules`) or add directory overrides.                  |
| `GW-003`  | `Inbound polling failed`      | IMAP fetch operation returned an error.                              | Check IMAP credentials, mailbox availability, and TLS settings.                             |
| `IPC-010` | `Queue congestion`            | Outbound queue depth exceeded threshold (>100 messages).             | Inspect telemetry metrics, increase worker capacity, or throttle submissions.               |
| `IPC-020` | `Telemetry upload failed`     | Remote exporter rejected the OTLP payload.                           | Confirm `telemetry.endpoint`, network reachability, and API tokens. Bundles remain on disk. |
| `IPC-030` | `Support bundle rejected`     | `/support/upload` refused to persist bundle (usually empty payload). | Regenerate bundle with CLI/UI tooling and retry.                                            |
| `MIG-100` | `FWZ checksum mismatch`       | Legacy archive failed checksum validation.                           | Re-ingest original FWZ file, or switch to `dry-run` to inspect contents manually.           |
| `MIG-110` | `Legacy document invalid`     | Parser reported malformed FWM metadata.                              | Quarantine file, review encoding, and update redaction rules.                               |
| `CLI-201` | `Trace bundle upload failed`  | `x400-cli support trace --upload` received non-2xx response.         | Re-run with `--endpoint` override and attach bundle manually to support ticket.             |
| `UI-300`  | `Diagnostics upload failure`  | UI diagnostics panel could not reach `/support/upload`.              | Verify IPC endpoint, ensure telemetry service is enabled, and retry.                        |

Keep this table synchronized with runtime error codes surfaced by the core service and SDK.
