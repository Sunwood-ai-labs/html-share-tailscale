# Architecture

[Documentation home](../index.md) · [日本語](../ja/guide/architecture.md)

The app has one local origin and one intentional network entry point:

~~~text
HTML + html-share.config.yaml
            │
            ▼
      html-share publish
            │
            ├─ .html-share/site/  static app + page manifest
            ├─ .html-share/data/  review state + share tokens
            │
            ▼
  127.0.0.1:4311 local HTTP server
            │
            ▼
  Tailscale Serve HTTPS (*.ts.net)
            │
            ▼
     Tailnet phone / PC
~~~

## Runtime units

- `src/bundle.ts` bundles approved local assets and creates the page manifest.
- `src/publish.ts` copies the dashboard and registered pages into `.html-share/site/` and creates expiring Tailnet links.
- `src/local-server.ts` serves static files and the review/settings APIs from the same origin.
- `src/local-state.ts` persists JSON state through temporary files.
- `src/review-client.ts` moves review cards between a PC-side agent and the local API.

## Storage boundary

The generated site and mutable state are separate:

- `.html-share/site/` is the published, browser-readable site.
- `.html-share/data/` contains preferences, reviews, and share records.
- `html-share.config.yaml` and `.env` remain local configuration files.

The server only serves files beneath the generated site root. It does not expose the repository, the configuration file, or the data directory as static content.

## Tailnet boundary

The app listens on loopback. Tailscale Serve is the user-configured HTTPS proxy to that origin. Access outside the Tailnet is not part of the intended design, and the app does not add a public internet authentication layer.

## Expiring links and reviews

`html-share share` and the dashboard share action write a random token plus an expiry to local state. The server checks both before returning a page.

Phone-originated requests go to `/api/owner/reviews` and are stored as `inbox` items. They can be completed from a paired PC or the dashboard. The inbox is a handoff queue, not a progress tracker.
