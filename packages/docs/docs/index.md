# X.400 Client Modernization

The X.400 Client Modernization programme delivers a cross-platform desktop client, local services, and automation tooling that bring the resiliency of legacy MailmaX.400/FileWork workflows to modern platforms. This documentation portal accompanies the pnpm + Turbo monorepo and explains how the new architecture preserves X.400 guarantees while embracing contemporary engineering practices.

!!! info "Project status"
The repository ships with a mock transport and SQLite-backed store suitable for local development and demos. Integration with the vendor X.400 SDK is planned for upcoming milestones.

## Monorepo at a glance

| Package                 | Purpose                                                                                      |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| `apps/ui-client`        | Tauri + React desktop client for Windows, Linux, and macOS                                   |
| `packages/core-service` | Rust background service exposing an HTTP IPC surface for queues, storage, and trace capture  |
| `packages/sdk-wrapper`  | TypeScript bridge that abstracts the vendor SDK and provides a mock transport implementation |
| `packages/shared`       | Shared Zod schemas, typed helpers, and logging utilities                                     |
| `packages/cli`          | Node.js CLI mirroring FW_SI.EXE verbs                                                        |
| `packages/docs`         | MkDocs site powering this documentation                                                      |

## Why modernize MailmaX.400/FileWork?

- Restore support for current operating systems without sacrificing compliance.
- Replace fragile COM automation with audited IPC endpoints.
- Introduce secure defaults such as TLS 1.3 only transport, SQLCipher-ready storage, and opinionated tracing.
- Enable continuous delivery with automated testing and GitHub Actions CI.

Continue to [Getting Started](getting-started.md) for installation instructions.

## Feature deep-dives

- [Gateway mode](gateway-mode.md) – address mapping, DSN/MDN bridging, and preview tooling.
- [Directory integration](directory-integration.md) – LDAP configuration, caching, and CLI helpers.
- [UI advanced search](ui-advanced-search.md) – keyboard shortcuts, saved filters, and status bar updates.
- [Testing the gateway and directory stack](testing-gateway-directory.md) – guidance for exercising the new components.
