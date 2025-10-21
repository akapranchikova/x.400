# Security Model

Security is a first-class concern for the modernization effort. Even though the current implementation is mocked, the design preserves the controls required for production deployments.

## TLS and certificates

* IPC endpoints are configured for TLS 1.3 only. The configuration file references certificate and key paths along with optional client-auth trust stores.
* Development mode uses plain HTTP on localhost, but the Tauri application and CLI surface visual warnings when TLS is disabled.
* Code signing placeholders are wired into the build pipeline. Windows builds expect an EV certificate thumbprint, while macOS builds reference an Apple Developer ID.

## Data at rest

* The SQLite store lives under `./data` and is compatible with SQLCipher. The configuration includes commented pragmas (`pragma key = ...`) and notes on enabling page-level encryption.
* Secrets such as the SQLCipher key are designed to be retrieved from OS keychains (DPAPI, Keychain, libsecret).
* Attachments and trace bundles are stored outside the Git repository with UUID-based directories to discourage accidental commits.

## Logging and telemetry

* The shared logger uses `pino` with redaction rules for recipient addresses and authentication headers.
* Trace bundles are JSONL archives zipped with metadata so that administrators can share them securely with support engineers.
* Audit events are planned for parity with FileWork: login attempts, submission results, and report ingestion will emit structured entries.

## Threat model

* **Primary risk** – interception of X.400 payloads during submission. Mitigation: TLS 1.3 with mutual authentication.
* **Secondary risk** – local workstation compromise. Mitigation: SQLCipher encryption, OS keychain integration, and secure update channels.
* **Operational risk** – misconfiguration when migrating from legacy environments. Mitigation: configuration validation via Zod and opinionated defaults that refuse weak cipher suites.

Future milestones will introduce automated certificate renewal (ACME/EST), security hardening guides per platform, and integration with enterprise SIEM tooling.
