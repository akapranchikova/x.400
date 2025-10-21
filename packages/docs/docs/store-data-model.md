# Store & Data Model

The store combines an in-memory queue with SQLite persistence to emulate how FileWork staged messages before relaying them to the X.400 transport. The design is SQLCipher-ready and enforces consistent schemas through shared Zod definitions.

## Queue Manager

* Keeps lightweight metadata for each message (`id`, `status`, `folder`).
* Supports `enqueue`, `move`, `archive`, and `delete` operations.
* Emits events to the Trace Manager for observability.

In the mock implementation the queue is process memory backed by a `RwLock`. The architecture document outlines how future releases can swap it for Redis or another durable queue.

## Store Manager

* Uses `sqlx` to communicate with a SQLite database (default path: `./data/x400.db`).
* Configuration references SQLCipher pragmas so that production builds can be encrypted without code changes.
* Persists envelopes, content parts, attachments, and report metadata.
* Exposes helper queries for folder counts and message retrieval.

A migration helper seeds development data with deterministic IDs so that UI tests have stable fixtures.

## Schema overview

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  subject TEXT NOT NULL,
  sender JSON NOT NULL,
  recipients JSON NOT NULL,
  folder TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  strategy INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE reports (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL REFERENCES messages(id),
  type TEXT NOT NULL,
  payload JSON NOT NULL,
  created_at TEXT NOT NULL
);
```

The TypeScript clients reuse the same schema via Zod types from `packages/shared`, preventing drift between frontend validation and backend persistence.
