# SDK Transport Integration

The modernization stack now ships with a production-grade transport scaffolding that can load the vendor X.400 P7 SDK while keeping the existing mock flows available for development and CI.

## Modes

Set `transport.mode` in `packages/core-service/config/default.toml` (or via `X400_MODE`) to control the runtime:

- `mock` – Default for local development; uses the in-process queue and SQLite store only.
- `sdk` – Enables TLS validation, profile inspection, and the `transport/p7_driver.rs` integration point for the vendor SDK.

The CLI and UI automatically detect the active mode through the `/status` endpoint exposed by the core service. The CLI also supports the `--mock` flag to force mock behaviour for a single invocation.

## SDK runtime configuration

Set the `[transport.sdk]` table in `packages/core-service/config/default.toml` (or `X400_SDK_*` environment variables) to point at the vendor runtime:

- `library_path` – Absolute path to the vendor shared library (`.so`, `.dll`, `.dylib`).
- `preferred_profile` – Default profile name passed to `bind` when the CLI/UI do not specify one explicitly.
- `connect_timeout_ms` / `operation_timeout_ms` – Client-side guards for session establishment and subsequent SDK calls.

At startup the core service resolves environment overrides, loads the library via `libloading`, and initializes the driver. Any error is surfaced in the `/status` payload and CLI health checks.

## TLS configuration

When `transport.tls.enabled = true`, the core service loads certificates from the `profiles/` directory:

- `profiles/certs/ca.pem` – CA chain used to validate the SDK peer.
- `transport.fingerprints` – Optional SHA-256 fingerprints for pinning.
- `transport.tls.client_certificate` / `client_key` – Client certificate pair for mutual TLS.
- `transport.tls.ocsp_responder` – Optional OCSP responder URL. When configured the service records the responder and emits a warning until live revocation checks are implemented.

At startup the service checks expiry dates, validates fingerprints, and emits the verdict through `/status`. The CLI `health` command can fail fast when `--tls-verify` is provided.

## SQLCipher storage

Enable encrypted storage by setting `database.use_sqlcipher = true`. Keys are resolved via:

1. OS keychain (DPAPI on Windows, macOS Keychain, Secret Service on Linux) using `security.keychain` hints.
2. A fallback environment variable (e.g. `X400_SQLCIPHER_KEY`) for CI automation.

The store falls back to plaintext SQLite if no key is available, logging a warning so operators can remediate.

## S/MIME support

Place signing and encryption certificates under `profiles/certs/` (defaults: `signing.pem/signing.key`, `encryption.pem`). When `security.smime.enabled = true`, outgoing messages are signed and incoming payloads are verified. Verification results surface in `/status`, the CLI `health` command, and the desktop status bar.

## CLI & UI touchpoints

| Command / View       | Purpose                                                     |
| -------------------- | ----------------------------------------------------------- |
| `x400-cli bind-test` | Connects to the SDK transport and prints session + status   |
| `x400-cli submit`    | Submits a message honouring TLS/S/MIME configuration        |
| `x400-cli health`    | Reports transport mode, TLS verdict, fingerprints, S/MIME   |
| Desktop status bar   | Shows connectivity, mode, TLS verdict, and S/MIME readiness |
| Settings panel       | Displays profile metadata and fingerprint information       |

## Troubleshooting

| Symptom                                       | Resolution                                                             |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `/status` reports `TLS: fingerprint mismatch` | Update `transport.fingerprints` with the correct SHA-256 fingerprint.  |
| SQLCipher key not applied                     | Confirm the key exists in the configured keychain or fallback variable |
| S/MIME verification failed                    | Ensure certificates are valid and match incoming signatures            |
| CLI stuck in mock mode                        | Remove `--mock`, set `X400_MODE=sdk`, and restart the core service     |

For deeper diagnostics consult the trace bundle (`/trace/bundle`) and the Rust logs emitted by `transport/p7_driver.rs` during initialization.
