# Security Policy

Security is fundamental to the modernization effort. Although the current implementation operates with mock transports, the design sets expectations for production deployments.

## TLS policy

- IPC endpoints are configured to require **TLS 1.3** when exposed beyond localhost. The configuration file (`packages/core-service/config/default.toml`) includes certificate chains, client identities, and fingerprint pinning.
- The `[transport.sdk]` block declares the SDK library path and default profile. Operators may override values via `X400_SDK_LIBRARY` and `X400_SDK_PROFILE` without editing configuration files.
- `transport.mode = "sdk"` triggers runtime validation: certificates are parsed for expiry, fingerprints are matched against the configured pinset, and OCSP placeholders enable future revocation checks.
- When an OCSP responder URL is configured the service surfaces a warning in `/status` until online revocation checks ship, ensuring operators understand the current coverage.
- Development mode runs on plain HTTP with explicit warnings in the logs and UI. Production builds must provide real certificates and, where required, client authentication trust stores.
- The Tauri build process contains placeholders for Windows EV code-signing certificates and macOS Developer ID identities. These must be supplied through secure CI secrets before shipping binaries.

## Data protection

- Storage uses SQLite today but transparently enables **SQLCipher** when `database.use_sqlcipher = true`. Keys are resolved from OS keychains (DPAPI, macOS Keychain, Secret Service) with the option to fall back to environment variables for CI.
- Attachments and trace bundles are stored outside the repository with UUID-based directory structures to reduce accidental leakage. Backups should be encrypted and rotated according to enterprise policies.
- Secrets (SQLCipher keys, API tokens) must never be committed to the repository. Use environment variables, key management services, or OS keychains.

## S/MIME

- Certificates reside under `profiles/certs/` with defaults for signing and encryption. The core service signs outgoing messages and verifies incoming payloads when certificates are available.
- Verification results are exposed through the `/status` endpoint and surfaced in the CLI (`health`, `bind-test`) and UI status bar.
- Certificate and key distribution must follow organisational PKI policy; private keys should be deployed via secure secrets management rather than static files.

## Logging and observability

- The shared logger wraps `pino` with redaction rules for authentication headers, recipient lists, and attachments. Structured logs can be ingested into SIEM tooling without exposing PII.
- Trace bundles retrieved via `/trace/bundle` are JSONL archives limited to sanitized metadata. Support workflows rely on operators exporting bundles manually, ensuring explicit consent.
- Audit events (logins, submission results, report ingestion) are logged with correlation IDs to make incident response efficient.

## Responsible disclosure

Security issues should be reported privately to the X.400 modernization security contact (placeholder: `security@example.com`). Provide details, reproduction steps, and any logs or trace bundles. Do not create public GitHub issues for security vulnerabilities.

## Dependency management

- GitHub Actions runs dependency audits as part of the CI pipeline (future milestone). In the meantime, use `pnpm audit` and `cargo audit` locally before releases.
- Rust dependencies are pinned via `Cargo.lock`, and Node dependencies use pnpm workspace resolution to avoid drift.

We will review this policy every release, updating the documentation and configuration defaults as the system moves from mock transports to production-grade SDK integrations.
