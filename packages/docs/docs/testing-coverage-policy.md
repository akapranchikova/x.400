# Testing Coverage & Quality Policy

The modernization client enforces a consistent testing strategy across all packages. This page captures the thresholds, tooling, and workflows introduced to harden the suite.

## Coverage thresholds

| Package / Area                 | Lines       | Branches |
| ------------------------------ | ----------- | -------- |
| `apps/ui-client`               | ≥ 80%       | ≥ 80%    |
| `packages/sdk-wrapper`         | ≥ 90%       | ≥ 85%    |
| `packages/cli`                 | ≥ 90%       | ≥ 85%    |
| `packages/shared`              | ≥ 95%       | ≥ 90%    |
| `packages/core-service` (Rust) | ≥ 85% lines |

Coverage is enforced locally via the Vitest configuration in each package and through the `coverage-ts` and `coverage-rust` jobs in CI. Failing to meet the threshold fails the workflow.

### Running locally

```bash
pnpm test:cov             # Aggregated TypeScript coverage via Vitest/c8
pnpm --filter @x400/core-service run coverage  # Rust coverage via cargo-llvm-cov
```

Coverage reports are emitted in `coverage/` within each package (TypeScript) and `packages/core-service/coverage/` (Rust, including HTML and lcov output).

## Property-based and fuzz testing

- TypeScript packages share deterministic generators via `@x400/shared/testing/arb`. Property suites in the CLI, SDK wrapper, shared schemas, and UI rely on these helpers.
- Rust uses `proptest` to cover the address mapper and new `.FWM` / `.FWZ` parsers.
- `cargo-fuzz` targets (`address_map`, `fwm_parser`) provide fast smoke runs in CI (`fuzz-smoke` job). Crashes are uploaded as workflow artifacts.

Run locally:

```bash
pnpm --filter @x400/shared run test:prop
pnpm --filter @x400/cli run test:prop
pnpm --filter @x400/sdk-wrapper run test:prop
pnpm --filter ui-client run test:prop
pnpm --filter @x400/core-service exec cargo test -- --ignored proptest
pnpm --filter @x400/core-service run fuzz:smoke
```

## Mutation guardrails

A lightweight mutation harness (`scripts/mutation-runner.mjs`) mutates critical hot paths (UI boolean parsing, CLI OR parsing, SDK transport status, shared ZIP conversions) and executes the relevant test suites. The `mutation` CI job enforces minimum scores (UI ≥70%, other packages ≥80%).

Run locally with `pnpm test:mut`. Results are printed per package; any surviving mutant fails the command.

## Visual, accessibility, and chaos E2E

Playwright scenarios cover:

- Core compose/submit/read flow (existing `send-and-receive` spec).
- New snapshot/a11y coverage (`pnpm e2e:vr`, `pnpm e2e:a11y`) using `@axe-core/playwright` and deterministic mock fixtures.
- Chaos tolerance via transient IPC failures (`chaos.spec.ts`).

Visual diffs live in `apps/ui-client/e2e/__snapshots__`, with traces and videos uploaded when CI retries tests.

## Contract drift

The `contract-check` job verifies that `packages/core-service/api/openapi.json` matches the recorded hash stored in `packages/sdk-wrapper/.openapi-hash`. Update the hash with:

```bash
pnpm contract:update
```

Any spec change should be accompanied by client regeneration and documentation updates.

## Performance smoke

`pnpm perf:smoke` runs a Node-based latency probe and the Criterion bench for the Rust address mapper. The CI job uploads benchmark summaries and fails when latency exceeds guardrails (average ≤25 ms, p95 ≤60 ms).

## Flake handling & debugging playbook

1. Reproduce locally with the specific command (`pnpm e2e`, `pnpm e2e:vr`, etc.).
2. Inspect artifacts (coverage HTML, Playwright reports, fuzz crashes) from the CI run.
3. Quarantine flaky Playwright specs by tagging with `@flaky` and referencing the GitHub issue; CI treats quarantined specs as non-blocking but they carry an SLA of 48 h for remediation.
4. Use deterministic seeds from `@x400/shared/testing/arb` or the new chaos controls to reproduce timing-dependent failures.

## Useful commands summary

```bash
pnpm test:cov
pnpm e2e && pnpm e2e:vr && pnpm e2e:a11y
pnpm test:mut
cargo llvm-cov --workspace --html
```

CI artifacts (coverage, fuzz outputs, Playwright traces, visual diffs) are uploaded for every run of the respective jobs and can be found in the GitHub Actions summary for the workflow.
