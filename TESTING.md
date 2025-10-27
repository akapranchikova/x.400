# Testing Guide

The X.400 client monorepo includes TypeScript, Rust, and Playwright projects. This guide explains how to execute the full testing strategy locally and in CI.

## Test Taxonomy

| Layer                 | Purpose                                                                          | Tooling                                               |
| --------------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------- |
| **Unit**              | Validate individual utilities, hooks, and managers.                              | `vitest`, `cargo test`                                |
| **Integration**       | Exercise IPC flows between SDK wrapper, CLI, and core-service.                   | `vitest`, `cargo test`, Playwright route mocks        |
| **Property-based**    | Stress validation and parsing invariants with deterministic randomness.          | `@x400/shared/testing/arb`, `proptest`                |
| **Contract**          | Ensure the OpenAPI contract matches generated clients.                           | Hash guard (`pnpm contract:check`), `serde_json`      |
| **End-to-end (E2E)**  | Simulate a user composing, submitting, and receiving delivery reports in the UI. | Playwright + Tauri/Vite preview                       |
| **Performance smoke** | Benchmark high-risk loops and latency.                                           | `scripts/perf-smoke.mjs`, Criterion benches           |
| **Security**          | Scan dependencies and lint for risky patterns.                                   | `pnpm audit`, `cargo audit`, `eslint-plugin-security` |

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

# Property-based test slices
pnpm --filter ui-client run test:prop
pnpm --filter @x400/sdk-wrapper run test:prop
pnpm --filter @x400/cli run test:prop
pnpm --filter @x400/shared run test:prop

# Playwright end-to-end scenarios
pnpm e2e             # headless
pnpm e2e:headed      # headed mode with UI
pnpm e2e:vr          # visual regression snapshots
pnpm e2e:a11y        # accessibility smoke with axe-core

# Coverage reports
pnpm test:cov        # aggregate Vitest coverage via Turbo
pnpm --filter @x400/core-service run coverage

# Formatting and linting
pnpm lint            # JS/TS lint (eslint + security plugin)
pnpm --filter @x400/core-service run lint  # cargo clippy
pnpm --filter @x400/core-service exec cargo fmt --all -- --check

# Security audits
pnpm audit --prod
pnpm --filter @x400/core-service run audit

# Performance & mutation smoke
pnpm perf:smoke
pnpm test:mut
```

| Package                        | Lines | Branches |
| ------------------------------ | ----- | -------- |
| `apps/ui-client`               | ≥ 80% | ≥ 80%    |
| `packages/sdk-wrapper`         | ≥ 90% | ≥ 85%    |
| `packages/cli`                 | ≥ 90% | ≥ 85%    |
| `packages/shared`              | ≥ 95% | ≥ 90%    |
| `packages/core-service` (Rust) | ≥ 85% | –        |

Coverage reports are emitted to `coverage/` per package (HTML + lcov). See [`testing-coverage-policy.md`](packages/docs/docs/testing-coverage-policy.md) for the full policy, commands, and CI gates. Rust coverage uses [`cargo-llvm-cov`](https://github.com/taiki-e/cargo-llvm-cov) via `pnpm --filter @x400/core-service run coverage`.

### Mutation harness

`scripts/mutation-runner.mjs` mutates high-risk branches in the UI, CLI, SDK wrapper, and shared utilities. Run `pnpm test:mut`; the command fails if the kill ratio dips below the package thresholds (UI ≥70%, others ≥80%).

## Continuous Integration

GitHub Actions pipeline (`.github/workflows/ci.yml`) executes:

1. **build** – pnpm install + TypeScript/Rust builds.
2. **lint** – eslint, cargo clippy, and `cargo fmt --check`.
3. **test** – `pnpm test:all` (Vitest + cargo test).
4. **coverage-ts** – `pnpm test:cov` with lcov uploads for each package.
5. **coverage-rust** – `pnpm --filter @x400/core-service run coverage` (cargo-llvm-cov HTML + lcov).
6. **mutation** – `pnpm test:mut` mutation harness.
7. **fuzz-smoke** – `pnpm --filter @x400/core-service run fuzz:smoke` (artifacts uploaded on failure).
8. **contract-check** – `pnpm contract:check` compares the OpenAPI hash.
9. **e2e** – Playwright matrix (Linux + Windows) for functional flows.
10. **e2e-visual-a11y** – Visual regression + axe smoke on Linux.
11. **audit** – `pnpm audit --prod` and `cargo audit`.
12. **docs** – mkdocs-material build of the documentation portal.

Artifacts: coverage directories, fuzz crash outputs, Playwright reports/snapshots, and the built MkDocs site are uploaded per run.

## Useful Tips

- Prefer `pnpm` script invocations; they forward `NODE_OPTIONS` and workspaces automatically.
- Shared fixtures live under `test/fixtures/` and are consumed by Playwright and Rust tests.
- Use `pnpm --filter <package>` to run targeted tasks.
- When adding new IPC endpoints, update `packages/core-service/api/openapi.json` and the contract tests in `packages/sdk-wrapper/src/contract.spec.ts`.
- See [`packages/docs/docs/testing-telemetry-support.md`](packages/docs/docs/testing-telemetry-support.md) for telemetry-specific test scenarios and privacy validation steps.
