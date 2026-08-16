# Usage

[Documentation home](../index.md) · [日本語](../ja/guide/usage.md)

## Register and publish a report

Add an HTML file inside one of the configured `content.roots`, then register it and publish the local site:

~~~bash
html-share page add reports/today.html --title "Today's report"
html-share publish
~~~

The dashboard reads the generated manifest from `.html-share/site/`. Re-run `publish` after editing a registered file.

## Open the dashboard

Use the configured Tailnet HTTPS URL from a device connected to the same Tailnet:

~~~text
https://your-device.example.ts.net:9222/app/index.html
~~~

The `/mobile` view is optimized for phone-side review. The `/inbox` view shows requests that an agent can pick up.

## Share an expiring link

Create a share link from the CLI:

~~~bash
html-share share demo-report
~~~

Share records and expiry timestamps remain in the local data directory. The link is still limited by the Tailnet boundary; it is not a public URL.

## Move a review request between devices

Use the mobile page or CLI to create a request, then inspect and complete it from the agent-side inbox:

~~~bash
html-share review inbox
html-share review complete <id>
~~~

Keep the origin on loopback and use Tailscale ACLs to control which Tailnet identities can reach it.
