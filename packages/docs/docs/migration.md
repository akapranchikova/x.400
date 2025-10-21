# Migration (FWM/FWZ import concept)

Legacy MailmaX.400/FileWork deployments rely on `*.FWM` and `*.FWZ` containers to transfer address books, stored messages, and configuration. The modernization project preserves this workflow by planning a dedicated import pipeline.

## Import pipeline stages

1. **Ingest** – The CLI or UI accepts an archive and verifies its signature. Hash mismatches or unsigned archives raise warnings and allow administrators to abort.
2. **Extract** – Metadata, messages, and attachments are unpacked into a secure staging directory that mimics the old folder structure.
3. **Normalize** – Records are converted into the shared Zod schemas. Character sets are normalized to UTF-8, and unsupported extensions are logged.
4. **Persist** – The Store Manager writes envelopes and content into SQLite using a transaction that can be rolled back if validation fails.
5. **Reconcile** – Duplicate detection ensures we do not re-import already-submitted messages. Reports correlate with message IDs via deterministic hashing.

## Current status

The skeleton includes parser stubs and trace logging but does not yet process real archives. Mock data seeds verify the table structure and queue operations so that engineers can focus on UI and CLI experiences.

## Planned enhancements

* UI wizard that walks operators through archive selection, verification, and dry-run mode.
* CLI flag (`x400-cli import <path> --dry-run`) for scripting migrations.
* Automatic backup of the existing SQLite database before import.
* Detailed reporting on imported vs. skipped items.

The roadmap tracks progress on these tasks and highlights risks discovered during pilot migrations.
