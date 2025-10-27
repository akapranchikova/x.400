# X.400 Client Modernization

![Build](https://img.shields.io/badge/build-turbo%20ready-blue?style=flat-square)
![Tests](https://img.shields.io/badge/tests-vitest%20%2B%20cargo-green?style=flat-square)
![Coverage](https://img.shields.io/badge/coverage-80%25-blueviolet?style=flat-square)
![Docs](https://img.shields.io/badge/docs-mkdocs%20material-informational?style=flat-square)
![Telemetry](https://img.shields.io/badge/telemetry-opt--in-important?style=flat-square)
![Release](https://img.shields.io/badge/release-semantic--release-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![pnpm](https://img.shields.io/badge/pnpm-8.x-orange?style=flat-square)

Modernization of the MailmaX.400/FileWork desktop suite built as a pnpm + Turbo monorepo. The repository contains a Tauri desktop UI, a Rust background service, TypeScript SDK bindings, a CLI compatible with FW_SI.EXE verbs, and comprehensive documentation. Everything ships with mock transports so the project builds and runs without vendor SDK access.

## What is this project?

The goal is to provide a secure, cross-platform replacement for legacy X.400 tooling while maintaining operational parity. The modernization introduces:

- A React + Tauri desktop client for Windows, Linux, and macOS.
- A Rust IPC service with HTTP endpoints for queue management, storage, and trace bundles.
- A TypeScript SDK wrapper abstracting the eventual vendor SDK integration.
- A Node.js CLI for automation scenarios still using FW_SI command verbs.
- MkDocs documentation and a roadmap aligned with modernization milestones.

## Current status

🚧 **MVP scaffold available**

- ✅ pnpm + Turbo monorepo structure
- ✅ Mock Rust service with SQLite-backed store
- ✅ React UI with folders, messages, compose, settings, advanced search, and live status bar
- ✅ SMTP↔X.400 gateway adapter with address preview and domain allow list enforcement
- ✅ LDAP/X.500 directory integration with autocomplete, caching, and CLI verbs
- ✅ CLI verbs for create/list/move/access/archive/delete/wait/message/bind-test/health/migrate
- ✅ SDK-aware transport wrapper with automatic mock/SDK switching
- ✅ Security hardening hooks: TLS validation, SQLCipher key retrieval, S/MIME scaffolding
- ✅ FWM/FWZ migration tooling with dry-run, resume, and checksum validation
- ✅ Telemetry instrumentation with diagnostics panel, CLI bundle export, and support tooling

## Feature matrix

| Capability                                                     | Status                               |
| -------------------------------------------------------------- | ------------------------------------ |
| X.400 P7 Operations: Bind/Submit/Fetch/List/Delete/Register-MS | **SDK-ready (mock fallback)**        |
| DR/NDR/Read Reports                                            | **Mocked**                           |
| SMTP↔X.400 Gateway                                            | **Mocked (preview + allow list)**    |
| Directory autocomplete & DLs                                   | **Mocked (cache + CLI)**             |
| Queue Manager                                                  | **Implemented (mock)**               |
| Local Store (SQLite/SQLCipher)                                 | **Implemented (SQLCipher optional)** |
| TLS 1.3 enforcement & fingerprint pinning                      | **Implemented**                      |
| S/MIME sign/encrypt/verify scaffolding                         | **Implemented (cert-dependent)**     |
| Import FWM/FWZ                                                 | **Implemented (dry-run/resume)**     |
| CLI FW_SI compatibility                                        | **Implemented (see docs/cli.md)**    |
| Telemetry & diagnostics                                        | 🚧 **Opt-in (UI + CLI bundles)**     |

## Security & SDK Integration

The mock transport can now be replaced at runtime with the real vendor SDK via `packages/core-service/src/transport/p7_driver.rs`.
Key highlights:

- `transport.mode` in `config/default.toml` controls whether the Rust service uses the mock queue or validates SDK profiles.
- `[transport.sdk]` controls the dynamic SDK integration. Set `library_path` to the vendor-provided shared library and `preferred_profile` to the default runtime profile. Both options can be overridden via `X400_SDK_LIBRARY` / `X400_SDK_PROFILE`.
- TLS assets are loaded from `profiles/` with expiry checks, fingerprint pinning, and OCSP placeholders.
- SQLCipher keys resolve from OS keychains (DPAPI, macOS Keychain, Linux Secret Service) with environment fallbacks for CI.
- S/MIME helpers sign, encrypt, and verify payloads when certificates are present.
- The CLI (`x400-cli`) exposes `bind-test`, `submit`, and `health` commands to exercise secure profiles.
- The desktop UI surfaces the active transport mode, TLS verdict, and S/MIME status in the status bar and settings panel.

See [docs/transport-sdk.md](packages/docs/docs/transport-sdk.md) for configuration examples, troubleshooting, and profile management tips.

## Getting started

### Prerequisites

- Node.js LTS (18.18 or later)
- pnpm 8+
- Rust stable (via `rustup`)
- Python 3 with `mkdocs-material` for docs previews

### Install dependencies

```bash
pnpm install
```

### Run in development

1. Copy and validate the environment configuration (skips existing files):

   ```bash
   pnpm run env:copy
   pnpm run env:check
   ```

2. Start the full workspace in watch mode. Passing `--output-logs=stream` keeps
   every process attached to the terminal instead of collapsing previous
   entries:

   ```bash
   pnpm dev -- --output-logs=stream
   ```

   Turbo spawns the following processes and keeps them running:

   | Package / command                    | Purpose                                             | Default endpoint                       |
   | ------------------------------------ | --------------------------------------------------- | -------------------------------------- |
   | `@x400/core-service` → `cargo run`   | Mock Rust IPC server used by the UI and CLI         | `http://127.0.0.1:3333`                |
   | `apps/ui-client` → `vite`            | Web UI dev server                                   | `http://localhost:5173`                |
   | `apps/ui-client` → `tauri dev`¹      | Desktop shell hooking into the Vite dev server      | Window shell → `http://localhost:1420` |
   | `@x400/sdk-wrapper` / `@x400/shared` | TypeScript build/watch pipelines consumed by the UI | _n/a_                                  |
   | `@x400/cli`                          | Rebuilds the CLI bundle for local smoke tests       | _n/a_                                  |

   ¹Launch the shell explicitly with `pnpm --filter ui-client tauri dev` when
   you want the desktop window. The command reuses the Vite server above so no
   extra configuration is required.

   The core service prints the bound address as soon as it loads the config:

   ```text
   Core service initialised on 127.0.0.1:3333 with <N> queued messages
   ```

   You can change the binding by editing
   [`packages/core-service/config/default.toml`](packages/core-service/config/default.toml)
   or overriding `CORE_IPC_HOST` / `CORE_IPC_PORT` in `.env`.

### Environment Variables

Copy the provided defaults and verify required values before starting any apps or tests:

```bash
pnpm run env:copy
pnpm run env:check
```

Key variables shipped in [`.env.example`](./.env.example):

| Variable                          | Default                 | Used by                                      |
| --------------------------------- | ----------------------- | -------------------------------------------- |
| `CORE_IPC_HOST` / `CORE_IPC_PORT` | `127.0.0.1` / `3333`    | Rust core-service, CLI, UI mocks, Playwright |
| `CORE_DB_PATH`                    | `./data/x400.sqlite`    | Rust core-service                            |
| `X400_MODE`                       | `mock`                  | CLI, SDK wrapper                             |
| `CLI_DEFAULT_PROFILE`             | `default`               | CLI `env` sanity command                     |
| `TAURI_DEV_HOST`                  | `http://localhost:1420` | Desktop shell / Tauri dev server             |
| `VITE_INLINE_EXECUTION`           | `true`                  | UI transport (enables inline mock data)      |

See [docs/environment.md](packages/docs/docs/environment.md) for the full catalog and CI behaviour notes.

### Development troubleshooting

- **Another service already uses a port** – `EADDRINUSE` in the console means
  either the Rust service (`3333`) or the Vite dev server (`5173`) is still
  running. Stop stray processes or change the port via `.env` (for the core
  service) or by passing `--port <free-port>` to
  `pnpm --filter ui-client dev`.
- **The desktop window does not appear** – run
  `pnpm --filter ui-client tauri dev`. The Tauri shell only launches on demand;
  the default `pnpm dev` command keeps the web UI running in the browser.
- **Terminal output keeps resetting** – Turbo collapses task logs by default.
  Pass `--output-logs=stream` (as in the command above) or `--output-logs=full`
  to persist previous output. You can also run individual tasks directly (for
  example `pnpm --filter @x400/core-service dev`) to keep a dedicated console.
- **Environment variables are missing** – run `pnpm run env:copy` to recreate
  `.env` from the template and `pnpm run env:check` to ensure the required keys
  (`CORE_IPC_PORT`, `X400_MODE`, etc.) are exported before starting services.

### Build all packages

```bash
pnpm build
```

## How to Test

The monorepo ships with a full testing harness across TypeScript, Rust, and Playwright. See [TESTING.md](TESTING.md) for the exhaustive guide. Common entry points:

| Goal                                | Command                                                            |
| ----------------------------------- | ------------------------------------------------------------------ |
| Install deps                        | `pnpm install`                                                     |
| Unit & integration (Vitest + cargo) | `pnpm test:all`                                                    |
| UI component tests                  | `pnpm test:ui`                                                     |
| SDK wrapper contract tests          | `pnpm test:sdk`                                                    |
| CLI tests                           | `pnpm test:cli`                                                    |
| Rust core-service tests             | `pnpm test:core`                                                   |
| Playwright E2E                      | `pnpm e2e` / `pnpm e2e:headed`                                     |
| Coverage reports                    | `pnpm coverage`                                                    |
| Security audits                     | `pnpm audit --prod` & `pnpm --filter @x400/core-service run audit` |

Additional details—test data, mock services, and CI pipelines—are documented in [packages/docs/docs/testing.md](packages/docs/docs/testing.md).

### Launch documentation site

```bash
pnpm docs:dev
```

### Migration & CLI quick start

- Run a dry-run against a legacy workspace: `pnpm --filter @x400/cli exec x400-cli migrate --path ./legacy --dry-run --json`.
- Start a full import with resume support: `x400-cli migrate --path ./legacy/archive.fwz --type fwz --quarantine ./quarantine`.
- Enable the admin UI migration panel by setting `VITE_ENABLE_MIGRATION=true` in your `.env` before launching `pnpm --filter ui-client dev`.
- Review the full runbook and troubleshooting tips in [packages/docs/docs/migration.md](packages/docs/docs/migration.md) and the FW_SI compatibility table in [packages/docs/docs/cli.md](packages/docs/docs/cli.md).

## Project structure

```
apps/
  ui-client/       Tauri + React desktop application
packages/
  core-service/    Rust IPC service (Axum, sqlx) with mock queues/storage
  sdk-wrapper/     TypeScript interfaces and mock HTTP transport
  cli/             Node.js CLI mirroring FW_SI.EXE verbs
  support-tool/    CLI for inspecting diagnostics bundles and validating PII redaction
  docs/            MkDocs + Material documentation site
  shared/          Zod schemas, shared types, logging utilities
```

## Security

- TLS 1.3 enforced in configuration with placeholders for certificate paths and client authentication.
- SQLCipher migration plan documented; dev builds use plain SQLite while explaining how to enable encryption.
- Code-signing placeholders for Windows EV certificates and macOS Developer IDs baked into the Tauri config.
- Structured logging via `pino` with redaction for sensitive metadata; trace bundles can be exported for support without exposing PII.

## Contributing & Code of Conduct

- Follow [Contributing guidelines](CONTRIBUTING.md) including Conventional Commits and branch strategy.
- All community interactions fall under the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

MIT © X.400 Modernization Team.

## Roadmap & Documentation

- Detailed roadmap: [ROADMAP.md](ROADMAP.md)
- Full documentation site: [`packages/docs`](packages/docs) (serve locally with `pnpm docs:dev`)

## Production Readiness and Support

- Automated release pipeline triggered by semver tags (`.github/workflows/release.yml`) produces
  signed Tauri bundles, CLI binaries, and Rust artifacts while publishing release notes via
  `semantic-release`.
- New diagnostics panel surfaces telemetry metrics, system information, and a one-click support
  upload workflow in the desktop UI.
- `x400-cli support trace` and the dedicated `x400-support` utility collect, validate, and analyze
  trace bundles with PII redaction checks.
- Comprehensive runbooks cover release management, telemetry configuration, support operations,
  error codes, and targeted testing (see `packages/docs/docs/*`).
