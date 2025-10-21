# Contributing

Thank you for investing in the X.400 Client Modernization project. Contributions are welcome from the community and internal teams. This guide covers the workflow and expectations.

## Development workflow

1. **Fork and branch** – Create feature branches from `main` using the `type/short-description` pattern (e.g., `feat/sdk-ffi`).
2. **Install dependencies** – Run `pnpm install` at the repository root.
3. **Run the stack** – Use `pnpm dev` to launch the UI, SDK wrapper, and Rust service.
4. **Add tests** – Write Vitest tests for TypeScript packages and `cargo test` coverage for Rust changes.
5. **Lint & format** – `pnpm lint` and `pnpm format` keep the codebase consistent. Rust changes should pass `cargo fmt` and `cargo clippy` (run via `pnpm --filter @x400/core-service exec`).
6. **Commit** – Follow [Conventional Commits](https://www.conventionalcommits.org/). Examples:
   - `feat(core-service): add SQLCipher configuration flag`
   - `fix(ui-client): restore keyboard shortcut handling`
7. **Pull request** – Open a PR with a clear description, testing evidence, and linked issues. CI (GitHub Actions) must pass before merging.

## Pre-commit hooks

Husky installs hooks automatically after `pnpm install`:

- `pre-commit` runs `lint-staged` to format staged files with Prettier.
- `commit-msg` validates Conventional Commit messages via Commitlint.

If hooks are skipped (e.g., via `HUSKY=0`), CI will catch formatting or commit message issues.

## Code review expectations

- Small, focused PRs are easier to review.
- Include screenshots for UI changes and describe security implications where relevant.
- Update documentation and tests alongside code changes.
- Address review feedback promptly; re-request review once updates are ready.

## Documentation

- Keep `README.md`, `ARCHITECTURE.md`, and `ROADMAP.md` in sync with implementation changes.
- Documentation site lives in `packages/docs`. Use `pnpm docs:dev` to preview and include relevant updates in your PR.

## Getting help

- Use GitHub Discussions or the project Slack channel for architectural questions.
- For security-sensitive issues follow the process outlined in [SECURITY.md](SECURITY.md).

Together we can deliver a secure, modern replacement for MailmaX.400/FileWork clients.
