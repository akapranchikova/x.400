# Directory Integration

The directory module adds a thin LDAP/X.500 abstraction that can be used for address autocomplete,
contact lookup, and distribution list expansion.

## Configuration

Directory settings live in `directory.*` keys of the core-service configuration file:

- `directory.ldap.url` – LDAP or LDAPS connection string.
- `directory.ldap.baseDN` – root of the directory tree.
- `directory.ldap.filterPerson` – filter used for autocomplete queries.
- `directory.cache.ttlSeconds` – cache TTL for resolved entries.
- `directory.cache.capacity` – maximum number of cached entries.

## Client behaviour

The `LdapDirectoryClient` stores results in an in-memory cache with TTL semantics to reduce round
trips. API consumers can opt-in to background synchronisation via `DirectorySync` to warm the cache
with distribution lists or frequently accessed organisational units.

Autocomplete is exposed by the UI compose dialog and returns display names combined with RFC822
addresses for faster entry.

## CLI usage

```bash
x400-cli directory search --query "Müller"
x400-cli directory entry --id 42 --json
x400-cli directory dl --id operations
```

Each command supports `--json` output for automation and scripting scenarios.
