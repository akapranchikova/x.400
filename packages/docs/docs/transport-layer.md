# Transport Layer

The transport layer defines how the modernization stack communicates with both the vendor SDK and any future message brokers. In this skeleton the layer is mocked but retains security-conscious defaults.

## IPC surface

The Rust core service exposes an Axum HTTP server bound to `127.0.0.1:7878` by default. Endpoints include:

| Method | Path | Description |
| --- | --- | --- |
| `GET` | `/folders` | Returns folder metadata and unread counts |
| `GET` | `/messages` | Lists message envelopes for a folder (`?folder=inbox`) |
| `GET` | `/messages/:id` | Returns envelope, content, and reports |
| `DELETE` | `/messages/:id` | Removes a message |
| `POST` | `/messages/:id/move` | Moves a message between folders |
| `POST` | `/messages/:id/archive` | Archives a message |
| `POST` | `/compose` | Creates a draft and enqueues submission |
| `POST` | `/submit` | Submits an envelope + content bundle with a strategy |
| `GET` | `/trace/bundle` | Retrieves the most recent structured trace entries |

Authentication is mocked, but the configuration file includes placeholders for mutual TLS and API-key validation. When the real SDK integration lands, the wrapper will supply signed tokens.

## Security defaults

* **TLS 1.3 only** – the configuration enforces TLS 1.3 when IPC is exposed beyond localhost. Development builds run without certificates, but config stubs point to keystores and trust anchors.
* **Code signing** – Tauri builds include placeholders for Windows and macOS signing identities. The CLI documentation outlines how to inject certificates at build time.
* **Structured logging** – every request attaches correlation IDs and redacts personally identifiable information before writing to disk.

## Mock transport behaviour

The TypeScript SDK wrapper uses Axios to call the IPC endpoints. In mock mode it generates deterministic queues, message lists, and submission results. This allows UI integration tests and CLI smoke tests to run without the vendor SDK.

A future implementation will expose a streaming channel for push notifications so that folder badges update in real time when new DR/NDR messages arrive.
