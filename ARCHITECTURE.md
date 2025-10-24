# Architecture Overview

The X.400 Client Modernization project is a pnpm + Turbo monorepo delivering a desktop UI, background services, SDK bindings, and automation tooling. The components communicate via a stable IPC surface exposed by the Rust core service.

```
┌─────────────────────────┐
│     apps/ui-client      │  React + Tauri desktop UI
└─────────────▲───────────┘
              │ hooks/services (@x400/sdk-wrapper)
┌─────────────┴───────────┐
│  packages/sdk-wrapper   │  TypeScript interfaces + mock/SDK transports
└─────────────▲───────────┘
              │ HTTP IPC (localhost, TLS 1.3 ready)
┌─────────────┴───────────┐
│ packages/core-service   │  Axum HTTP service, Queue/Store/Trace managers
└─────────────┬───────────┘
              │
   ┌──────────┴─────────┐
   │   QueueManager     │ – in-memory mock, strategy staging
   │   StoreManager     │ – SQLite/SQLCipher-ready persistence
   │   TraceManager     │ – structured redacted trace bundles
   │   Transport/P7     │ – TLS validation, SDK wiring, report parsing
   └──────────┬─────────┘
              │
        SQLite database
        Structured logs
```

## Submit strategies (0..5)

Submit strategies mirror historical FileWork behaviours and provide hooks for policy engines:

| Strategy | Behaviour                                                                      |
| -------- | ------------------------------------------------------------------------------ |
| 0        | Immediate enqueue and return once persisted (default mock implementation).     |
| 1        | Immediate enqueue + trace bundle capture for troubleshooting.                  |
| 2        | Deferred transport – persist message and wait for scheduler.                   |
| 3        | Parallel submission – attempt direct dispatch with persisted backup.           |
| 4        | Quarantine – persist to a quarantine folder pending manual approval.           |
| 5        | SDK passthrough – delegate to vendor SDK with minimal transformation (future). |

The mock service accepts a `strategy` field during `/submit` and `/compose`, logging the selection so automated tests can verify behaviour.

## DR/NDR correlation

Delivery (DR), non-delivery (NDR), and read reports are stored alongside their originating envelope. Reports share the message UUID so that the UI and CLI can present lineage, and the trace manager adds correlation IDs to exported bundles. When the real SDK integration lands the wrapper will translate vendor result codes into the shared Zod schema to prevent contract drift.

## SDK abstraction rationale

The `packages/sdk-wrapper` module isolates vendor-specific details from consumers:

- Presents consistent interfaces (`IX400Transport`, `IMessageService`, `IFolderService`) for the UI, CLI, and automation scripts.
- Provides both a mock HTTP implementation and an SDK-aware implementation that share retry and timeout logic.
- Centralises security enhancements such as certificate pinning, TLS policy enforcement, and error translation.

Future implementations (FFI bindings, gRPC bridges) can live alongside the mock transport without requiring application changes.

## Data flow

1. UI or CLI requests data through the SDK wrapper.
2. Wrapper issues HTTP requests to the core service.
3. Core service queries the store (SQLite) and queue manager, records trace entries, and returns typed JSON payloads.
4. Shared schemas (`packages/shared`) validate data on both sides, keeping the contract honest.

The architecture emphasises replaceability: each layer has a well-defined surface, enabling incremental upgrades without breaking tooling. The new `/status` endpoint exposes TLS, S/MIME, and transport mode to both the CLI and UI so that administrators can verify profile health before enabling the vendor SDK.
