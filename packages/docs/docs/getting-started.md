# Getting Started

This guide walks through installing prerequisites, running the development environment, and exploring the mock workflow end-to-end.

## Prerequisites

* **Node.js LTS** (v18.18 or later)
* **pnpm** (v8 or later)
* **Rust** stable toolchain via `rustup`
* **Python 3** with `mkdocs-material` for local documentation preview

## Installation

```bash
pnpm install
```

The repository uses a pnpm workspace with Turbo to coordinate builds. Running `pnpm install` at the repository root installs all Node dependencies and prepares Husky git hooks.

## Development workflows

### Start the desktop client and service

```bash
pnpm dev
```

The command launches the Tauri UI, compiles TypeScript packages in watch mode, and runs the Rust service with hot reload where applicable.

### Run tests

```bash
pnpm test
```

Turbo orchestrates Vitest (TypeScript) and `cargo test` (Rust) to ensure consistent behaviour across packages.

### Build artifacts

```bash
pnpm build
```

This produces production builds for the UI, CLI, SDK wrapper, and Rust service. The docs package also exposes `pnpm --filter @x400/docs run docs:build` for static site generation.

## Useful environment variables

| Variable | Description |
| --- | --- |
| `X400_BASE_URL` | Overrides the IPC endpoint when pointing the CLI or UI at a remote service |
| `X400_LOG_LEVEL` | Controls pino log verbosity (default: `info`) |
| `DATABASE_URL` | Allows the Rust service to connect to an alternate SQLite or SQLCipher database |

Continue to [Architecture](architecture.md) to understand how the pieces fit together.
