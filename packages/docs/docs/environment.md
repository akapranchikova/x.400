# Environment Configuration

The modernization workspace standardises configuration through a checked-in `.env.example` at the repo root. Copy it locally and override values as needed—never commit real credentials.

## Quick start

```bash
pnpm run env:copy
pnpm run env:check
```

The `env:copy` script copies `.env.example` to `.env` when the file does not yet exist. `env:check` loads the environment (via `dotenv`) and ensures critical keys such as `CORE_IPC_PORT` and `X400_MODE` are present before starting services or CI jobs.

## Variable reference

### Global

| Variable   | Default       | Purpose                                     |
| ---------- | ------------- | ------------------------------------------- |
| `NODE_ENV` | `development` | Controls React/Vite + Node mode             |
| `RUST_LOG` | `info`        | Default log level for the Rust core-service |

### UI / Tauri

| Variable         | Default                 | Purpose                                                    |
| ---------------- | ----------------------- | ---------------------------------------------------------- |
| `TAURI_DEV_HOST` | `http://localhost:1420` | Host exposed by the desktop shell during local development |

### Core service

| Variable                                   | Default                               | Purpose                                                                      |
| ------------------------------------------ | ------------------------------------- | ---------------------------------------------------------------------------- |
| `CORE_IPC_HOST` / `CORE_IPC_PORT`          | `127.0.0.1` / `3333`                  | IPC bind address consumed by the CLI, UI transport, and Playwright e2e mocks |
| `CORE_DB_PATH`                             | `./data/x400.sqlite`                  | SQLite location for dev builds (wrapped as `sqlite://` internally)           |
| `CORE_DB_ENCRYPTION_KEY`                   | `dev_only_key`                        | Placeholder demonstrating SQLCipher usage in secured builds                  |
| `CORE_TLS_ENABLE`                          | `false`                               | Toggles TLS bindings for the IPC server                                      |
| `CORE_TLS_CERT_PATH` / `CORE_TLS_KEY_PATH` | `./certs/dev.crt` / `./certs/dev.key` | Certificate/key file paths when TLS is enabled                               |

### SDK / Transport

| Variable                      | Default                   | Purpose                                                                   |
| ----------------------------- | ------------------------- | ------------------------------------------------------------------------- |
| `X400_MODE`                   | `mock`                    | Chooses between the mocked transport and future SDK-backed implementation |
| `X400_SDK_LIB_PATH`           | `./vendor/sdk/libx400.so` | Location to the native SDK library when `X400_MODE=sdk`                   |
| `X400_PROFILE`                | `default`                 | Active transport profile for UI + CLI                                     |
| `X400_USER` / `X400_PASSWORD` | `devuser` / `devpass`     | Mock credentials used by transport tests                                  |

### Directory & messaging gateways

| Variable                               | Default                                     | Purpose                            |
| -------------------------------------- | ------------------------------------------- | ---------------------------------- |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_TLS` | `smtp.dev.local` / `587` / `true`           | Mail gateway placeholders          |
| `IMAP_HOST` / `IMAP_PORT` / `IMAP_TLS` | `imap.dev.local` / `993` / `true`           | Inbox sync placeholders            |
| `LDAP_URL`                             | `ldaps://ldap.dev.local`                    | Directory service mock             |
| `LDAP_BIND_DN` / `LDAP_BIND_PASSWORD`  | `cn=app,ou=svc,dc=dev,dc=local` / `devpass` | Bind account for directory lookups |
| `LDAP_BASE_DN`                         | `dc=dev,dc=local`                           | Base DN for LDAP queries           |

### Telemetry & support tooling

| Variable                  | Default                                | Purpose                                   |
| ------------------------- | -------------------------------------- | ----------------------------------------- |
| `TELEMETRY_ENABLED`       | `false`                                | Toggles optional telemetry uploads        |
| `SUPPORT_UPLOAD_ENDPOINT` | `http://localhost:3333/support/upload` | Endpoint used for trace uploads in dev    |
| `TRACE_BUNDLE_PATH`       | `./traces`                             | Directory where trace bundles are emitted |

### CLI helpers

| Variable              | Default   | Purpose                                               |
| --------------------- | --------- | ----------------------------------------------------- |
| `CLI_DEFAULT_PROFILE` | `default` | Profile printed by `x400-cli env --json` sanity check |

## Continuous integration

The CI workflow adds a **Setup environment** step that copies `.env.example` into `.env` and logs the resolved IPC port. All jobs rely on deterministic defaults, and Playwright retries twice when running on CI runners. The CLI `env --json` command is used as a sanity check to assert that `X400_MODE`, `CLI_DEFAULT_PROFILE`, and the IPC URL are wired correctly.

## Security guidelines

- Keep production credentials in your secret manager—`.env` is ignored by Git and should stay local.
- Rotate TLS material (`CORE_TLS_CERT_PATH` / `CORE_TLS_KEY_PATH`) for real deployments.
- The defaults intentionally point at local mock services; update them explicitly when integrating the real SDK or gateways.
