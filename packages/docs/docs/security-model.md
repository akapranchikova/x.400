# Security Model

Security is a first-class concern for the modernization effort. Even though the current implementation is mocked, the design preserves the controls required for production deployments.

## TLS and certificates

- IPC endpoints are configured for TLS 1.3 only. The configuration file references certificate chains, client credentials, and fingerprint pinsets.
- The `[transport.sdk]` section declares the SDK library path, preferred profile, and timeout guards. Environment overrides (`X400_SDK_LIBRARY`, `X400_SDK_PROFILE`) are supported for CI and secrets management.
- When `transport.mode` is set to `sdk`, the core service loads certificates at startup, checks expiry and fingerprints, and exposes the verdict via `/status`.
- OCSP responder URLs trigger a `/status` warning until active revocation checks are implemented so operators retain situational awareness.
- Development mode uses plain HTTP on localhost, but the Tauri application and CLI surface visual warnings when TLS is disabled.
- Code signing placeholders are wired into the build pipeline. Windows builds expect an EV certificate thumbprint, while macOS builds reference an Apple Developer ID.

## Data at rest

- The SQLite store lives under `./data` and automatically enables SQLCipher when configured. Keys are resolved from OS keychains (DPAPI, Keychain, libsecret) with environment fallbacks for CI.
- Secrets such as the SQLCipher key should be retrieved from OS keychains; environment variables are reserved for non-production automation.
- Attachments and trace bundles are stored outside the Git repository with UUID-based directories to discourage accidental commits.

## S/MIME controls

- Certificates live under `profiles/certs/`. Signing, encryption, and verification are handled by the Rust service via OpenSSL bindings.
- Signature results are logged and surfaced through the `/status` endpoint, allowing operators to confirm certificate health.
- Certificate rotation should follow enterprise PKI policy; the project does not ship private keys.

## Logging and telemetry

- The shared logger uses `pino` with redaction rules for recipient addresses and authentication headers.
- Trace bundles are JSONL archives zipped with metadata so that administrators can share them securely with support engineers.
- Audit events are planned for parity with FileWork: login attempts, submission results, and report ingestion will emit structured entries.

## Threat model

- **Primary risk** – interception of X.400 payloads during submission. Mitigation: TLS 1.3 with mutual authentication.
- **Secondary risk** – local workstation compromise. Mitigation: SQLCipher encryption, OS keychain integration, and secure update channels.
- **Operational risk** – misconfiguration when migrating from legacy environments. Mitigation: configuration validation via Zod and opinionated defaults that refuse weak cipher suites.

Future milestones will introduce automated certificate renewal (ACME/EST), security hardening guides per platform, and integration with enterprise SIEM tooling.
