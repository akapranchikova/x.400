# Testing Guide

The X.400 client monorepo includes TypeScript, Rust, and Playwright projects. This guide explains how to execute the full testing strategy locally and in CI.

## Test Taxonomy

| Layer                 | Purpose                                                                          | Tooling                                                             |
| --------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Unit**              | Validate individual utilities, hooks, and managers.                              | `vitest`, `cargo test`                                              |
| **Integration**       | Exercise IPC flows between SDK wrapper, CLI, and core-service.                   | `vitest`, `cargo test`, Playwright route mocks                      |
| **Contract**          | Ensure the OpenAPI contract matches generated clients.                           | `@apidevtools/swagger-parser`, `openapi-client-axios`, `serde_json` |
| **End-to-end (E2E)**  | Simulate a user composing, submitting, and receiving delivery reports in the UI. | Playwright + Tauri/Vite preview                                     |
| **Performance smoke** | Benchmark the compose/submit loop in Rust.                                       | `criterion` bench (`cargo bench --bench submit_loop`)               |
| **Security**          | Scan dependencies and lint for risky patterns.                                   | `pnpm audit`, `cargo audit`, `eslint-plugin-security`               |

## Commands Overview

```bash
# Install dependencies
pnpm install

# Run project-wide unit tests (TypeScript + Rust)
pnpm test:all

# Package-specific tests
pnpm test:ui         # apps/ui-client Vitest suite
pnpm test:sdk        # packages/sdk-wrapper
pnpm test:cli        # packages/cli
pnpm test:shared     # packages/shared
pnpm test:core       # cargo tests (unit + integration)
pnpm gateway-tests  # core-service gateway adapter tests
pnpm directory-tests # core-service directory tests

# Playwright end-to-end scenarios
pnpm e2e             # headless
pnpm e2e:headed      # headed mode with UI

# Coverage reports
pnpm --filter ui-client run coverage
pnpm --filter @x400/sdk-wrapper run coverage
pnpm --filter @x400/cli run coverage
pnpm coverage        # aggregate Vitest coverage via Turbo

# Formatting and linting
pnpm lint            # JS/TS lint (eslint + security plugin)
pnpm --filter @x400/core-service run lint  # cargo clippy
pnpm --filter @x400/core-service exec cargo fmt --all -- --check

# Security audits
pnpm audit --prod
pnpm --filter @x400/core-service run audit

# Performance benches
pnpm --filter @x400/core-service exec cargo bench --bench submit_loop
```

## Environment Setup

1. **Node & pnpm** – Install Node 18+ and pnpm 8. `pnpm install` bootstraps the workspace.
2. **Rust toolchain** – Install the stable toolchain (`rustup toolchain install stable`). Run `cargo install cargo-audit` for security checks.
3. **Playwright browsers** – `pnpm exec playwright install --with-deps` downloads Chromium/Firefox for E2E tests.
4. **Environment variables** – The repo ships with `.env.test`. Copy to `.env` or `.env.local` to ensure mocked endpoints resolve to `http://127.0.0.1:7878`.
5. **Mock core service** – Use `pnpm --filter @x400/core-service run dev` or execute the Rust binary to provide an HTTP IPC endpoint. For tests, Playwright interceptors and the TypeScript SDK wrappers provide in-memory mocks; no vendor SDK is required.
6. **Seed data (optional)** – `pnpm tsx scripts/seed-dev.ts` posts fixture messages to a running core-service for local development.

## Writing Tests

### TypeScript (`vitest`)

- Test files use `*.spec.ts` / `*.test.ts` naming.
- Shared factories live in `@x400/shared/testing` for consistent fixtures.
- Example component test (`apps/ui-client/src/components/__tests__/ComposeDialog.spec.tsx`):
  - Render with Testing Library.
  - Interact via `@testing-library/user-event`.
  - Assert network side effects with jest-style spies (`vi.fn()`).

### Playwright

- Global config: `playwright.config.ts` launches a Vite dev server for the Tauri app shell.
- E2E test (`apps/ui-client/e2e/send-and-receive.spec.ts`) stubs IPC requests via `page.route` and verifies DR/read receipts.
- Accessibility smoke: `@axe-core/playwright` runs `axe` on page load.
- Run in headed mode for debugging: `pnpm e2e:headed`.

### Rust (`cargo test`)

- Unit tests live alongside modules (`queue.rs`, `store.rs`, `trace.rs`).
- Integration tests under `packages/core-service/tests` spawn an HTTP server using `axum` and hit real endpoints with `reqwest`.
- The mock delivery provider (`mock_provider.rs`) simulates submit → DR → read transitions for predictable flows.

## Coverage Targets

| Package                | Lines | Branches |
| ---------------------- | ----- | -------- |
| `apps/ui-client`       | ≥ 70% | ≥ 70%    |
| `packages/sdk-wrapper` | ≥ 80% | ≥ 75%    |
| `packages/cli`         | ≥ 80% | ≥ 75%    |

Coverage reports are emitted to `coverage/` per package (HTML + lcov). Use `pnpm coverage` to aggregate.

Rust coverage is optional; install [`cargo-llvm-cov`](https://github.com/taiki-e/cargo-llvm-cov) and run `cargo llvm-cov --workspace` for detailed metrics.

## Continuous Integration

GitHub Actions pipeline (`.github/workflows/ci.yml`) executes:

1. **build** – pnpm install + TypeScript/Rust builds.
2. **lint** – eslint, cargo clippy, and `cargo fmt --check`.
3. **test** – `pnpm test:all` (Vitest + cargo test).
4. **e2e** – Playwright matrix (Linux + Windows) with artifacts on failure.
5. **audit** – `pnpm audit --prod` and `cargo audit`.
6. **docs** – mkdocs-material build of the documentation portal.

Artifacts: Playwright reports (`playwright-report/`) upload on failures, and the built MkDocs site is archived per run.

## Useful Tips

- Prefer `pnpm` script invocations; they forward `NODE_OPTIONS` and workspaces automatically.
- Shared fixtures live under `test/fixtures/` and are consumed by Playwright and Rust tests.
- Use `pnpm --filter <package>` to run targeted tasks.
- When adding new IPC endpoints, update `packages/core-service/api/openapi.json` and the contract tests in `packages/sdk-wrapper/src/contract.spec.ts`.
