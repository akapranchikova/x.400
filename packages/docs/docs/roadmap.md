# Roadmap & Status

The roadmap mirrors the standalone `ROADMAP.md` file and adds more context for stakeholders.

## Release phases

| Phase      | Goals                                                    | Status         |
| ---------- | -------------------------------------------------------- | -------------- |
| MVP        | Mock transport, SQLite store, CLI skeleton, UI shell     | ✅ Delivered   |
| Parity     | SDK integration, FWM/FWZ import, automated reports       | 🚧 In progress |
| Extensions | Real-time notifications, advanced tracing, policy engine | ⏳ Planned     |

## Detailed milestones

### MVP

- ✅ Monorepo scaffold with pnpm + Turbo
- ✅ Mock Rust service with HTTP IPC
- ✅ React + Tauri UI showing folders, messages, and compose dialog
- ✅ CLI reproducing key FW_SI verbs
- ✅ MkDocs documentation portal

### Parity

- ✅ Integrate vendor X.400 SDK via FFI
- ✅ Complete SQLCipher hardening with keychain integration
- 🚧 Deliver migration tooling for FWM/FWZ archives
- 🚧 Expand Vitest and cargo test coverage

### Extensions

- ⏳ Streaming push channel for live folder updates
- ⏳ Policy-driven submit strategies (DLP, escalation flows)
- ⏳ SIEM integrations and trace bundle uploads

## Risks

| Risk                           | Impact | Mitigation                                                                        |
| ------------------------------ | ------ | --------------------------------------------------------------------------------- |
| Vendor SDK licensing           | High   | Engage legal and procurement early; mock transport keeps engineers unblocked      |
| SQLCipher performance overhead | Medium | Benchmark with representative archives, tune page size, and prepare read replicas |
| Code signing complexity        | Medium | Provide platform-specific guides and automation scripts                           |

The roadmap is reviewed at the start of each sprint. Contributions should align with the current phase and include updates to this document.
