# Release Process

The X.400 modernization platform follows semantic versioning (`MAJOR.MINOR.PATCH`) and publishes
artifacts for the desktop client, CLI utilities, and the Rust core service. Every release is driven
from an annotated Git tag (`v*.*.*`) and executed automatically by the GitHub Actions workflow in
`.github/workflows/release.yml`.

## Channels

| Channel  | Branch | Description                                                    |
| -------- | ------ | -------------------------------------------------------------- |
| `stable` | `main` | Production-ready builds promoted after automated verification. |
| `beta`   | `beta` | Release candidates with telemetry enabled; promoted weekly.    |
| `dev`    | `dev`  | Nightly builds with experimental features and relaxed signing. |

## Versioning and Commit Hygiene

Semantic releases are powered by [`semantic-release`](https://semantic-release.gitbook.io). The
`.releaserc.json` file configures the commit analyzer with conventional commit types:

- `feat`: triggers a **minor** release.
- `fix`, `perf`, `docs`, `refactor`: trigger a **patch** release.
- `chore`, `test`: documented but do not bump the version.

Release notes and the `CHANGELOG.md` are generated automatically from commit history.

## Signed Artifacts

Tauri bundles for Windows, macOS, and Linux are produced with signing keys provisioned via CI
secrets (`TAURI_SIGNING_PRIVATE_KEY`). CLI binaries and Rust crates are signed with the internal
GPG key (placeholder secrets in CI). Signing failures block the release.

## Release Pipeline

1. Create a tag (`git tag v1.2.3 && git push --tags`).
2. GitHub Actions builds the UI client (`tauri build`), CLI packages, and the core service crates.
3. Automated tests and telemetry checks run (`pnpm test --filter core-service...`).
4. Docs are published to GitHub Pages (`packages/docs/dist`).
5. `semantic-release` drafts GitHub release notes, publishes npm packages (`@x400/cli`,
   `@x400/support-tool`), and updates `CHANGELOG.md`.
6. Release managers validate the staged artifacts and promote to the appropriate channel.

## Rollback Strategy

- **Client UI**: distribute the previous `stable` bundle and mark the new release as deprecated.
- **CLI/Core**: publish a patch release (`x.y.z+hotfix`) reverting to the last known good commit.
- **Docs**: redeploy the previous `site` snapshot from Git history.

Always record rollbacks and mitigation steps in `docs/support-runbook.md`.
