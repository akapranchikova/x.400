# CLI Reference (FW_SI compatibility)

The `x400-cli` command recreates FW_SI.EXE verbs for scripting scenarios. Every command communicates with the local IPC service via the SDK wrapper and prints JSON output for easy consumption by automation tools.

```bash
Usage: x400-cli [options] [command]

Options:
  --base-url <url>  Base URL of the local IPC endpoint (default: "http://127.0.0.1:7878")
  -h, --help        display help for command

Commands:
  list [options]       List folders or message envelopes
  access --id <id>     Fetch a message and display all details
  create [options]     Submit a message to the queue
  delete --id <id>     Remove a message from the store
  move [options]       Move a message between folders
  archive --id <id>    Archive a message
  wait [options]       Wait for the outbox queue to flush
  message --id <id>    Display a summary for a message
```

## Examples

### List inbox messages

```bash
x400-cli list --folder inbox | jq
```

### Submit a message

```bash
x400-cli create \
  --from "C=DE;O=Modernization;S=Operator" \
  --to "C=DE;O=Modernization;S=Recipient" \
  --subject "Modern client" \
  --body "This is a mock submission." | jq
```

### Wait for delivery

```bash
x400-cli wait --timeout 120
```

When integrating with legacy scripts, pipe the JSON into familiar parsing utilities or wrap the CLI with PowerShell/Unix shell functions. Future releases will add structured logging export and trace bundle download helpers.
