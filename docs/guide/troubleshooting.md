# Troubleshooting

[Documentation home](../index.md) · [日本語](../ja/guide/troubleshooting.md)

## The config file is not found

Create the ignored local files from the examples:

~~~powershell
Copy-Item html-share.config.example.yaml html-share.config.yaml
Copy-Item .env.example .env
~~~

Run commands from the repository root, or pass `--config path/to/html-share.config.yaml`.

## The URL fails validation

`server.publicUrl` and `HTML_SHARE_PUBLIC_URL` must be:

- HTTPS
- A hostname under `*.ts.net`
- Free of credentials, query strings, hashes, and paths
- Consistent with `server.tailscale.hostname` and `HTML_SHARE_TAILSCALE_HOSTNAME`
- Using the same port as `server.tailscale.httpsPort` and `HTML_SHARE_TAILSCALE_HTTPS_PORT`

Use a placeholder in tracked examples; put your real hostname in `.env`.

## The local server will not start

Check whether port 4311 is already in use. Keep `server.host` set to `127.0.0.1`; the configuration intentionally rejects a LAN-wide bind such as `0.0.0.0`.

## Tailscale Serve returns an error

Confirm that:

1. Tailscale is logged in on the host PC.
2. The phone is connected to the same Tailnet.
3. The HTTPS port in `.env` matches the port in the Serve command.
4. The local health endpoint responds first:

~~~bash
curl http://127.0.0.1:4311/api/health
~~~

Do not reset unrelated Serve configuration or enable Funnel as a workaround.

## The dashboard is empty

Run `html-share page add ...` for a page under one of `content.roots`, then run `html-share publish`. The CLI does not infer pages from agent threads.

## A review request is missing

Use `html-share review inbox` to list waiting requests. The request may already be completed; the inbox intentionally has only handoff states, not a separate “picked up” state.
