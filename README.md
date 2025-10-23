# X.400 Client Modernization

![Build](https://img.shields.io/badge/build-turbo%20ready-blue?style=flat-square)
![Tests](https://img.shields.io/badge/tests-vitest%20%2B%20cargo-green?style=flat-square)
![Coverage](https://img.shields.io/badge/coverage-80%25-blueviolet?style=flat-square)
![Docs](https://img.shields.io/badge/docs-mkdocs%20material-informational?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![pnpm](https://img.shields.io/badge/pnpm-8.x-orange?style=flat-square)

Modernization of the MailmaX.400/FileWork desktop suite built as a pnpm + Turbo monorepo. The repository contains a Tauri desktop UI, a Rust background service, TypeScript SDK bindings, a CLI compatible with FW_SI.EXE verbs, and comprehensive documentation. Everything ships with mock transports so the project builds and runs without vendor SDK access.

## What is this project?

The goal is to provide a secure, cross-platform replacement for legacy X.400 tooling while maintaining operational parity. The modernization introduces:

* A React + Tauri desktop client for Windows, Linux, and macOS.
* A Rust IPC service with HTTP endpoints for queue management, storage, and trace bundles.
* A TypeScript SDK wrapper abstracting the eventual vendor SDK integration.
* A Node.js CLI for automation scenarios still using FW_SI command verbs.
* MkDocs documentation and a roadmap aligned with modernization milestones.

## Current status

🚧 **MVP scaffold available**

- ✅ pnpm + Turbo monorepo structure
- ✅ Mock Rust service with SQLite-backed store
- ✅ React UI with folders, messages, compose, and settings
- ✅ CLI verbs for create/list/move/access/archive/delete/wait/message
- 🚧 SDK FFI bindings (mock transport only)
- 🚧 Security hardening and SQLCipher encryption
- ⏳ FWM/FWZ migration tooling

## Feature matrix

| Capability | Status |
| --- | --- |
| X.400 P7 Operations: Bind/Submit/Fetch/List/Delete/Register-MS | **Mocked** |
| DR/NDR/Read Reports | **Mocked** |
| Queue Manager | **Implemented (mock)** |
| Local Store (SQLite) | **Implemented (dev)** |
| Import FWM/FWZ | **Planned** |
| CLI FW_SI compatibility | **Planned** |

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

```bash
pnpm dev
```

### Build all packages

```bash
pnpm build
```

## How to Test

The monorepo ships with a full testing harness across TypeScript, Rust, and Playwright. See [TESTING.md](TESTING.md) for the exhaustive guide. Common entry points:

| Goal | Command |
| --- | --- |
| Install deps | `pnpm install` |
| Unit & integration (Vitest + cargo) | `pnpm test:all` |
| UI component tests | `pnpm test:ui` |
| SDK wrapper contract tests | `pnpm test:sdk` |
| CLI tests | `pnpm test:cli` |
| Rust core-service tests | `pnpm test:core` |
| Playwright E2E | `pnpm e2e` / `pnpm e2e:headed` |
| Coverage reports | `pnpm coverage` |
| Security audits | `pnpm audit --prod` & `pnpm --filter @x400/core-service run audit` |

Additional details—test data, mock services, and CI pipelines—are documented in [packages/docs/docs/testing.md](packages/docs/docs/testing.md).

### Launch documentation site

```bash
pnpm docs:dev
```

## Project structure

```
apps/
  ui-client/       Tauri + React desktop application
packages/
  core-service/    Rust IPC service (Axum, sqlx) with mock queues/storage
  sdk-wrapper/     TypeScript interfaces and mock HTTP transport
  cli/             Node.js CLI mirroring FW_SI.EXE verbs
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
