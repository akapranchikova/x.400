# Roadmap

The roadmap tracks modernization milestones and highlights dependencies, risks, and mitigations. Status icons: ✅ complete, 🚧 in progress, ⏳ planned.

## Release phases

| Release    | Objectives                                               | Status |
| ---------- | -------------------------------------------------------- | ------ |
| MVP        | Mock transport, SQLite persistence, CLI verbs, docs site | ✅     |
| Parity     | Vendor SDK integration, SQLCipher, migration tooling     | 🚧     |
| Extensions | Real-time events, policy engine, observability           | ⏳     |

## Milestones

### MVP (Complete)

- ✅ Turbo + pnpm monorepo scaffold
- ✅ Rust core service with HTTP IPC and mock queue/store
- ✅ React + Tauri desktop shell with folders, messages, compose, settings
- ✅ CLI with FW_SI-compatible verbs hitting IPC endpoints
- ✅ MkDocs documentation with security, migration, and roadmap guides

### Parity (Active)

- ✅ Integrate vendor X.400 SDK via FFI bindings in `packages/sdk-wrapper`
- ✅ Harden SQLite with SQLCipher, leveraging OS keychains for key retrieval
- 🚧 Build FWM/FWZ import pipeline (UI wizard + CLI support)
- 🚧 Expand automated tests: Vitest component tests, cargo integration tests

### Extensions (Planned)

- ⏳ Streaming notification channel for live badge updates
- ⏳ Policy-driven submit strategies (DLP, manual approval, escalation)
- ⏳ Observability exports: trace bundle uploader, SIEM integration, metrics

## Risks & Mitigations

| Risk                                        | Impact | Mitigation                                                                    |
| ------------------------------------------- | ------ | ----------------------------------------------------------------------------- |
| Vendor SDK licensing or availability delays | High   | Mock transport keeps development unblocked; engage vendor early               |
| SQLCipher performance overhead              | Medium | Benchmark with representative datasets, tune pragmas, provide feature flags   |
| Code-signing certificate procurement        | Medium | Document platform-specific processes, automate signing in CI                  |
| Migration data quality issues               | Medium | Provide dry-run mode, generate detailed reports, validate with shared schemas |

## Next review

Roadmap is reviewed at the beginning of each sprint. Update this file and `packages/docs/docs/roadmap.md` when milestone status changes.
