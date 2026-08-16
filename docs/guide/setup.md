# Setup

[Documentation home](../index.md) · [日本語](../ja/guide/setup.md)

HTML Share keeps HTML and review state on the host PC. Tailscale Serve forwards a Tailnet HTTPS endpoint to the local server; no AWS account or external hosting is required.

## Requirements

- Node.js 22 or newer
- Tailscale installed on the host PC
- The phone and host PC connected to the same Tailnet
- An agent such as Claude Code or Codex is optional

## Install

From a clean checkout:

~~~bash
git clone https://github.com/Sunwood-ai-labs/html-share-tailscale.git
cd html-share-tailscale
npm ci
npm run build
npm link
cp html-share.config.example.yaml html-share.config.yaml
cp .env.example .env
~~~

In Windows PowerShell, replace `cp` with `Copy-Item`.

## Configure private values

Keep machine-specific values in `.env`. It is ignored by Git. The YAML file controls the page list and content roots; environment variables override the server and Tailnet values.

~~~dotenv
HTML_SHARE_PUBLIC_URL=https://your-device.example.ts.net:9222
HTML_SHARE_TAILSCALE_HOSTNAME=your-device.example.ts.net
HTML_SHARE_TAILSCALE_HTTPS_PORT=9222
~~~

The local server must remain loopback-only:

~~~yaml
server:
  host: 127.0.0.1
~~~

Do not copy a real Tailnet hostname, token, IP address, or business data into a tracked example or documentation page.

## Start

Run the publish, local server, and Serve setup from separate terminals:

~~~bash
html-share publish
html-share serve
html-share tailscale serve
~~~

`html-share serve` binds the local HTTP server to `127.0.0.1`. `html-share tailscale serve` calls the Tailscale CLI with the configured HTTPS port and forwards it to the local origin.

Open this path from a Tailnet-connected device:

~~~text
https://your-device.example.ts.net:9222/app/index.html
~~~

Do not use Tailscale Funnel for this app.

## Add a page

~~~bash
html-share page add reports/today.html --title "Today's report"
html-share publish
~~~

The path must be inside one of the configured `content.roots`. The CLI does not automatically collect agent threads; register the HTML you want to share.

## Review handoff

- Use `/mobile` to send a review request to the phone.
- Use `/inbox` to let an agent pick up a request placed from the phone.
- Use `html-share review inbox` and `html-share review complete <id...>` from the CLI when working without the dashboard.

Review data is saved beneath `server.dataDir`, which defaults to `.html-share/data`.

## Verify

~~~bash
curl http://127.0.0.1:4311/api/health
curl -I https://your-device.example.ts.net:9222/app/index.html
npm run verify
~~~

The first request checks the local process. The second checks the Tailscale HTTPS route from a device that is actually connected to the Tailnet.
