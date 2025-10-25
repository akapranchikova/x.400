# UI Enhancements: Advanced Search & Shortcuts

The web client now features an advanced search dialog, saved filters, keyboard shortcuts, and a
status bar that surfaces gateway and directory activity.

## Advanced search dialog

Press `Ctrl+F` or use the header button to open the advanced search dialog. Operators can filter by
sender, recipient, status, attachment presence, and date range. Applying a filter updates the message
list and the quick-search pill. Filters can be saved for reuse via the "Save current filter" control.

## Saved filters

Saved filters appear below the header as clickable chips. Selecting a saved filter immediately
re-applies the stored query. Filters are stored in-memory for the session.

## Keyboard shortcuts

- `/` – focus the quick search input.
- `j` / `k` – move message selection down or up.
- `Enter` – open the compose dialog when the list is focused.
- `n` – start composing a new message.
- `Ctrl+Enter` – send from the compose dialog.

## Gateway preview

A dedicated gateway preview panel lives next to the message list. It prompts for an O/R address and
renders the mapped RFC822 address together with warnings. The preview reuses the gateway adapter
endpoint exposed by the IPC service.

## Status bar updates

The status bar now reports TLS health, transport mode, last sync time, gateway preview status, and
whether the directory cache has been warmed by autocomplete requests.
