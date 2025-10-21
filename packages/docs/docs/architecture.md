# Architecture

The modernization project separates responsibilities into modular packages that communicate through stable interfaces and local IPC. The goal is to keep the X.400 protocol details encapsulated while offering predictable integration points for UI and automation layers.

```
┌───────────────────┐      ┌──────────────────────┐      ┌─────────────────────┐
│  apps/ui-client   │◄────►│ packages/sdk-wrapper │◄────►│ packages/core-service│
└───────────────────┘      └──────────────────────┘      └─────────┬───────────┘
         ▲                           ▲                              │
         │                           │                              │
         │                           │                     ┌────────▼─────────┐
         │                           │                     │ QueueManager     │
         │                           │                     │ StoreManager     │
         │                           │                     │ TraceManager     │
         │                           │                     └────────┬─────────┘
         │                           │                              │
         │                           │                   ┌──────────▼──────────┐
         │                           │                   │ SQLite (SQLCipher) │
         │                           │                   │ Structured logging │
         │                           │                   │ Transport stubs    │
```

* The **UI client** renders message lists, folders, and compose flows using React and relies exclusively on the SDK wrapper to avoid leaking transport details.
* The **SDK wrapper** normalises TypeScript consumers and hides the eventual vendor SDK behind clean interfaces. The mock implementation uses Axios to call the local HTTP IPC.
* The **core service** is written in Rust for safety and performance. It exposes an Axum-based HTTP API, queues messages in memory, persists envelopes and content in SQLite, and emits structured trace bundles for troubleshooting.

## Submit strategies (0..5)

The submit strategies mirror historical FileWork behaviour:

1. **Strategy 0** – immediate hand-off: directly enqueues the message and returns once persisted.
2. **Strategy 1** – hand-off with trace capture: collects a trace bundle for troubleshooting.
3. **Strategy 2** – deferred transport: stores the message and waits for an external scheduler to trigger submission.
4. **Strategy 3** – parallel submission: attempts immediate dispatch while persisting a fallback copy.
5. **Strategy 4** – quarantine: stores the message in a secure quarantine folder pending manual approval.
6. **Strategy 5** – SDK passthrough: delegates to the vendor SDK with minimal transformation (future implementation).

The mock service accepts a `strategy` field during submission and logs the selection so that testing can assert behaviour.

## DR/NDR correlation

Delivery reports (DR), non-delivery reports (NDR), and read reports share a correlation identifier with the original envelope. The service stores them alongside the message and exposes them via `/messages/:id`. When the SDK integration lands, the wrapper will map vendor-specific result codes into the shared Zod schemas, ensuring consistent typing across the UI and CLI.

## SDK abstraction rationale

Abstracting the vendor SDK through the `sdk-wrapper` package provides:

* A place to perform validation and translate error codes before they reach UI components.
* A mock transport for offline testing and CI pipelines.
* A single point of integration for security hardening (e.g., certificate pinning, TLS policy enforcement).

Future releases will add additional implementations (e.g., direct native bindings) without forcing application code to change.
