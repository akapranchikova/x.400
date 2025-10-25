# Legacy migration runbook

This runbook describes how to import historical FileWork data (`*.FWM` metadata folders and `*.FWZ` archives) into the modern X.400 store. The process is coordinated by the Rust core-service and exposed through both the CLI (`x400-cli migrate`) and the administrator UI panel.

## When to migrate

Use the migration tooling when:

- Decommissioning a FileWork workstation and moving mailboxes to the modernized client.
- Seeding lower environments with realistic content before functional or performance testing.
- Restoring messages after a disaster recovery exercise.

The importer understands the legacy folder structure, attachments, and delivery/read report relationships. It is idempotent and can be re-run safely for the same source directory.

## Pre-flight checklist

1. **Back up the modern store.** Take a snapshot of the SQLite/SQLCipher database (file copy or VM snapshot).
2. **Check disk space.** Reserve at least 2× the size of the legacy workspace to accommodate staging, quarantine, and the target database.
3. **Validate permissions.** The service account running the CLI/UI must have read access to the legacy files and write access to the configured migration workspace and quarantine directories (see `core-service` configuration keys `migration.workspace` and `migration.quarantine`).
4. **Prepare the quarantine directory.** Ensure the path exists so corrupted archives can be isolated automatically.
5. **Communicate downtime expectations.** Large imports (10k+ items) can take minutes; schedule maintenance windows for production runs.

## Running a dry-run

Dry-runs parse the legacy files, calculate checksums, and report duplicates without touching the database.

```bash
x400-cli migrate --path /mnt/filework/mailbox --type auto --dry-run --json > dry-run.json
```

- Verify `dry-run: true` and `failed: 0` in the JSON summary.
- Review `notes` and the optional `errors` array for warnings about encoding fixes, attachment size mismatches, or skipped folders.
- Use the UI panel (enable `VITE_ENABLE_MIGRATION=true`) to repeat the dry-run if you prefer a graphical dashboard. The panel shows per-item counters and lets you export the full report as JSON for archival.

## Full migration

When satisfied with the dry-run, rerun without the `--dry-run` flag. You can specify additional limits:

```bash
x400-cli migrate \
  --path /mnt/filework/mailbox \
  --type fwz \
  --since 2024-01-01T00:00:00Z \
  --limit 10000 \
  --quarantine /srv/x400/quarantine
```

During execution:

- Progress updates include processed/imported/failed counters and the active file path.
- Attachment SHA-256 hashes are calculated; corrupt entries are moved to the quarantine directory and flagged with `checksumOk=false` in the final report.
- Duplicate detection compares subject, body, and checksum to keep the process idempotent.

### Resume and recovery

If the import is interrupted (service restart or machine reboot), re-run the command with `--resume <jobId>` using the identifier returned from the initial start. The core-service reuses the captured progress and continues where it left off.

## Verification

After completion:

- Run `x400-cli list --folder inbox` (and other system folders) to confirm new envelopes.
- Use the UI to open the Migration panel, review the counters, and export the JSON summary for audit.
- Spot check attachments and delivery reports via the Message Detail view to ensure linking survived the import.

## Rollback strategy

- If the import fails with `failed > 0`, the CLI prints a structured error to stderr and sets the exit code to `2`. Review the report, remediate the files, and rerun with `--resume`.
- To revert the store entirely, restore the database snapshot taken during the pre-flight checklist.

## Performance tuning

- Adjust `migration.parallelism` in `core-service` configuration to limit concurrent file reads on slower disks.
- Relocate `migration.workspace` and `migration.quarantine` to fast SSD storage for large batches.
- For multi-GB archives, run `x400-cli migrate --dry-run` first to warm caches and detect hot spots.

## Troubleshooting

| Symptom                                           | Likely cause                         | Resolution                                                                                 |
| ------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `checksumOk=false` in report                      | Attachment corrupted during transfer | Inspect the quarantine directory, recover from backup, then resume the job.                |
| CLI exits with `limit must be a positive integer` | Invalid `--limit` flag value         | Provide a positive integer (e.g. `--limit 5000`).                                          |
| UI progress stalls on `pending`                   | Core-service not reachable           | Verify `VITE_CORE_IPC_*` settings and restart the core-service.                            |
| Reports missing                                   | Legacy archive lacked DR/NDR files   | Confirm the original FileWork source still has report files; import is lossy in this case. |

## Related documents

- [`cli.md`](./cli.md) – Command syntax, FW_SI compatibility matrix, and JSON schema references.
- [`testing.md`](./testing.md#migration-suite) – Details on automated tests covering the migration flows.
