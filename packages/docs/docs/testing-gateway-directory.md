# Testing the Gateway and Directory Components

The project ships with mocked SMTP, IMAP, and LDAP clients to keep integration tests self-contained.

## Unit tests

- Address mapping rules and alias fallbacks (`packages/core-service/src/gateway/address_map.rs`).
- Delivery report conversions (`packages/core-service/src/gateway/report_map.rs`).
- Directory cache eviction (`packages/core-service/src/directory/cache.rs`).

Run with:

```bash
pnpm -w test --filter core-service
```

## Integration tests

The `gateway-tests` and `directory-tests` CI jobs spin up mock servers defined in `docker-compose.yml`
and execute the accompanying test suites. Locally, you can trigger the same workflows with Turbo:

```bash
pnpm turbo run gateway-tests
pnpm turbo run directory-tests
```

## UI regression tests

Playwright scenarios cover the advanced search dialog, keyboard shortcuts, and the compose
autocomplete path. Use the workspace root to execute:

```bash
pnpm -w test --filter ui-client -- --runInBand
```

## Manual checklist

1. Run `x400-cli gateway send` against the mock service and confirm the status output.
2. Inspect `x400-cli directory search --query Example` to verify cache warm-up (look for repeated
   queries responding instantly).
3. Use the UI quick-search `/` shortcut, save a filter, trigger gateway preview, and ensure the status
   bar updates.
