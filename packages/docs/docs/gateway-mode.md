# Gateway Mode

The gateway adapter bridges X.400 traffic with SMTP and IMAP infrastructure. The simplified
implementation included with the sample project focuses on mapping X.400 O/R names to RFC822
addresses, enforcing a security allow list, and producing reports that resemble DSN/MDN
notifications.

## Address mapping

Address templates are defined in the runtime configuration (`gateway.mapping.rules`). Each rule is a
string with placeholders such as `{G}` (given name), `{S}` (surname), `{O}` (organisation) and `{C}`
(country). The adapter normalises input using ASCII transliteration and lower-case output before
attempting to match the rule.

If the template cannot be applied the adapter falls back to an alias table. Aliases are stored using
classic O/R syntax (`C=DE;O=Org;S=User`) and can be used to preserve historical addresses that do
not round-trip through the template.

## SMTP flow

1. Map all recipients to RFC822 addresses.
2. Validate the domain against the allow list defined in `gateway.security.domain_allow_list`.
3. Dispatch the message through the TLS-enforced SMTP client.
4. Persist delivery metadata for later inspection.

## IMAP flow

Inbound messages are read from the configured mailbox (IDLE or polling). The adapter converts the
sender address back to an O/R representation and passes the payload to the X.400 submission
pipeline. Reports (DSN/MDN) are mapped using the same helper that created outbound notifications.

## Preview utility

The user interface exposes a "Gateway preview" panel that allows operators to validate how a given
O/R name would be translated. The CLI exposes the same capability through
`x400-cli gateway send` and `x400-cli gateway inbound --peek` to inspect the synthetic IMAP queue.
