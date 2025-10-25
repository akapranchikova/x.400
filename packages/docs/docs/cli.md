# CLI reference and FW_SI compatibility

The `x400-cli` executable is a drop-in replacement for `FW_SI.EXE`. It uses the local IPC channel exposed by the core-service and adds modern conveniences such as JSON output, dry-run migrations, and TLS inspection.

## Quick start

```bash
x400-cli --help
x400-cli list --folders
x400-cli migrate --path /mnt/filework/archive.fwz --type fwz --dry-run --json
```

Use `--base-url` to point the CLI at a remote or non-default IPC host and `--mock` to force the built-in mock transport during development.

## Command catalogue

| Command                      | FW_SI equivalent    | Summary                                                                   |
| ---------------------------- | ------------------- | ------------------------------------------------------------------------- |
| `list`                       | `LIST`              | Lists folders or messages within a folder. Use `--folders` for metadata.  |
| `access`                     | `ACCESS`            | Fetches a complete message by identifier.                                 |
| `create` / `submit`          | `CREATE`            | Creates a message locally (`create`) or submits via transport (`submit`). |
| `delete`                     | `DELETE`            | Removes a message from the store.                                         |
| `move`                       | `MOVE`              | Moves a message between folders.                                          |
| `archive`                    | `ARCHIVE`           | Archives a message and detaches it from live queues.                      |
| `wait`                       | `WAIT`              | Waits until the outbox is empty or times out.                             |
| `message`                    | `MESSAGE`           | Prints a summary of envelope details.                                     |
| `migrate`                    | `IMPORT` (enhanced) | Imports legacy `.FWM` or `.FWZ` data with dry-run/resume support.         |
| `env`, `health`, `bind-test` | (new)               | Inspect environment, TLS status, and transport connectivity.              |

## Migration command options

```
x400-cli migrate --path <dir|archive> [--type auto|fwm|fwz] [--dry-run] [--resume <jobId>] \
                  [--limit <n>] [--since <iso>] [--quarantine <dir>] [--json]
```

- `--type`: skip auto-detection when the extension is ambiguous.
- `--dry-run`: parse and validate without mutating the database.
- `--resume`: continue a previously started job using its identifier.
- `--limit`: stop after importing the specified number of messages.
- `--since`: import items created after the timestamp (ISO-8601).
- `--quarantine`: override the configured quarantine directory for corrupted attachments.
- `--json`: stream machine-readable progress and the final report to stdout; errors are emitted to stderr as JSON.

Example output (abridged):

```json
{
  "type": "progress",
  "jobId": "e7b5b708-ff49-4f28-aafc-d2ebb2c23ac6",
  "progress": {
    "imported": 24,
    "failed": 0,
    "duplicates": 1,
    "total": 32,
    "status": "running"
  }
}
```

On completion the CLI prints a `type=report` payload containing the schema defined in [`@x400/shared`](../packages/shared/src/schemas/migration.ts).

## JSON schemas

The CLI validates requests and responses using the Zod schemas exported from `@x400/shared`:

- `migrationRequestSchema`
- `migrationProgressSchema`
- `migrationReportSchema`

These schemas are also used by the web UI to ensure consistent typing across transports. Refer to the source for field-level documentation or consume them directly via TypeScript imports.

## Exit codes

- `0` – command succeeded.
- `2` – migration completed with failures (`report.failed > 0`).
- `>0` – command validation error or unexpected runtime failure.

## Troubleshooting

- `Error: Limit must be a positive integer` – adjust `--limit` to a positive integer.
- `Timeout reached while waiting for outbox to drain` – increase `--timeout` or inspect queue status via the UI.
- `TLS validation failed` when using `health --tls-verify` – verify the IPC endpoint certificate and trust store.
