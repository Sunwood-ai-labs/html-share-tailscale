# Threat model

[Documentation home](../index.md) · [日本語](../ja/guide/threat-model.md)

This project is designed for a private Tailnet, not as a public hosting service.

## Assets

- Unpublished HTML reports
- Review requests and responses
- Read marks, stars, and dashboard preferences
- Expiring share-link tokens
- Local configuration and content-root choices

## Intended boundary

- Tailscale ACLs decide which Tailnet identities can reach the host.
- The HTTP server binds to loopback by default.
- Tailscale Serve is the explicit entry point.
- The repository ignores `.env`, local YAML configuration, and `.html-share/`.

## Trust assumptions

- The Tailnet and its ACL administrators are trusted.
- The host PC and connected client devices are maintained.
- Registered HTML is trusted enough to run in the viewer's browser.
- Operators keep real hostnames, IP addresses, tokens, and business data out of tracked examples.

## Important limitations

- Tailscale ACLs do not protect a compromised Tailnet device.
- A viewer can save content after opening it; an expiring link cannot recall a copy.
- Registered HTML can execute JavaScript and should be reviewed before sharing.
- The app does not stop an operator from adding a separate public proxy or Tailscale Funnel.
- This is not a replacement for application-level identity, audit logging, or enterprise DLP.

## Safe operating rule

Keep the origin on loopback, use Tailnet ACLs deliberately, use `.env` for machine-specific values, and only register HTML that you trust. If the intended audience is outside your Tailnet, choose a separate product designed for public publishing rather than changing this boundary casually.
