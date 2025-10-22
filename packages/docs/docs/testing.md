# Testing Guide

This page summarises how to exercise the modernised X.400 client test harness across every package.

## Strategy Overview

- **Unit tests** – Vitest (TS) and `cargo test` (Rust) cover schemas, components, queue/store managers, and CLI utilities.
- **Integration tests** – The Rust core-service spins up an Axum server while CLI/SDK tests mock transports against recorded fixtures.
- **Contract tests** – `packages/core-service/api/openapi.json` is validated by `packages/sdk-wrapper/src/contract.spec.ts` using Swagger Parser and OpenAPI Client Axios.
- **End-to-end** – Playwright drives the React/Tauri UI (`apps/ui-client/e2e/send-and-receive.spec.ts`) with mocked IPC routes, including accessibility smoke checks via `@axe-core/playwright`.
- **Performance** – `cargo bench --bench submit_loop` runs a Criterion micro-benchmark around the compose/submit loop.
- **Security** – `pnpm audit --prod`, `cargo audit`, and `eslint-plugin-security` flag dependency or source-level vulnerabilities.

## Commands

| Goal | Command |
| --- | --- |
| Install dependencies | `pnpm install` |
| Unit + integration tests | `pnpm test:all` |
| UI component tests | `pnpm test:ui` |
| SDK wrapper tests & contracts | `pnpm test:sdk` |
| CLI unit/integration | `pnpm test:cli` |
| Rust core-service tests | `pnpm test:core` |
| Playwright E2E (headless / headed) | `pnpm e2e` / `pnpm e2e:headed` |
| Coverage reports | `pnpm coverage` (plus per-package `coverage` scripts) |
| Linting | `pnpm lint`, `pnpm --filter @x400/core-service run lint` |
| Security audits | `pnpm audit --prod`, `pnpm --filter @x400/core-service run audit` |

### Environment Tips

1. Copy `.env.test` to `.env.local` to configure mock URLs (`http://127.0.0.1:7878`).
2. Install Playwright browsers: `pnpm exec playwright install --with-deps`.
3. Seed development data (optional): `pnpm tsx scripts/seed-dev.ts` against a running `@x400/core-service` instance.
4. Shared fixtures live in `test/fixtures/` and in `@x400/shared/testing` factories.

### Coverage Targets

- UI client: **≥ 70% lines / branches**
- SDK wrapper: **≥ 80% lines / ≥ 75% branches**
- CLI: **≥ 80% lines / ≥ 75% branches**

Rust coverage is optional via [`cargo-llvm-cov`](https://github.com/taiki-e/cargo-llvm-cov).

### CI Pipeline

The GitHub Actions workflow runs the following jobs on every pull request:

1. **build** – workspace install & compilation.
2. **lint** – eslint, cargo clippy, cargo fmt checks.
3. **test** – `pnpm test:all` (Vitest + cargo test suites).
4. **e2e** – Playwright matrix (`ubuntu-latest`, `windows-latest`), with reports uploaded on failure.
5. **audit** – npm/pnpm + cargo security scans.
6. **docs** – MkDocs Material build for documentation.

Artifacts include Playwright reports and the generated `packages/docs/site` bundle.

## Testing Status

| Check | Badge |
| --- | --- |
| Tests | ![Tests](https://img.shields.io/badge/tests-passing-green) |
| Coverage | ![Coverage](https://img.shields.io/badge/coverage-80%25-blue) |
| Docs | ![Docs](https://img.shields.io/badge/docs-ready-success) |

Use these commands locally before pushing to ensure parity with CI.
